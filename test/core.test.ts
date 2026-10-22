import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PLACES, filterPlaces, sanitizeSession, vote, winner, type Session } from '../src/core';

const base: Session = { id: 'x', artist: 'Artist', venue: 'Brooklyn Steel', venueLat: 40.7285, venueLon: -73.9386,
  members: [{ id: 'a', name: 'A', tastes: ['quiet'] }, { id: 'b', name: 'B', tastes: ['food'] }],
  note: '', radiusKm: 2, options: [], votes: {}, source: 'fixture', createdAt: 0, version: 0 };

test('distance and budget constraints cannot be overruled by ranking', () => {
  assert.equal(filterPlaces({ ...base, budget: 20 }, DEMO_PLACES).length, 2);
  assert.equal(filterPlaces({ ...base, radiusKm: 0.01 }, DEMO_PLACES).length, 0);
  assert.equal(filterPlaces({ ...base, budget: 1 }, DEMO_PLACES).length, 0);
});

test('vote is one per member and invalid choices fail', () => {
  const session = { ...base, options: [{ ...DEMO_PLACES[0], score: 1, reason: '', distanceKm: 0.1 }] };
  const once = vote(session, 'a', 'demo-1');
  const twice = vote(once, 'a', 'demo-1');
  assert.equal(Object.keys(twice.votes).length, 1);
  assert.equal(winner(twice)?.id, 'demo-1');
  assert.throws(() => vote(session, 'unknown', 'demo-1'));
  assert.throws(() => vote(session, 'a', 'missing'));
  assert.deepEqual(sanitizeSession({ ...once, options: [] }).votes, {});
});
