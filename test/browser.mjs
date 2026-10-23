import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL || 'http://localhost:8787';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(baseUrl + '/');
  await page.getByRole('heading', { name: 'A Friday night in Williamsburg' }).waitFor();
  await page.getByRole('button', { name: 'Pause' }).click();
  assert.equal(await page.getByRole('button', { name: 'Play', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Replay' }).click();
  await page.screenshot({ path: '/tmp/encore-home.png', fullPage: true });

  await page.goto(baseUrl + '/locate.html');
  await page.locator('#location-status').filter({ hasText: 'invalid or has expired' }).waitFor();

  await page.goto(baseUrl + '/demo.html?fixture=1');
  await page.getByRole('button', { name: 'Start the Friday-night plan' }).click();
  await page.getByRole('heading', { name: 'Places where the night can meet.' }).waitFor();
  assert.equal(await page.locator('.demo-option').count(), 3);
  await page.locator('.demo-option').first().getByRole('button', { name: /Choose this/ }).click();
  await page.locator('.demo-option.winner').waitFor();
  await page.getByRole('button', { name: 'Replan around that' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.demo-option').length <= 3);
  assert.equal(await page.locator('#demo-error').textContent(), '');
  await page.screenshot({ path: '/tmp/encore-demo.png', fullPage: true });

  await page.goto(baseUrl + '/demo.html');
  await page.getByRole('button', { name: 'Start the Friday-night plan' }).click();
  // Locally this is the setup error; with a QLOO_API_KEY in .dev.vars it is a live Qloo plan.
  await page.locator('#start-error:not(:empty), .demo-option').first().waitFor();
  if (await page.locator('#start-error:not(:empty)').count()) {
    await page.locator('#start-error').filter({ hasText: 'Qloo is not configured yet.' }).waitFor();
    assert.equal(await page.locator('#demo-start').evaluate(element => !element.hidden), true);
  }
  // Location handoff: grant geolocation, check the exact coordinates reach the API, then the success state.
  const handoff = '22222222-2222-2222-2222-222222222222';
  const geo = await browser.newContext({ geolocation: { latitude: 40.7178, longitude: -73.9632 }, permissions: ['geolocation'], viewport: { width: 390, height: 800 } });
  const locate = await geo.newPage();
  let posted;
  await locate.route('**/api/location-handoffs/*', route => { posted = { url: route.request().url(), body: route.request().postDataJSON() }; route.fulfill({ json: { posted: true } }); });
  await locate.goto(`${baseUrl}/locate.html?handoff=${handoff}`);
  await locate.getByRole('button', { name: 'Use my current location' }).click();
  await locate.locator('#location-status').filter({ hasText: 'Location shared' }).waitFor();
  assert.ok(posted.url.endsWith(handoff));
  assert.deepEqual(posted.body, { lat: 40.7178, lon: -73.9632 });
  await locate.screenshot({ path: '/tmp/encore-locate.png', fullPage: true });
  const denied = await browser.newContext();
  const refused = await denied.newPage();
  await refused.goto(`${baseUrl}/locate.html?handoff=${handoff}`);
  await refused.getByRole('button', { name: 'Use my current location' }).click();
  await refused.locator('#location-status').filter({ hasText: /not granted|could not get/ }).waitFor();
  console.log('Browser flow passed');
} finally { await browser.close(); }
