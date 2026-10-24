import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryCache, previewFor, resolveAnchor, runAgent, toArtist, type Cache } from '../src/qloo';

const fresh = (): Cache => { const m = new Map<string, unknown>(); return { async get(k) { return m.get(k) ?? null; }, async set(k, v) { m.set(k, v); } }; };
const ent = (id: string, name: string, p: Record<string, unknown> = {}) => ({ entity_id: id, name, properties: { start_year: 1962, obscurity_scale: ['1'], lyrical_themes: ['Love'], notable_songs: [`${name} Song`], primary_genres: ['Pop'], ...p } });
async function withFetch(handler: (url: string) => Response | Promise<Response>, run: () => Promise<void>) {
  const original = globalThis.fetch; globalThis.fetch = (async (input: unknown) => handler(String(input))) as typeof fetch;
  try { await run(); } finally { globalThis.fetch = original; }
}

test('toArtist reads Qloo field shapes (arrays, nulls) and drops entities without an id', () => {
  const a = toArtist({ entity_id: 'x', name: 'X', properties: { start_year: 1965, end_year: null, obscurity_scale: ['3'], complexity_scale: null, notable_songs: ['A', 'B', 'C', 'D', 'E'], image: { url: 'u' } } })!;
  assert.deepEqual([a.start, a.end, a.obscurity, a.complexity, a.songs.length, a.image], [1965, undefined, 3, undefined, 4, 'u']);
  assert.equal(toArtist({ name: 'no id' }), null);
});
test('anchor resolution rejects a fuzzy match whose name differs', async () => {
  await withFetch(() => Response.json({ results: [{ entity_id: '1', name: 'Totally Different Band' }] }), async () => {
    assert.equal(await resolveAnchor('Zzqxv Band 9000', 'k', fresh()), null);
  });
  await withFetch(() => Response.json({ results: [{ entity_id: '1', name: 'Nana Mouskouri' }] }), async () => {
    const hit = await resolveAnchor('nana mouskouri', 'k', fresh()); assert.deepEqual([hit?.id, hit?.name], ['1', 'Nana Mouskouri']);
  });
});
test('agent re-anchors until enough safe in-era artists, then stops at the hop limit', async () => {
  let insights = 0;
  await withFetch(url => {
    if (url.includes('/search?')) return Response.json({ results: [{ entity_id: 'anchor', name: 'Anchor' }] });
    if (url.includes('urn%3Aentity%3Aartist')) { insights++; const base = insights * 100; return Response.json({ results: { entities: Array.from({ length: 5 }, (_, i) => ent(`h${base + i}`, `Artist ${base + i}`)) } }); }
    return Response.json({ results: { entities: [{ ...ent('m1', 'A Film'), properties: { release_year: 1966, image: { url: 'i' } } }] } });
  }, async () => {
    const result = await runAgent({ born: 1946, anchors: ['Anchor', 'Missing'] }, 'k', fresh());
    assert.equal(insights, 3, 'three hops of five artists never reach fifteen safe, so it stops at the limit');
    assert.equal(result.pool.artists.length, 16, 'the named artist plus fifteen found');
    assert.deepEqual(result.unresolved, ['Missing']);
    assert.ok(result.trace.some(s => s.text.startsWith('Kept artists active 1956 to 1976')));
    assert.deepEqual(result.pool.media.map(m => m.kind), ['film', 'show']);
  });
});
test('agent fails clearly when no anchor resolves', async () => {
  await withFetch(() => Response.json({ results: [] }), async () => {
    await assert.rejects(runAgent({ born: 1946, anchors: ['Nobody'] }, 'k', fresh()), /could not find Nobody/);
  });
});
test('rate limiting retries, then reports Qloo busy without a generic fallback', async () => {
  let calls = 0;
  await withFetch(() => { calls++; return new Response('', { status: 429 }); }, async () => {
    await assert.rejects(runAgent({ born: 1946, anchors: ['X'] }, 'k-busy', fresh()), /busy/);
    assert.equal(calls, 3);
  });
});
test('preview requires the artist name to match and caches misses', async () => {
  let calls = 0;
  const cache = fresh();
  await withFetch(() => { calls++; return Response.json({ results: [{ previewUrl: 'wrong', artistName: 'Someone Else' }, { previewUrl: 'right', artistName: 'Nana Mouskouri' }] }); }, async () => {
    assert.equal(await previewFor('Song', 'Nana Mouskouri', cache), 'right');
    assert.equal(await previewFor('Song', 'Nana Mouskouri', cache), 'right'); assert.equal(calls, 1);
  });
  await withFetch(() => Response.json({ results: [{ previewUrl: 'wrong', artistName: 'Someone Else' }] }), async () => {
    assert.equal(await previewFor('Other', 'Nana Mouskouri', cache), null);
  });
  void memoryCache;
});
