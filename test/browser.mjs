import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const baseUrl = process.env.BASE_URL || 'http://localhost:8787';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(baseUrl + '/');
  await page.locator('input[name="artist"]').fill('The Marías');
  await page.getByRole('button', { name: 'Start a group plan' }).click();
  await page.getByRole('heading', { name: 'The Marías · Brooklyn Steel' }).waitFor();
  const link = await page.locator('#share-url').inputValue();
  for (const [name, tastes] of [['Alex', 'quiet cafes, jazz'], ['Sam', 'late-night food'], ['Jo', 'conversation']]) {
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="tastes"]').fill(tastes);
    await page.getByRole('button', { name: 'Add preference' }).click();
    await page.locator('.member').filter({ hasText: name }).waitFor();
  }
  assert.equal(await page.locator('.option').count(), 3);
  await page.locator('.option').first().locator('select').selectOption({ label: 'Alex' });
  await page.locator('.option').first().getByRole('button', { name: 'Vote' }).click();
  await page.locator('.option.winner').waitFor();
  await page.locator('input[name="budget"]').fill('20');
  await page.locator('input[name="note"]').fill('Somewhere quieter');
  await page.getByRole('button', { name: 'Replan' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.option').length <= 2);
  assert.ok(await page.locator('.option').count() <= 2);
  await page.reload();
  await page.getByRole('heading', { name: 'The Marías · Brooklyn Steel' }).waitFor();
  assert.equal(await page.locator('.member').count(), 3);
  await page.screenshot({ path: '/tmp/encore-browser.png', fullPage: true });
  const second = await browser.newPage();
  await second.goto(baseUrl + '/');
  await second.locator('input[name="artist"]').fill('Another Artist');
  await second.getByRole('button', { name: 'Start a group plan' }).click();
  assert.notEqual(await second.locator('#share-url').inputValue(), link);
  console.log('Browser flow passed:', link);
} finally { await browser.close(); }
