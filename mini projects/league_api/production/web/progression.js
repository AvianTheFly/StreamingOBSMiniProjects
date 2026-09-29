import { corners, glow, ease, particles, rails, crest } from './primitives.js';
import { edgePoint } from './materials.js';
export function runes(c, e, color, power) {
  corners(c, e.elapsed, (c, index, t) => {
    glow(c, 0, 0, 110, color, 0.65);
    c.strokeStyle = color;
    c.lineWidth = 2;
    for (let ring = 0; ring < 3; ring++) {
      c.save();
      c.rotate((ring % 2 ? -1 : 1) * t * 0.5);
      const r = 28 + ring * 16;
      c.beginPath();
      c.arc(0, 0, r, 0.2, Math.PI * 1.65);
      c.stroke();
      for (let i = 0; i < 8; i++) {
        c.save();
        c.rotate((i * Math.PI) / 4);
        c.beginPath();
        c.moveTo(0, -r - 4);
        c.lineTo(4, -r - 10);
        c.lineTo(-3, -r - 14);
        c.stroke();
        c.restore();
      }
      c.restore();
    }
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, -20);
    c.lineTo(15, 0);
    c.lineTo(0, 20);
    c.lineTo(-15, 0);
    c.closePath();
    c.fill();
  });
  particles(c, color, e.elapsed, e.duration, power, 'star');
  rails(c, color, e.elapsed);
}
export function portal(c, e, color, power) {
  corners(c, e.elapsed, (c, index, t) => {
    glow(c, 0, 0, 120, color, 0.6);
    c.strokeStyle = color;
    c.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      c.save();
      c.rotate(t * 0.4 + (i * Math.PI) / 4);
      c.beginPath();
      c.ellipse(0, 0, (25 + i * 10) * ease(t / 0.5), 45 + i * 5, 0.3, 0, Math.PI * 1.7);
      c.stroke();
      c.restore();
    }
  });
  particles(c, color, e.elapsed, e.duration, power, 'star');
  rails(c, color, e.elapsed, power);
}
export function treasure(c, e, color, power) {
  corners(c, e.elapsed, (c, index, t) => {
    glow(c, 0, 0, 90, color, 0.6);
    c.save();
    c.translate(0, Math.sin(t * 3) * 5);
    c.rotate(t * 0.15);
    c.fillStyle = color;
    c.strokeStyle = '#fff6dc';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-30, -10);
    c.lineTo(-16, -30);
    c.lineTo(17, -30);
    c.lineTo(30, -10);
    c.lineTo(0, 31);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = '#5c506f';
    c.beginPath();
    c.moveTo(-30, -10);
    c.lineTo(30, -10);
    c.moveTo(-16, -30);
    c.lineTo(0, 31);
    c.lineTo(17, -30);
    c.stroke();
    c.restore();
  });
  particles(c, color, e.elapsed, e.duration, power, 'coin');
  rails(c, color, e.elapsed);
}
export function harvest(c, e, color, power) {
  corners(c, e.elapsed, (c, index, t) => {
    glow(c, 0, 0, 90, color, 0.5);
    c.fillStyle = color;
    c.strokeStyle = color;
    c.lineWidth = 2;
    for (let stalk = 0; stalk < 3; stalk++) {
      c.save();
      c.rotate(-0.35 + stalk * 0.3 + Math.sin(t * 2) * 0.04);
      c.beginPath();
      c.moveTo(0, 40);
      c.lineTo(0, -45);
      c.stroke();
      for (let i = 0; i < 5; i++)
        for (const sign of [-1, 1]) {
          c.beginPath();
          c.ellipse(sign * 8, -38 + i * 12, 4, 9, sign * 0.65, 0, 7);
          c.fill();
        }
      c.restore();
    }
  });
  particles(c, color, e.elapsed, e.duration, power, 'coin');
}
export function vision(c, e, color, power) {
  corners(c, e.elapsed, (c, index, t) => {
    glow(c, 0, 0, 100, color, 0.55);
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-43, 0);
    c.quadraticCurveTo(0, -35, 43, 0);
    c.quadraticCurveTo(0, 35, -43, 0);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, 11, 0, 7);
    c.stroke();
    c.save();
    c.rotate(t * 1.2);
    c.beginPath();
    c.arc(0, 0, 58, 0, 0.8);
    c.moveTo(0, 0);
    c.lineTo(58, 0);
    c.stroke();
    c.restore();
  });
  rails(c, color, e.elapsed, power);
}
export function march(c, e, color, power) {
  for (let i = 0; i < 16; i++) {
    const side = i % 4,
      length = side % 2 ? 1080 : 1920,
      [x, y] = edgePoint(side, (120 + Math.floor(i / 4) * 330 + e.elapsed * 110) % length, 30);
    c.save();
    c.translate(x, y);
    c.rotate((side * Math.PI) / 2);
    c.translate(0, Math.sin(e.elapsed * 8 + i) * 3);
    c.fillStyle = color;
    c.strokeStyle = '#dffaff';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-11, 12);
    c.lineTo(0, -13);
    c.lineTo(11, 12);
    c.closePath();
    c.fill();
    c.beginPath();
    c.arc(0, -12, 7, Math.PI, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#0c233b';
    c.fillRect(-4, -10, 8, 3);
    c.restore();
  }
  rails(c, color, e.elapsed, power);
}
