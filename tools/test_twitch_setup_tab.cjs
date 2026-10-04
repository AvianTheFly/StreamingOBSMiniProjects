// Offline extension worker regression: only an accepted, still-marked tab closes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,
  '../lib/twitch_stream_settings/extension/background.js'), 'utf8');
const nonce = 'abcdefghijklmnopqrstuvwxyz123456';
const url = `https://dashboard.twitch.tv/u/test/settings/stream#streaming-hub=${nonce}&hub-port=7420`;
async function check({ok = true, state = 'ready', senderUrl = url, currentUrl = url,
                      pendingUrl, tabId = 7, reject = false} = {}) {
  let listener;
  const removed = [];
  vm.runInNewContext(source, {URL, URLSearchParams, Number,
    fetch: async () => { if (reject) throw Error('offline'); return {ok}; },
    chrome: {runtime: {onMessage: {addListener: fn => listener = fn}},
      tabs: {get: async () => ({url: currentUrl, pendingUrl}),
             remove: async id => removed.push(id)}}});
  listener({type: 'streaming-hub-result', port: '7420', nonce, state},
           {url: senderUrl, tab: {id: tabId}}, () => {});
  await new Promise(resolve => setImmediate(resolve));
  return removed;
}
(async () => {
  assert.deepEqual(await check(), [7]);
  for (const options of [{ok: false}, {state: 'error'}, {state: 'login_required'},
    {senderUrl: 'https://dashboard.twitch.tv/u/test/settings/stream'},
    {currentUrl: 'https://example.com'}, {pendingUrl: 'https://example.com'},
    {tabId: null}, {reject: true}, {currentUrl: url.replace(nonce, 'old')}])
    assert.deepEqual(await check(options), [], JSON.stringify(options));
  console.log('Twitch setup tab ownership and accepted-result checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });

