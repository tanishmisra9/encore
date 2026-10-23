import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_LOCATION, DEMO_PLACES, filterPlaces, resolveLocation, sanitizeSession, signalsFor, vote, winner, type Session } from '../src/core';

const base: Session = { id: 'x', request: 'What should we do in Williamsburg tonight?', location: DEMO_LOCATION,
  members: [{ id: 'a', name: 'A', tastes: ['quiet'] }, { id: 'b', name: 'B', tastes: ['food'] }],
  signals: [], note: '', radiusKm: 2, options: [], votes: {}, source: 'fixture', createdAt: 0, version: 0 };

test('distance and budget constraints cannot be overruled by ranking', () => {
  assert.equal(filterPlaces({ ...base, budget: 20 }, DEMO_PLACES).length, 2);
  assert.equal(filterPlaces({ ...base, radiusKm: 0.01 }, DEMO_PLACES).length, 0);
  assert.equal(filterPlaces({ ...base, budget: 1 }, DEMO_PLACES).length, 0);
});

test('location and explicit signals stay bounded', () => {
  assert.equal(resolveLocation('What should we do in Williamsburg tonight?')?.label, 'Williamsburg, Brooklyn');
  assert.equal(resolveLocation('What should we do tonight?'), null);
  assert.deepEqual(signalsFor(base.members, 'Under $35').map(signal => signal.value), ['quiet', 'food', 'Under $35']);
});

test('vote is one per member and invalid choices fail', () => {
  const session: Session = { ...base, options: [{ ...DEMO_PLACES[0], score: 1, reason: '', appealsTo: [], distanceKm: 0.1 }] };
  const once = vote(session, 'a', 'demo-1');
  const twice = vote(once, 'a', 'demo-1');
  assert.equal(Object.keys(twice.votes).length, 1);
  assert.equal(winner(twice)?.id, 'demo-1');
  assert.throws(() => vote(session, 'unknown', 'demo-1'));
  assert.throws(() => vote(session, 'a', 'missing'));
  assert.deepEqual(sanitizeSession({ ...once, options: [] }).votes, {});
});

test('a stated budget keeps places with unknown price and drops known over-budget ones', () => {
  const places = [{ ...DEMO_PLACES[0], price: undefined }, { ...DEMO_PLACES[1], price: 50 }];
  assert.deepEqual(filterPlaces({ ...base, budget: 20 }, places).map(place => place.id), [DEMO_PLACES[0].id]);
});
