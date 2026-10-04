// Actual Chromium rendering and controls, using a temporary isolated service.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const artifacts =
  process.env.LEAGUE_TEST_ARTIFACT_DIR || path.join(os.tmpdir(), 'league-production-tests');
fs.mkdirSync(artifacts, { recursive: true });
const server = spawn(
  'py',
  ['-3.11', '-X', 'utf8', '-u', path.join(__dirname, 'league_production_fixture.py')],
  { cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
);
function localRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...options.headers };
    if (options.body) headers['Content-Length'] = Buffer.byteLength(options.body);
    const req = http.request(url, { method: options.method || 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          resolve({ json: async () => data });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.end(options.body);
  });
}
server.stderr.on('data', (data) => process.stderr.write(data));
async function endpoint() {
  return await new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(Error('Fixture startup timed out')), 10000);
    server.stdout.on('data', (chunk) => {
      text += chunk;
      const line = text.split(/\r?\n/).find((line) => line.startsWith('{'));
      if (line) {
        clearTimeout(timer);
        resolve('http://127.0.0.1:' + JSON.parse(line).port);
      }
    });
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(Error('Fixture exited ' + code));
    });
  });
}
(async () => {
  let browser;
  try {
    const base = await endpoint();
    browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--mute-audio'] });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }),
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.productionClears = 0;
      const clear = CanvasRenderingContext2D.prototype.clearRect;
      CanvasRenderingContext2D.prototype.clearRect = function (...args) {
        if (this.canvas.id === 'production-effects') window.productionClears++;
        return clear.apply(this, args);
      };
    });
    await page.goto(base + '/overlay?monitor=1');
    await page.waitForFunction(() => window.leagueProduction).catch(error=>{
      throw Error(error.message+'; overlay page errors: '+errors.join('; '));
    });
    const idleClears = await page.evaluate(() => window.productionClears);
    await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(() => window.productionClears), idleClears,
      'disabled production polling must not repeatedly clear the full canvas');
    await page.evaluate(async () => {
      const { ProductionScene } = await import('/production/scene.js');
      const canvas = document.createElement('canvas');
      canvas.id = 'test-scene';
      canvas.width = 1920;
      canvas.height = 1080;
      canvas.style.cssText = 'position:absolute;inset:0';
      document.querySelector('#stage').append(canvas);
      window.testScene = new ProductionScene(canvas);
      window.renderProduction = (theme, effect = null, opacity = 0.8) => {
        window.testScene.draw({
          enabled: true,
          opacity,
          edge_width: 56,
          ambient: effect ? null : { theme, elapsed: 2 },
          effect,
        });
        const pixels = window.testScene.c.getImageData(0, 0, 1920, 1080).data;
        let maxAlpha = 0, edgeAlpha = 0,
          centerAlpha = 0,
          filled = 0;
        for (let y = 0; y < 1080; y++)
          for (let x = 0; x < 1920; x++) {
            const alpha = pixels[(y * 1920 + x) * 4 + 3];
            if (x >= 240 && x < 1680 && y >= 170 && y < 840) centerAlpha += alpha;
            else edgeAlpha += alpha;
            if (alpha) filled++;maxAlpha=Math.max(maxAlpha,alpha);
          }
        return { edgeAlpha, centerAlpha, filled, maxAlpha };
      };
    });
    const hextechContinuity=await page.evaluate(async()=>{
      const {hextechChargeSamples}=await import('/production/elements.js');
      const open=[[0,0],[0,100],[100,100]],closed=[[0,0],[100,0],[100,100],[0,100],[0,0]];
      let longest=0;
      for(const path of [open,closed])for(let t=0;t<12;t+=.013){
        for(const segment of hextechChargeSamples(path,t,100,0).segments){
          const [a,b]=segment.points;longest=Math.max(longest,Math.hypot(a[0]-b[0],a[1]-b[1]));
        }
      }
      const sample=t=>hextechChargeSamples(open,t,100,0);
      return{longest,exiting:sample(2.4).head,finished:sample(2.9).segments.length,reentered:sample(3.4).head};
    });
    assert(hextechContinuity.longest<7,'Light trails cannot draw diagonal wraparound chords');
    assert.equal(hextechContinuity.exiting,null,'Open circuit head exits before restarting');
    assert.equal(hextechContinuity.finished,0,'Open circuit tail finishes before the next head');
    assert(hextechContinuity.reentered,'Open circuit charge eventually reenters');
    for (const theme of ['earth', 'fire', 'water', 'air', 'hextech', 'chemtech', 'elder']) {
      const stats = await page.evaluate((theme) => window.renderProduction(theme), theme);
      assert.equal(stats.centerAlpha, 0, theme + ' center must be transparent');
      assert(stats.filled > 1000, theme + ' should render');
    }
    const full = await page.evaluate(() => window.renderProduction('earth', null, 1));
    const low = await page.evaluate(() => window.renderProduction('earth', null, 0.25));
    assert(
      low.edgeAlpha < full.edgeAlpha * 0.3 && low.edgeAlpha > full.edgeAlpha * 0.2,
      'Master opacity must reach rock textures',
    );
    await page.evaluate(() => window.renderProduction('earth'));
    await page.screenshot({
      path: path.join(artifacts, 'mountain-ambient.png'),
      omitBackground: true,
    });
    for (const [kind, theme, title, rank] of [
      ['dragon', 'earth', 'MOUNTAIN DRAGON SECURED', 1],
      ['dragon', 'fire', 'INFERNAL DRAGON SECURED', 1],
      ['baron', 'void', 'BARON SECURED', 1],
      ['streak', 'gold', 'PENTAKILL', 5],
      ['structure', 'earth', 'TOWER DOWN', 1],
    ]) {
      const stats = await page.evaluate(
        ([kind, theme, title, rank]) =>
          window.renderProduction(theme, { kind, theme, title, rank, elapsed: 1, duration: 2.7 }),
        [kind, theme, title, rank],
      );
      assert.equal(stats.centerAlpha, 0);
      assert(stats.filled > 1000);
      if (kind === 'dragon' && theme === 'earth')
        await page.screenshot({
          path: path.join(artifacts, 'mountain-crumble.png'),
          omitBackground: true,
        });
      if (kind === 'streak')
        await page.screenshot({
          path: path.join(artifacts, 'pentakill.png'),
          omitBackground: true,
        });
    }
    const catalog = (await (await localRequest(base + '/production/settings')).json()).catalog;
    const artCoverage=await page.evaluate(async()=>{const {EVENT_DESIGNS}=await import('/production/event-art.js');return {keys:Object.keys(EVENT_DESIGNS),unique:new Set(Object.values(EVENT_DESIGNS)).size};});
    assert.deepEqual(artCoverage.keys.slice().sort(),catalog.map(e=>e.key).sort(),'Every built-in event must have an authored composition');
    assert.equal(artCoverage.unique,catalog.length,'Every event has its own art direction');
    const distinctArt=await page.evaluate(async catalog=>{
      const {ProductionScene}=await import('/production/scene.js');const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;canvas.getContext('2d',{willReadFrequently:true});const scene=new ProductionScene(canvas);
      const groups=new Map();for(const effect of catalog){scene.draw({enabled:true,opacity:.8,intensity:1.15,edge_width:56,effect:{...effect,title:'',elapsed:effect.duration*.5}});const hash=canvas.toDataURL();groups.set(hash,[...(groups.get(hash)||[]),effect.key]);}
      return [...groups.values()].filter(keys=>keys.length>1);
    },catalog);
    assert.deepEqual(distinctArt,[],'Event artwork must differ even with all captions removed');

    let maxShowMs = 0;
    for (const effect of catalog) {
      for (const elapsed of [0.18, effect.duration * 0.5]) {
        const stats = await page.evaluate((e) => window.renderProduction(e.theme, e), {
          ...effect,
          elapsed,
        });
        assert.equal(stats.centerAlpha, 0, effect.key + ' must preserve gameplay center');
        assert(stats.filled > 500, effect.key + ' must have a visible border effect');
        assert(stats.maxAlpha<=205,effect.key+' must honor the saved master strength');
      }
      if (
        [
          'baron',
          'herald',
          'void_grub',
          'dragon_fire',
          'dragon_hextech',
          'victory',
          'level_up',
        ].includes(effect.key)
      ) {
        await page.screenshot({
          path: path.join(artifacts, effect.key + '.png'),
          omitBackground: true,
        });
      }
      const ms = await page.evaluate((e) => {
        const start = performance.now();
        for (let i = 0; i < 8; i++)
          window.testScene.draw({
            enabled: true,
            opacity: 0.8,
            edge_width: 56,
            intensity: 1.15,
            ambient: null,
            effect: { ...e, elapsed: e.duration * 0.4 + i * 0.01 },
          });
        return (performance.now() - start) / 8;
      }, effect);
      maxShowMs = Math.max(maxShowMs, ms);
    }
    assert(maxShowMs < 30, 'Every show must fit a 30fps rendering budget');
    const deathCheck=await page.evaluate(()=>{
      const c=window.testScene.c;
      const read=()=>{const pixels=c.getImageData(0,0,1920,1080).data;let filled=0,max=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i])filled++;max=Math.max(max,pixels[i]);}return {filled,max};};
      const draw=elapsed=>window.testScene.draw({enabled:true,opacity:.8,edge_width:56,death:{elapsed,remaining:18},effect:null,ambient:null});
      draw(0);const entrance=read();draw(4);const visible=read();
      const center=c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v);
      draw(15);const sustained=read();window.testScene.draw({enabled:true,opacity:.8});const ended=read();
      return {entrance,visible,center,sustained,ended};
    });
    assert.equal(deathCheck.entrance.filled,0,'Death enters smoothly from clear');
    assert(deathCheck.visible.filled>500&&deathCheck.sustained.filled>500,'Stasis persists through a real death');
    assert(deathCheck.visible.max<=205);assert(deathCheck.visible.max>170);assert.equal(deathCheck.center,false);assert.equal(deathCheck.ended.filled,0);

    const timing = await page.evaluate(() => {
      const start = performance.now();
      for (let i = 0; i < 90; i++)
        window.testScene.draw({
          enabled: true,
          opacity: 0.8,
          edge_width: 56,
          ambient: { theme: 'earth', elapsed: 3 + i / 15 },
          effect: null,
        });
      return (performance.now() - start) / 90;
    });
    assert(timing < 30, 'Ambient scenery must stay within a 30fps frame budget');
    // Polling/animation lifecycle with real production entry point.
    await page.evaluate(() => document.querySelector('#test-scene').remove());
    let live = {
      enabled: true,
      opacity: 0.8,
      edge_width: 56,
      ambient: { id: 'test', theme: 'earth', elapsed: 2 },
      effect: null,
    };
    await page.route('**/state*', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          production: live,
          alerts: [],
          layout: { x: 24, y: 440, width: 280, height: 158 },
        }),
      }),
    );
    await page.waitForTimeout(750);
    const alpha = () =>
      page.evaluate(() => {
        const c = document.querySelector('#production-effects').getContext('2d');
        return c.getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v) ? 1 : 0;
      });
    assert((await alpha()) > 0, 'Polling should start ambience');
    live = { ...live, ambient: null };
    // Wait for the next 500ms poll and paint under load, bounded below the
    // 2.5-second disconnected-source deadline; do not assume a 650ms wall clock.
    await page.waitForFunction(() => !document.querySelector('#production-effects').getContext('2d').getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v),null,{timeout:2000});
    assert.equal(await alpha(), 0, 'Idle state clears canvas');
    const painted = () => page.evaluate(() => {
      const pixels=document.querySelector('#production-effects').getContext('2d').getImageData(0,0,1920,1080).data;
      return pixels.some((value,index)=>index%4===3&&value>0);
    });
    live = { ...live, death: { elapsed: 4, remaining: 20 } };
    await page.waitForTimeout(650);
    assert(await painted(), 'Death alone starts and sustains animation');
    live = { ...live, death: null };
    await page.waitForFunction(() => !document.querySelector('#production-effects').getContext('2d').getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v),null,{timeout:2000});
    assert.equal(await painted(), false, 'Respawn clears persistent death frame');
    live = { ...live, death: { elapsed: 6, remaining: 18 } };
    await page.waitForTimeout(650);
    assert(await painted());
    await page.unroute('**/state*');
    await page.route('**/state*', () => {});
    await page.waitForTimeout(2800);
    assert.equal(await painted(), false, 'Lost transport clears persistent death frame');
    await page.close();
    const editor = await browser.newPage();
    editor.on('pageerror', (error) => errors.push(error.message));
    await editor.goto(base + '/production');
    await editor.waitForFunction(
      () => document.querySelector('input[name=opacity]').value === '0.8',
    );
    const before = await (await localRequest(base + '/settings')).json();
    await editor.locator('input[name=opacity]').fill('0.6');
    await editor.getByRole('button', { name: 'Save borders' }).click();
    await editor.getByRole('status').filter({ hasText: 'Production borders saved.' }).waitFor();
    const saved = await (await localRequest(base + '/production/settings')).json();
    assert.equal(saved.settings.opacity, 0.6);
    assert.deepEqual((await (await localRequest(base + '/settings')).json()).config, before.config);
    await editor.locator('[data-preview=earth_cycle]').click();
    await editor.waitForFunction(() =>
      document.querySelector('#notice').textContent.startsWith('Showing'),
    );
    assert((await (await localRequest(base + '/state')).json()).production.ambient);
    await editor.getByRole('button', { name: 'Clear current effects' }).click();
    await editor.waitForFunction(() =>
      document.querySelector('#notice').textContent.startsWith('Current borders cleared'),
    );
    assert.equal((await (await localRequest(base + '/state')).json()).production.ambient, null);
    await editor.locator('#eventSearch').fill('takedown');
    const killCard = editor.locator('[data-effect=kill]');
    await killCard.getByLabel('TAKEDOWN Impact').fill('1.3');
    assert.equal(await killCard.getByLabel('TAKEDOWN Seconds').getAttribute('min'), '2');
    await killCard.getByLabel('TAKEDOWN Seconds').fill('2.3');
    await killCard.getByRole('checkbox').uncheck();
    await editor.locator('#eventGroup').selectOption('progression');
    await editor.locator('#eventSearch').fill('level');
    await editor.locator('#eventGroup').selectOption('all');
    await editor.locator('#eventSearch').fill('takedown');
    assert.equal(await killCard.getByLabel('TAKEDOWN Seconds').inputValue(), '2.3');
    await editor.getByRole('button', { name: 'Save effect edits' }).click();
    await editor.locator('#eventSaveStatus').filter({ hasText: 'Effect edits saved.' }).waitFor();
    let controls = (await (await localRequest(base + '/production/settings')).json()).settings;
    assert.deepEqual(controls.event_options.kill, {
      intensity: 1.3,
      duration: 2.3,
      enabled: false,
    });
    await killCard.getByRole('button', { name: 'Preview', exact: true }).click();
    await editor.waitForFunction(
      () => document.querySelector('#notice').textContent === 'Showing TAKEDOWN.',
    );
    assert.equal(
      (await (await localRequest(base + '/state')).json()).production.effect.key,
      'kill',
    );
    await killCard.getByRole('button', { name: 'Reset', exact: true }).click();
    await killCard.getByLabel('TAKEDOWN Seconds').fill('1.1');
    await editor.getByRole('button', { name: 'Save effect edits' }).click();
    await editor.waitForFunction(
      () =>
        document.querySelector('#eventSaveStatus').textContent === 'Effect edits saved.' &&
        document.querySelector('#eventSaveStatus').previousElementSibling.disabled === false,
    );
    controls = (await (await localRequest(base + '/production/settings')).json()).settings;
    assert.deepEqual(
      controls.event_options.kill,
      { duration: 1.1 },
      'Reset must remove earlier intensity/toggle overrides',
    );
    assert.equal(controls.opacity, 0.6, 'Event edits must preserve master strength');
    // A stale editor cannot overwrite another window's controls.
    await localRequest(base + '/production/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision: controls.revision, settings: { opacity: 0.7 } }),
    });
    await editor.getByRole('button', { name: 'Save borders' }).click();
    await editor.waitForFunction(() =>
      document.querySelector('#notice').textContent.includes('Reload before saving'),
    );
    assert.equal(
      (await (await localRequest(base + '/production/settings')).json()).settings.opacity,
      0.7,
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        passed: true,
        ambientThemes: 7,
        borderEvents: catalog.length,
        maxShowFrameMs: Math.round(maxShowMs * 100) / 100,
        centerAlpha: 0,
        stoneFrameMs: Math.round(timing * 100) / 100,
        artifacts,
      }),
    );
  } finally {
    if (browser) await browser.close();
    server.stdin.end();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
