/** Screenshot every extension page in light + dark mode for a visual review. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ext = path.resolve('.output/chrome-mv3');
const outDir = path.resolve('.shots');
fs.mkdirSync(outDir, { recursive: true });

const profile = path.join(os.tmpdir(), `txe-shots-${Date.now()}`);
const ctx = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

let sw = ctx.serviceWorkers()[0];
if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 });
const extId = sw.url().split('/')[2];

const targets = [
  ['popup', `chrome-extension://${extId}/popup.html`, { width: 400, height: 720 }],
  ['options-general', `chrome-extension://${extId}/options.html#general`, { width: 1280, height: 1400 }],
  ['options-providers', `chrome-extension://${extId}/options.html#providers`, { width: 1280, height: 1200 }],
  ['options-sites', `chrome-extension://${extId}/options.html#sites`, { width: 1280, height: 1100 }],
  ['text-translate', `chrome-extension://${extId}/text-translate.html`, { width: 1280, height: 800 }],
  ['pdf-viewer', `chrome-extension://${extId}/pdf-viewer.html`, { width: 1280, height: 800 }],
  ['sidepanel', `chrome-extension://${extId}/sidepanel.html`, { width: 400, height: 900 }],
];

for (const scheme of ['light', 'dark']) {
  for (const [name, url, viewport] of targets) {
    const page = await ctx.newPage();
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(url);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, `${name}-${scheme}.png`), fullPage: false });
    await page.close();
    console.log(`shot: ${name}-${scheme}.png`);
  }
}

await ctx.close();
console.log('done ->', outDir);
