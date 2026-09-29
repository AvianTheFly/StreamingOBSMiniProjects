import { noise, edgePoint } from './materials.js';
export const clamp = (x) => Math.max(0, Math.min(1, x));
export const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
export function corners(c, t, fn) {
  for (const [x, y, sx, sy, index] of [
    [72, 70, 1, 1, 0],
    [1848, 70, -1, 1, 1],
    [1848, 1010, -1, -1, 2],
    [72, 1010, 1, -1, 3],
  ]) {
    c.save();
    c.translate(x, y);
    c.scale(sx, sy);
    fn(c, index, t);
    c.restore();
  }
}
export function glow(c, x, y, r, color, strength = 0.55) {
  c.save();
  c.globalAlpha *= clamp(strength);
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color + 'aa');
  g.addColorStop(0.35, color + '45');
  g.addColorStop(1, color + '00');
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}
export function rails(c, color, t, power = 1) {
  c.save();
  c.strokeStyle = color;
  c.lineCap = 'round';
  const base = c.globalAlpha;
  for (let side = 0; side < 4; side++) {
    const length = side % 2 ? 1080 : 1920,
      travel = (t * 0.8 + side * 0.14) % 1;
    c.globalAlpha = base * 0.8;
    c.lineWidth = 2.5 * power;
    c.beginPath();
    c.moveTo(...edgePoint(side, Math.max(0, (travel - 0.22) * length), 11));
    c.lineTo(...edgePoint(side, travel * length, 11));
    c.stroke();
    c.beginPath();
    c.moveTo(...edgePoint(side, length - travel * length, 21));
    c.lineTo(...edgePoint(side, length - Math.max(0, (travel - 0.15) * length), 21));
    c.stroke();
  }
  c.restore();
}
export function particles(c, color, t, d, power = 1, style = 'spark') {
  const count = Math.min(140, Math.round(48 * power)),
    fade = clamp(1 - t / d);
  for (let i = 0; i < count; i++) {
    const side = i % 4,
      length = side % 2 ? 1080 : 1920,
      seed = i + 17;
    const along = (noise(seed) * length + t * (noise(seed + 8) - 0.5) * 210 + length) % length;
    const inset =
      12 + noise(seed + 2) * 72 + Math.sin(clamp(t / d) * Math.PI) * noise(seed + 3) * 38;
    const [x, y] = edgePoint(side, along, inset),
      size = 2 + noise(seed + 5) * 4;
    c.save();
    c.translate(x, y);
    c.rotate(t * (noise(seed + 6) * 5 - 2));
    c.globalAlpha *= fade * (0.25 + noise(seed + 4) * 0.7);
    c.fillStyle = i % 4 ? color : '#fff8df';
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    c.beginPath();
    if (style === 'bubble') {
      c.arc(0, 0, size, 0, Math.PI * 2);
      c.stroke();
    } else if (style === 'star') {
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4,
          r = k % 2 ? size * 0.3 : size;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    } else if (style === 'coin') {
      c.ellipse(0, 0, size * 0.55, size, 0, 0, Math.PI * 2);
      c.fill();
    } else {
      c.moveTo(-size, 0);
      c.lineTo(0, -size * 0.5);
      c.lineTo(size, 0);
      c.lineTo(0, size * 0.5);
      c.closePath();
      c.fill();
    }
    c.restore();
  }
}
export function crest(c, color, t, rank = 1) {
  c.save();
  c.rotate(Math.sin(t * 0.8) * 0.05);
  glow(c, 0, 0, 90, color, 0.8);
  // A dark beveled seal keeps the emblem readable over bright gameplay.
  const seal = c.createLinearGradient(-30, -36, 30, 36);
  seal.addColorStop(0, '#334358');
  seal.addColorStop(0.45, '#101c2e');
  seal.addColorStop(1, '#050a14');
  c.fillStyle = seal;
  c.strokeStyle = color;
  c.lineWidth = 1.5;
  c.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 6;
    c.lineTo(Math.cos(a) * 36, Math.sin(a) * 36);
  }
  c.closePath();
  c.fill();
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = 2;
  for (let ring = 0; ring < 2; ring++) {
    c.save();
    c.rotate(t * (ring ? 0.3 : -0.25));
    c.beginPath();
    const r = 30 + ring * 15;
    for (let i = 0; i <= 6; i++) {
      const a = (i * Math.PI) / 3;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.stroke();
    c.restore();
  }
  const metal = c.createLinearGradient(0, -26, 0, 24);
  metal.addColorStop(0, '#fff8df');
  metal.addColorStop(0.38, color);
  metal.addColorStop(0.65, '#fff0c5');
  metal.addColorStop(1, color);
  c.fillStyle = metal;
  c.beginPath();
  c.moveTo(-18, 8);
  c.lineTo(-25, -14);
  c.lineTo(-8, -3);
  c.lineTo(0, -26);
  c.lineTo(8, -3);
  c.lineTo(25, -14);
  c.lineTo(18, 8);
  c.closePath();
  c.fill();
  c.strokeStyle = '#fff8df';
  c.lineWidth = 0.75;
  c.stroke();
  for (let i = 0; i < rank; i++) {
    c.beginPath();
    c.arc((i - (rank - 1) / 2) * 11, 21, 2.2, 0, 7);
    c.fill();
  }
  c.restore();
}
export function caption(c, e, color) {
  if (!e.title) return;
  c.save();
  const major = e.priority >= 80 || e.rank >= 3,
    entrance = ease(e.elapsed / 0.35);
  const y = (major ? 78 : 43) - 14 * (1 - entrance),
    size = major ? 30 : 20;
  c.font = `800 ${size}px "Segoe UI",Arial`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const width = Math.min(780, c.measureText(e.title).width + 72),
    left = 960 - width / 2;
  const g = c.createLinearGradient(left, 0, left + width, 0);
  g.addColorStop(0, '#07111c00');
  g.addColorStop(0.2, '#07111ccc');
  g.addColorStop(0.8, '#07111ccc');
  g.addColorStop(1, '#07111c00');
  c.fillStyle = g;
  c.fillRect(left, y - 23, width, 46);
  c.lineWidth = 5;
  c.strokeStyle = '#09111a';
  c.strokeText(e.title, 960, y);
  c.fillStyle = color;
  c.fillText(e.title, 960, y);
  c.strokeStyle = color;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(left + 22, y + 25);
  c.lineTo(left + width - 22, y + 25);
  c.stroke();
  for (const x of [left + 12, left + width - 12]) {
    c.save();
    c.translate(x, y + 25);
    c.rotate(Math.PI / 4);
    c.fillRect(-3, -3, 6, 6);
    c.restore();
  }
  if (e.confidence === 'possible') {
    c.font = '11px "Segoe UI",Arial';
    c.fillText('POSSIBLE SIGNAL', 960, y + 43);
  }
  c.restore();
}
