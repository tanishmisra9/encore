import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.BASE_URL || 'https://encore.encore-tanishmisra9.workers.dev';
const outputDir = process.env.RECORDING_DIR || '/tmp/encore-demo-recording';
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outputDir, size: { width: 1280, height: 720 } }
});
const page = await context.newPage();
await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(11000);
await page.getByRole('button', { name: 'Run the guided demo' }).click();
await page.getByRole('heading', { name: 'The Marías · Brooklyn Steel' }).waitFor();
await page.waitForTimeout(9000);
await page.locator('.voices').scrollIntoViewIfNeeded();
await page.waitForTimeout(9000);
await page.locator('.shortlist').scrollIntoViewIfNeeded();
await page.waitForTimeout(8000);
await page.locator('.option').first().locator('select').selectOption({ label: 'Alex' });
await page.waitForTimeout(1300);
await page.locator('.option').first().getByRole('button', { name: 'Vote' }).click();
await page.waitForTimeout(9000);
await page.locator('.replan').scrollIntoViewIfNeeded();
await page.waitForTimeout(5000);
await page.locator('input[name="note"]').pressSequentially('Somewhere quieter, with food', { delay: 40 });
await page.locator('input[name="budget"]').pressSequentially('20', { delay: 180 });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Replan' }).click();
await page.waitForTimeout(7000);
await page.locator('.shortlist').scrollIntoViewIfNeeded();
await page.waitForTimeout(12000);

const video = page.video();
await page.close();
await context.close();
await browser.close();
console.log(await video.path());
