/**
 * End-to-end smoke: load the built extension into Chromium, open a local
 * test page, trigger full-page translation and report what happened.
 * Run: node scripts/e2e.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const PORT = 18923;
const server = http.createServer((_req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><body>
  <nav style="display:flex;gap:12px">
    <a href="/pricing">Pricing</a>
    <a href="/signup" style="border:1px solid #333;padding:4px 10px">Sign up</a>
  </nav>
  <article>
    <h1>Testing the translation extension</h1>
    <p>Hello world, this is a test paragraph for translation.</p>
    <p>The quick brown fox jumps over the lazy dog.</p>
  </article></body></html>`);
});
await new Promise((r) => server.listen(PORT, r));

const ext = path.resolve('.output/chrome-mv3');
const profile = path.join(os.tmpdir(), `txe-e2e-${Date.now()}`);
const ctx = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

try {
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 });
  console.log('service worker:', sw.url());

  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.text().includes('Violation')) problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));

  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForTimeout(1200);

  const reply = await sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1:*/*' });
    if (!tabs[0]?.id) return { error: 'no tab found' };
    try {
      return await chrome.tabs.sendMessage(tabs[0].id, {
        __tx: true,
        scope: 'cs',
        type: 'translatePage',
        payload: undefined,
      });
    } catch (e) {
      return { error: String(e) };
    }
  });
  console.log('translatePage reply:', JSON.stringify(reply));

  await page.waitForTimeout(8000);
  const translated = await page.locator('.txe-t').allTextContents();
  const errors = await page.locator('.txe-error').count();
  console.log('translated blocks:', translated.length);
  for (const t of translated) console.log('  >', t);
  console.log('error blocks on page:', errors);
  console.log('console problems:', problems.length ? problems : '(none)');

  // nav/button links must not be duplicated; translation goes inside the link
  const linkCount = await page.locator('nav a').count();
  const navLinkText = await page.locator('nav a').first().textContent();
  console.log('nav links:', linkCount, '| first link text:', JSON.stringify(navLinkText));
  const navOk = linkCount === 2 && /定价|Pricing/.test(navLinkText ?? '');

  // float ball opens the full popup panel in an iframe
  let panelOk = false;
  try {
    await page.click('.txe-ball', { timeout: 5000 });
    const iframe = page.locator('.txe-ball-frame iframe');
    await iframe.waitFor({ state: 'attached', timeout: 5000 });
    const src = await iframe.getAttribute('src');
    panelOk = !!src?.includes('popup.html');
    console.log('float-ball panel iframe:', src);
  } catch (e) {
    console.log('float-ball panel FAILED:', String(e));
  }

  // side panel page renders (page controls + text translate with compare)
  let sidepanelOk = false;
  try {
    const extId = sw.url().split('/')[2];
    const sp = await ctx.newPage();
    await sp.goto(`chrome-extension://${extId}/sidepanel.html`);
    await sp.locator('text=双引擎对比').waitFor({ timeout: 5000 });
    sidepanelOk = (await sp.locator('textarea').count()) > 0;
    console.log('sidepanel renders:', sidepanelOk);
    await sp.close();
  } catch (e) {
    console.log('sidepanel FAILED:', String(e));
  }

  const ok = translated.length >= 3 && errors === 0 && panelOk && navOk && sidepanelOk;
  console.log(ok ? '\nE2E PASS' : '\nE2E FAIL');
  process.exitCode = ok ? 0 : 1;
} finally {
  await ctx.close();
  server.close();
}
