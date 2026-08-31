// One-off visual check: load a real page with the extension and screenshot the result.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const EXT_PATH = path.resolve('.output/chrome-mv3');
const url = process.argv[2] ?? 'https://github.com/';
const shot = process.argv[3] ?? '/tmp/visual-check.png';

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'txe-visual-'));
const ctx = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [
    '--headless=new',
    `--disable-extensions-except=${EXT_PATH}`,
    `--load-extension=${EXT_PATH}`,
    '--no-first-run',
    '--window-size=1280,900',
  ],
  viewport: { width: 1280, height: 900 },
});

let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });

const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(2500);

const reply = await sw.evaluate(async () => {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  const tab = tabs[tabs.length - 1];
  if (!tab?.id) return { error: 'no tab found' };
  try {
    return await chrome.tabs.sendMessage(tab.id, {
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

await page.waitForTimeout(9000);
const counts = await page.evaluate(() => ({
  translated: document.querySelectorAll('.txe-t').length,
  errors: document.querySelectorAll('.txe-error').length,
  navLinks: document.querySelectorAll('header a, nav a').length,
}));
console.log('counts:', JSON.stringify(counts));

await page.screenshot({ path: shot, fullPage: false });
console.log('screenshot:', shot);
await ctx.close();
fs.rmSync(userDataDir, { recursive: true, force: true });
