import { stoneBorder, terrain } from './terrain.js';
import { colors } from './palette.js';
import { clamp, particles, rails, caption } from './primitives.js';
import { blades, streak, link, fracture, pulse } from './combat.js';
import { elemental, wings } from './elements.js';
import { voidArms, eye, grubs, structure, crown } from './objectives.js';
import { runes, portal, treasure, harvest, vision, march } from './progression.js';

const renderers = {
  blades,
  streak,
  link,
  fracture,
  pulse,
  wings,
  void: voidArms,
  baron: voidArms,
  eye,
  grubs,
  crown,
  sigil: crown,
  runes,
  portal,
  treasure,
  harvest,
  vision,
  march,
};

export function burst(c, effect, options) {
  const t = effect.elapsed,
    d = effect.duration;
  if (t < 0 || t >= d) return;
  const p = clamp(t / d),
    color = colors[effect.theme] || colors.gold;
  const power = Math.max(
    0.3,
    Math.min(2.56, (options.intensity ?? 1.15) * (effect.intensity ?? 1)),
  );
  c.save();
  c.globalAlpha *= Math.min(1, t / 0.12, (d - t) / 0.4);
  if (effect.kind === 'release') {
    if (effect.theme === 'earth') stoneBorder(c, options.edge_width, 1 - p);
    else {
      c.globalAlpha *= 1 - p;
      terrain(c, effect.theme, t, options);
    }
    c.restore();
    return;
  }
  if (effect.kind === 'dragon') elemental(c, effect, color, options, power);
  else if (effect.kind === 'structure') structure(c, effect, color, options, power);
  else (renderers[effect.kind] || runes)(c, effect, color, power);
  caption(c, effect, color);
  c.restore();
}
