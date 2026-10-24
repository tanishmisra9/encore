import { eraWindow, inWindow, safety, type Artist, type Media, type Pool } from './engine';

const BASE = 'https://hackathon.api.qloo.com';
export type Cache = { get(key: string): Promise<unknown | null>; set(key: string, value: unknown, ttlMs: number): Promise<void> };
export type Step = { text: string; kept?: number; dropped?: number };
type Raw = { entity_id?: string; name?: string; properties?: Record<string, unknown>; query?: { explainability?: Record<string, Array<{ entity_id: string; score: number }>> } };

const memory = new Map<string, { value: unknown; expires: number }>();
export const memoryCache: Cache = {
  async get(key) { const hit = memory.get(key); return hit && hit.expires > Date.now() ? hit.value : null; },
  async set(key, value, ttl) { if (memory.size > 300) memory.clear(); memory.set(key, { value, expires: Date.now() + ttl }); },
};

// Qloo's terms allow private server-side caching; it also keeps a rate-limited hackathon key usable.
export async function qlooGet(path: string, params: Record<string, string>, key: string, cache: Cache = memoryCache): Promise<unknown> {
  const query = new URLSearchParams(params).toString(), id = `${path}?${query}`;
  const hit = await cache.get(id); if (hit) return hit;
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${BASE}${path}?${query}`, { headers: { 'X-Api-Key': key } });
    if (response.status === 429 && attempt < 2) { await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1))); continue; }
    if (response.status === 429) throw new Error('Qloo is busy right now (rate limit). Try again in a minute.');
    if (!response.ok) throw new Error(`Qloo unavailable (${response.status}).`);
    const value = await response.json();
    await cache.set(id, value, 24 * 3600_000);
    return value;
  }
}

const list = (data: unknown): Raw[] => { const r = (data as { results?: unknown })?.results; const items = Array.isArray(r) ? r : (r as { entities?: unknown })?.entities; return Array.isArray(items) ? items as Raw[] : []; };
// Qloo uses null for unknown, and Number(null) is 0, which would read an active artist's end_year as 0.
const one = (value: unknown): number | undefined => { const v = Array.isArray(value) ? value[0] : value; if (v === null || v === undefined || v === '') return undefined; const n = Number(v); return Number.isFinite(n) ? n : undefined; };
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
const image = (value: unknown): string | undefined => { const url = (value as { url?: unknown })?.url; return typeof url === 'string' ? url : undefined; };
export const norm = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function toArtist(raw: Raw): Artist | null {
  const p = raw.properties || {};
  if (!raw.entity_id || !raw.name) return null;
  return { id: raw.entity_id, name: raw.name, start: one(p.start_year), end: one(p.end_year), obscurity: one(p.obscurity_scale), complexity: one(p.complexity_scale),
    themes: strings(p.lyrical_themes), songs: strings(p.notable_songs).slice(0, 4), genres: strings(p.primary_genres).slice(0, 3), image: image(p.image) };
}
export function toMedia(raw: Raw, kind: 'film' | 'show'): Media | null {
  const year = one(raw.properties?.release_year);
  return raw.entity_id && raw.name && year ? { id: raw.entity_id, title: raw.name, year, kind, image: image(raw.properties?.image), popularity: typeof (raw as { popularity?: unknown }).popularity === 'number' ? (raw as { popularity: number }).popularity : 0 } : null;
}

async function searchRaw(q: string, key: string, cache?: Cache): Promise<Raw[]> {
  return list(await qlooGet('/search', { query: q, take: '6', types: 'urn:entity:artist' }, key, cache)).filter(e => e.entity_id && e.name);
}
export async function searchArtists(q: string, key: string, cache?: Cache): Promise<{ id: string; name: string; image?: string }[]> {
  return (await searchRaw(q, key, cache)).map(e => ({ id: e.entity_id!, name: e.name!, image: image(e.properties?.image) })).slice(0, 6);
}
// Qloo search is fuzzy (a nonsense name still returns something), so accept a match only when the names agree.
export async function resolveAnchor(name: string, key: string, cache?: Cache): Promise<{ id: string; name: string; artist: Artist | null } | null> {
  const wanted = norm(name);
  const hit = (await searchRaw(name, key, cache)).find(a => { const got = norm(a.name!); return got === wanted || got.includes(wanted) || wanted.includes(got); });
  return hit ? { id: hit.entity_id!, name: hit.name!, artist: toArtist(hit) } : null;
}

export type AgentResult = { anchors: { id: string; name: string }[]; unresolved: string[]; pool: Pool; trace: Step[] };
export const TARGET_SAFE = 15, MAX_HOPS = 3;

export async function runAgent(input: { born: number; anchors: string[] }, key: string, cache?: Cache): Promise<AgentResult> {
  const trace: Step[] = [], [from, to] = eraWindow(input.born);
  const resolved = await Promise.all(input.anchors.map(async name => ({ name, hit: await resolveAnchor(name, key, cache) })));
  const anchors = resolved.flatMap(r => r.hit ? [{ id: r.hit.id, name: r.hit.name }] : []), unresolved = resolved.filter(r => !r.hit).map(r => r.name);
  if (!anchors.length) throw Object.assign(new Error(`Qloo could not find ${unresolved.join(', ')}. Check the spelling or pick from the shelf.`), { unresolved });
  trace.push({ text: `Found ${anchors.map(a => a.name).join(', ')} in Qloo.`, kept: anchors.length, dropped: unresolved.length });

  const names = new Map(anchors.map(a => [a.id, a.name])), pool = new Map<string, Artist>();
  // The artists the caregiver named go first: they are the surest songs, and they face the same safety screen as everyone else.
  for (const { hit } of resolved) if (hit?.artist) pool.set(hit.id, hit.artist);
  for (const { hit } of resolved) if (hit?.artist && !(inWindow(hit.artist, input.born) && safety(hit.artist).safe)) trace.push({ text: `Left out ${hit.name}: ${!inWindow(hit.artist, input.born) ? `not active ${from} to ${to}` : safety(hit.artist).notes[0]}.` });
  let signals = anchors.map(a => a.id);
  const used = new Set(signals);
  for (let hop = 1; hop <= MAX_HOPS; hop++) {
    trace.push({ text: `Asking Qloo for artists near ${signals.length} you gave it.` });
    const data = await qlooGet('/v2/insights', { 'filter.type': 'urn:entity:artist', 'signal.interests.entities': signals.join(','), take: '50', 'feature.explainability': 'true' }, key, cache);
    let added = 0;
    for (const raw of list(data)) {
      const artist = toArtist(raw); if (!artist || pool.has(artist.id)) continue;
      const top = Object.values(raw.query?.explainability || {}).flat().sort((a, b) => b.score - a.score)[0];
      artist.via = top ? names.get(top.entity_id) : undefined;
      pool.set(artist.id, artist); names.set(artist.id, artist.name); added++;
    }
    const fit = [...pool.values()].filter(a => inWindow(a, input.born)), safe = fit.filter(a => safety(a).safe);
    trace.push({ text: `Kept artists active ${from} to ${to} that are gentle and familiar.`, kept: safe.length, dropped: pool.size - safe.length });
    if (safe.length >= TARGET_SAFE || !added) break;
    // Re-anchor on artists not yet used, so each hop explores new ground instead of repeating the last query.
    const fresh = safe.filter(a => !used.has(a.id)).slice(0, 5);
    if (!fresh.length) break;
    fresh.forEach(a => used.add(a.id));
    signals = [...anchors.map(a => a.id), ...fresh.map(a => a.id)];
    if (hop < MAX_HOPS) trace.push({ text: `Not enough yet. Asking again from ${fresh.slice(0, 3).map(a => a.name).join(', ')}.` });
  }

  const seeds = [...pool.values()].filter(a => inWindow(a, input.born) && safety(a).safe).slice(0, 5).map(a => a.id);
  const media: Media[] = [];
  for (const [type, kind] of [['movie', 'film'], ['tv_show', 'show']] as const) {
    const data = await qlooGet('/v2/insights', { 'filter.type': `urn:entity:${type}`, 'signal.interests.entities': [...anchors.map(a => a.id), ...seeds].join(','), 'filter.release_year.min': String(from), 'filter.release_year.max': String(to), take: '12' }, key, cache).catch(() => null);
    // Of the in-window results with artwork, show the most widely known: a familiar title is safer than an obscure one.
    const first = list(data).map(raw => toMedia(raw, kind)).filter((m): m is Media => !!m && !!m.image).sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];
    if (first) media.push(first);
  }
  trace.push({ text: `Picked films and shows released ${from} to ${to}.`, kept: media.length });
  return { anchors, unresolved, pool: { artists: [...pool.values()], media }, trace };
}

// iTunes returns a 30-second preview; the artist name must match so a cover or namesake is never played.
export async function previewFor(song: string, artist: string, cache: Cache = memoryCache): Promise<string | null> {
  const id = `itunes:${norm(song)}:${norm(artist)}`, hit = await cache.get(id);
  if (hit !== null) return hit === '' ? null : hit as string;
  const response = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({ term: `${song} ${artist}`, media: 'music', entity: 'song', limit: '6' })}`).catch(() => null);
  if (!response?.ok) return null;
  const data = await response.json() as { results?: Array<{ previewUrl?: string; artistName?: string }> };
  const lead = norm(artist).split(' ')[0];
  const found = data.results?.find(r => r.previewUrl && norm(r.artistName || '').includes(lead))?.previewUrl ?? null;
  await cache.set(id, found ?? '', 7 * 24 * 3600_000);
  return found;
}
