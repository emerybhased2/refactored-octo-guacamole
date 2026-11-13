/* Snapshot interpolation: render remote entities ~100ms in the past, lerping between the two surrounding snapshots. */
(function (g) {
  const M = (g.Mope = g.Mope || {});
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * t; };
  class Interpolator {
    constructor(delayMs = 100) { this.delay = delayMs; this.snaps = []; }
    /** entities: array of {id,x,y,angle,...} */
    push(t, entities) {
      const map = new Map(); for (const e of entities) map.set(e.id, e);
      this.snaps.push({ t, map });
      while (this.snaps.length > 6) this.snaps.shift();
    }
    sample(now) {
      const rt = now - this.delay, s = this.snaps, out = [];
      if (!s.length) return out;
      let a = s[0], b = s[s.length - 1];
      for (let i = 0; i < s.length - 1; i++) if (s[i].t <= rt && s[i + 1].t >= rt) { a = s[i]; b = s[i + 1]; break; }
      const span = b.t - a.t, k = span > 0 ? Math.max(0, Math.min(1, (rt - a.t) / span)) : 1;
      for (const [id, eb] of b.map) {
        const ea = a.map.get(id);
        if (!ea) { out.push(eb); continue; }
        out.push(Object.assign({}, eb, { x: lerp(ea.x, eb.x, k), y: lerp(ea.y, eb.y, k), angle: lerpAngle(ea.angle, eb.angle, k) }));
      }
      return out;
    }
  }
  M.Interpolator = Interpolator; M.lerpAngle = lerpAngle;
  if (typeof module !== 'undefined') module.exports = { Interpolator, lerpAngle };
})(typeof window !== 'undefined' ? window : globalThis);
