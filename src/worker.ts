import { alternates, applyReaction, buildPlan, prompts, refill, validate, type Item, type Pool, type Profile, type Reaction } from './engine';
import { previewFor, runAgent, searchArtists, type Cache, type Step } from './qloo';
import { SHELVES } from './shelves';

type Env = { DB: D1Database; ASSETS: Fetcher; QLOO_API_KEY?: string };
type Session = { id: string; version: number; profile: Profile; pool: Pool; plan: Item[]; trace: Step[]; unresolved: string[]; createdAt: number };
const DAY = 24 * 3600_000, KEEP = 30 * DAY;
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const bad = (message: string, status = 400) => json({ error: message }, status);
const REACTIONS = ['smiled', 'neutral', 'upset'];

const dbCache = (db: D1Database): Cache => ({
  async get(key) { const row = await db.prepare('SELECT body FROM qloo_cache WHERE key = ? AND expires_at > ?').bind(key, Date.now()).first<{ body: string }>(); return row ? JSON.parse(row.body) : null; },
  async set(key, value, ttl) { await db.prepare('INSERT OR REPLACE INTO qloo_cache (key, body, expires_at) VALUES (?,?,?)').bind(key, JSON.stringify(value), Date.now() + ttl).run(); },
});
const view = (s: Session) => ({ id: s.id, version: s.version, name: s.profile.name, born: s.profile.born, plan: s.plan, prompts: prompts(s.plan, s.profile), trace: s.trace, unresolved: s.unresolved });

async function read(db: D1Database, id: string): Promise<Session | null> {
  const row = await db.prepare('SELECT body FROM sessions WHERE id = ? AND expires_at > ?').bind(id, Date.now()).first<{ body: string }>();
  return row ? JSON.parse(row.body) : null;
}
// Qloo's notable_songs can name an album or a track iTunes lacks, so try the artist's other songs until one has audio.
async function withPreviews(plan: Item[], pool: Pool, cache: Cache): Promise<Item[]> {
  return Promise.all(plan.map(async item => {
    if (item.kind !== 'song' || !item.by || item.previewUrl !== undefined) return item;
    for (const title of [item.title, ...alternates(pool, item)]) {
      const previewUrl = await previewFor(title, item.by, cache);
      if (previewUrl) return { ...item, title, id: `${item.artistId}:${title}`, previewUrl };
    }
    return { ...item, previewUrl: null };
  }));
}

// A song nobody can press play on defeats the point, so an artist with no audio is swapped for the next eligible one (up to three rounds).
async function playable(plan: Item[], pool: Pool, profile: Profile, cache: Cache): Promise<{ plan: Item[]; profile: Profile }> {
  let current = await withPreviews(plan, pool, cache);
  for (let round = 0; round < 3; round++) {
    const dead = current.filter(i => i.kind === 'song' && i.previewUrl === null && i.artistId);
    if (!dead.length) break;
    profile = { ...profile, banned: [...profile.banned, ...dead.map(i => i.artistId!)] };
    current = await withPreviews(refill(current.map(i => dead.includes(i) ? { ...i, reaction: 'upset' as const } : i), pool, profile), pool, cache);
  }
  return { plan: current, profile };
}

async function create(request: Request, env: Env): Promise<Response> {
  if (!env.QLOO_API_KEY) return bad('Qloo is not configured.', 503);
  let input; try { input = validate(await request.json()); } catch (error) { return bad(error instanceof Error ? error.message : 'Invalid request.'); }
  const cache = dbCache(env.DB);
  let result; try { result = await runAgent(input, env.QLOO_API_KEY, cache); } catch (error) { return bad(error instanceof Error ? error.message : 'Qloo failed.', 502); }
  const profile: Profile = { born: input.born, name: input.name, anchors: result.anchors, weights: {}, banned: [] };
  const { plan, profile: finalProfile } = await playable(buildPlan(result.pool, profile), result.pool, profile, cache);
  if (!plan.some(item => item.kind === 'song')) return bad('Qloo found no gentle, familiar songs from those years. Try different artists.', 422);
  const session: Session = { id: crypto.randomUUID(), version: 0, profile: finalProfile, pool: result.pool, plan, trace: result.trace, unresolved: result.unresolved, createdAt: Date.now() };
  await env.DB.prepare('INSERT INTO sessions (id, version, body, expires_at) VALUES (?,?,?,?)').bind(session.id, 0, JSON.stringify(session), Date.now() + KEEP).run();
  return json(view(session), 201);
}

async function react(request: Request, env: Env, id: string): Promise<Response> {
  const session = await read(env.DB, id); if (!session) return bad('This session expired or was deleted.', 404);
  const body = await request.json().catch(() => ({})) as { itemId?: unknown; reaction?: unknown };
  const item = session.plan.find(i => i.id === body.itemId);
  if (!item || typeof body.reaction !== 'string' || !REACTIONS.includes(body.reaction)) return bad('Unknown item or reaction.');
  const reaction = body.reaction as Reaction, cache = dbCache(env.DB);
  const profile = applyReaction(session.profile, item, reaction);
  const marked = session.plan.map(i => i.id === item.id ? { ...i, reaction } : i);
  const { plan, profile: nextProfile } = await playable(refill(marked, session.pool, profile), session.pool, profile, cache);
  const next: Session = { ...session, profile: nextProfile, plan, version: session.version + 1 };
  const saved = await env.DB.prepare('UPDATE sessions SET version = ?, body = ? WHERE id = ? AND version = ?').bind(next.version, JSON.stringify(next), id, session.version).run();
  return saved.meta.changes === 1 ? json(view(next)) : bad('The session changed. Try again.', 409);
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url), path = url.pathname;
  if (path === '/api/artists' && request.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
    if (q.length < 2 || !env.QLOO_API_KEY) return json([]);
    return json(await searchArtists(q, env.QLOO_API_KEY, dbCache(env.DB)));
  }
  if (path === '/api/shelf' && request.method === 'GET') return json(SHELVES);
  if (path === '/api/sessions' && request.method === 'POST') return create(request, env);
  const match = path.match(/^\/api\/sessions\/([a-f0-9-]{36})(?:\/(react))?$/);
  if (match) {
    const [, id, action] = match;
    if (action === 'react' && request.method === 'POST') return react(request, env, id);
    if (!action && request.method === 'GET') { const s = await read(env.DB, id); return s ? json(view(s)) : bad('This session expired or was deleted.', 404); }
    if (!action && request.method === 'DELETE') { await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run(); return json({ deleted: true }); }
  }
  return bad('Not found', 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (new URL(request.url).pathname.startsWith('/api/')) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return bad('Something went wrong. Please try again.', 503);
    }
  },
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const now = Date.now();
    await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now), env.DB.prepare('DELETE FROM qloo_cache WHERE expires_at <= ?').bind(now)]);
  },
} satisfies ExportedHandler<Env>;
