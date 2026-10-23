// Qloo vs generic-ranking baseline on fixed scenarios. Prints summary metrics only; raw Qloo data is not stored.
// Run: node --import tsx scripts/eval.mts
import { readFileSync } from 'node:fs';
import { filterPlaces, signalsFor, type Member, type Place, type Session } from '../src/core';
import { bridges, recommend, tagFor } from '../src/providers';

const key = readFileSync('.dev.vars', 'utf8').match(/QLOO_API_KEY=(.+)/)![1].trim();
const NYC = { label: 'Williamsburg, Brooklyn', lat: 40.7178, lon: -73.9632 };
const scenarios: { name: string; location: typeof NYC; members: Member[]; budget?: number; radiusKm: number; hits: RegExp }[] = [
  { name: 'Williamsburg night out', location: NYC, radiusKm: 2, members: [{ id: 'a', name: 'Alex', tastes: ['quiet jazz'] }, { id: 'b', name: 'Sam', tastes: ['late-night food'] }, { id: 'c', name: 'Jo', tastes: ['a place that feels like a night out'] }] },
  { name: 'Visiting friends, wine and music', location: NYC, radiusKm: 1, members: [{ id: 'a', name: 'Alex', tastes: ['thoughtful wine'] }, { id: 'b', name: 'Sam', tastes: ['local music'] }] },
  { name: 'Team after work, casual', location: { label: 'Lower Manhattan', lat: 40.7075, lon: -74.0113 }, radiusKm: 1.5, members: [{ id: 'a', name: 'Alex', tastes: ['casual food'] }, { id: 'b', name: 'Sam', tastes: ['low noise'] }] },
];

async function baseline(session: Session): Promise<Place[]> {
  const params = new URLSearchParams({ 'filter.type': 'urn:entity:place', 'filter.location': `POINT(${session.location.lon} ${session.location.lat})`, 'filter.location.radius': String(session.radiusKm * 1000), take: '30' });
  const body = await (await fetch(`https://hackathon.api.qloo.com/v2/insights?${params}`, { headers: { 'X-Api-Key': key } })).json() as any;
  return filterPlaces(session, (body.results?.entities ?? []).flatMap((e: any) => e.location ? [{ id: `qloo-${e.entity_id}`, name: e.name, lat: e.location.lat, lon: e.location.lon, category: 'place', tags: (e.tags ?? []).map((t: any) => t.name) }] : [])).slice(0, 3);
}
// Same yardstick for both lists: how many distinct members does each place bridge, via the Qloo tag their stated taste resolves to?
async function coverage(session: Session, places: Place[]) {
  const tastes = session.signals.filter(signal => signal.kind === 'taste');
  const resolved = await Promise.all([...new Set(tastes.map(signal => signal.value.trim()))].map(async term => ({ term, tag: await tagFor(term, key) })));
  const per = places.map(place => new Set(bridges(place, resolved, tastes).map(hit => hit.name)).size);
  return { membersBridgedPerPlace: per.length ? +(per.reduce((a, b) => a + b, 0) / per.length).toFixed(2) : 0, placesBridgingMultiple: per.filter(n => n >= 2).length, groupSize: session.members.length };
}

for (const s of scenarios) {
  const session: Session = { id: 'e', request: s.name, location: s.location, members: s.members, signals: signalsFor(s.members), note: '', radiusKm: s.radiusKm, options: [], votes: {}, source: 'qloo', createdAt: 0, version: 0 };
  const t0 = Date.now(); const q = await recommend(session, { QLOO_API_KEY: key }).catch(e => ({ options: [] as Place[], error: String(e.message) })); const ms = Date.now() - t0;
  const b = await baseline(session);
  const inRadius = (ps: Place[]) => ps.every(p => filterPlaces(session, [p]).length === 1);
  const overlap = q.options.filter(o => b.some(p => p.id === o.id)).length;
  console.log(JSON.stringify({ scenario: s.name, qloo: q.options.map(o => o.name), baseline: b.map(p => p.name), qloo_coverage: await coverage(session, q.options), baseline_coverage: await coverage(session, b), inRadius: inRadius(q.options), sharedWithBaseline: overlap, ms, error: (q as any).error }));
}
