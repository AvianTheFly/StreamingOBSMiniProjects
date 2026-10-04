// Render the authored replay stage into deterministic OBS image assets.
// Run with Playwright available on NODE_PATH while the supported Hub is up.
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

(async () => {
  const folder = path.resolve(__dirname, '..', 'mini projects', 'instant_replay', 'art');
  fs.mkdirSync(folder, {recursive: true});
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  try {
    for (const kind of ['replay', 'clip', 'highlights']) {
      for (const companion of [false, true]) {
       for (const camera of [false, true]) {
        const page = await browser.newPage({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});
        await page.route('**/api/projects/instant_replay/stage', route => route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({active: true, kind, companion, camera, view: companion ? 'live' : 'off', title: '', index: 0, total: 0}),
        }));
        await page.goto('http://127.0.0.1:7420/replay-stage.html?render=art');
        await page.waitForFunction((expected) => document.body.dataset.kind === expected, kind);
        await page.locator('#stage[data-ready=true]').waitFor();
        await page.waitForFunction(() => [...document.images].every(i => i.complete));
        await page.evaluate(() => document.fonts.ready);
        await page.locator('.masthead').waitFor({state: 'visible'});
        if (companion) await page.locator('.live-window').waitFor({state: 'visible'});
        if (camera) await page.locator('.camera-window').waitFor({state: 'visible'});
        const suffix=companion&&camera?'-live-camera':camera?'-camera':companion?'-companion':'';
        const file = path.join(folder, `${kind}${suffix}-v3.png`);
        await page.screenshot({path: file, animations: 'disabled'});
        console.log(file);
        await page.close();
       }
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
