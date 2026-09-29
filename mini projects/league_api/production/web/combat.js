import { corners, glow, ease, particles, rails, crest, clamp } from './primitives.js';
import { noise, edgePoint } from './materials.js';
export function blades(c, e, color, power) {
  corners(c, e.elapsed, (c, index, t) => {
    const hit = ease(t / 0.24);
    glow(c, 10, 10, 105, color, 0.8);
    c.strokeStyle = color;
    c.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      c.save();
      c.rotate(-0.5 + i * 0.45);
      c.fillStyle = i === 1 ? '#fff6df' : color;
      c.beginPath();
      c.moveTo(-20, -60);
      c.lineTo(8 + hit * 105, 30 + i * 8);
      c.lineTo(2 + hit * 70, 30 + i * 8);
      c.lineTo(-26, -56);
      c.closePath();
      c.fill();
      c.strokeStyle = color;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(10, 50 + i * 9);
      c.lineTo(90 * hit, 65 + i * 9);
      c.stroke();
      c.restore();
    }
    if (e.rank >= 3) crest(c, color, t, e.rank);
  });
  particles(c, color, e.elapsed, e.duration, power);
  rails(c, color, e.elapsed, power);
}
export function streak(c, e, color, power) {
  corners(c, e.elapsed, (c, index, t) => {
    c.scale(ease(t / 0.35), ease(t / 0.35));
    for (const sign of [-1, 1]) {
      c.save();
      c.scale(sign, 1);
      const feather = c.createLinearGradient(22, 26, 105, -60);
      feather.addColorStop(0, '#775532');
      feather.addColorStop(0.3, color);
      feather.addColorStop(1, '#fff4ce');
      c.fillStyle = feather;
      c.strokeStyle = '#fff3c5';
      c.lineWidth = 0.7;
      for (let i = 0; i < 6; i++) {
        c.globalAlpha *= 0.93;
        c.beginPath();
        c.moveTo(26, 15);
        c.quadraticCurveTo(50 + i * 10, -32 - i * 8, 98 + i * 8, -18 - i * 13);
        c.quadraticCurveTo(75 + i * 6, 35 - i * 5, 26, 25);
        c.fill();
        c.stroke();
      }
      c.restore();
    }
    crest(c, color, t, e.rank || 3);
    for (let i = 0; i < (e.rank || 3); i++) {
      c.save();
      c.rotate(i * 1.3 + t * 0.45);
      glow(c, 65, 0, 12, color, 0.9);
      c.restore();
    }
  });
  particles(c, color, e.elapsed, e.duration, power * 1.5, 'star');
  rails(c, color, e.elapsed, power);
}
export function link(c, e, color, power) {
  corners(c, e.elapsed, (c, index, t) => {
    glow(c, 0, 0, 90, color, 0.5);
    c.strokeStyle = color;
    c.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const x = i * 24;
      c.beginPath();
      c.arc(x, x * 0.4, 12, 0, Math.PI * 2);
      c.stroke();
      if (i) {
        c.beginPath();
        c.moveTo(x - 24 + 10, (x - 24) * 0.4);
        c.lineTo(x - 10, x * 0.4);
        c.stroke();
      }
    }
  });
  particles(c, color, e.elapsed, e.duration, power * 0.7);
  rails(c, color, e.elapsed);
}
export function fracture(c, e, color, power) {
  for (let side = 0; side < 4; side++)
    for (let i = 0; i < 9; i++) {
      const length = side % 2 ? 1080 : 1920,
        along = ((i + 0.5) * length) / 9;
      c.save();
      c.strokeStyle = color;
      c.lineWidth = 1.7;
      c.beginPath();
      c.moveTo(...edgePoint(side, along, 0));
      c.lineTo(...edgePoint(side, along - 14, 25));
      c.lineTo(...edgePoint(side, along + 10, 45));
      c.lineTo(...edgePoint(side, along - 6, 70 * ease(e.elapsed / 0.3)));
      c.stroke();
      c.restore();
    }
  corners(c, e.elapsed, (c) => glow(c, 0, 0, 100, color, 0.5));
  particles(c, color, e.elapsed, e.duration, power, 'spark');
}
export function pulse(c, e, color, power) {
  const beat = 0.45 + 0.4 * Math.sin(Math.min(e.elapsed, 1.7) * Math.PI * 2 - 1);
  corners(c, e.elapsed, (c) => {
    glow(c, 0, 0, 110, color, beat);
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-50, 20);
    c.lineTo(-16, 20);
    c.lineTo(-4, -5);
    c.lineTo(8, 43);
    c.lineTo(18, 12);
    c.lineTo(58, 12);
    c.stroke();
  });
  rails(c, color, e.elapsed, power);
}
