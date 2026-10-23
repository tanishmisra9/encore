import test from 'node:test';
import assert from 'node:assert/strict';
import { completeLocation, handleDiscord, type LocationHandoff } from '../src/discord';
import type { Session } from '../src/core';

test('Discord rejects tampered signatures and acknowledges a signed request', async () => {
  const keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', keys.publicKey)).toString('hex');
  const sign = async (body: string) => Buffer.from(await crypto.subtle.sign('Ed25519', keys.privateKey, new TextEncoder().encode('123' + body))).toString('hex');
  const body = JSON.stringify({ type: 1 }), headers = { 'X-Signature-Timestamp': '123', 'X-Signature-Ed25519': await sign(body) };
  const store = { read: async () => null, insert: async () => {}, update: async () => false, createHandoff: async () => {} };
  const context = { waitUntil: () => {} } as unknown as ExecutionContext;
  const valid = await handleDiscord(new Request('https://example.com/discord/interactions', { method: 'POST', headers, body }), { DISCORD_PUBLIC_KEY: publicKey }, context, store);
  assert.deepEqual(await valid.json(), { type: 1 });
  const invalid = await handleDiscord(new Request('https://example.com/discord/interactions', { method: 'POST', headers, body: body + ' ' }), { DISCORD_PUBLIC_KEY: publicKey }, context, store);
  assert.equal(invalid.status, 401);
});

test('opt-in command reads only 25 messages and stores extracted statements, not raw chat', async () => {
  const keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', keys.publicKey)).toString('hex');
  const payload = { type: 2, id: 'interaction', token: 'one-use-token', application_id: 'app', channel_id: 'channel', data: { name: 'encore', options: [{ name: 'ask', value: 'What should we do in Williamsburg tonight?' }, { name: 'use_recent_chat', value: true }] } };
  const body = JSON.stringify(payload), signature = Buffer.from(await crypto.subtle.sign('Ed25519', keys.privateKey, new TextEncoder().encode('123' + body))).toString('hex');
  const requests: string[] = [], pending: Promise<unknown>[] = [], plans: Session[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input); requests.push(url);
    if (url.includes('/messages?limit=25')) return Response.json(Array.from({ length: 26 }, (_, i) => ({ author: { id: String(i), username: `u${i}` }, content: i === 0 ? 'I prefer quiet cafés. private tail' : 'random chat' })));
    if (url.includes('/search?')) return Response.json({ results: { entities: [{ entity_id: 'id', name: 'Jazz' }] } });
    if (url.includes('/v2/tags?')) return Response.json({ results: { tags: [{ id: 'tag', name: 'Jazz' }] } });
    if (url.includes('/v2/insights?')) return Response.json({ results: { entities: [{ entity_id: 'near', name: 'Near', properties: { location: { latitude: 40.718, longitude: -73.963 } } }] } });
    if (url.includes('/webhooks/')) return Response.json({ id: 'message' });
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const context = { waitUntil: (promise: Promise<unknown>) => { pending.push(promise); } } as unknown as ExecutionContext;
    const store = { read: async () => null, insert: async (plan: Session) => { plans.push(plan); }, update: async () => false, createHandoff: async () => {} };
    const response = await handleDiscord(new Request('https://example.com/discord/interactions', { method: 'POST', headers: { 'X-Signature-Timestamp': '123', 'X-Signature-Ed25519': signature }, body }), { DISCORD_PUBLIC_KEY: publicKey, DISCORD_BOT_TOKEN: 'test', QLOO_API_KEY: 'test' }, context, store);
    assert.deepEqual(await response.json(), { type: 5 }); await Promise.all(pending);
    assert.equal(plans[0].discord?.contextRead, 25);
    assert.deepEqual(plans[0].members[0].tastes, ['quiet cafés']);
    assert.ok(!JSON.stringify(plans[0]).includes('private tail'));
    assert.ok(requests.some(url => url.includes('limit=25')));
  } finally { globalThis.fetch = originalFetch; }
});

test('missing location gets a concise follow-up without reading channel context', async () => {
  const keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', keys.publicKey)).toString('hex');
  const payload = { type: 2, id: 'interaction', token: 'one-use-token', application_id: 'app', channel_id: 'channel', member: { user: { id: 'starter', username: 'Starter' } }, data: { name: 'encore', options: [{ name: 'ask', value: 'What should we do tonight?' }, { name: 'use_recent_chat', value: true }] } };
  const body = JSON.stringify(payload), signature = Buffer.from(await crypto.subtle.sign('Ed25519', keys.privateKey, new TextEncoder().encode('123' + body))).toString('hex');
  const requests: string[] = [], pending: Promise<unknown>[] = [], handoffs: unknown[] = [];
  const originalFetch = globalThis.fetch; globalThis.fetch = async input => { requests.push(String(input)); return Response.json({ id: 'message' }); };
  try {
    const context = { waitUntil: (promise: Promise<unknown>) => { pending.push(promise); } } as unknown as ExecutionContext;
    const response = await handleDiscord(new Request('https://example.com/discord/interactions', { method: 'POST', headers: { 'X-Signature-Timestamp': '123', 'X-Signature-Ed25519': signature }, body }), { DISCORD_PUBLIC_KEY: publicKey, DISCORD_BOT_TOKEN: 'test' }, context, { read: async () => null, insert: async () => {}, update: async () => false, createHandoff: async (handoff: unknown) => { handoffs.push(handoff); } });
    assert.deepEqual(await response.json(), { type: 5, data: { flags: 64 } }); await Promise.all(pending);
    assert.equal(requests.some(url => url.includes('/messages?limit=25')), false);
    assert.equal(handoffs.length, 1);
    assert.match(requests.find(url => url.includes('/webhooks/')) || '', /webhooks/);
  } finally { globalThis.fetch = originalFetch; }
});


test('location handoff uses browser coordinates once and posts the plan to its Discord channel', async () => {
  const calls: string[] = [], plans: Session[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input); calls.push(url);
    if (url.includes('/messages?limit=25')) return Response.json([{ author: { id: 'a', username: 'Alex' }, content: 'I love quiet jazz.' }]);
    if (url.includes('/search?')) return Response.json({ results: { entities: [{ entity_id: 'jazz', name: 'Jazz' }] } });
    if (url.includes('/v2/tags?')) return Response.json({ results: { tags: [{ id: 'jazz-tag', name: 'Jazz' }] } });
    if (url.includes('/v2/insights?')) return Response.json({ results: { entities: [{ entity_id: 'near', name: 'Near', properties: { location: { latitude: 40.718, longitude: -73.963 } } }] } });
    if (url.includes('/channels/channel/messages')) return Response.json({ id: 'posted' });
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const handoff: LocationHandoff = { id: crypto.randomUUID(), channelId: 'channel', request: 'What should we do tonight?', userId: 'starter', useRecentChat: true, expiresAt: Date.now() + 60_000 };
    const store = { read: async () => null, insert: async (plan: Session) => { plans.push(plan); }, update: async () => false, createHandoff: async () => {} };
    await completeLocation(handoff, { lat: 40.7178, lon: -73.9632 }, { DISCORD_BOT_TOKEN: 'test', QLOO_API_KEY: 'test' }, store);
    assert.deepEqual(plans[0].location, { label: 'Shared current location', lat: 40.7178, lon: -73.9632 });
    assert.ok(calls.some(url => url.includes('filter.location=POINT%28-73.9632+40.7178%29')));
    assert.ok(calls.some(url => url.includes('/channels/channel/messages')));
  } finally { globalThis.fetch = originalFetch; }
});
