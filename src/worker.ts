import { VENUES, sanitizeSession, vote, winner, type Member, type Session } from './core';
import { recommend } from './providers';

type Env = { DB: D1Database; ASSETS: Fetcher; OPENAI_API_KEY?: string; QLOO_API_KEY?: string; DISCORD_PUBLIC_KEY?: string; DISCORD_BOT_TOKEN?: string };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const bad = (message: string, status = 400) => json({ error: message }, status);

async function readPlan(db: D1Database, id: string): Promise<Session | null> {
  const row = await db.prepare('SELECT body FROM plans WHERE id = ? AND expires_at > ?').bind(id, Date.now()).first<{body:string}>();
  return row ? JSON.parse(row.body) as Session : null;
}
async function insertPlan(db: D1Database, plan: Session): Promise<void> {
  await db.prepare('INSERT INTO plans (id,version,body,expires_at) VALUES (?,?,?,?)')
    .bind(plan.id, plan.version, JSON.stringify(plan), plan.createdAt + 7 * 86400000).run();
}
async function updatePlan(db: D1Database, old: Session, next: Session): Promise<boolean> {
  const result = await db.prepare('UPDATE plans SET version = ?, body = ? WHERE id = ? AND version = ?')
    .bind(next.version, JSON.stringify(next), old.id, old.version).run();
  return result.meta.changes === 1;
}
function clean(value: unknown, max = 100): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function number(value: unknown, min: number, max: number): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}
async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/api/venues' && request.method === 'GET') return json(VENUES);
  if (url.pathname === '/api/plans' && request.method === 'POST') {
    const body = await request.json() as Record<string,unknown>;
    const artist = clean(body.artist), venueName = clean(body.venue);
    const venue = VENUES.find(item => item.name === venueName);
    if (!artist || !venue) return bad('Choose an artist and listed venue.');
    const plan: Session = { id: crypto.randomUUID(), artist, venue: venue.name, venueLat: venue.lat, venueLon: venue.lon,
      members: [], note: '', radiusKm: 2, options: [], votes: {}, source: 'fixture', createdAt: Date.now(), version: 0 };
    await insertPlan(env.DB, plan);
    return json(plan, 201);
  }
  const match = url.pathname.match(/^\/api\/plans\/([a-f0-9-]+)(?:\/(members|vote|revise))?$/);
  if (!match) return bad('Not found', 404);
  const old = await readPlan(env.DB, match[1]);
  if (!old) return bad('Plan not found or expired', 404);
  if (!match[2] && request.method === 'GET') return json({ ...old, winner: winner(old) });
  if (request.method !== 'POST') return bad('Method not allowed', 405);
  const body = await request.json() as Record<string,unknown>;
  let next: Session;
  if (match[2] === 'members') {
    const name = clean(body.name, 40), id = clean(body.id, 40) || crypto.randomUUID();
    const tastes = Array.isArray(body.tastes) ? body.tastes.map(v => clean(v, 60)).filter(Boolean).slice(0, 3) : [];
    if (!name || !tastes.length) return bad('Add a name and at least one taste.');
    const member: Member = { id, name, tastes };
    next = { ...old, members: [...old.members.filter(m => m.id !== id), member].slice(0, 8), version: old.version + 1 };
    const rec = await recommend(next, env);
    next = sanitizeSession({ ...next, ...rec });
  } else if (match[2] === 'vote') {
    try { next = vote(old, clean(body.memberId), clean(body.optionId)); }
    catch (error) { return bad((error as Error).message); }
  } else if (match[2] === 'revise') {
    const radiusKm = body.radiusKm === undefined ? old.radiusKm : number(body.radiusKm, 0.1, 10);
    const budget = body.budget === '' || body.budget === null ? undefined : body.budget === undefined ? old.budget : number(body.budget, 1, 500);
    if (radiusKm === undefined || (body.budget !== undefined && body.budget !== '' && body.budget !== null && budget === undefined)) return bad('Invalid limits.');
    next = { ...old, note: clean(body.note, 300), radiusKm, budget, votes: {}, version: old.version + 1 };
    const rec = await recommend(next, env);
    next = { ...next, ...rec };
  } else return bad('Not found', 404);
  if (!await updatePlan(env.DB, old, next)) return bad('Plan changed. Refresh and try again.', 409);
  return json({ ...next, winner: winner(next) });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (new URL(request.url).pathname.startsWith('/api/')) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return bad('Something went wrong. Please try again.', 500);
    }
  },
} satisfies ExportedHandler<Env>;
