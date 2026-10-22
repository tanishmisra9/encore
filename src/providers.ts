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
    .map(item => ({ ...byId.get(item.id)!, score: Math.max(0, Math.min(5, item.score)), reason: item.reason.slice(0, 220) }))
    .sort((a,b) => b.score - a.score).slice(0, 3);
}

export async function recommend(session: Session, env: EnvKeys, mode: 'fixture' | 'live' = 'fixture'): Promise<{ options: Option[]; source: Session['source'] }> {
  if (env.QLOO_API_KEY) return { options: await qlooRank(session, env.QLOO_API_KEY), source: 'qloo' };
  const places = mode === 'live' ? await nearbyOsm(session) : DEMO_PLACES;
  return { options: await openaiRank(session, places, env.OPENAI_API_KEY), source: mode === 'live' ? 'provisional' : 'fixture' };
}

async function qlooRank(_session: Session, _key: string): Promise<Option[]> {
  throw new Error('Qloo adapter awaits a verified API key and live contract test');
}
