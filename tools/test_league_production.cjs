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
    await page.goto(base + '/overlay?monitor=1');
    await page.waitForFunction(() => window.leagueProduction);
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
        let edgeAlpha = 0,
          centerAlpha = 0,
          filled = 0;
        for (let y = 0; y < 1080; y++)
          for (let x = 0; x < 1920; x++) {
            const alpha = pixels[(y * 1920 + x) * 4 + 3];
            if (x >= 240 && x < 1680 && y >= 170 && y < 840) centerAlpha += alpha;
            else edgeAlpha += alpha;
            if (alpha) filled++;
          }
        return { edgeAlpha, centerAlpha, filled };
      };
    });
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
    let maxShowMs = 0;
    for (const effect of catalog) {
      for (const elapsed of [0.18, effect.duration * 0.5]) {
        const stats = await page.evaluate((e) => window.renderProduction(e.theme, e), {
          ...effect,
          elapsed,
        });
        assert.equal(stats.centerAlpha, 0, effect.key + ' must preserve gameplay center');
        assert(stats.filled > 500, effect.key + ' must have a visible border effect');
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
    assert(timing < 30, 'Cached stone rendering must stay within a 30fps frame budget');
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
        return c.getImageData(120, 20, 1, 1).data[3];
      });
    assert((await alpha()) > 0, 'Polling should start ambience');
    live = { ...live, ambient: null };
    await page.waitForTimeout(650);
    assert.equal(await alpha(), 0, 'Idle state clears canvas');
    live = { ...live, ambient: { id: 'test2', theme: 'earth', elapsed: 2 } };
    await page.waitForTimeout(650);
    assert((await alpha()) > 0);
    await page.unroute('**/state*');
    await page.route('**/state*', () => {});
    await page.waitForTimeout(2800);
    assert.equal(await alpha(), 0, 'Lost transport clears persistent frame');
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
    await killCard.getByLabel('TAKEDOWN Seconds').fill('0.9');
    await killCard.getByRole('checkbox').uncheck();
    await editor.locator('#eventGroup').selectOption('progression');
    await editor.locator('#eventSearch').fill('level');
    await editor.locator('#eventGroup').selectOption('all');
    await editor.locator('#eventSearch').fill('takedown');
    assert.equal(await killCard.getByLabel('TAKEDOWN Seconds').inputValue(), '0.9');
    await editor.getByRole('button', { name: 'Save effect edits' }).click();
    await editor.locator('#eventSaveStatus').filter({ hasText: 'Effect edits saved.' }).waitFor();
    let controls = (await (await localRequest(base + '/production/settings')).json()).settings;
    assert.deepEqual(controls.event_options.kill, {
      intensity: 1.3,
      duration: 0.9,
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
