// Real-browser check of the whole flow against a running Worker (default http://localhost:8787, live Qloo).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://localhost:8787', shots = process.env.SHOTS;
const browser = await chromium.launch();
try {
  for (const [name, width, height] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
    const page = await (await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })).newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && !/favicon|fonts/.test(m.text()) && errors.push(m.text()));
    await page.goto(base + '/');
    await page.locator('.strip:not(.blank)').first().waitFor({ timeout: 90000 });
    const songs = page.locator('.strip .play');
    assert.ok(await songs.count() >= 4, `${name}: at least four songs have audio`);
    // No horizontal scroll, and no pill-shaped controls.
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no horizontal scroll`);
    const pills = await page.evaluate(() => [...document.querySelectorAll('*')].filter(el => { const r = parseFloat(getComputedStyle(el).borderTopLeftRadius); return r > 8; }).map(el => el.tagName));
    assert.deepEqual(pills, [], `${name}: no rounded or pill shapes`);
    // Touch targets.
    const small = await page.evaluate(() => [...document.querySelectorAll('button, a.button, input, select')].filter(el => { const b = el.getBoundingClientRect(); return b.width && (b.height < 44) && getComputedStyle(el).visibility !== 'hidden'; }).map(el => el.id || el.className));
    assert.deepEqual(small, [], `${name}: controls are at least 44px tall`);
    if (shots) await page.screenshot({ path: `${shots}/${name}-top.png` });

    // Play one strip: audio element has a preview URL and the strip reveals reactions.
    const first = page.locator('.strip').first();
    await first.locator('.play').click();
    assert.ok(await first.evaluate(el => el.classList.contains('open') && el.classList.contains('playing')));
    await first.locator('.play').click();
    // Upset removes the song and puts a different one in the same slot.
    const before = await first.locator('.title').textContent(), code = await first.locator('.code').innerText();
    await first.locator('[data-react="upset"]').click();
    await page.waitForFunction(([c, t]) => { const s = [...document.querySelectorAll('.strip')].find(e => e.querySelector('.code')?.textContent === c); return s && s.querySelector('.title').textContent !== t; }, [code, before], { timeout: 60000 });
    // Smiled is kept and reflected in the summary.
    const second = page.locator('.strip').nth(1), keep = await second.locator('.title').textContent();
    await second.locator('.toggle').click(); await second.locator('[data-react="smiled"]').click();
    await page.waitForFunction(t => [...document.querySelectorAll('.strip.reacted-smiled .title')].some(e => e.textContent === t), keep, { timeout: 60000 });
    assert.ok(await page.locator('#wall.still').count(), `${name}: a reaction does not replay the entrance animation`);
    const href = await page.locator('#summary-link').getAttribute('href');
    await page.goto(base + href); await page.getByRole('heading', { name: /What works/ }).waitFor();
    await page.waitForFunction(t => document.querySelector('#groups')?.textContent.includes(t), keep, { timeout: 30000 });
    if (shots) await page.screenshot({ path: `${shots}/${name}-summary.png`, fullPage: true });
    // Delete makes the session disappear.
    const id = new URL(base + href).searchParams.get('id');
    assert.equal((await fetch(`${base}/api/sessions/${id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await fetch(`${base}/api/sessions/${id}`)).status, 404);
    assert.deepEqual(errors, [], `${name}: no console errors`);
  }
  // Maker form: validation, then a custom build with no named place or login.
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })).newPage();
  await page.goto(base + '/'); await page.locator('.strip:not(.blank)').first().waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Build the session' }).click();
  assert.match(await page.locator('#error').innerText(), /birth year/);
  await page.fill('#born', '1952'); await page.getByRole('button', { name: 'Build the session' }).click();
  assert.match(await page.locator('#error').innerText(), /at least one artist/);
  await page.fill('#a1', 'Zzqxv Nonexistent Band 9000'); await page.getByRole('button', { name: 'Build the session' }).click();
  await page.locator('#error:not(:empty)').filter({ hasText: /could not find/ }).waitFor({ timeout: 60000 });
  await page.selectOption('#shelf', 'jamaica'); await page.fill('#name', 'Winston');
  await page.getByRole('button', { name: 'Build the session' }).click();
  await page.locator('#wall-title', { hasText: 'Winston' }).waitFor({ timeout: 90000 });
  await page.locator('.strip:not(.blank)').first().waitFor({ timeout: 90000 });
  assert.ok((await page.locator('.strip .by').allInnerTexts()).length >= 4);
  if (shots) await page.screenshot({ path: `${shots}/mobile-custom.png`, fullPage: true });
  console.log('Browser flow passed');
} finally { await browser.close(); }
