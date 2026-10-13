// Pure finite presentation. The caller owns the clock, surface, scale and lifetime.
(function (global) {
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const greet = [0, 0, 1, 2, 3, 4, 3, 4, 3, 4, 5, 5, 6, 6, 7, 7];
  const dance = [0, 1, 2, 3, 2, 1, 2, 3, 4, 5, 6, 1, 2, 3, 2, 1, 2, 3, 4, 5, 6, 7];
  const story = [0, 0, 1, 1, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7];
  const boo = { peekaboo: [2, 2, 0, 2, 0, 0, 1, 0, 2, 0], dance: [0, 1, 1, 0, 1, 1, 0, 1, 1, 0], scare: [0, 0, 1, 1, 1, 0, 2, 2, 0] };
  function sample(clip, seconds) {
    const t = Number.isFinite(seconds) ? seconds : -1;
    const state = { visible: t >= .2 && t < 4.8, pose: 0, x: 0, y: 0, angle: 0, opacity: 1, sx: 1, sy: 1 };
    if (!state.visible) return state;
    const enter = smooth((t - .2) / .65), leave = smooth((t - 4.0) / .8), progress = clamp((t - .85) / 2.85);
    const act = clip.id.slice(clip.character.length + 1);
    const sequence = clip.character === 'boo' ? boo[act] : clip.kind === 'dance' ? dance : clip.kind === 'greeting' ? greet : story;
    state.pose = sequence[Math.min(sequence.length - 1, Math.floor(progress * sequence.length))] + (clip.character === 'boo' ? 0 : clip.row * 8);
    // Fully clear gaps on both ends make these safe one-shot overlays.
    state.opacity = Math.min(clamp((t - .2) / .2), 1 - clamp((t - 4.5) / .3));
    switch (clip.character) {
      case 'boo':
        state.opacity *= enter * (1 - leave); state.y = -28 - Math.sin(t * 3.5) * 9;
        if (act === 'dance') { state.x = Math.sin(t * 7) * 28; state.angle = Math.sin(t * 7) * .18; }
        if (act === 'scare' && progress > .48 && progress < .67) { state.x = Math.sin(t * 60) * 7; state.y -= 25; }
        state.y -= leave * 100; break;
      case 'goose':
        state.x = -360 * (1 - enter) + 360 * leave;
        state.y = (t < .85 || t > 4 ? -Math.abs(Math.sin(t * 15)) * 9 : 0); break;
      case 'climber':
        state.y = 280 * (1 - enter) + 340 * leave * leave;
        if (act === 'dance') state.angle = Math.sin(progress * Math.PI * 8) * .06;
        break;
      case 'hornet':
        state.y = -420 * (1 - enter); state.x = 400 * leave;
        if (act === 'flourish' && progress > .35 && progress < .75) state.y -= Math.sin((progress - .35) / .4 * Math.PI) * 22;
        break;
      case 'creeper':
        state.x = -330 * (1 - enter) + 340 * leave; state.y = -Math.sin(enter * Math.PI) * 32;
        if (act === 'dance') state.y -= Math.abs(Math.sin(progress * Math.PI * 8)) * 8;
        break;
      case 'kirby':
        state.y = 240 * (1 - enter) - 400 * leave;
        if (act === 'dance') state.y -= Math.abs(Math.sin(progress * Math.PI * 8)) * 18;
        break;
      default:
        state.x = -340 * (1 - enter) + 350 * leave;
        if (clip.character === 'salvager' && (t < .85 || t > 4)) state.angle = Math.sin(t * 10) * .035;
    }
    return state;
  }
  class Renderer {
    constructor(catalog, base = './') { this.catalog = catalog; this.base = base; this.images = new Map(); this.generation = 0; this.disposed = false; this.character = null; }
    async load(character) {
      const generation = ++this.generation;
      for (const image of this.images.values()) image.src = '';
      this.images.clear();
      const spec = this.catalog.characters.find(c => c.id === character);
      if (!spec) throw Error('Unknown character ' + character);
      const images = await Promise.all(spec.poses.map(async url => { const image = new Image(); image.src = new URL(this.base + url, document.baseURI).href; await image.decode(); return image; }));
      if (this.disposed || generation !== this.generation) { for (const image of images) image.src = ''; return false; }
      images.forEach((image, i) => this.images.set(i, image)); this.character = character; return true;
    }
    draw(ctx, clip, seconds, options = {}) {
      const s = sample(clip, seconds), w = ctx.canvas.width, h = ctx.canvas.height;
      ctx.clearRect(0, 0, w, h); if (!s.visible || this.disposed) return s;
      const image = this.images.get(s.pose); if (!image) return s;
      const size = Math.min(w, h) / 512 * (options.scale || 1), direction = options.flip ? -1 : 1;
      ctx.save(); ctx.translate(w / 2 + (options.x || 0) + s.x * size * direction, h * .82 + (options.y || 0) + s.y * size);
      ctx.scale(size * direction, size); ctx.rotate(s.angle); ctx.globalAlpha = s.opacity;
      ctx.drawImage(image, -192, -320, 384, 384); ctx.restore(); return s;
    }
    dispose() { this.disposed = true; this.generation++; for (const image of this.images.values()) image.src = ''; this.images.clear(); }
  }
  global.Cameo = { sample, Renderer };
  if (typeof module !== 'undefined') module.exports = { sample };
})(globalThis);
