(function (g) {
  const M = (g.Mope = g.Mope || {});
  class Camera {
    constructor() { this.x = 0; this.y = 0; this.zoom = 1; this.targetZoom = 1; }
    follow(x, y, tier, dtSec) {
      const k = 1 - Math.pow(0.001, dtSec);
      this.x += (x - this.x) * k; this.y += (y - this.y) * k;
      this.targetZoom = 1 / (1 + 0.12 * (tier - 1));
      this.zoom += (this.targetZoom - this.zoom) * (1 - Math.pow(0.05, dtSec));
    }
    snap(x, y) { this.x = x; this.y = y; }
    worldToScreen(wx, wy, vw, vh) { return [(wx - this.x) * this.zoom + vw / 2, (wy - this.y) * this.zoom + vh / 2]; }
    screenToWorld(sx, sy, vw, vh) { return [(sx - vw / 2) / this.zoom + this.x, (sy - vh / 2) / this.zoom + this.y]; }
    visible(wx, wy, r, vw, vh) { const hw = vw / 2 / this.zoom + r, hh = vh / 2 / this.zoom + r; return Math.abs(wx - this.x) < hw && Math.abs(wy - this.y) < hh; }
  }
  M.Camera = Camera;
  if (typeof module !== 'undefined') module.exports = { Camera };
})(typeof window !== 'undefined' ? window : globalThis);
