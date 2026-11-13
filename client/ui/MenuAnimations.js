(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Background animation for the menu. 'drifting-animals': placeholder animal sprites float across the screen. */
  class MenuAnimations {
    constructor(cfg, animalDefs, seed = 1) {
      this.cfg = cfg.animation; this.items = []; this.defs = animalDefs;
      let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const names = (this.cfg.animals || []).filter((id) => animalDefs.some((a) => a.id === id));
      for (let i = 0; i < (this.cfg.count || 0); i++) this.items.push({ id: names[i % names.length], x: rnd(), y: rnd(), dir: rnd() * 6.28, sp: 0.5 + rnd(), scale: 24 + rnd() * 40 });
    }
    update(dt, vw, vh) {
      for (const it of this.items) {
        it.x += (Math.cos(it.dir) * this.cfg.speed * it.sp * dt) / vw; it.y += (Math.sin(it.dir) * this.cfg.speed * it.sp * dt) / vh;
        if (it.x < -0.1) it.x = 1.1; if (it.x > 1.1) it.x = -0.1; if (it.y < -0.1) it.y = 1.1; if (it.y > 1.1) it.y = -0.1;
      }
    }
    draw(ctx, vw, vh) {
      ctx.save(); ctx.globalAlpha = 0.55;
      for (const it of this.items) {
        const def = this.defs.find((a) => a.id === it.id); if (!def) continue;
        ctx.save(); ctx.translate(it.x * vw, it.y * vh); ctx.rotate(it.dir);
        ctx.drawImage(M.Sprites.get(def), -it.scale, -it.scale, it.scale * 2, it.scale * 2); ctx.restore();
      }
      ctx.restore();
    }
  }
  M.MenuAnimations = MenuAnimations;
  if (typeof module !== 'undefined') module.exports = { MenuAnimations };
})(typeof window !== 'undefined' ? window : globalThis);
