import { DEMO_LOCATION, DEMO_MEMBERS, sanitizeSession, signalsFor, vote, winner, type Session } from './core';
import { recommend } from './providers';
import { completeLocation, handleDiscord, type LocationHandoff } from './discord';

type Env = { DB: D1Database; ASSETS: Fetcher; QLOO_API_KEY?: string; DISCORD_PUBLIC_KEY?: string; DISCORD_BOT_TOKEN?: string; DISCORD_APPLICATION_ID?: string };
const json = (value: unknown, status = 200) => Response.json(value, status === 200 ? { headers: { 'Cache-Control': 'no-store' } } : { status, headers: { 'Cache-Control': 'no-store' } });
const bad = (message: string, status = 400) => json({ error: message }, status);
const clean = (value: unknown, max = 300) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const number = (value: unknown, min: number, max: number) => { const n = Number(value); return Number.isFinite(n) && n >= min && n <= max ? n : undefined; };
const handoffId = (value: string) => /^[a-f0-9-]{36}$/i.test(value);

async function readPlan(db: D1Database, id: string): Promise<Session | null> {
  const row = await db.prepare('SELECT body FROM plans WHERE id = ? AND expires_at > ?').bind(id, Date.now()).first<{ body: string }>();
  return row ? JSON.parse(row.body) as Session : null;
}
async function insertPlan(db: D1Database, plan: Session): Promise<void> {
  await db.prepare('INSERT INTO plans (id,version,body,expires_at) VALUES (?,?,?,?)').bind(plan.id, plan.version, JSON.stringify(plan), plan.createdAt + 7 * 86400000).run();
}
async function updatePlan(db: D1Database, old: Session, next: Session): Promise<boolean> {
  const result = await db.prepare('UPDATE plans SET version = ?, body = ? WHERE id = ? AND version = ?').bind(next.version, JSON.stringify(next), old.id, old.version).run();
  return result.meta.changes === 1;
}
async function createHandoff(db: D1Database, handoff: LocationHandoff): Promise<void> {
  await db.prepare('INSERT INTO pending_locations (id,body,expires_at) VALUES (?,?,?)').bind(handoff.id, JSON.stringify(handoff), handoff.expiresAt).run();
}
async function takeHandoff(db: D1Database, id: string): Promise<LocationHandoff | null> {
  const now = Date.now();
  const row = await db.prepare('SELECT body FROM pending_locations WHERE id = ? AND expires_at > ? AND used_at IS NULL').bind(id, now).first<{ body: string }>();
  if (!row) return null;
  const claimed = await db.prepare('UPDATE pending_locations SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?').bind(now, id, now).run();
  return claimed.meta.changes === 1 ? JSON.parse(row.body) as LocationHandoff : null;
}
function demoSession(): Session {
  const members = DEMO_MEMBERS.map(member => ({ ...member, tastes: [...member.tastes] }));
  return { id: crypto.randomUUID(), request: 'What should we do in Williamsburg tonight?', location: DEMO_LOCATION, members, signals: signalsFor(members), note: '', radiusKm: 2, options: [], votes: {}, source: 'qloo', createdAt: Date.now(), version: 0 };
}
const store = (db: D1Database) => ({ read: (id: string) => readPlan(db, id), insert: (plan: Session) => insertPlan(db, plan), update: (old: Session, next: Session) => updatePlan(db, old, next), createHandoff: (handoff: LocationHandoff) => createHandoff(db, handoff) });

async function handleLocationHandoff(request: Request, env: Env, id: string): Promise<Response> {
  if (request.method !== 'POST') return bad('Method not allowed', 405);
  if (!handoffId(id)) return bad('Location link is invalid or expired.', 404);
  const body = await request.json() as Record<string, unknown>;
  const lat = number(body.lat, -90, 90), lon = number(body.lon, -180, 180);
  if (lat === undefined || lon === undefined) return bad('Location coordinates are invalid.');
  const handoff = await takeHandoff(env.DB, id);
  if (!handoff) return bad('This location link is invalid, expired, or already used.', 404);
  try { await completeLocation(handoff, { lat, lon }, env, store(env.DB)); }
  catch (error) {
    await env.DB.prepare('UPDATE pending_locations SET used_at = NULL WHERE id = ?').bind(id).run();
    return bad(error instanceof Error ? error.message : 'Encore could not finish the plan. Try again.', 503);
  }
  return json({ posted: true });
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const locationMatch = url.pathname.match(/^\/api\/location-handoffs\/([a-f0-9-]+)$/);
  if (locationMatch) return handleLocationHandoff(request, env, locationMatch[1]);
  if (url.pathname === '/api/demo' && request.method === 'POST') {
    const plan = demoSession();
    const fixture = url.searchParams.get('fixture') === '1' && ['localhost', '127.0.0.1'].includes(url.hostname);
    const rec = await recommend(plan, env, fixture ? 'fixture' : 'production');
    Object.assign(plan, rec);
    await insertPlan(env.DB, plan);
    return json(plan, 201);
  }
  const match = url.pathname.match(/^\/api\/plans\/([a-f0-9-]+)(?:\/(vote|revise))?$/);
  if (!match) return bad('Not found', 404);
  const old = await readPlan(env.DB, match[1]);
  if (!old) return bad('Plan not found or expired', 404);
  if (!match[2] && request.method === 'GET') return json({ ...old, winner: winner(old) });
  if (old.discord) return bad('Discord plans can only be changed in Discord.', 403);
  if (request.method !== 'POST') return bad('Method not allowed', 405);
  const body = await request.json() as Record<string, unknown>;
  let next: Session;
  if (match[2] === 'vote') {
    try { next = vote(old, clean(body.memberId, 40), clean(body.optionId, 80)); }
    catch (error) { return bad((error as Error).message); }
  } else {
    const radiusKm = body.radiusKm === undefined ? old.radiusKm : number(body.radiusKm, 0.1, 10);
    const budget = body.budget === '' || body.budget === null ? undefined : body.budget === undefined ? old.budget : number(body.budget, 1, 500);
    const note = clean(body.note);
    if (radiusKm === undefined || (body.budget !== undefined && body.budget !== '' && body.budget !== null && budget === undefined)) return bad('Budget or walking radius is invalid.');
    next = { ...old, note, budget, radiusKm, signals: signalsFor(old.members, note), votes: {}, version: old.version + 1 };
    const fixture = old.source === 'fixture' && ['localhost', '127.0.0.1'].includes(url.hostname);
    const rec = await recommend(next, env, fixture ? 'fixture' : 'production');
    next = sanitizeSession({ ...next, ...rec });
  }
  if (!await updatePlan(env.DB, old, next)) return bad('Plan changed. Refresh and try again.', 409);
  return json({ ...next, winner: winner(next) });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      if (new URL(request.url).pathname === '/discord/interactions' && request.method === 'POST') return await handleDiscord(request, env, ctx, store(env.DB));
      if (new URL(request.url).pathname.startsWith('/api/')) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return bad(error instanceof Error ? error.message : 'Something went wrong. Please try again.', 503);
    }
  },
  async scheduled(_event: ScheduledController, env: Env): Promise<void> { await env.DB.batch([env.DB.prepare('DELETE FROM plans WHERE expires_at <= ?').bind(Date.now()), env.DB.prepare('DELETE FROM pending_locations WHERE expires_at <= ?').bind(Date.now())]); },
} satisfies ExportedHandler<Env>;
