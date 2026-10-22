import { DEMO_PLACES, filterPlaces, type Option, type Place, type Session } from './core';

export type EnvKeys = { OPENAI_API_KEY?: string; QLOO_API_KEY?: string };

export async function nearbyOsm(session: Session): Promise<Place[]> {
  const query = `[out:json][timeout:12];(node(around:1500,${session.venueLat},${session.venueLon})[amenity~"^(restaurant|bar|cafe)$"];way(around:1500,${session.venueLat},${session.venueLon})[amenity~"^(restaurant|bar|cafe)$"];);out center 35;`;
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', headers: { 'Content-Type': 'text/plain', 'User-Agent': 'EncoreHackathon/0.1 (github.com/tanishmisra9/encore)' }, body: query,
  });
  if (!response.ok) throw new Error(`Place source unavailable (${response.status})`);
  const data = await response.json() as { elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: {lat: number; lon: number}; tags?: Record<string,string> }> };
  return (data.elements || []).filter(item => item.tags?.name && (item.lat || item.center?.lat))
    .map(item => ({ id: `osm-${item.type}-${item.id}`, name: item.tags!.name, lat: item.lat ?? item.center!.lat, lon: item.lon ?? item.center!.lon,
      category: item.tags!.amenity || 'place', hours: item.tags!.opening_hours, url: item.tags!.website,
      tags: [item.tags!.cuisine, item.tags!.amenity].filter(Boolean) as string[] }));
}

async function openaiRank(session: Session, places: Place[], key?: string): Promise<Option[]> {
  const filtered = filterPlaces(session, places);
  if (!filtered.length) return [];
  if (!key) return filtered.slice(0, 3).map((place, i) => ({ ...place, score: 3 - i, reason: 'Nearby option; taste match not verified.' }));
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4.1-mini', input: `Rank these places for a group after a ${session.artist} show. Tastes: ${session.members.map(m => `${m.name}: ${m.tastes.join(', ')}`).join('; ')}. Request: ${session.note}. Places: ${JSON.stringify(filtered.map(({id,name,category,tags}) => ({id,name,category,tags})))}. Use only provided facts. Do not claim opening hours or personal knowledge.`,
      text: { format: { type: 'json_schema', name: 'ranked_places', strict: true, schema: { type: 'object', additionalProperties: false, properties: { results: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, score: { type: 'number' }, reason: { type: 'string' } }, required: ['id','score','reason'] } } }, required: ['results'] } } } }),
  });
  if (!response.ok) throw new Error(`OpenAI provisional ranking failed (${response.status})`);
  const data = await response.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
  const raw = data.output?.flatMap(item => item.content || []).find(item => item.text)?.text;
  if (!raw) throw new Error('OpenAI returned no ranking');
  const ranking = JSON.parse(raw) as { results: Array<{ id: string; score: number; reason: string }> };
  const byId = new Map(filtered.map(place => [place.id, place]));
  return ranking.results.filter(item => byId.has(item.id) && Number.isFinite(item.score))
    .map(item => {
      const place = byId.get(item.id)!;
      const matched = place.tags.filter(tag => session.members.some(member => member.tastes.some(taste => taste.toLowerCase().includes(tag.toLowerCase()))));
      return { ...place, score: Math.max(0, Math.min(5, item.score)), reason: matched.length ? `Shared preference: ${matched.join(', ')}. Provisional match based on supplied place tags.` : 'Provisional match based on supplied place tags; no direct shared preference verified.' };
    })
    .sort((a,b) => b.score - a.score).slice(0, 3);
}

export async function recommend(session: Session, env: EnvKeys, mode: 'fixture' | 'live' = 'fixture'): Promise<{ options: Option[]; source: Session['source'] }> {
  if (env.QLOO_API_KEY) return { options: await qlooRank(session, env.QLOO_API_KEY), source: 'qloo' };
  const places = mode === 'live' ? await nearbyOsm(session) : DEMO_PLACES;
  return { options: await openaiRank(session, places, env.OPENAI_API_KEY), source: mode === 'live' ? 'provisional' : 'fixture' };
}

type QlooEntity = { entity_id?: string; name?: string; subtype?: string; properties?: Record<string, any>; location?: Record<string, number>; tags?: Array<{ name?: string }>; query?: { affinity?: number; affinity_rank?: number } };
async function qlooGet(path: string, params: URLSearchParams, key: string): Promise<any> {
  const response = await fetch(`https://hackathon.api.qloo.com${path}?${params}`, { headers: { 'X-Api-Key': key } });
  if (!response.ok) throw new Error(`Qloo unavailable (${response.status})`);
  return response.json();
}
function entities(data: any): QlooEntity[] {
  const items = data?.results?.entities || data?.results || [];
  return Array.isArray(items) ? items : [];
}
function coordinates(entity: QlooEntity): { lat: number; lon: number } | null {
  const location = entity.properties?.location || entity.location || entity.properties?.geocode?.location || entity.properties?.geocode;
  const lat = Number(location?.latitude ?? location?.lat);
  const lon = Number(location?.longitude ?? location?.lng ?? location?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}
async function qlooRank(session: Session, key: string): Promise<Option[]> {
  const searched = await qlooGet('/search', new URLSearchParams({ query: session.artist, types: 'urn:entity:artist', take: '5' }), key);
  const anchor = entities(searched).find(entity => entity.subtype === 'urn:entity:artist' && entity.name?.toLowerCase() === session.artist.toLowerCase())
    || entities(searched).find(entity => entity.subtype === 'urn:entity:artist');
  if (!anchor?.entity_id) throw new Error('Qloo could not resolve the artist');
  const params = new URLSearchParams({
    'filter.type': 'urn:entity:place', 'signal.interests.entities': anchor.entity_id,
    'filter.location': `POINT(${session.venueLon} ${session.venueLat})`,
    'filter.location.radius': String(Math.ceil(session.radiusKm * 1000)), take: '30',
  });
  const result = await qlooGet('/v2/insights', params, key);
  const places: Place[] = entities(result).flatMap(entity => {
    const point = coordinates(entity);
    if (!point || !entity.entity_id || !entity.name) return [];
    return [{ id: `qloo-${entity.entity_id}`, name: entity.name, ...point, category: entity.subtype || 'place',
      hours: undefined, tags: (entity.tags || []).map(tag => tag.name).filter((tag): tag is string => !!tag) }];
  });
  const filtered = filterPlaces(session, places);
  const byId = new Map(entities(result).map(entity => [`qloo-${entity.entity_id}`, entity]));
  return filtered.sort((a, b) => (byId.get(b.id)?.query?.affinity_rank ?? byId.get(b.id)?.query?.affinity ?? 0)
    - (byId.get(a.id)?.query?.affinity_rank ?? byId.get(a.id)?.query?.affinity ?? 0)).slice(0, 3)
    .map((place, index) => ({ ...place, score: 3 - index,
      reason: `Qloo taste affinity from ${anchor.name}. Group preferences are shown separately and are not verified by this match.` }));
}
