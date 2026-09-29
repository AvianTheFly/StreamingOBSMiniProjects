// Deterministic beveled stone, cached as small tiles instead of redrawn geometry.
export function noise(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const tiles = new Map();
export function rock(seed, width, depth) {
  const key = `${seed}:${width}:${depth}`;
  if (tiles.has(key)) return tiles.get(key);
  const tile = document.createElement('canvas');
  tile.width = width + 8;
  tile.height = depth + 10;
  const c = tile.getContext('2d'),
    w = width,
    d = depth;
  const points = [
      [3, 2],
      [w - 4, 2],
      [w - 1, d * 0.35],
      [w * 0.79, d * 0.8],
      [w * 0.52, d * (0.83 + noise(seed) * 0.17)],
      [w * 0.22, d * 0.8],
      [2, d * 0.5],
    ],
    center = [w * 0.49, d * 0.35];
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  const shade = c.createLinearGradient(0, 0, 0, d);
  shade.addColorStop(0, '#161c22');
  shade.addColorStop(0.55, '#515961');
  shade.addColorStop(1, '#22282e');
  c.fillStyle = shade;
  c.fill();
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      q = points[(i + 1) % points.length];
    c.beginPath();
    c.moveTo(...center);
    c.lineTo(...p);
    c.lineTo(...q);
    c.closePath();
    c.fillStyle = `rgba(${i % 2 ? '185,172,141' : '8,16,23'},${0.08 + noise(seed + i) * 0.24})`;
    c.fill();
  }
  c.lineWidth = 1.2;
  c.strokeStyle = '#869097';
  c.globalAlpha = 0.75;
  c.beginPath();
  c.moveTo(2, d * 0.5);
  c.lineTo(w * 0.22, d * 0.8);
  c.lineTo(w * 0.52, d * 0.94);
  c.lineTo(w * 0.79, d * 0.8);
  c.lineTo(w - 1, d * 0.35);
  c.stroke();
  c.globalAlpha = 0.65;
  c.strokeStyle = '#111920';
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(w * 0.32, 3);
  c.lineTo(w * 0.4, d * 0.32);
  c.lineTo(w * 0.34, d * 0.52);
  c.lineTo(w * 0.52, d * 0.7);
  c.stroke();
  c.globalAlpha = 0.2;
  for (let i = 0; i < 16; i++) {
    c.fillStyle = i % 2 ? '#e7d0ac' : '#020810';
    c.fillRect(noise(seed + i * 3) * w, noise(seed + i * 3 + 1) * d, 1, 1);
  }
  if (tiles.size >= 256) tiles.delete(tiles.keys().next().value);
  tiles.set(key, tile);
  return tile;
}
export function stones(edge) {
  const result = [];
  for (let side = 0; side < 4; side++) {
    const count = side % 2 ? 9 : 16,
      length = side % 2 ? 1080 : 1920;
    for (let i = 0; i < count; i++) {
      const along = ((i + 0.5) * length) / count,
        seed = side * 41 + i;
      result.push({
        seed,
        side,
        x: side === 0 ? along : side === 1 ? 1926 : side === 2 ? 1920 - along : -6,
        y: side === 0 ? -6 : side === 1 ? along : side === 2 ? 1086 : 1080 - along,
        angle: (side * Math.PI) / 2,
        width: Math.ceil(length / count + 16),
        depth: Math.ceil(edge * (0.72 + noise(seed) * 0.35)),
      });
    }
  }
  return result;
}
export function edgePoint(side, along, inset) {
  return side === 0
    ? [along, inset]
    : side === 1
      ? [1920 - inset, along]
      : side === 2
        ? [1920 - along, 1080 - inset]
        : [inset, 1080 - along];
}
export function clipEdges(c) {
  c.beginPath();
  c.rect(0, 0, 1920, 1080);
  c.rect(240, 170, 1440, 670);
  c.clip('evenodd');
}
