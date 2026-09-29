import { rock, stones, noise, edgePoint } from './materials.js';
import { colors } from './palette.js';
export { colors } from './palette.js';
export function stoneBorder(c, edge, opacity, progress = 0, ingress = 0) {
  const base = c.globalAlpha;
  for (const s of stones(edge)) {
    c.save();
    c.translate(s.x, s.y);
    c.rotate(s.angle);
    c.translate(0, -s.depth * ingress);
    // Whole slabs break into three independent chips, travelling along the edge.
    const tile = rock(s.seed, s.width, s.depth),
      shift = (noise(s.seed + 2) - 0.5) * 90 * progress;
    for (let piece = 0; piece < 3; piece++) {
      const width = tile.width / 3,
        cuts = [0, width, width * 2, tile.width];
      c.save();
      c.globalAlpha = base * opacity * Math.max(0, 1 - progress * 1.1);
      c.translate(
        shift + (piece - 1) * 70 * progress,
        (noise(s.seed + piece) * 42 - 20) * progress,
      );
      c.rotate((piece - 1) * progress * 0.65);
      c.translate(-tile.width / 2, 0);
      // Adjacent chips share a jagged fracture instead of square slice edges.
      const left = cuts[piece],
        right = cuts[piece + 1],
        h = tile.height;
      c.beginPath();
      c.moveTo(left, 0);
      c.lineTo(right, 0);
      c.lineTo(right + (piece < 2 ? 8 : 0), h * 0.36);
      c.lineTo(right - (piece < 2 ? 5 : 0), h * 0.64);
      c.lineTo(right, h);
      c.lineTo(left, h);
      c.lineTo(left - (piece ? 5 : 0), h * 0.64);
      c.lineTo(left + (piece ? 8 : 0), h * 0.36);
      c.closePath();
      c.clip();
      c.drawImage(tile, 0, 0);
      c.restore();
    }
    c.restore();
  }
}
export function terrain(c, theme, t, options) {
  const color = colors[theme] || colors.earth,
    edge = options.edge_width,
    base = c.globalAlpha;
  if (theme === 'earth') {
    stoneBorder(c, edge, 0.75, 0, Math.max(0, 1 - t / 1.4));
    c.strokeStyle = color;
    c.lineWidth = 1;
    c.globalAlpha = base * (0.22 + 0.07 * Math.sin(t * 0.6));
    for (const s of stones(edge)) {
      c.save();
      c.translate(s.x, s.y);
      c.rotate(s.angle);
      c.beginPath();
      c.moveTo(-22, s.depth * 0.5);
      c.lineTo(0, s.depth * 0.74);
      c.lineTo(19, s.depth * 0.48);
      c.stroke();
      c.restore();
    }
    return;
  }
  c.lineCap = 'round';
  for (let side = 0; side < 4; side++) {
    const length = side % 2 ? 1080 : 1920;
    if (theme === 'fire') {
      for (let i = 0; i < length / 40; i++) {
        const x = i * 40,
          tall = 15 + noise(i + side * 71) * edge * 0.7 + Math.sin(t * 2 + i) * 7;
        c.beginPath();
        c.moveTo(...edgePoint(side, x - 16, 0));
        c.quadraticCurveTo(
          ...edgePoint(side, x - 19, tall * 0.6),
          ...edgePoint(side, x + Math.sin(t + i) * 8, tall),
        );
        c.quadraticCurveTo(...edgePoint(side, x + 20, tall * 0.55), ...edgePoint(side, x + 20, 0));
        const flame = c.createLinearGradient(...edgePoint(side, x, 0), ...edgePoint(side, x, tall));
        flame.addColorStop(0, '#ffedb5');
        flame.addColorStop(0.3, i % 3 ? '#ffa13b' : '#ffd278');
        flame.addColorStop(0.75, '#f95a28');
        flame.addColorStop(1, '#bd253600');
        c.fillStyle = flame;
        c.globalAlpha = base * (0.28 + noise(i) * 0.2);
        c.fill();
      }
    } else if (theme === 'hextech') {
      for (let along = 60; along < length; along += 160) {
        const [x, y] = edgePoint(side, along, edge * 0.35);
        c.strokeStyle = '#a588c3';
        c.lineWidth = 2;
        c.globalAlpha = base * 0.7;
        c.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = (i * Math.PI) / 3;
          c.lineTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15);
        }
        c.stroke();
        c.strokeStyle = color;
        c.globalAlpha = base * (0.4 + 0.2 * Math.sin(t * 2 + along));
        c.beginPath();
        c.moveTo(...edgePoint(side, along + 18, edge * 0.35));
        c.lineTo(...edgePoint(side, along + 90, edge * 0.35));
        c.stroke();
      }
    } else {
      for (let line = 0; line < 3; line++) {
        c.beginPath();
        for (let along = 0; along <= length; along += 14) {
          const inset =
            10 +
            line * 8 +
            Math.sin(
              along / (theme === 'air' ? 130 : 70) + t * (theme === 'chemtech' ? 0.35 : 1.2) + line,
            ) *
              5;
          c.lineTo(...edgePoint(side, along, inset));
        }
        c.lineWidth = theme === 'chemtech' ? 12 - line * 3 : 3 - line * 0.5;
        c.strokeStyle = color;
        c.globalAlpha = base * (theme === 'chemtech' ? 0.08 : 0.17 + line * 0.08);
        c.stroke();
      }
      for (let i = 0; i < length / 100; i++) {
        const along = (i * 103 + t * (theme === 'air' ? 45 : 13)) % length,
          [x, y] = edgePoint(side, along, edge * (0.3 + noise(i) * 0.45));
        c.beginPath();
        c.arc(x, y, theme === 'chemtech' ? 3 + noise(i) * 6 : 1.5, 0, 7);
        c.fillStyle = color;
        c.globalAlpha = base * (0.3 + noise(i) * 0.3);
        c.fill();
      }
    }
  }
}
