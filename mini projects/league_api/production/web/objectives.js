import { corners, glow, ease, particles, rails, crest } from './primitives.js';
import { edgePoint, noise } from './materials.js';
import { stoneBorder } from './terrain.js';
export function voidArms(c, e, color, power) {
  corners(c, e.elapsed, (c, index, t) => {
    glow(c, 0, 0, 140, color, 0.7);
    for (let i = 0; i < 5; i++) {
      c.save();
      c.rotate(-0.7 + i * 0.4);
      const reach = (80 + i * 8) * ease(t / 0.5),
        curl = Math.sin(t * 1.6 + i) * 18;
      const g = c.createLinearGradient(0, 0, reach, 0);
      g.addColorStop(0, '#281437');
      g.addColorStop(0.75, color);
      g.addColorStop(1, '#fff0fa');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-18, 12);
      c.bezierCurveTo(reach * 0.3, 35, reach, 25 + curl, reach, -10 + curl);
      c.bezierCurveTo(reach + 12, -36 + curl, reach - 28, -45 + curl, reach - 27, -16 + curl);
      c.bezierCurveTo(reach - 35, -34 + curl, reach - 12, -24 + curl, reach - 16, -3 + curl);
      c.bezierCurveTo(reach * 0.6, 9, 22, -5, -18, -8);
      c.closePath();
      c.fill();
      c.restore();
    }
    crest(c, color, t, 4);
  });
  particles(c, color, e.elapsed, e.duration, power * 1.3, 'star');
  rails(c, color, e.elapsed, power);
}
export function eye(c, e, color, power) {
  corners(c, e.elapsed, (c, index, t) => {
    glow(c, 0, 0, 115, color, 0.7);
    c.fillStyle = '#1e1735';
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-58, 0);
    c.quadraticCurveTo(0, -45, 58, 0);
    c.quadraticCurveTo(0, 45, -58, 0);
    c.fill();
    c.stroke();
    const gaze = Math.sin(t * 1.1 + index) * 9;
    glow(c, gaze, 0, 25, color, 0.9);
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(gaze, 0, 11, 22, 0, 0, 7);
    c.fill();
    c.fillStyle = '#1e1735';
    c.fillRect(gaze - 2, -14, 4, 28);
    c.beginPath();
    c.moveTo(-50, -14);
    c.quadraticCurveTo(-67, -64, -22, -55);
    c.moveTo(50, -14);
    c.quadraticCurveTo(67, -64, 22, -55);
    c.stroke();
  });
  particles(c, color, e.elapsed, e.duration, power);
  rails(c, color, e.elapsed);
}
export function grubs(c, e, color, power) {
  for (let i = 0; i < 12; i++) {
    const side = i % 4,
      length = side % 2 ? 1080 : 1920,
      [x, y] = edgePoint(side, ((i / 4) * 400 + 120 + e.elapsed * 100) % length, 30);
    c.save();
    c.translate(x, y);
    c.rotate((side * Math.PI) / 2);
    c.translate(0, Math.sin(e.elapsed * 7 + i) * 4);
    glow(c, 0, 0, 35, color, 0.4);
    c.fillStyle = '#73649e';
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(0, 0, 19, 12, 0, 0, 7);
    c.fill();
    c.stroke();
    for (let leg = -1; leg <= 1; leg++) {
      c.beginPath();
      c.moveTo(leg * 11, 7);
      c.lineTo(leg * 11 + Math.sin(e.elapsed * 9 + leg) * 5, 18);
      c.stroke();
    }
    c.fillStyle = '#fff6f7';
    for (const dx of [7, 14]) {
      c.beginPath();
      c.arc(dx, -4, 3, 0, 7);
      c.fill();
    }
    c.fillStyle = '#28243f';
    c.fillRect(9, -5, 2, 3);
    c.fillRect(15, -5, 2, 3);
    c.beginPath();
    c.moveTo(15, -10);
    c.lineTo(23, -19);
    c.stroke();
    c.restore();
  }
  particles(c, color, e.elapsed, e.duration, power * 0.6, 'star');
}
export function structure(c, e, color, options, power) {
  stoneBorder(c, options.edge_width, 1, e.elapsed / e.duration);
  corners(c, e.elapsed, (c, index, t) => {
    c.save();
    c.translate(0, t * t * 9);
    c.rotate(Math.sin(t * 2) * 0.12);
    glow(c, 0, 0, 90, color, 0.5);
    c.strokeStyle = color;
    c.fillStyle = '#273847';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-25, 28);
    c.lineTo(-21, -12);
    c.lineTo(-29, -12);
    c.lineTo(-29, -32);
    c.lineTo(-17, -32);
    c.lineTo(-17, -22);
    c.lineTo(-5, -22);
    c.lineTo(-5, -32);
    c.lineTo(7, -32);
    c.lineTo(7, -22);
    c.lineTo(19, -22);
    c.lineTo(19, -32);
    c.lineTo(30, -32);
    c.lineTo(30, -12);
    c.lineTo(22, -12);
    c.lineTo(26, 28);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(-1, -17);
    c.lineTo(9, -2);
    c.lineTo(-3, 8);
    c.lineTo(8, 24);
    c.stroke();
    c.restore();
  });
  particles(c, color, e.elapsed, e.duration, power * 1.3);
  rails(c, color, e.elapsed, power);
}
export function crown(c, e, color, power) {
  corners(c, e.elapsed, (c, index, t) => {
    c.scale(ease(t / 0.35), ease(t / 0.35));
    crest(c, color, t, e.rank || 4);
    c.strokeStyle = color;
    c.lineWidth = 2;
    for (const sign of [-1, 1])
      for (let i = 0; i < 7; i++) {
        const angle = (-0.6 + i * 0.21) * sign,
          x = Math.sin(angle) * 66,
          y = 12 + Math.cos(angle) * 58;
        c.save();
        c.translate(x, y);
        c.rotate(angle + sign * 0.55);
        c.fillStyle = color;
        c.beginPath();
        c.ellipse(0, 0, 4, 11, 0, 0, 7);
        c.fill();
        c.restore();
      }
  });
  particles(c, color, e.elapsed, e.duration, power * 1.8, 'star');
  rails(c, color, e.elapsed, power * 1.3);
}
