(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Pointer/touch -> {angle, mag}, relative to screen centre (the player is camera-centred). */
  function pointerToInput(px, py, vw, vh, deadzone = 12, fullAt = 140) {
    const dx = px - vw / 2, dy = py - vh / 2, d = Math.hypot(dx, dy);
    return { angle: Math.atan2(dy, dx), mag: d < deadzone ? 0 : Math.min(1, (d - deadzone) / (fullAt - deadzone)) };
  }
  class Input {
    constructor(el) {
      this.px = window.innerWidth / 2; this.py = window.innerHeight / 2; this.enabled = false; this.keyHandlers = {}; this.stick = null; // stick: on-screen joystick override {angle, mag}
      el.addEventListener('mousemove', (e) => { this.px = e.clientX; this.py = e.clientY; });
      el.addEventListener('touchstart', (e) => { const t = e.touches[0]; this.px = t.clientX; this.py = t.clientY; }, { passive: true });
      el.addEventListener('touchmove', (e) => { const t = e.touches[0]; this.px = t.clientX; this.py = t.clientY; }, { passive: true });
      g.addEventListener('keydown', (e) => { if (e.target && e.target.tagName === 'INPUT') return; const h = this.keyHandlers[e.key.toLowerCase()]; if (h) { h(e); } });
    }
    on(key, fn) { this.keyHandlers[key.toLowerCase()] = fn; }
    current(vw, vh) { if (this.stick) return this.stick; return pointerToInput(this.px, this.py, vw, vh); }
  }
  M.Input = Input; M.pointerToInput = pointerToInput;
  if (typeof module !== 'undefined') module.exports = { Input, pointerToInput };
})(typeof window !== 'undefined' ? window : globalThis);
