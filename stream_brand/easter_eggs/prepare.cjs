// Finite, lossless sprite separation. Preserves generated originals and whole components.
const fs = require('node:fs'), path = require('node:path'), sharp = require('sharp');
sharp.concurrency(2);
const root = path.join(__dirname, 'v1');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'prompts.json')));

function components(data, width, height) {
  const labels = new Int32Array(width * height), queue = new Int32Array(width * height), blobs = [];
  for (let seed = 0; seed < labels.length; seed++) {
    if (labels[seed] || data[seed * 4 + 3] < 8) continue;
    const id = blobs.length + 1; let head = 0, tail = 1, left = width, right = 0, top = height, bottom = 0, sx = 0, sy = 0;
    queue[0] = seed; labels[seed] = id;
    while (head < tail) {
      const p = queue[head++], x = p % width, y = Math.floor(p / width);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); sx += x; sy += y;
      for (const n of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1]) {
        if (n >= 0 && !labels[n] && data[n * 4 + 3] >= 8) { labels[n] = id; queue[tail++] = n; }
      }
    }
    blobs.push({ id, count: tail, left, right, top, bottom, cx: sx / tail, cy: sy / tail });
  }
  return { labels, blobs };
}
const distance = (a, b) => Math.hypot(Math.max(0, a.left - b.right, b.left - a.right), Math.max(0, a.top - b.bottom, b.top - a.bottom));

async function main() {
  const manifest = { version: 1, fps: 24, duration: 5, width: 512, height: 512, poseSize: 384, anchor: [192, 320], characters: [], clips: [] }, quality = [];
  for (const char of catalog.cast) {
    const poseFiles = [];
    if (char.id === 'boo') {
      for (let i = 0; i < 3; i++) {
        const file = `poses/boo/${i}.png`; fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        const input = path.join(root, `art/boo-${i}.png`), meta = await sharp(input).metadata();
        const scale = 218 / meta.height, w = Math.round(meta.width * scale), h = 218;
        const image = await sharp(input).resize(w, h).png().toBuffer();
        await sharp({ create: { width: 384, height: 384, channels: 4, background: '#00000000' } }).composite([{ input: image, left: Math.round(192 - w / 2), top: 320 - h }]).png().toFile(path.join(root, file));
        poseFiles.push(file);
      }
    } else {
      const { data, info } = await sharp(path.join(root, `art/${char.id}-v1.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const { labels, blobs } = components(data, info.width, info.height), cw = info.width / 8, ch = info.height / 3;
      const mains = Array(24).fill(null);
      for (const b of blobs) {
        const row = Math.min(2, Math.floor(b.cy / ch)), col = Math.min(7, Math.floor(b.cx / cw)), index = row * 8 + col;
        if (!mains[index] || b.count > mains[index].count) mains[index] = b;
      }
      if (mains.some(b => !b || b.count < 1800)) throw Error(`Incomplete source sheet: ${char.id}`);
      const groups = mains.map(b => [b]), ids = new Set(mains.map(b => b.id));
      for (const b of blobs) {
        if (ids.has(b.id) || b.count < 5) continue;
        let best = 0, score = Infinity;
        mains.forEach((m, i) => { const d = distance(b, m) + Math.abs(b.cy - m.cy) * .12; if (d < score) { score = d; best = i; } });
        groups[best].push(b);
      }
      const boxes = groups.map(g => ({ left: Math.min(...g.map(b => b.left)), right: Math.max(...g.map(b => b.right)), top: Math.min(...g.map(b => b.top)), bottom: Math.max(...g.map(b => b.bottom)) }));
      // One scale for the entire character, not a per-pose resize that erases crouches.
      let scale = 1.18;
      boxes.forEach((b, i) => { const m = mains[i], cx = (m.left + m.right) / 2; scale = Math.min(scale, 172 / Math.max(cx - b.left, b.right - cx), 286 / (m.bottom - b.top + 1), 52 / Math.max(1, b.bottom - m.bottom)); });
      for (let i = 0; i < 24; i++) {
        const box = boxes[i], main = mains[i], selected = new Set(groups[i].map(b => b.id)), w = box.right - box.left + 1, h = box.bottom - box.top + 1, out = Buffer.alloc(w * h * 4);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const src = (y + box.top) * info.width + x + box.left; if (selected.has(labels[src])) data.copy(out, (y * w + x) * 4, src * 4, src * 4 + 4); }
        const sw = Math.round(w * scale), sh = Math.round(h * scale), left = Math.round(192 + (box.left - (main.left + main.right) / 2) * scale), top = Math.round(320 + (box.top - main.bottom) * scale);
        if (left < 0 || top < 0 || left + sw > 384 || top + sh > 384) throw Error(`Clipped extraction ${char.id}/${i}`);
        const resized = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).resize(sw, sh).png().toBuffer();
        const file = `poses/${char.id}/${String(i).padStart(2, '0')}.png`; fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        await sharp({ create: { width: 384, height: 384, channels: 4, background: '#00000000' } }).composite([{ input: resized, left, top }]).png().toFile(path.join(root, file));
        poseFiles.push(file); quality.push({ character: char.id, pose: i, components: selected.size, scale, contentBounds: [left, top, sw, sh] });
      }
    }
    manifest.characters.push({ id: char.id, name: char.name, source: char.source, art: char.id === 'boo' ? 'Existing three poses; new deterministic choreography. New image generation blocked twice.' : '24 newly illustrated poses; eight per act.', poses: poseFiles });
    char.acts.forEach((a, i) => manifest.clips.push({ id: `${char.id}-${a[0]}`, character: char.id, name: a[1], kind: a[2], row: i, beats: a[3], duration: 5, fps: 24, frames: 120, file: `clips/${char.id}-${a[0]}.webm`, sequence: `frames/${char.id}-${a[0]}/%03d.png` }));
  }
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(root, 'catalog.js'), 'globalThis.CAMEO_CATALOG = ' + JSON.stringify(manifest) + ';\n');
  fs.writeFileSync(path.join(root, 'extraction-check.json'), JSON.stringify(quality, null, 2));
  console.log(`Prepared ${manifest.characters.length} characters, ${manifest.clips.length} acts, ${quality.length + 3} source poses.`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
