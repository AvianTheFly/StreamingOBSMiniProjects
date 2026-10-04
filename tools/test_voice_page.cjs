// Exercise the actual Hub page in Chromium with an isolated voice service fixture.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    const errors = [], actions = [];
    let reads = 0;
    let voice = {ready: true, state: 'listening', owner: 'specific_song',
      session_id: 7, started_at: Date.now()/1000, model: 'large-v3', device: 'cpu',
      compute: 'int8', consumers: [{tag: 'specific_song', state: 'listening', timeout: 2}],
      history: [{owner: 'soundboard', outcome: 'transcribed', started_at: Date.now()/1000,
        text: '<img src=x onerror="window.injected=true">'}]};
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/voice', async route => {
      if (route.request().method() === 'POST') {
        actions.push(route.request().postDataJSON());
        if (actions.at(-1).action === 'clear_history') voice.history = [];
        else voice = {...voice, state: 'idle', session_id: null, owner: null, started_at: null};
        await route.fulfill({json: {ok: true}});
      } else {
        reads++;
        await route.fulfill({json: voice});
      }
    });
    await page.goto('http://127.0.0.1:7420/#voice');
    await page.getByText('specific_song', {exact: true}).first().waitFor();
    await page.locator('#voiceHistory').getByText(voice.history[0].text, {exact: true}).waitFor();
    assert.equal(await page.evaluate(() => !!window.injected), false);
    await page.getByRole('button', {name: 'Finish recording', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('#voiceFinish').disabled);
    assert.deepEqual(actions[0], {action: 'finish', session_id: 7});
    voice = {...voice, state: 'processing', session_id: 8, owner: 'instant_replay'};
    await page.waitForFunction(() => !document.querySelector('#voiceCancel').disabled);
    await page.getByRole('button', {name: 'Cancel command', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('#voiceCancel').disabled);
    assert.deepEqual(actions[1], {action: 'cancel', session_id: 8});
    await page.getByRole('button', {name: 'Clear history', exact: true}).click();
    await page.getByText('No voice sessions yet.', {exact: true}).waitFor();
    assert.equal(actions[2].action, 'clear_history');
    await page.getByRole('link', {name: 'Dashboard', exact: true}).click();
    const before = reads;
    await page.waitForTimeout(1300);
    assert.equal(reads, before, 'Voice polling must stop when leaving the page');
    assert.deepEqual(errors, []);
    console.log('Voice page: controls, history, escaping, and poll cleanup passed');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
