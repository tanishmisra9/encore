// Live read-only probe of the Qloo hackathon API. Prints shapes and counts only.
import { readFileSync } from 'node:fs';
const key = readFileSync('.dev.vars', 'utf8').match(/QLOO_API_KEY=(.+)/)?.[1].trim();
const get = async (path, params) => {
  const r = await fetch(`https://hackathon.api.qloo.com${path}?${new URLSearchParams(params)}`, { headers: { 'X-Api-Key': key } });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};
const keys = o => o && typeof o === 'object' ? Object.keys(o).join(',') : typeof o;
const s = await get('/search', { query: 'quiet jazz', take: '3' });
console.log('search', s.status, keys(s.body), keys(s.body.results), (s.body.results?.entities ?? s.body.results)?.slice?.(0, 3).map(e => [e.entity_id, e.name, e.subtype]));
const t = await get('/v2/tags', { query: 'jazz', take: '3' });
console.log('tags', t.status, keys(t.body), JSON.stringify(t.body).slice(0, 300));
const anchor = (s.body.results?.entities ?? s.body.results)?.[0]?.entity_id;
const i = await get('/v2/insights', { 'filter.type': 'urn:entity:place', 'filter.location': 'POINT(-73.9632 40.7178)', 'filter.location.radius': '2000', 'signal.interests.entities': anchor, take: '10' });
const ents = i.body.results?.entities ?? [];
console.log('insights', i.status, keys(i.body), 'entities', ents.length);
if (ents[0]) console.log('entity keys', keys(ents[0]), 'props', keys(ents[0].properties), 'query', JSON.stringify(ents[0].query), 'loc', JSON.stringify(ents[0].location ?? ents[0].properties?.geocode ?? ents[0].properties?.location));
console.log(ents.slice(0, 5).map(e => e.name));
if (!ents.length) console.log(JSON.stringify(i.body).slice(0, 400));
