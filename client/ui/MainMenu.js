(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Main menu controller: paints the version-specific menu and wires nickname + Play. */
  class MainMenu {
    constructor({ canvas, root, nickEl, playEl, onPlay }) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.root = root; this.nickEl = nickEl; this.playEl = playEl;
      this.cfg = null; this.anim = null; this.visible = false; this.last = 0; this.animals = [];
      try { nickEl.value = localStorage.getItem('mope.nick') || ''; } catch (e) {}
      const go = () => { const n = nickEl.value.trim(); try { localStorage.setItem('mope.nick', n); } catch (e) {} onPlay(n); };
      playEl.addEventListener('click', go);
      nickEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    }
    /** animals: the animal definitions used by the menu's background animation (from versions' animals database). */
    setConfig(cfg, animals) { this.cfg = cfg; this.animals = animals; this.anim = new M.MenuAnimations(cfg, animals); this.layout(); }
    layout() {
      if (!this.cfg) return;
      const vw = (this.canvas.width = innerWidth), vh = (this.canvas.height = innerHeight);
      this.rects = M.MenuRenderer.layoutElements(this.cfg, vw, vh);
      M.MenuRenderer.applyDom(this.cfg, this.rects, this.nickEl, this.playEl);
    }
    show() { this.visible = true; this.root.style.display = 'block'; this.canvas.style.display = 'block'; this.last = performance.now(); requestAnimationFrame((t) => this.frame(t)); }
    hide() { this.visible = false; this.root.style.display = 'none'; this.canvas.style.display = 'none'; }
    frame(t) {
      if (!this.visible) return;
      const dt = Math.min(0.1, (t - this.last) / 1000); this.last = t;
      const vw = this.canvas.width, vh = this.canvas.height;
      M.MenuRenderer.paintBackground(this.ctx, this.cfg, vw, vh);
      this.anim.update(dt, vw, vh); this.anim.draw(this.ctx, vw, vh);
      M.MenuRenderer.paintLogo(this.ctx, this.cfg, vw, vh);
      requestAnimationFrame((tt) => this.frame(tt));
    }
  }
  M.MainMenu = MainMenu;
})(typeof window !== 'undefined' ? window : globalThis);
