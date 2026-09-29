import { stoneBorder, terrain } from './terrain.js';
import { corners, glow, ease, particles, rails, crest } from './primitives.js';
export function wings(c, e, color, power) {
  corners(c, e.elapsed, (c, index, t) => {
    glow(c, 0, 0, 115, color, 0.7);
    c.fillStyle = color;
    for (let i = 0; i < 7; i++) {
      const r = 35 + i * 10;
      c.save();
      c.rotate(-0.8 + i * 0.17 + Math.sin(t * 2) * 0.08);
      c.beginPath();
      c.moveTo(8, 10);
      c.quadraticCurveTo(r * 0.4, -26, r + 12, -12);
      c.quadraticCurveTo(r * 0.8, 13, 8, 10);
      c.fill();
      c.restore();
    }
    c.fillStyle = '#fff8df';
    c.beginPath();
    c.moveTo(-8, 12);
    c.lineTo(0, -20);
    c.lineTo(9, 12);
    c.closePath();
    c.fill();
  });
  particles(c, color, e.elapsed, e.duration, power, 'star');
  rails(c, color, e.elapsed, power);
}
export function elemental(c, e, color, options, power) {
  const p = e.elapsed / e.duration;
  if (e.theme === 'earth') {
    stoneBorder(c, options.edge_width, 1, Math.max(0, (p - 0.12) / 0.88));
    corners(c, e.elapsed, (c) => glow(c, 0, 0, 100, color, 0.7));
    particles(c, color, e.elapsed, e.duration, power * 1.4);
    return;
  }
  c.save();
  c.globalAlpha *= 0.9;
  terrain(c, e.theme, e.elapsed, { ...options, edge_width: Math.min(84, options.edge_width + 18) });
  c.restore();
  if (e.theme === 'elder') {
    wings(c, e, color, power * 1.5);
    return;
  }
  corners(c, e.elapsed, (c, index, t) => {
    glow(c, 0, 0, 125, color, 0.75);
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 3;
    if (e.theme === 'fire') {
      for (let i = 0; i < 5; i++) {
        c.save();
        c.rotate(-0.75 + i * 0.33);
        c.beginPath();
        c.moveTo(-8, 30);
        c.bezierCurveTo(-30, -5, 20, -25 + Math.sin(t * 3 + i) * 8, 8, -75 - i * 7);
        c.bezierCurveTo(48, -30, 36, 16, 8, 30);
        const flame = c.createLinearGradient(0, 30, 0, -100);
        flame.addColorStop(0, '#fff4c2');
        flame.addColorStop(0.35, '#ffb14c');
        flame.addColorStop(1, '#ed493000');
        c.fillStyle = flame;
        c.fill();
        c.restore();
      }
    } else if (e.theme === 'water') {
      for (let i = 0; i < 3; i++) {
        c.save();
        c.rotate(t * 0.16 + i * 0.45);
        c.beginPath();
        c.moveTo(-40, 35);
        c.bezierCurveTo(-82, -70, 90, -85, 38, -5);
        c.bezierCurveTo(62, -43, 18, -38, 13, -6);
        c.stroke();
        c.restore();
      }
    } else if (e.theme === 'air') {
      for (let i = 0; i < 4; i++) {
        c.save();
        c.rotate(t * 0.6 + i * 0.6);
        c.beginPath();
        c.ellipse(0, 0, 55 + i * 6, 17 + i * 4, 0.7, 0.2, Math.PI * 1.7);
        c.stroke();
        c.restore();
      }
    } else if (e.theme === 'hextech') {
      crest(c, color, t, 3);
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(20 + i * 13, 35);
        c.lineTo(38 + i * 13, 50);
        c.lineTo(100, 50 + i * 8);
        c.stroke();
        glow(c, 100, 50 + i * 8, 9, color, 0.8);
      }
    } else if (e.theme === 'chemtech') {
      for (let i = 0; i < 8; i++) {
        const a = i * 0.9 + t * 0.3,
          x = Math.cos(a) * 45,
          y = Math.sin(a) * 35;
        c.beginPath();
        c.arc(x, y, 9 + (i % 3) * 3, 0, 7);
        c.stroke();
        glow(c, x, y, 20, color, 0.45);
      }
      c.beginPath();
      c.moveTo(-12, 15);
      c.lineTo(0, -26);
      c.lineTo(18, 18);
      c.closePath();
      c.fill();
    } else crest(c, color, t, 3);
  });
  particles(
    c,
    color,
    e.elapsed,
    e.duration,
    power * 1.3,
    e.theme === 'water' || e.theme === 'chemtech' ? 'bubble' : 'star',
  );
  rails(c, color, e.elapsed, power);
}
