import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReaction, buildPlan, eligible, eraWindow, inWindow, prompts, refill, safety, validate, type Artist, type Pool, type Profile } from '../src/engine';

const artist = (id: string, over: Partial<Artist> = {}): Artist => ({ id, name: `Artist ${id}`, start: 1960, themes: ['Love'], songs: [`Song ${id}`], genres: ['Pop'], obscurity: 1, ...over });
const profile: Profile = { born: 1946, anchors: [{ id: 'anchor', name: 'Anchor' }], weights: {}, banned: [] };

test('era window is born+10 to born+30 and both ends are inclusive', () => {
  assert.deepEqual(eraWindow(1946), [1956, 1976]);
  assert.ok(inWindow({ start: 1976 }, 1946), 'starts exactly at the end');
  assert.ok(!inWindow({ start: 1977 }, 1946), 'one year after');
  assert.ok(inWindow({ start: 1930, end: 1956 }, 1946), 'ends exactly at the start');
  assert.ok(!inWindow({ start: 1930, end: 1955 }, 1946), 'ended one year before');
  assert.ok(inWindow({ start: 1930 }, 1946), 'still active');
});
test('an unknown start year is excluded', () => assert.ok(!inWindow({}, 1946)));

test('safety rejects obscure, complex, upsetting and songless artists; unknowns pass but are flagged', () => {
  assert.equal(safety(artist('a', { obscurity: 4 })).safe, false);
  assert.equal(safety(artist('a', { obscurity: 3 })).safe, true, 'threshold is inclusive');
  assert.equal(safety(artist('a', { complexity: 7 })).safe, false);
  assert.equal(safety(artist('a', { themes: ['Love', 'Heartbreak'] })).safe, false);
  assert.equal(safety(artist('a', { themes: ['Warmth'] })).safe, true, 'whole-word match only');
  assert.equal(safety(artist('a', { songs: [] })).safe, false);
  const unknown = safety(artist('a', { themes: [], obscurity: undefined }));
  assert.ok(unknown.safe && unknown.notes.includes('themes unknown') && unknown.notes.includes('familiarity unrated'));
});

test('validate enforces year range and one to three distinct anchors', () => {
  assert.deepEqual(validate({ born: 1946, anchors: [' Nana ', 'Nana', 'Elvis'], name: ' Margaret ' }), { born: 1946, name: 'Margaret', anchors: ['Nana', 'Elvis'] });
  assert.throws(() => validate({ born: 1919, anchors: ['a'] }), /1920/);
  assert.throws(() => validate({ born: 1975.5, anchors: ['a'] }));
  assert.throws(() => validate({ born: 1946, anchors: [] }), /one to three/);
  assert.throws(() => validate({ born: 1946, anchors: ['a', 'b', 'c', 'd'] }), /one to three/);
  assert.throws(() => validate(null));
});

test('plan has six songs, one per artist, all in era, and tolerates an empty or short pool', () => {
  const artists = Array.from({ length: 10 }, (_, i) => artist(String(i)));
  artists.push(artist('late', { start: 1990 }), artist('dup', { name: 'Artist 0' }));
  const plan = buildPlan({ artists, media: [] }, profile);
  assert.equal(plan.filter(i => i.kind === 'song').length, 6);
  assert.equal(new Set(plan.map(i => i.by)).size, 6);
  assert.ok(plan.every(i => i.year >= 1956 && i.year <= 1976 && i.age === i.year - 1946));
  assert.deepEqual(buildPlan({ artists: [], media: [] }, profile), []);
  assert.equal(buildPlan({ artists: artists.slice(0, 2), media: [] }, profile).length, 2);
});
test('anchored artists are marked as named, others as found', () => {
  const plan = buildPlan({ artists: [artist('anchor'), artist('x')], media: [] }, profile);
  assert.deepEqual(plan.map(i => i.found), [false, true]);
});
test('media outside the window is dropped and prompts are filled from real items', () => {
  const pool: Pool = { artists: [artist('1'), artist('2')], media: [{ id: 'm1', title: 'In Era', year: 1965, kind: 'film' }, { id: 'm2', title: 'Too Late', year: 1999, kind: 'film' }] };
  const plan = buildPlan(pool, profile);
  assert.deepEqual(plan.filter(i => i.kind === 'film').map(i => i.title), ['In Era']);
  const out = prompts(plan, profile);
  assert.equal(out.length, 3);
  assert.match(out[0], /Song 1/); assert.match(out[1], /1964/); assert.match(out[2], /In Era/);
});

test('reactions: upset bans the artist and cools genres, smiled warms them, weights stay clamped', () => {
  const item = buildPlan({ artists: [artist('1', { genres: ['Jazz'] })], media: [] }, profile)[0];
  const upset = applyReaction(profile, item, 'upset');
  assert.deepEqual(upset.banned, ['1']); assert.equal(upset.weights.Jazz, 0.5);
  assert.equal(applyReaction(upset, item, 'upset').banned.length, 1, 'no duplicate ban');
  let warm = profile; for (let i = 0; i < 10; i++) warm = applyReaction(warm, item, 'smiled');
  assert.equal(warm.weights.Jazz, 2);
  let cold = profile; for (let i = 0; i < 10; i++) cold = applyReaction(cold, item, 'upset');
  assert.equal(cold.weights.Jazz, 0.25);
  assert.deepEqual(applyReaction(profile, item, 'neutral'), profile);
  assert.deepEqual(profile.banned, [], 'input profile is not mutated');
});
test('genre weights reorder candidates but never admit an unsafe one', () => {
  const pool: Pool = { artists: [artist('a', { genres: ['Pop'] }), artist('b', { genres: ['Jazz'] }), artist('c', { genres: ['Jazz'], themes: ['Death'] })], media: [] };
  const ranked = eligible(pool, { ...profile, weights: { Jazz: 2 } }).map(a => a.id);
  assert.deepEqual(ranked, ['b', 'a']);
});
test('refill replaces an upset song with a new artist, keeps reacted-and-kept items, and runs out gracefully', () => {
  const artists = Array.from({ length: 7 }, (_, i) => artist(String(i)));
  const pool: Pool = { artists, media: [] };
  const plan = buildPlan(pool, profile).map((i, n) => n === 0 ? { ...i, reaction: 'smiled' as const } : n === 1 ? { ...i, reaction: 'upset' as const } : i);
  const after = refill(plan, pool, applyReaction(profile, plan[1], 'upset'));
  assert.equal(after[0].id, plan[0].id); assert.equal(after[0].reaction, 'smiled');
  assert.notEqual(after[1].id, plan[1].id); assert.equal(after[1].by, 'Artist 6'); assert.equal(after[1].code, 'A2');
  assert.ok(!after.some(i => i.by === 'Artist 1'));
  const few: Pool = { artists: artists.slice(0, 2), media: [] };
  const small = buildPlan(few, profile).map(i => ({ ...i, reaction: 'upset' as const }));
  assert.equal(refill(small, few, { ...profile, banned: ['0', '1'] }).every(i => i.title === 'No further song fits'), true);
});

test('a named artist with dated songs gets an exact year and age and a preview', () => {
  const named = artist('anchor', { start: 1964, known: [{ title: 'Dated', year: 1964, previewUrl: 'p' }], songs: ['Dated'] });
  const [item] = buildPlan({ artists: [named], media: [] }, profile);
  assert.deepEqual([item.title, item.year, item.age, item.ages, item.previewUrl, item.found], ['Dated', 1964, 18, [18, 18], 'p', false]);
});

test('one act under two names, and one song under two spellings, appear once', () => {
  const a = artist('a', { name: 'Bob Marley', songs: ['No Woman, No Cry'] }), b = artist('b', { name: 'Bob Marley & The Wailers', songs: ['No Woman No Cry'] }), c = artist('c', { name: 'Peter Tosh', songs: ['No Woman, No Cry'] });
  const plan = buildPlan({ artists: [a, b, c, artist('d')], media: [] }, profile);
  assert.deepEqual(plan.map(i => i.by), ['Bob Marley', 'Artist d']);
});

test('artists active around ages 15 to 25 outrank ones that only touch the window, and named songs pick the year nearest 19', () => {
  const edge = artist('edge', { start: 1900, end: 1957 }), middle = artist('middle', { start: 1962, end: 1980 });
  assert.deepEqual(buildPlan({ artists: [edge, middle], media: [] }, profile).map(i => i.artistId), ['middle', 'edge']);
  const named = artist('n', { start: 1956, known: [{ title: 'Ten', year: 1956, previewUrl: 'a' }, { title: 'Nineteen', year: 1965, previewUrl: 'b' }], songs: ['Ten', 'Nineteen'] });
  assert.equal(buildPlan({ artists: [named], media: [] }, profile)[0].title, 'Nineteen');
});
