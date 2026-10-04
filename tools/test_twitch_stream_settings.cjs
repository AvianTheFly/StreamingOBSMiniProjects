// Real DOM regression for startup switches and persistence; no Twitch requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const content = fs.readFileSync(path.join(__dirname, '../lib/twitch_stream_settings/extension/content.js'), 'utf8');
const labels = ['Store past broadcasts', 'Always Publish VODs', 'Stream Rewind'];
(async () => {
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  try {
    async function fixture(initial, {marker = true, rollback = false} = {}) {
      const page = await browser.newPage();
      await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: `
        ${labels.map((label, i) => `<div><label for="s${i}">${label}</label><input id="s${i}" type="checkbox"></div>`).join('')}
        <label for="unrelated">Other preference</label><input id="unrelated" type="checkbox">
        <script>
          window.chrome = {runtime: {sendMessage: message => {window.result = message;}}};
          const saved = ${rollback} ? ${JSON.stringify(initial)} : JSON.parse(localStorage.getItem('saved') || '${JSON.stringify(initial)}');
          saved.forEach((checked, i) => document.getElementById('s'+i).checked = checked);
          document.querySelectorAll('input').forEach(input => input.onclick = () => {
            localStorage.setItem('clicks', String(Number(localStorage.getItem('clicks') || 0)+1));
            localStorage.setItem('saved', JSON.stringify([0,1,2].map(i => document.getElementById('s'+i).checked)));
          });
          const originalTimer = window.setTimeout;
          window.setTimeout = (callback, delay) => originalTimer(callback, Math.min(delay, 5));
        </script><script>${content}</script>`}));
      await page.goto('http://fixture.test/settings/stream' + (marker ? '#streaming-hub=abcdefghijklmnopqrstuvwxyz123456&hub-port=7420' : ''));
      return page;
    }
    for (const initial of [[false, false, false], [true, true, true]]) {
      const page = await fixture(initial);
      await page.waitForFunction(() => window.result?.state === 'ready');
      assert.equal(await page.evaluate(() => Number(localStorage.getItem('clicks') || 0)), initial[0] ? 0 : 3);
      assert.equal(await page.locator('#unrelated').isChecked(), false);
      await page.close();
    }
    const rollback = await fixture([false, false, false], {rollback: true});
    await rollback.waitForFunction(() => window.result?.state === 'error');
    assert.equal(await rollback.evaluate(() => Number(localStorage.getItem('clicks'))), 3);
    await rollback.close();
    const ordinary = await fixture([false, false, false], {marker: false});
    assert.equal(await ordinary.locator('#s0').isChecked(), false);
    assert.equal(await ordinary.evaluate(() => window.result), undefined);
    await ordinary.close();
    console.log('Twitch startup extension: enable, no-op, save rejection and ordinary-page tests passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
