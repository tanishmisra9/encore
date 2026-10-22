import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_LOCATION, signalsFor, type Session } from '../src/core';
import { recommend } from '../src/providers';

const members = [{ id: 'a', name: 'Alex', tastes: ['quiet jazz'] }, { id: 'b', name: 'Sam', tastes: ['late-night food'] }];
const plan: Session = { id: 'p', request: 'What should we do in Williamsburg tonight?', location: DEMO_LOCATION, members, signals: signalsFor(members), note: '', radiusKm: 2, options: [], votes: {}, source: 'fixture', createdAt: 0, version: 0 };

test('Qloo path resolves group signals, uses tags, and enforces distance locally', async () => {
  const original = globalThis.fetch, calls: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input); calls.push(url);
    if (url.includes('/search?')) return Response.json({ results: { entities: [{ entity_id: 'taste-anchor', name: 'Jazz', subtype: 'urn:entity:artist' }] } });
    if (url.includes('/v2/tags?')) return Response.json({ results: { tags: [{ id: 'taste-tag', name: 'Jazz' }] } });
    if (url.includes('/v2/insights?')) return Response.json({ results: { entities: [
      { entity_id: 'near', name: 'Near', properties: { location: { latitude: 40.718, longitude: -73.963 } }, query: { affinity_rank: 0.8 } },
      { entity_id: 'far', name: 'Far', properties: { location: { latitude: 40.9, longitude: -73.963 } }, query: { affinity_rank: 0.9 } },
    ] } });
    throw new Error(`Unexpected URL ${url}`);
  };
  try {
    const result = await recommend(plan, { QLOO_API_KEY: 'test' });
    assert.equal(result.source, 'qloo');
    assert.deepEqual(result.options.map(option => option.name), ['Near']);
    assert.deepEqual(result.options[0].appealsTo, ['Alex', 'Sam']);
    const insight = calls.find(url => url.includes('/v2/insights?')) || '';
    assert.ok(insight.includes('signal.interests.entities=taste-anchor'));
    assert.ok(insight.includes('signal.interests.tags=taste-tag'));
    assert.ok(insight.includes('filter.location.radius=2000'));
  } finally { globalThis.fetch = original; }
});

test('Qloo failure never falls back to fixtures in production', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('no', { status: 503 });
  try { await assert.rejects(recommend(plan, { QLOO_API_KEY: 'test' }), /Qloo unavailable/); }
  finally { globalThis.fetch = original; }
});

test('fixtures require an explicit non-production mode', async () => {
  const result = await recommend(plan, {}, 'fixture');
  assert.equal(result.source, 'fixture');
  await assert.rejects(recommend(plan, {}), /Qloo is not configured/);
});
