import { DEMO_PLACES, filterPlaces, type Option, type Place, type Session } from './core';

export type EnvKeys = { QLOO_API_KEY?: string };
type QlooEntity = { entity_id?: string; name?: string; subtype?: string; properties?: Record<string, unknown>; location?: Record<string, number>; tags?: Array<{ id?: string; name?: string }>; query?: { affinity?: number; affinity_rank?: number } };
type QlooTag = { id?: string; tag_id?: string; name?: string };

async function qlooGet(path: string, params: URLSearchParams, key: string): Promise<unknown> {
  const response = await fetch(`https://hackathon.api.qloo.com${path}?${params}`, { headers: { 'X-Api-Key': key } });
  if (!response.ok) throw new Error(`Qloo unavailable (${response.status})`);
  return response.json();
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

async function qlooRank(session: Session, key: string): Promise<Option[]> {
  const terms = [...new Set(session.signals.filter(signal => signal.kind === 'taste').map(signal => signal.value.trim()).filter(Boolean))].slice(0, 6);
  if (!terms.length) throw new Error('Encore needs one stated taste before it can ask Qloo.');
  const settle = (call: Promise<unknown>) => call.catch(() => null);
  const lookups = await Promise.all(terms.map(async term => ({ term, search: await settle(qlooGet('/search', new URLSearchParams({ query: term, take: '3' }), key)), tag: await settle(qlooGet('/v2/tags', new URLSearchParams({ 'filter.query': term, take: '3' }), key)) })));
  if (lookups.every(({ search, tag }) => !search && !tag)) throw new Error('Qloo unavailable');
  const anchors = lookups.flatMap(({ search }) => entities(search).slice(0, 1)).filter((entity): entity is QlooEntity & { entity_id: string } => !!entity.entity_id);
  const tagIds = lookups.flatMap(({ tag }) => tags(tag).slice(0, 1).map(item => item.id || item.tag_id).filter((id): id is string => !!id));
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
  const byId = new Map(entities(result).map(entity => [`qloo-${entity.entity_id}`, entity]));
  const places: Place[] = entities(result).flatMap(entity => {
    const point = coordinates(entity);
    if (!point || !entity.entity_id || !entity.name) return [];
    return [{ id: `qloo-${entity.entity_id}`, name: entity.name, ...point, category: entity.tags?.[0]?.name || 'place', tags: (entity.tags || []).map(tag => tag.name).filter((tag): tag is string => !!tag) }];
  });
  const appealsTo = [...new Set(session.signals.filter(signal => signal.kind === 'taste').map(signal => signal.name))];
  return filterPlaces(session, places).sort((a, b) => (byId.get(b.id)?.query?.affinity_rank ?? byId.get(b.id)?.query?.affinity ?? 0) - (byId.get(a.id)?.query?.affinity_rank ?? byId.get(a.id)?.query?.affinity ?? 0))
    .slice(0, 3).map((place, index) => ({ ...place, score: 3 - index, appealsTo, reason: `Qloo found a cultural overlap across ${appealsTo.join(', ')}. Stated tastes stay separate from this recommendation.` }));
}

export async function recommend(session: Session, env: EnvKeys, mode: 'production' | 'fixture' = 'production'): Promise<{ options: Option[]; source: Session['source'] }> {
  if (mode === 'fixture') {
    const appealsTo = [...new Set(session.signals.filter(signal => signal.kind === 'taste').map(signal => signal.name))];
    return { source: 'fixture', options: filterPlaces(session, DEMO_PLACES).slice(0, 3).map((place, index) => ({ ...place, score: 3 - index, appealsTo, reason: `Fixture match for ${appealsTo.join(', ') || 'the group'}.` })) };
  }
  if (!env.QLOO_API_KEY) throw new Error('Qloo is not configured yet. Try the recorded replay while Encore finishes setup.');
  return { source: 'qloo', options: await qlooRank(session, env.QLOO_API_KEY) };
}
