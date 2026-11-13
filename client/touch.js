(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Pure joystick maths (unit-tested): origin -> finger offset -> {angle, mag}; a small dead zone avoids drift. */
  function stick(ox, oy, x, y, radius = 56, dead = 0.14) {
    const dx = x - ox, dy = y - oy, d = Math.hypot(dx, dy), m = Math.min(1, d / radius);
    return { angle: Math.atan2(dy, dx), mag: m < dead ? 0 : (m - dead) / (1 - dead), dx: d > radius ? dx / d * radius : dx, dy: d > radius ? dy / d * radius : dy };
  }
  const isTouchDevice = () => !!(g.matchMedia && g.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in g || (g.navigator && g.navigator.maxTouchPoints > 0);

  /** On-screen controls: floating left-thumb joystick + BOOST / ABILITY / CLIMB / CHAT buttons. */
  class TouchControls {
    constructor(doc, input, h) {
      this.doc = doc; this.input = input; this.h = h; this.enabled = false; this.id = null; this.origin = null; this.root = doc.getElementById('touchUi');
      this.base = doc.getElementById('tuBase'); this.knob = doc.getElementById('tuKnob'); const cv = doc.getElementById('gCanvas');
      cv.addEventListener('touchstart', (e) => this.start(e), { passive: false }); cv.addEventListener('touchmove', (e) => this.move(e), { passive: false });
      const end = (e) => this.end(e); cv.addEventListener('touchend', end, { passive: false }); cv.addEventListener('touchcancel', end, { passive: false });
      const hold = (id, on, off) => { const el = doc.getElementById(id); if (!el) return; const dn = (e) => { e.preventDefault(); el.classList.add('down'); on && on(); }, up = (e) => { e.preventDefault(); el.classList.remove('down'); off && off(); }; el.addEventListener('touchstart', dn, { passive: false }); el.addEventListener('touchend', up, { passive: false }); el.addEventListener('touchcancel', up, { passive: false }); };
      hold('tuBoost', () => h.boost(true), () => h.boost(false)); hold('tuAbility', () => h.ability()); hold('tuClimb', () => h.climb()); hold('tuChat', () => h.chat());
    }
    enable(on, features) { this.enabled = on; this.root.style.display = on ? 'block' : 'none'; this.doc.body.classList.toggle('touchUi', on); if (!on) this.release(); const f = features || {}; this.doc.getElementById('tuClimb').style.display = f.climb ? '' : 'none'; this.doc.getElementById('tuChat').style.display = f.chat ? '' : 'none'; }
    start(e) {
      if (!this.enabled) return; e.preventDefault();
      if (this.h.spectating && this.h.spectating()) { this.h.next(); return; } // spectating: tap = next target
      for (const t of e.changedTouches) if (this.id === null && t.clientX < g.innerWidth * 0.62) { this.id = t.identifier; this.origin = { x: t.clientX, y: t.clientY }; this.base.style.display = 'block'; this.base.style.left = t.clientX + 'px'; this.base.style.top = t.clientY + 'px'; this.knob.style.transform = 'translate(0,0)'; }
    }
    move(e) {
      if (!this.enabled || this.id === null) return; e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === this.id) { const s = stick(this.origin.x, this.origin.y, t.clientX, t.clientY); this.input.stick = { angle: s.angle, mag: s.mag }; this.knob.style.transform = 'translate(' + s.dx + 'px,' + s.dy + 'px)'; }
    }
    end(e) { if (!this.enabled) return; for (const t of e.changedTouches) if (t.identifier === this.id) this.release(); }
    release() { this.id = null; this.origin = null; this.input.stick = null; if (this.base) this.base.style.display = 'none'; }
  }
  M.TouchControls = TouchControls; M.TouchControls.stick = stick; M.isTouchDevice = isTouchDevice;
  if (typeof module !== 'undefined') module.exports = { TouchControls, stick, isTouchDevice };
})(typeof window !== 'undefined' ? window : globalThis);
