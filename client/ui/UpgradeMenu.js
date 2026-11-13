(function (g) {
  const M = (g.Mope = g.Mope || {});

  /* ---------- pure logic (unit-tested in Node) ---------- */

  /** Ancestors of `id` following reverse evolution edges. */
  function ancestors(id, edges) {
    const seen = new Set(), stack = [id];
    while (stack.length) { const c = stack.pop(); for (const e of edges) if (e.to === c && !seen.has(e.from)) { seen.add(e.from); stack.push(e.from); } }
    return seen;
  }
  /** Card state: current | available | needsXp | past | future. Generated purely from the version's progression data. */
  function stateOf(id, currentId, xp, animals, edges) {
    if (id === currentId) return 'current';
    const a = animals.find((x) => x.id === id);
    if (edges.some((e) => e.from === currentId && e.to === id)) return xp >= a.xpRequired ? 'available' : 'needsXp';
    if (ancestors(currentId, edges).has(id)) return 'past';
    return 'future';
  }
  /** Geometry: one column per tier, one card per animal; vertical scroll when content exceeds the panel. */
  function layout(animals, cfg, vw, vh, scrollY = 0) {
    const tiers = [...new Set(animals.map((a) => a.tier))].sort((a, b) => a - b);
    const c = cfg.card, p = cfg.panel, titleH = 36;
    const cols = tiers.length, rowsMax = Math.max(...tiers.map((t) => animals.filter((a) => a.tier === t).length));
    const contentW = cols * c.w + (cols - 1) * c.gap, contentH = rowsMax * c.h + (rowsMax - 1) * c.gap;
    const w = Math.min(vw - 2 * p.margin, contentW + 2 * p.padding), h = Math.min(vh - 2 * p.margin, contentH + 2 * p.padding + titleH);
    const px = Math.round((vw - w) / 2), py = Math.round((vh - h) / 2);
    const maxScroll = Math.max(0, contentH + 2 * p.padding + titleH - h);
    const sc = Math.max(0, Math.min(maxScroll, scrollY));
    const x0 = px + Math.round((w - contentW) / 2);
    const cards = [];
    for (const [ci, t] of tiers.entries()) animals.filter((a) => a.tier === t).forEach((a, ri) => {
      cards.push({ id: a.id, tier: t, col: ci, row: ri, x: x0 + ci * (c.w + c.gap), y: py + p.padding + titleH + ri * (c.h + c.gap) - sc, w: c.w, h: c.h });
    });
    return { panel: { x: px, y: py, w, h }, cards, maxScroll, scroll: sc, clip: { x: px, y: py + titleH + 4, w, h: h - titleH - 4 } };
  }
  function cardAt(lay, mx, my) {
    const cl = lay.clip; if (mx < cl.x || mx > cl.x + cl.w || my < cl.y || my > cl.y + cl.h) return null;
    return lay.cards.find((k) => mx >= k.x && mx <= k.x + k.w && my >= k.y && my <= k.y + k.h) || null;
  }

  /* ---------- stateful UI ---------- */
  class UpgradeMenu {
    constructor(onEvolve) { this.onEvolve = onEvolve; this.open = false; this.scroll = 0; this.hover = null; this.v = null; this.lay = null; }
    setVersion(v) { this.v = v; this.cfg = v.upgradeMenu; this.animals = v.animals; this.edges = v.edges; this.tiers = v.tiers; }
    toggle() { this.open = !this.open; this.scroll = 0; }
    badgeRect(vw, vh) { const b = this.cfg.badge; return { x: Math.round(vw / 2 - b.w / 2), y: vh - b.marginBottom - b.h - 40, w: b.w, h: b.h }; }
    /** Returns true if the click was consumed. */
    click(mx, my, vw, vh, you) {
      if (!this.v) return false;
      if (!this.open) {
        const r = this.badgeRect(vw, vh);
        if (you.ev.length && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) { this.toggle(); return true; }
        return false;
      }
      const k = cardAt(this.lay || layout(this.animals, this.cfg, vw, vh, this.scroll), mx, my);
      if (k && stateOf(k.id, you.a, you.xp, this.animals, this.edges) === 'available') { this.onEvolve(k.id); this.open = false; }
      else if (!k) { const p = (this.lay || layout(this.animals, this.cfg, vw, vh)).panel; if (mx < p.x || mx > p.x + p.w || my < p.y || my > p.y + p.h) this.open = false; }
      return true;
    }
    wheel(dy) { if (this.open) this.scroll = Math.max(0, this.scroll + dy); }
    mouse(mx, my) { this.mx = mx; this.my = my; }
    draw(ctx, vw, vh, you, now) {
      if (!this.v) return;
      const cfg = this.cfg;
      if (!this.open) {
        if (!you.ev.length) return;
        const r = this.badgeRect(vw, vh), pulse = 1 + 0.06 * Math.sin(now / 160);
        ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(pulse, pulse);
        ctx.fillStyle = '#4caf50'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; roundRect(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cfg.badge.label + ' [' + cfg.toggleKey.toUpperCase() + ']', 0, 1); ctx.restore();
        return;
      }
      const lay = (this.lay = layout(this.animals, cfg, vw, vh, this.scroll)); this.scroll = lay.scroll;
      const P = lay.panel;
      ctx.save();
      ctx.fillStyle = cfg.panel.background; ctx.strokeStyle = cfg.panel.border; ctx.lineWidth = 2; roundRect(ctx, P.x, P.y, P.w, P.h, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cfg.panel.title, P.x + P.w / 2, P.y + 22);
      ctx.beginPath(); ctx.rect(lay.clip.x, lay.clip.y, lay.clip.w, lay.clip.h); ctx.clip();
      const byId = Object.fromEntries(lay.cards.map((k) => [k.id, k]));
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
      for (const e of this.edges) { const a = byId[e.from], b = byId[e.to]; if (a && b) { ctx.beginPath(); ctx.moveTo(a.x + a.w, a.y + a.h / 2); ctx.lineTo(b.x, b.y + b.h / 2); ctx.stroke(); } }
      this.hover = this.mx != null ? cardAt(lay, this.mx, this.my) : null;
      for (const k of lay.cards) {
        const a = this.animals.find((x) => x.id === k.id), st = stateOf(k.id, you.a, you.xp, this.animals, this.edges), S = cfg.states[st];
        const hov = this.hover && this.hover.id === k.id && st === 'available';
        ctx.fillStyle = hov ? S.hoverFill : S.fill; ctx.strokeStyle = S.border; ctx.lineWidth = st === 'current' || st === 'available' ? 3 : 2;
        roundRect(ctx, k.x, k.y, k.w, k.h, cfg.card.radius); ctx.fill(); ctx.stroke();
        const tc = (this.tiers.find((t) => t.tier === a.tier) || {}).color || '#fff';
        ctx.fillStyle = tc; ctx.fillRect(k.x + 8, k.y + 6, k.w - 16, 4);
        ctx.globalAlpha = st === 'future' || st === 'needsXp' ? 0.45 : 1;
        const s = 54 * cfg.card.iconScale; ctx.drawImage(M.Sprites.get(a), k.x + k.w / 2 - s / 2, k.y + 16, s, s); ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff'; ctx.font = cfg.card.nameFont; ctx.textAlign = 'center'; ctx.fillText(a.name, k.x + k.w / 2, k.y + 88);
        ctx.font = cfg.card.xpFont; ctx.fillStyle = st === 'needsXp' ? '#ffd36b' : '#cfd8cf';
        ctx.fillText(st === 'current' ? 'You' : st === 'past' ? 'Evolved' : a.xpRequired + ' XP', k.x + k.w / 2, k.y + 108);
      }
      ctx.restore();
      if (this.hover) { const a = this.animals.find((x) => x.id === this.hover.id); tooltip(ctx, a.name + ' (Tier ' + a.tier + ') - ' + a.description, this.mx, this.my, vw); }
    }
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function tooltip(ctx, text, x, y, vw) {
    ctx.save(); ctx.font = '14px Arial'; const w = ctx.measureText(text).width + 16, tx = Math.min(vw - w - 4, x + 14);
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(tx, y + 14, w, 26); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, tx + 8, y + 27); ctx.restore();
  }

  UpgradeMenu.layout = layout; UpgradeMenu.stateOf = stateOf; UpgradeMenu.cardAt = cardAt; UpgradeMenu.ancestors = ancestors; UpgradeMenu.roundRect = roundRect;
  M.UpgradeMenu = UpgradeMenu;
  if (typeof module !== 'undefined') module.exports = { UpgradeMenu };
})(typeof window !== 'undefined' ? window : globalThis);
