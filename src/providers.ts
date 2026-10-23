import { DEMO_PLACES, filterPlaces, type Option, type Place, type Session } from './core';

export type EnvKeys = { QLOO_API_KEY?: string };
type QlooEntity = { entity_id?: string; name?: string; subtype?: string; properties?: Record<string, unknown>; location?: Record<string, number>; tags?: Array<{ id?: string; name?: string }>; query?: { affinity?: number; affinity_rank?: number } };
type QlooTag = { id?: string; tag_id?: string; name?: string };

// Private server-side cache (allowed by Qloo's terms) plus retry keeps a rate-limited hackathon key usable.
const cache = new Map<string, { value: unknown; expires: number }>();
async function qlooGet(path: string, params: URLSearchParams, key: string): Promise<unknown> {
  const id = `${key}${path}?${params}`, hit = cache.get(id);
  if (hit && hit.expires > Date.now()) return hit.value;
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`https://hackathon.api.qloo.com${path}?${params}`, { headers: { 'X-Api-Key': key } });
    if (response.status === 429 && attempt < 2) { await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1))); continue; }
    if (response.status === 429) throw new Error('Qloo unavailable (429): the hackathon key is rate-limited. Try again in a minute.');
    if (!response.ok) throw new Error(`Qloo unavailable (${response.status})`);
    const value = await response.json();
    if (cache.size >= 200) cache.clear();
    cache.set(id, { value, expires: Date.now() + 10 * 60_000 });
    return value;
  }
}
function entities(data: unknown): QlooEntity[] {
  const value = data as { results?: { entities?: QlooEntity[] } | QlooEntity[] };
  const items = Array.isArray(value?.results) ? value.results : value?.results?.entities;
  return Array.isArray(items) ? items : [];
}
function tags(data: unknown): QlooTag[] {
  const value = data as { results?: { tags?: QlooTag[] } | QlooTag[]; tags?: QlooTag[] };
  const items = Array.isArray(value?.results) ? value.results : value?.results?.tags || value?.tags;
  return Array.isArray(items) ? items : [];
}
function coordinates(entity: QlooEntity): { lat: number; lon: number } | null {
  const properties = entity.properties || {};
  for (const candidate of [entity.location, properties.geocode, properties.location]) {
    const location = (candidate || {}) as Record<string, unknown>;
    const lat = Number(location.latitude ?? location.lat), lon = Number(location.longitude ?? location.lng ?? location.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
  }
  return null;
}

// Qloo reports price as a 1-4 level. These per-person dollar figures are rough estimates, shown with "~" and never as facts.
const PRICE_ESTIMATE = [0, 15, 30, 60, 100];
// Tags that describe places (what is served, how it feels) beat music or occupation tags when we filter venues.
export const PLACE_TAG = /:(place|cuisine|offerings|ambience|good_for)[:_]|:place:/;
export const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Qloo tags rarely match a whole phrase ("thoughtful wine"), so fall back to its words, last first (usually the noun).
export async function tagFor(term: string, key: string): Promise<{ id: string; name: string } | undefined> {
  for (const query of [term, ...term.split(/[\s-]+/).filter(word => word.length > 3).reverse()]) {
    const found = tags(await qlooGet('/v2/tags', new URLSearchParams({ 'filter.query': query, take: '6' }), key).catch(() => null)).map(item => ({ id: item.id || item.tag_id || '', name: item.name || '' })).filter(item => item.id);
    if (found.length) return found.find(item => PLACE_TAG.test(item.id)) || found[0];
  }
}

// A member is "bridged" when the place carries the Qloo tag that member's stated taste resolved to.
export function bridges(place: Place, resolved: { term: string; tag?: { name: string } }[], tastes: { name: string; value: string }[]): { name: string; tag: string }[] {
  const have = place.tags.map(tag => ` ${norm(tag)} `), hits: { name: string; tag: string }[] = [];
  for (const { term, tag } of resolved) if (tag && have.some(text => text.includes(` ${norm(tag.name)} `))) for (const name of new Set(tastes.filter(signal => signal.value.trim() === term).map(signal => signal.name))) hits.push({ name, tag: tag.name });
  return hits;
}

async function qlooRank(session: Session, key: string): Promise<Option[]> {
  const tastes = session.signals.filter(signal => signal.kind === 'taste' && signal.value.trim());
  const terms = [...new Set(tastes.map(signal => signal.value.trim()))].slice(0, 6);
  if (!terms.length) throw new Error('Encore needs one stated taste before it can ask Qloo.');
  const settle = (call: Promise<unknown>) => call.catch(() => null);
  const lookups = await Promise.all(terms.map(async term => ({ term, search: await settle(qlooGet('/search', new URLSearchParams({ query: term, take: '3' }), key)), tag: await tagFor(term, key) })));
  if (lookups.every(({ search, tag }) => !search && !tag)) throw new Error('Qloo unavailable');
  const anchors = lookups.flatMap(({ search }) => entities(search).slice(0, 1)).filter((entity): entity is QlooEntity & { entity_id: string } => !!entity.entity_id);
  const resolved = lookups.map(({ term, tag }) => ({ term, tag }));
  const tagIds = [...new Set(resolved.flatMap(({ tag }) => tag ? [tag.id] : []))];
  if (!anchors.length && !tagIds.length) throw new Error('Encore could not resolve the group’s cultural signals. Ask with a few specific tastes.');
  const params = new URLSearchParams({
    'filter.type': 'urn:entity:place',
    'filter.location': `POINT(${session.location.lon} ${session.location.lat})`,
    'filter.location.radius': String(Math.ceil(session.radiusKm * 1000)),
    take: '30',
  });
  if (anchors.length) params.set('signal.interests.entities', anchors.map(anchor => anchor.entity_id).join(','));
  if (tagIds.length) params.set('signal.interests.tags', tagIds.join(','));
  const result = await qlooGet('/v2/insights', params, key);
  const raw = new Map(entities(result).map((entity, rank) => [`qloo-${entity.entity_id}`, { entity, rank }]));
  const places: Place[] = entities(result).flatMap(entity => {
    const point = coordinates(entity);
    if (!point || !entity.entity_id || !entity.name) return [];
    const level = Number(entity.properties?.price_level);
    return [{ id: `qloo-${entity.entity_id}`, name: entity.name, ...point, category: entity.tags?.[0]?.name || 'place', price: PRICE_ESTIMATE[level], tags: (entity.tags || []).map(tag => tag.name).filter((tag): tag is string => !!tag) }];
  });
  return filterPlaces(session, places).map(place => ({ place, hits: bridges(place, resolved, tastes) }))
    .sort((a, b) => new Set(b.hits.map(hit => hit.name)).size - new Set(a.hits.map(hit => hit.name)).size || (raw.get(a.place.id)?.rank ?? 99) - (raw.get(b.place.id)?.rank ?? 99))
    .slice(0, 3).map(({ place, hits }, index) => {
      const names = [...new Set(hits.map(hit => hit.name))];
      return { ...place, score: 3 - index, appealsTo: names, reason: names.length ? `Fits ${hits.map(hit => `${hit.name} (${hit.tag})`).join(' and ')} through Qloo tags.` : 'Qloo ranked this near the group’s combined tastes; no single stated taste matched its tags exactly.' };
    });
}

export async function recommend(session: Session, env: EnvKeys, mode: 'production' | 'fixture' = 'production'): Promise<{ options: Option[]; source: Session['source'] }> {
  if (mode === 'fixture') {
    const appealsTo = [...new Set(session.signals.filter(signal => signal.kind === 'taste').map(signal => signal.name))];
    return { source: 'fixture', options: filterPlaces(session, DEMO_PLACES).slice(0, 3).map((place, index) => ({ ...place, score: 3 - index, appealsTo, reason: `Fixture match for ${appealsTo.join(', ') || 'the group'}.` })) };
  }
  if (!env.QLOO_API_KEY) throw new Error('Qloo is not configured yet. Try the recorded replay while Encore finishes setup.');
  return { source: 'qloo', options: await qlooRank(session, env.QLOO_API_KEY) };
}
