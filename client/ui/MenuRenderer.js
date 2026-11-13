(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Pure geometry: element rectangles for a main-menu config in a viewport (anchored to viewport centre + offsetY). */
  function layoutElements(cfg, vw, vh) {
    const out = {};
    for (const [name, el] of Object.entries(cfg.elements)) out[name] = { x: Math.round(vw / 2 - el.w / 2), y: Math.round(vh / 2 + el.offsetY - el.h / 2), w: el.w, h: el.h };
    const l = cfg.logo; out.logo = { x: vw / 2, y: vh / 2 + l.offsetY };
    return out;
  }
  function paintBackground(ctx, cfg, vw, vh) {
    const bg = cfg.background;
    if (bg.type === 'gradient') {
      const gr = ctx.createLinearGradient(0, 0, 0, vh);
      for (const [s, c] of bg.stops) gr.addColorStop(s, c);
      ctx.fillStyle = gr;
    } else ctx.fillStyle = bg.color || '#000';
    ctx.fillRect(0, 0, vw, vh);
  }
  function paintLogo(ctx, cfg, vw, vh) {
    const l = cfg.logo; ctx.save();
    ctx.font = l.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = l.strokeWidth; ctx.strokeStyle = l.stroke; ctx.strokeText(l.text, vw / 2, vh / 2 + l.offsetY);
    ctx.fillStyle = l.fill; ctx.fillText(l.text, vw / 2, vh / 2 + l.offsetY); ctx.restore();
  }
  /** Applies config styling/positions to DOM controls (nickname input, play button). */
  function applyDom(cfg, rects, nickEl, playEl) {
    const set = (el, c, r) => {
      Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', font: c.font, borderRadius: c.radius + 'px', border: c.border, background: c.background });
      if (c.color) el.style.color = c.color;
    };
    set(nickEl, cfg.elements.nickname, rects.nickname); nickEl.placeholder = cfg.elements.nickname.placeholder; nickEl.maxLength = cfg.elements.nickname.maxLength;
    set(playEl, cfg.elements.play, rects.play); playEl.textContent = cfg.elements.play.label;
    playEl.onmouseenter = () => (playEl.style.background = cfg.elements.play.hover);
    playEl.onmouseleave = () => (playEl.style.background = cfg.elements.play.background);
  }
  M.MenuRenderer = { layoutElements, paintBackground, paintLogo, applyDom };
  if (typeof module !== 'undefined') module.exports = M.MenuRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
