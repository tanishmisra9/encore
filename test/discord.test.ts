import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDiscord } from '../src/discord';
import type { Session } from '../src/core';

test('Discord rejects tampered signatures and acknowledges a signed request', async () => {
  const keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', keys.publicKey)).toString('hex');
  const sign = async (body: string) => Buffer.from(await crypto.subtle.sign('Ed25519', keys.privateKey, new TextEncoder().encode('123' + body))).toString('hex');
  const body = JSON.stringify({ type: 1 });
  const headers = { 'X-Signature-Timestamp': '123', 'X-Signature-Ed25519': await sign(body) };
  const store = { read: async () => null, insert: async () => {}, update: async () => false };
  const context = { waitUntil: () => {} } as unknown as ExecutionContext;
  const url = 'https://example.com/discord/interactions';
  const valid = await handleDiscord(new Request(url, { method: 'POST', headers, body }), { DISCORD_PUBLIC_KEY: publicKey }, context, store);
  assert.deepEqual(await valid.json(), { type: 1 });
  const invalid = await handleDiscord(new Request(url, { method: 'POST', headers, body: body + ' ' }), { DISCORD_PUBLIC_KEY: publicKey }, context, store);
  assert.equal(invalid.status, 401);
});

test('opt-in command reads only 25 messages and stores extracted statements, not raw chat', async () => {
  const keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', keys.publicKey)).toString('hex');
  const payload = { type: 2, id: 'interaction', token: 'one-use-token', application_id: 'app', channel_id: 'channel',
    data: { name: 'encore', options: [{ name: 'artist', value: 'The Marías' }, { name: 'venue', value: 'Brooklyn Steel' }, { name: 'use_recent_chat', value: true }] } };
  const body = JSON.stringify(payload);
  const signature = Buffer.from(await crypto.subtle.sign('Ed25519', keys.privateKey, new TextEncoder().encode('123' + body))).toString('hex');
  const requests: string[] = [], pending: Promise<unknown>[] = [], plans: Session[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input); requests.push(url);
    if (url.includes('/messages?limit=25')) return Response.json(Array.from({ length: 26 }, (_, i) => ({ author: { id: String(i), username: `u${i}` }, content: i === 0 ? 'I prefer quiet cafés. private tail' : 'random chat' })));
    if (url.includes('/webhooks/')) return Response.json({ id: 'message' });
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const context = { waitUntil: (promise: Promise<unknown>) => { pending.push(promise); } } as unknown as ExecutionContext;
    const store = { read: async () => null, insert: async (plan: Session) => { plans.push(plan); }, update: async () => false };
    const response = await handleDiscord(new Request('https://example.com/discord/interactions', { method: 'POST',
      headers: { 'X-Signature-Timestamp': '123', 'X-Signature-Ed25519': signature }, body }),
      { DISCORD_PUBLIC_KEY: publicKey, DISCORD_BOT_TOKEN: 'test' }, context, store);
    assert.deepEqual(await response.json(), { type: 5 });
    await Promise.all(pending);
    assert.equal(plans[0].discord?.contextRead, 25);
    assert.deepEqual(plans[0].members[0].tastes, ['quiet cafés']);
    assert.ok(!JSON.stringify(plans[0]).includes('private tail'));
    assert.ok(requests.some(url => url.includes('limit=25')));
  } finally { globalThis.fetch = originalFetch; }
});
