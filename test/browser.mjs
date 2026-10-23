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
  await page.locator('#start-error').filter({ hasText: 'Qloo is not configured yet.' }).waitFor();
  assert.equal(await page.locator('#demo-start').evaluate(element => !element.hidden), true);
  console.log('Browser flow passed');
} finally { await browser.close(); }
