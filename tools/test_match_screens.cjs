// Isolated browser integration: no live OBS, game polling or listener mutations.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const artifacts = process.env.LEAGUE_TEST_ARTIFACT_DIR || path.join(root, 'output', 'match-screens-2026-10-01');
fs.mkdirSync(artifacts, { recursive: true });
const server = spawn('py', ['-3.11', '-X', 'utf8', '-u', path.join(__dirname, 'league_production_fixture.py')],
  { cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
server.stderr.on('data', data => process.stderr.write(data));
const ready = new Promise((resolve, reject) => {
  let output = '';
  const timer = setTimeout(() => reject(Error('Fixture startup timed out')), 10000);
  server.stdout.on('data', chunk => {
    output += chunk;
    const line = output.split(/\r?\n/).find(line => line.startsWith('{'));
    if (line) { clearTimeout(timer); resolve('http://127.0.0.1:' + JSON.parse(line).port); }
  });
  server.on('exit', code => { clearTimeout(timer); reject(Error('Fixture exited ' + code)); });
});
(async () => {
  let browser;
  try {
    const base = await ready;
    browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function request(route, body) {
      const response = body ? await page.request.post(base + route, { data: body }) : await page.request.get(base + route);
      assert(response.ok(), route + ': ' + await response.text());
      return response.json();
    }
    await page.goto(base + '/overlay?monitor=1');
    await page.waitForFunction(() => window.leagueMatchScreens);
    const clipSettings = (await request('/settings')).config;
    await request('/options', { revision: clipSettings.revision, overlay_enabled: false });
    const settings = (await request('/production/settings')).settings;
    await request('/production/configure', { revision: settings.revision,
      settings: { match_screens: true, result_hold_seconds: 2, start_hold_seconds: 2 } });
    for (const key of ['game_start', 'defeat', 'victory']) {
      await request('/production/preview', { key });
      await page.waitForFunction(key => {
        const layer = document.querySelector('#match-screen');
        return layer.style.display === 'block' && Number(layer.style.opacity) > .95 &&
          layer.querySelector('img')?.src.endsWith('/' + key) && layer.querySelector('img').naturalWidth > 0;
      }, key);
      const info = await page.locator('#match-screen').evaluate(layer => ({
        text: layer.textContent, rect: { width: layer.offsetWidth, height: layer.offsetHeight },
        alt: layer.querySelector('img').alt, media: layer.querySelectorAll('video,audio').length,
      }));
      assert.equal(info.text, ''); assert.equal(info.alt, ''); assert.equal(info.media, 0);
      assert.deepEqual(info.rect, { width: 1920, height: 1080 });
      const composition = await page.evaluate(() => {
        const border=document.querySelector('#match-screen-border');
        const alpha=border.getContext('2d').getImageData(0,0,1920,1080).data;
        let visible=0,center=0;
        for(let y=0;y<1080;y++)for(let x=0;x<1920;x++)if(alpha[(y*1920+x)*4+3]){
          visible++;if(x>=240&&x<1680&&y>=170&&y<840)center++;
        }
        return {visible,center,children:document.querySelector('#match-screen').children.length};
      });
      assert(composition.visible>500, key+' matching border is visible above picture');
      assert.equal(composition.center,0); assert.equal(composition.children,2);
      await page.screenshot({ path: path.join(artifacts, key + '-browser.png') });
      await request('/production/clear', {});
      await page.waitForFunction(() => document.querySelector('#match-screen').style.display === 'none');
    }
    // The renderer independently waits 1.5 seconds, and still expires on a
    // finite deadline when /state fails. It must not depend on wall clock time.
    await page.route('**/state*', route => route.abort());
    await page.evaluate(() => {
      window.leagueMatchScreens.update({id:899,key:'defeat',elapsed:0.5,remaining:2,duration:2.5});
      window.leagueProduction.update({enabled:true,opacity:1,ambient:{theme:'infernal',elapsed:4},
        death:{elapsed:2,remaining:10},effect:{key:'kill',theme:'crimson',elapsed:.5,duration:3}});
    });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => {
      const c=document.querySelector('#production-effects');
      return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(v=>v!==0);
    }),false,'Other production layers yield to result picture');
    await page.evaluate(() => window.leagueMatchScreens.update({ id: 900,
      key: 'victory', elapsed: -1.5, remaining: 3.5, duration: 2 }));
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('#match-screen').evaluate(el => el.style.display), 'none');
    await page.waitForFunction(() => document.querySelector('#match-screen').style.display === 'block');
    await page.waitForFunction(() => document.querySelector('#match-screen').style.display === 'none');
    assert.equal(await page.evaluate(() => {
      const c=document.querySelector('#match-screen-border');
      return window.leagueMatchScreens.ownsPresentation() || c.getContext('2d').getImageData(0,0,c.width,c.height).data.some(v=>v!==0);
    }),false,'Picture and border expire together after transport loss');
    // Replacement during the delay cannot revive the old picture or border.
    await page.evaluate(() => {
      window.leagueMatchScreens.update({id:901,key:'victory',elapsed:-1,remaining:3,duration:2});
      window.leagueMatchScreens.update({id:902,key:'defeat',elapsed:.5,remaining:2,duration:2.5});
    });
    await page.waitForTimeout(1100);
    assert(await page.locator('#match-screen img').evaluate(el=>el.src.endsWith('/defeat')));
    await page.evaluate(()=>window.leagueMatchScreens.update(null));
    await page.unroute('**/state*');
    const traversal = await page.request.get(base + '/match-art/unknown');
    assert.equal(traversal.status(), 404);
    const controls = await browser.newPage();
    await controls.goto(base + '/production');
    await controls.waitForFunction(() => document.querySelector('[name=match_screens]').checked);
    assert.equal(await controls.locator('[name=result_delay_seconds]').inputValue(), '1.5');
    assert.equal(await controls.locator('[name=result_hold_seconds]').inputValue(), '2');
    assert.deepEqual(errors, []);
    console.log('Match-screen browser checks passed: three composed pictures/borders, layer precedence, replacement, delay, shared expiry, clear and controls.');
  } finally {
    if (browser) await browser.close();
    server.stdin.end();
    await new Promise(resolve => {
      if (server.exitCode !== null) return resolve();
      server.once('exit', resolve);
      setTimeout(() => { if (server.exitCode === null) server.kill(); resolve(); }, 5000).unref();
    });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
