/** Screenshot the injected content UI (progress pill, selection bubble, float ball). */
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const PORT = 18931;
const server = http.createServer((_req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><body style="font:16px/1.7 system-ui;max-width:640px;margin:40px auto">
  <h1>Testing the translation extension</h1>
  <p id="p1">Hello world, this is a test paragraph for translation.</p>
  <p>The quick brown fox jumps over the lazy dog.</p>
  <p>Design is not just what it looks like and feels like. Design is how it works.</p>
  </body></html>`);
});
await new Promise((r) => server.listen(PORT, r));

const ext = path.resolve('.output/chrome-mv3');
const outDir = path.resolve('.shots');
fs.mkdirSync(outDir, { recursive: true });
const profile = path.join(os.tmpdir(), `txe-cshots-${Date.now()}`);
const ctx = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

let sw = ctx.serviceWorkers()[0];
if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 });

const page = await ctx.newPage();
await page.setViewportSize({ width: 1000, height: 700 });
await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForTimeout(1000);

// 1. trigger full-page translation -> progress pill
await sw.evaluate(async () => {
  const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1:*/*' });
  void chrome.tabs.sendMessage(tabs[0].id, {
    __tx: true,
    scope: 'cs',
    type: 'translatePage',
    payload: undefined,
  });
});
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(outDir, 'content-translating.png') });
await page.waitForTimeout(4000);
await page.screenshot({ path: path.join(outDir, 'content-translated.png') });

// 2. selection bubble: select text then click the trigger
const p1 = page.locator('#p1');
await p1.click({ clickCount: 3 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, 'content-sel-trigger.png') });
try {
  await page.locator('.txe-sel-trigger').click({ timeout: 3000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outDir, 'content-sel-panel.png') });
} catch (e) {
  console.log('selection trigger not found:', String(e));
}

console.log('done ->', outDir);
await ctx.close();
server.close();
