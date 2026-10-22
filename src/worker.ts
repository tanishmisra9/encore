import { DEMO_LOCATION, DEMO_MEMBERS, resolveLocation, sanitizeSession, signalsFor, vote, winner, type Session } from './core';
import { recommend } from './providers';
import { handleDiscord } from './discord';

type Env = { DB: D1Database; ASSETS: Fetcher; QLOO_API_KEY?: string; DISCORD_PUBLIC_KEY?: string; DISCORD_BOT_TOKEN?: string; DISCORD_APPLICATION_ID?: string };
const json = (value: unknown, status = 200) => Response.json(value, status === 200 ? { headers: { 'Cache-Control': 'no-store' } } : { status, headers: { 'Cache-Control': 'no-store' } });
const bad = (message: string, status = 400) => json({ error: message }, status);
const clean = (value: unknown, max = 300) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const number = (value: unknown, min: number, max: number) => { const n = Number(value); return Number.isFinite(n) && n >= min && n <= max ? n : undefined; };

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
function demoSession(): Session {
  const members = DEMO_MEMBERS.map(member => ({ ...member, tastes: [...member.tastes] }));
  return { id: crypto.randomUUID(), request: 'What should we do in Williamsburg tonight?', location: DEMO_LOCATION, members, signals: signalsFor(members), note: '', radiusKm: 2, options: [], votes: {}, source: 'qloo', createdAt: Date.now(), version: 0 };
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/api/demo' && request.method === 'POST') {
    const plan = demoSession();
    const rec = await recommend(plan, env);
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
    const rec = await recommend(next, env);
    next = sanitizeSession({ ...next, ...rec });
  }
  if (!await updatePlan(env.DB, old, next)) return bad('Plan changed. Refresh and try again.', 409);
  return json({ ...next, winner: winner(next) });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      if (new URL(request.url).pathname === '/discord/interactions' && request.method === 'POST') return await handleDiscord(request, env, ctx, { read: id => readPlan(env.DB, id), insert: plan => insertPlan(env.DB, plan), update: (old, next) => updatePlan(env.DB, old, next) });
      if (new URL(request.url).pathname.startsWith('/api/')) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return bad(error instanceof Error ? error.message : 'Something went wrong. Please try again.', 503);
    }
  },
  async scheduled(_event: ScheduledController, env: Env): Promise<void> { await env.DB.prepare('DELETE FROM plans WHERE expires_at <= ?').bind(Date.now()).run(); },
} satisfies ExportedHandler<Env>;
