// Memory Lane vs two baselines on eight frozen personas. Prints aggregates only; Qloo's terms keep raw responses out of the repo.
// Run: npm run eval   (needs QLOO_API_KEY in .dev.vars)
import { readFileSync } from 'node:fs';
import { buildPlan, inWindow, safety, type Artist } from '../src/engine';
import { memoryCache, previewFor, qlooGet, runAgent, toArtist } from '../src/qloo';

const key = readFileSync('.dev.vars', 'utf8').match(/QLOO_API_KEY=(.+)/)![1].trim();
const personas = [
  { name: 'US 1946', born: 1946, anchors: ['Frank Sinatra', 'Elvis Presley'] }, { name: 'UK 1942', born: 1942, anchors: ['The Beatles', 'Dusty Springfield'] },
  { name: 'Mexico 1950', born: 1950, anchors: ['Vicente Fernández', 'José José'] }, { name: 'India 1948', born: 1948, anchors: ['Lata Mangeshkar', 'Kishore Kumar'] },
  { name: 'Greece 1947', born: 1947, anchors: ['Nana Mouskouri', 'Mikis Theodorakis'] }, { name: 'Brazil 1949', born: 1949, anchors: ['Tom Jobim', 'Elis Regina'] },
  { name: 'Jamaica 1952', born: 1952, anchors: ['Bob Marley', 'Jimmy Cliff'] }, { name: 'Italy 1944', born: 1944, anchors: ['Domenico Modugno', 'Mina'] },
];
const ents = (d: any): any[] => (Array.isArray(d.results) ? d.results : d.results?.entities) || [];
const top6 = (artists: Artist[]) => artists.slice(0, 6);
const rate = (xs: Artist[], f: (a: Artist) => boolean) => xs.length ? xs.filter(f).length / xs.length : 0;
const jaccard = (a: Set<string>, b: Set<string>) => [...a].filter(x => b.has(x)).length / new Set([...a, ...b]).size;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

const arms: Record<string, { era: number[]; unsafe: number[]; yield: number[]; sets: Set<string>[]; ms: number[] }> = {};
for (const name of ['memory-lane', 'anchors-only', 'popularity']) arms[name] = { era: [], unsafe: [], yield: [], sets: [], ms: [] };
let previews = 0, songs = 0, calls = 0;
for (const p of personas) {
  // Arm A: the shipped agent and engine.
  let t = Date.now();
  const result = await runAgent({ born: p.born, anchors: p.anchors }, key, memoryCache);
  const profile = { born: p.born, anchors: result.anchors, weights: {}, banned: [] };
  const plan = buildPlan(result.pool, profile), planned = plan.filter(i => i.kind === 'song');
  const chosen = planned.map(i => result.pool.artists.find(a => a.id === i.artistId)!).filter(Boolean);
  arms['memory-lane'].ms.push(Date.now() - t);
  arms['memory-lane'].era.push(rate(chosen, a => inWindow(a, p.born) || !!a.known)); arms['memory-lane'].unsafe.push(rate(chosen, a => !safety(a).safe));
  arms['memory-lane'].yield.push(result.pool.artists.filter(a => (inWindow(a, p.born) || a.known) && safety(a).safe).length); arms['memory-lane'].sets.push(new Set(chosen.map(a => a.id)));
  for (const i of planned) { songs++; if (i.previewUrl || (i.by && await previewFor(i.title, i.by, memoryCache))) previews++; }
  // Arm B: anchors, one Insights call, same filters, no re-anchoring loop.
  t = Date.now();
  const one = ents(await qlooGet('/v2/insights', { 'filter.type': 'urn:entity:artist', 'signal.interests.entities': result.anchors.map(a => a.id).join(','), take: '50' }, key, memoryCache)).map(toArtist).filter((a): a is Artist => !!a);
  const okOne = one.filter(a => inWindow(a, p.born) && safety(a).safe);
  arms['anchors-only'].ms.push(Date.now() - t); arms['anchors-only'].era.push(rate(top6(okOne), () => true)); arms['anchors-only'].unsafe.push(0);
  arms['anchors-only'].yield.push(okOne.length); arms['anchors-only'].sets.push(new Set(top6(okOne).map(a => a.id)));
  // Arm C: generic popular artists, no personal signal, no filters: what a plain "oldies" request returns.
  const pop = ents(await qlooGet('/v2/insights', { 'filter.type': 'urn:entity:artist', 'filter.popularity.min': '0.9', take: '50' }, key, memoryCache)).map(toArtist).filter((a): a is Artist => !!a);
  arms.popularity.era.push(rate(top6(pop), a => inWindow(a, p.born))); arms.popularity.unsafe.push(rate(top6(pop), a => !safety(a).safe));
  arms.popularity.yield.push(pop.filter(a => inWindow(a, p.born) && safety(a).safe).length); arms.popularity.sets.push(new Set(top6(pop).map(a => a.id))); arms.popularity.ms.push(0);
  calls++; console.error(`done ${p.name}`);
}
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
for (const [name, a] of Object.entries(arms)) {
  const pairs: number[] = []; for (let i = 0; i < a.sets.length; i++) for (let j = i + 1; j < a.sets.length; j++) pairs.push(jaccard(a.sets[i], a.sets[j]));
  console.log(JSON.stringify({ arm: name, personas: calls, eraFitTop6: pct(mean(a.era)), upsettingThemesTop6: pct(mean(a.unsafe)), safeInEraArtistsAvailable: +mean(a.yield).toFixed(1), minAvailable: Math.min(...a.yield), crossPersonaOverlap: +mean(pairs).toFixed(2), avgMs: Math.round(mean(a.ms)) }));
}
console.log(JSON.stringify({ previewCoverage: `${previews}/${songs}` }));
