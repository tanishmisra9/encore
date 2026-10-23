// Local Discord sandbox: a mock Discord API plus signed interactions drive the real Worker end to end.
// Real Qloo is used (needs QLOO_API_KEY in .dev.vars). Run: npm run sandbox
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { generateKeyPairSync, sign, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const WORKER = 'http://localhost:8788', MOCK_PORT = 8799, CHANNEL = 'chan-1', APP = '1562884435278565416';
const qlooKey = readFileSync('.dev.vars', 'utf8').match(/QLOO_API_KEY=(.+)/)?.[1].trim();
assert.ok(qlooKey, 'QLOO_API_KEY is required in .dev.vars');

// Discord signs interactions with Ed25519; the sandbox holds its own keypair and hands the Worker the public half.
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const publicHex = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
async function interact(body, tamper = false) {
  const text = JSON.stringify({ application_id: APP, token: randomUUID(), id: randomUUID(), channel_id: CHANNEL, ...body });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign(null, Buffer.from(timestamp + (tamper ? text + ' ' : text)), privateKey).toString('hex');
  const response = await fetch(`${WORKER}/discord/interactions`, { method: 'POST', headers: { 'X-Signature-Ed25519': signature, 'X-Signature-Timestamp': timestamp, 'Content-Type': 'application/json' }, body: text });
  return { status: response.status, json: response.ok ? await response.json() : null, token: JSON.parse(text).token };
}

// Mock Discord: seeded channel history, plus a log of everything the Worker sends back.
const chat = [
  { author: { id: 'u-alex', username: 'alex' }, content: 'I like quiet jazz. My cat is called canary-xyzzy' },
  { author: { id: 'u-sam', username: 'sam' }, content: 'I want late-night food' },
  { author: { id: 'u-jo', username: 'jo' }, content: 'budget under $40 please' },
  { author: { id: 'u-bot', username: 'bot', bot: true }, content: 'ignored bot message' },
];
const edits = [], posts = [], patches = [];
const mock = createServer((req, res) => {
  let raw = ''; req.on('data', chunk => raw += chunk); req.on('end', () => {
    const body = raw ? JSON.parse(raw) : null, send = (value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (req.method === 'GET' && req.url.startsWith(`/channels/${CHANNEL}/messages`)) return send(chat);
    if (req.method === 'PATCH' && req.url.includes('/webhooks/')) { edits.push({ token: req.url.split('/')[3], body }); return send({}); }
    if (req.method === 'POST' && req.url === `/channels/${CHANNEL}/messages`) { posts.push(body); return send({ id: `msg-${posts.length}` }); }
    if (req.method === 'PATCH' && req.url.startsWith(`/channels/${CHANNEL}/messages/`)) { patches.push({ id: req.url.split('/').pop(), body }); return send({}); }
    send({ error: `mock: unhandled ${req.method} ${req.url}` }, 404);
  });
});
await new Promise(resolve => mock.listen(MOCK_PORT, resolve));

// Fresh local D1 so runs never depend on earlier state.
const persist = mkdtempSync(join(tmpdir(), 'encore-sandbox-'));
execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'encore', '--local', '--persist-to', persist], { stdio: 'ignore' });
const worker = spawn('npx', ['wrangler', 'dev', '--port', '8788', '--persist-to', persist,
  '--var', `DISCORD_PUBLIC_KEY:${publicHex}`, '--var', 'DISCORD_BOT_TOKEN:sandbox-token', '--var', `DISCORD_API_BASE:http://localhost:${MOCK_PORT}`, '--var', `QLOO_API_KEY:${qlooKey}`], { stdio: 'ignore' });
const until = async (label, check, ms = 40000) => { const end = Date.now() + ms; while (Date.now() < end) { const value = check(); if (value) return value; await new Promise(r => setTimeout(r, 250)); } throw new Error(`Timed out waiting for ${label}`); };
const slash = (ask, useRecentChat = true, user = 'u-alex') => interact({ type: 2, member: { user: { id: user, username: user } }, data: { name: 'encore', options: [{ name: 'ask', value: ask }, { name: 'use_recent_chat', value: useRecentChat }] } });
const optionOf = plan => plan.components[0].components.find(c => c.custom_id.startsWith('vote:'));
let browser, passed = 0;
const step = (name) => { passed++; console.log(`ok ${passed} ${name}`); };

try {
  await until('worker', async () => null, 1).catch(() => {});
  for (let i = 0; i < 60; i++) { try { if ((await fetch(WORKER + '/privacy.html')).ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }

  // 1. Discord handshake and signature enforcement.
  assert.equal((await interact({ type: 1 })).json.type, 1); step('signed ping is acknowledged');
  assert.equal((await interact({ type: 1 }, true)).status, 401); step('tampered signature is rejected');

  // 2. No place named: private reply with a one-time location link, then the browser hands over coordinates.
  const noPlace = await slash('what should we do tonight?');
  assert.equal(noPlace.json.type, 5); assert.equal(noPlace.json.data.flags, 64); step('missing location gets an ephemeral deferral');
  const linkEdit = await until('location link', () => edits.find(e => e.token === noPlace.token));
  const url = linkEdit.body.components[0].components[0].url;
  assert.match(url, new RegExp(`^${WORKER}/locate\\.html\\?handoff=[0-9a-f-]{36}$`)); step('reply carries a one-time location link');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ geolocation: { latitude: 40.7178, longitude: -73.9632 }, permissions: ['geolocation'], viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  await page.goto(url); await page.getByRole('button', { name: 'Use my current location' }).click();
  await page.locator('#location-status').filter({ hasText: 'Location shared' }).waitFor({ timeout: 40000 }); step('browser location approval posts coordinates');
  const plan = await until('plan post', () => posts[0]);
  assert.match(plan.content, /Encore · Shared current location/); assert.match(plan.content, /Qloo taste graph/);
  const options = plan.content.match(/^\d\. \*\*/gm) || []; assert.ok(options.length >= 1, 'plan lists places'); step(`plan posted to the channel with ${options.length} Qloo places`);
  assert.ok(!plan.content.includes('canary-xyzzy') && !plan.content.includes('cat is called'), 'raw chat must not be echoed'); step('raw chat text is not echoed to the channel');

  // 3. The link works once.
  const again = await fetch(url.replace(`${WORKER}/locate.html?handoff=`, `${WORKER}/api/location-handoffs/`), { method: 'POST', body: JSON.stringify({ lat: 40.7, lon: -74 }) });
  assert.equal(again.status, 404); step('location link cannot be reused');

  // 4. Vote and replan through signed component and modal interactions.
  const planId = optionOf(plan).custom_id.split(':')[1];
  const vote = { type: 3, message: { id: 'msg-1' }, member: { user: { id: 'u-sam', username: 'sam' } }, data: { custom_id: optionOf(plan).custom_id } };
  assert.equal((await interact(vote)).json.type, 6);
  const voted = await until('vote edit', () => patches.find(p => p.body.content.includes('1 vote(s)'))); step('vote updates the channel message');
  assert.ok(voted.body.content.includes('🏆')); step('leading option is marked');
  const replan = await interact({ type: 5, message: { id: 'msg-1' }, member: { user: { id: 'u-alex', username: 'alex' } }, data: { custom_id: `replan:${planId}:msg-1`, components: [{ components: [{ custom_id: 'note', value: 'quieter' }, { custom_id: 'budget', value: '35' }, { custom_id: 'radius', value: '1' }] }] } });
  assert.equal(replan.json.type, 5);
  const replanned = await until('replan edit', () => patches.find(p => p.body.content.includes('budget $35') && p.body.content.includes('radius 1 km'))); step('replan applies budget and radius');
  assert.ok(!replanned.body.content.includes('🏆') && !/[1-9] vote\(s\)/.test(replanned.body.content), 'replan clears votes'); step('replan clears earlier votes');
  const stranger = await interact({ ...vote, channel_id: 'other-channel' });
  assert.equal(stranger.json.type, 6); await new Promise(r => setTimeout(r, 1500));
  assert.equal(patches.filter(p => /[1-9] vote\(s\)/.test(p.body.content)).length, 1); step('a vote from another channel is ignored');

  // 5. Named place skips the browser step; no stated tastes stops cleanly.
  const named = await slash('what should we do in Williamsburg tonight?');
  assert.equal(named.json.data, undefined); const namedEdit = await until('named plan', () => edits.find(e => e.token === named.token));
  assert.match(namedEdit.body.content, /Encore · Williamsburg, Brooklyn/); step('named place plans without the browser step');
  const bare = await slash('what should we do in Williamsburg tonight?', false);
  const bareEdit = await until('no-taste reply', () => edits.find(e => e.token === bare.token));
  assert.match(bareEdit.body.content, /needs one stated group taste/); step('no stated taste stops with a clear message');

  // 6. Persistence: nothing from the raw chat reaches the database.
  const dump = execFileSync('npx', ['wrangler', 'd1', 'execute', 'encore', '--local', '--persist-to', persist, '--json', '--command', 'SELECT body FROM plans'], { encoding: 'utf8' });
  assert.ok(!dump.includes('canary-xyzzy') && !dump.includes('cat is called') && !dump.includes('ignored bot message')); step('database holds no raw chat text');
  console.log(`Sandbox passed (${passed} checks)`);
} catch (error) { console.error('Sandbox failed:', error.message); process.exitCode = 1; }
finally { await browser?.close(); worker.kill('SIGTERM'); mock.close(); setTimeout(() => process.exit(process.exitCode || 0), 500); }
