import { stoneBorder, terrain, colors } from './terrain.js';
import { edgePoint, noise } from './materials.js';
function shards(c, theme, t, duration) {
  const color = colors[theme] || colors.gold,
    p = t / duration,
    base = c.globalAlpha;
  for (let i = 0; i < 72; i++) {
    const side = i % 4,
      length = side % 2 ? 1080 : 1920,
      along = (noise(i + 5) * length + t * (noise(i + 1) - 0.5) * 120 + length) % length;
    const inset =
        12 + noise(i + 7) * 45 + Math.sin(Math.min(1, p * 2) * Math.PI) * noise(i + 8) * 60,
      [x, y] = edgePoint(side, along, inset);
    c.save();
    c.translate(x, y);
    c.rotate(t * (noise(i) * 8 - 4));
    c.globalAlpha = base * Math.max(0, 1 - p) * (0.2 + noise(i + 2) * 0.6);
    c.fillStyle = i % 3 ? color : '#ffe7bf';
    c.beginPath();
    c.moveTo(-4, -2);
    c.lineTo(5, -6);
    c.lineTo(9, 3);
    c.lineTo(-2, 6);
    c.closePath();
    c.fill();
    c.restore();
  }
}
function sigils(c, t, color, rank = 1) {
  for (const [x, y, rotation] of [
    [106, 110, 1],
    [1814, 110, -1],
    [106, 970, -1],
    [1814, 970, 1],
  ]) {
    c.save();
    c.translate(x, y);
    c.rotate(rotation * t * 0.23);
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.shadowColor = color;
    c.shadowBlur = 12;
    for (let ring = 0; ring < 2; ring++) {
      c.beginPath();
      c.arc(0, 0, 32 + ring * 15, 0, Math.PI * 2);
      c.stroke();
    }
    c.shadowBlur = 0;
    c.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      c.save();
      c.rotate((i * Math.PI) / 4);
      c.beginPath();
      c.moveTo(0, -28);
      c.lineTo(5, -38);
      c.lineTo(0, -43);
      c.lineTo(-5, -38);
      c.stroke();
      c.restore();
    }
    c.fillStyle = color;
    c.font = 'bold 27px Georgia';
    c.textAlign = 'center';
    c.fillText(rank > 1 ? '×' + rank : '✦', 0, 9);
    c.restore();
  }
}
export function burst(c, effect, options) {
  const t = effect.elapsed,
    d = effect.duration,
    p = Math.min(1, t / d),
    fade = Math.min(1, t / 0.12, (d - t) / 0.4),
    color = colors[effect.theme] || colors.gold,
    base = c.globalAlpha;
  c.globalAlpha = base * Math.max(0, fade);
  if (effect.kind === 'release') {
    if (effect.theme === 'earth') stoneBorder(c, options.edge_width, 1 - p);
    else {
      c.save();
      c.globalAlpha = base * (1 - p);
      terrain(c, effect.theme, t, options);
      c.restore();
    }
    return;
  }
  if ((effect.kind === 'dragon' && effect.theme === 'earth') || effect.kind === 'structure') {
    stoneBorder(c, options.edge_width, 1, Math.max(0, (p - 0.12) / 0.88));
    shards(c, 'earth', t, d);
  } else {
    sigils(c, t, color, effect.rank || 1);
    shards(c, effect.theme, t, d);
    // Thin impulse races outward along the border, with no full-screen flash.
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.shadowColor = color;
    c.shadowBlur = 15;
    for (const y of [12, 1068]) {
      c.beginPath();
      c.moveTo(960 - 930 * Math.min(1, p * 3), y);
      c.lineTo(960 + 930 * Math.min(1, p * 3), y);
      c.stroke();
    }
    c.shadowBlur = 0;
  }
  if (effect.title) {
    c.globalAlpha = base * Math.max(0, fade);
    c.textAlign = 'center';
    c.font = '700 24px "Segoe UI",Arial';
    c.lineWidth = 6;
    c.strokeStyle = '#111820';
    c.fillStyle = color;
    c.strokeText(effect.title, 960, 76);
    c.fillText(effect.title, 960, 76);
    c.strokeStyle = color;
    c.lineWidth = 1;
    c.globalAlpha = base * fade * 0.5;
    c.beginPath();
    c.moveTo(735, 87);
    c.lineTo(1185, 87);
    c.stroke();
  }
}
