import test from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../src/providers';
import type { Session } from '../src/core';

const plan: Session = { id: 'p', artist: 'The Marías', venue: 'Brooklyn Steel', venueLat: 40.7285, venueLon: -73.9386,
  members: [{ id: 'a', name: 'Alex', tastes: ['quiet'] }], note: '', radiusKm: 2, options: [], votes: {}, source: 'fixture', createdAt: 0, version: 0 };

test('Qloo path uses artist signal and place insights, then enforces distance locally', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input); calls.push(url);
    if (url.includes('/search?')) return Response.json({ results: { entities: [{ entity_id: 'artist-id', name: 'The Marías', subtype: 'urn:entity:artist' }] } });
    if (url.includes('/v2/insights?')) return Response.json({ results: { entities: [
      { entity_id: 'near', name: 'Near', properties: { location: { latitude: 40.729, longitude: -73.938 } }, query: { affinity_rank: 0.8 } },
      { entity_id: 'far', name: 'Far', properties: { location: { latitude: 40.9, longitude: -73.938 } }, query: { affinity_rank: 0.9 } },
    ] } });
    throw new Error(`Unexpected URL ${url}`);
  };
  try {
    const result = await recommend(plan, { QLOO_API_KEY: 'test' });
    assert.equal(result.source, 'qloo');
    assert.deepEqual(result.options.map(option => option.name), ['Near']);
    assert.equal(result.options[0].price, undefined);
    assert.ok(calls[1].includes('signal.interests.entities=artist-id'));
    assert.ok(calls[1].includes('filter.location.radius=2000'));
  } finally { globalThis.fetch = original; }
});

test('Qloo failure never falls back to provisional recommendations', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('no', { status: 503 });
  try { await assert.rejects(recommend(plan, { QLOO_API_KEY: 'test', OPENAI_API_KEY: 'test' }), /Qloo unavailable/); }
  finally { globalThis.fetch = original; }
});
