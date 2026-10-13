// Finite browser export, using exactly the same pure renderer as the gallery.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const root = path.join(__dirname, 'v1');
async function main() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); res.end(); return; }
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
    res.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream'); fs.createReadStream(target).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const checks = [], errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => globalThis.galleryReady);
    const catalog = await page.evaluate(() => cameoReview.catalog);
    for (const clip of catalog.clips) {
      await page.evaluate(async id => { await cameoReview.select(id); cameoReview.setSize(512, 512); }, clip.id);
      const result = await page.evaluate(() => {
        const frames = [], canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d'); let first = -1, last = -1, max = 0;
        const hashes = new Set();
        for (let i = 0; i < 120; i++) {
          frames.push(cameoReview.render(i / 24));
          const pixels = ctx.getImageData(0, 0, 512, 512).data; let visible = 0, hash = 2166136261;
          for (let p = 3; p < pixels.length; p += 4) { if (pixels[p] > 0) visible++; hash = Math.imul(hash ^ pixels[p], 16777619); }
          if (i === 0) first = visible; if (i === 119) last = visible; max = Math.max(max, visible); hashes.add(hash);
        }
        return { frames, first, last, max, distinctAlphaFrames: hashes.size };
      });
      if (result.first || result.last || result.max < 8000 || result.distinctAlphaFrames < 25) throw Error('Failed clear/motion check: ' + clip.id);
      const dir = path.join(root, 'frames', clip.id); fs.mkdirSync(dir, { recursive: true });
      result.frames.forEach((data, i) => fs.writeFileSync(path.join(dir, `${String(i).padStart(3, '0')}.png`), Buffer.from(data.split(',')[1], 'base64')));
      const { frames, ...stats } = result; checks.push({ clip: clip.id, count: frames.length, ...stats });
      console.log(`Rendered ${clip.id}: ${frames.length} frames, transparent first/last, ${stats.distinctAlphaFrames} distinct silhouettes.`);
    }
    // Exercise rapid changes, seeking, one-shot cleanup and controls on the real gallery.
    await page.evaluate(async () => { await Promise.all([cameoReview.select('kirby-hello'), cameoReview.select('hornet-silk'), cameoReview.select('boo-peekaboo')]); });
    const stale = await page.evaluate(() => ({ clip: cameoReview.clip.character, images: cameoReview.renderer.character }));
    if (stale.clip !== 'boo' || stale.images !== 'boo') throw Error('Stale character load');
    await page.evaluate(async () => { await cameoReview.select('goose-theft'); cameoReview.setSize(900, 510); cameoReview.seek(2.8); });
    await page.screenshot({ path: path.join(root, 'gallery-preview.png'), fullPage: true });
    await page.locator('#flip').check(); await page.locator('#background').selectOption('cream');
    await page.locator('#next').click(); await page.locator('#previous').click();
    await page.locator('#play').click(); await page.waitForFunction(() => !cameoReview.playing, { timeout: 10000 });
    const clear = await page.evaluate(() => { const c = document.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; return !d.some((v, i) => i % 4 === 3 && v); });
    if (!clear) throw Error('One-shot playback did not clear');
    if (errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync(path.join(root, 'render-check.json'), JSON.stringify({ checks, staleSelection: stale, oneShotClears: clear, errors }, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
