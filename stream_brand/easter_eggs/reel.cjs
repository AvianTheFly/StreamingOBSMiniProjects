// Finite, labelled preview backgrounds. Animation frames stay unchanged.
const fs = require('node:fs'), path = require('node:path'), sharp = require('sharp');
const root = path.join(__dirname, 'v1'), manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
(async () => {
  fs.mkdirSync(path.join(root, 'review'), { recursive: true });
  for (const c of manifest.characters) {
    const acts = manifest.clips.filter(a => a.character === c.id);
    const cards = acts.map((a, i) => `<rect x="${12 + i * 384}" y="104" width="360" height="380" rx="16" fill="#263235"/><text x="${192 + i * 384}" y="133" fill="#a9c695" text-anchor="middle" font-size="11" letter-spacing="2">${a.kind.toUpperCase()}</text><text x="${192 + i * 384}" y="466" fill="#e4e9e3" text-anchor="middle" font-size="14">${escape(a.name)}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="512"><rect width="1152" height="512" fill="#141b1d"/><g font-family="Segoe UI, sans-serif"><text x="25" y="29" fill="#acc897" font-size="11" letter-spacing="3">LITTLE APPEARANCES / 24 CAMEOS</text><text x="24" y="75" fill="#f1ede5" font-size="32">${escape(c.name)}</text><text x="1125" y="72" text-anchor="end" fill="#a6b6ae" font-size="12">APPEAR · PERFORM · DISAPPEAR</text>${cards}</g></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(root, 'review', `${c.id}-stage.png`));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
