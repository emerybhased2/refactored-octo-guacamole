(function (g) {
  const M = (g.Mope = g.Mope || {});
  const BIOME_ORDER = ['land', 'ocean', 'arctic', 'desert', 'volcano']; // land/ocean/arctic = client biomeNum 0,1,2 (archived); desert/volcano appended (2019, order inferred)

  /* ---------------- pure logic (unit-tested in Node) ---------------- */

  /** Order offered choices: sorted by biome (archived update note); the suggested choice (first/leftmost) is the first one in the animal's own biome, else the first overall (INFERRED rule). */
  function orderChoices(ids, animals, currentBiome) {
    const A = (id) => animals.find((a) => a.id === id);
    const list = ids.slice().sort((a, b) => BIOME_ORDER.indexOf(A(a).biome) - BIOME_ORDER.indexOf(A(b).biome) || (A(a).internalId || 0) - (A(b).internalId || 0));
    const own = list.findIndex((id) => A(id).biome === currentBiome);
    if (own > 0) list.unshift(list.splice(own, 1)[0]);
    return list;
  }
  /** Row of square buttons centred at the bottom of the screen. The first (suggested) button is larger. */
  function choiceLayout(ordered, cfg, vw, vh) {
    const c = cfg.choices, base = c.button.w, out = [];
    const sizes = ordered.map((_, i) => (i === 0 ? Math.round(base * c.suggestedScale) : base));
    const total = sizes.reduce((s, x) => s + x, 0) + c.gap * Math.max(0, ordered.length - 1);
    let x = Math.round(vw / 2 - total / 2); const bottom = vh - c.marginBottom;
    ordered.forEach((id, i) => { out.push({ id, x, y: bottom - sizes[i], w: sizes[i], h: sizes[i], suggested: i === 0 }); x += sizes[i] + c.gap; });
    return out;
  }
  function choiceAt(buttons, mx, my) { return buttons.find((b) => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) || null; }

  function ancestors(id, edges) {
    const seen = new Set(), stack = [id];
    while (stack.length) { const c = stack.pop(); for (const e of edges) if (e.to === c && !seen.has(e.from)) { seen.add(e.from); stack.push(e.from); } }
    return seen;
  }
  /** Tree card state: current | available | needsXp | past | future. */
  function stateOf(id, currentId, xp, animals, edges) {
    if (id === currentId) return 'current';
    const a = animals.find((x) => x.id === id);
    if (edges.some((e) => e.from === currentId && e.to === id)) return xp >= a.xpRequired ? 'available' : 'needsXp';
    if (ancestors(currentId, edges).has(id)) return 'past';
    return 'future';
  }
  /** Dev tree geometry: one column per tier, vertical scroll. cfg = upgradeMenu.tree */
  function layout(animals, cfg, vw, vh, scrollY = 0) {
    const tiers = [...new Set(animals.map((a) => a.tier))].sort((a, b) => a - b);
    const c = cfg.card, p = cfg.panel, titleH = 36;
    const cols = tiers.length, rowsMax = Math.max(...tiers.map((t) => animals.filter((a) => a.tier === t).length));
    const contentW = cols * c.w + (cols - 1) * c.gap, contentH = rowsMax * c.h + (rowsMax - 1) * c.gap;
    const w = Math.min(vw - 2 * p.margin, contentW + 2 * p.padding), h = Math.min(vh - 2 * p.margin, contentH + 2 * p.padding + titleH);
    const px = Math.round((vw - w) / 2), py = Math.round((vh - h) / 2);
    const maxScroll = Math.max(0, contentH + 2 * p.padding + titleH - h), sc = Math.max(0, Math.min(maxScroll, scrollY));
    const x0 = px + Math.round((w - contentW) / 2), cards = [];
    for (const [ci, t] of tiers.entries()) animals.filter((a) => a.tier === t).forEach((a, ri) => {
      cards.push({ id: a.id, tier: t, col: ci, row: ri, x: x0 + ci * (c.w + c.gap), y: py + p.padding + titleH + ri * (c.h + c.gap) - sc, w: c.w, h: c.h });
    });
    return { panel: { x: px, y: py, w, h }, cards, maxScroll, scroll: sc, clip: { x: px, y: py + titleH + 4, w, h: h - titleH - 4 } };
  }
  function cardAt(lay, mx, my) {
    const cl = lay.clip; if (mx < cl.x || mx > cl.x + cl.w || my < cl.y || my > cl.y + cl.h) return null;
    return lay.cards.find((k) => mx >= k.x && mx <= k.x + k.w && my >= k.y && my <= k.y + k.h) || null;
  }

  /* ---------------- stateful UI ---------------- */
  class UpgradeMenu {
    /** devTree: enable the project-only full tree overview (never part of a historical build). */
    constructor(onEvolve, devTree = false) { this.onEvolve = onEvolve; this.devTree = devTree; this.treeOpen = false; this.scroll = 0; this.v = null; this.buttons = []; this.mx = -1; this.my = -1; this.lay = null; }
    setVersion(v) { this.v = v; this.cfg = v.upgradeMenu; this.animals = v.animals; this.edges = v.edges; this.tiers = v.tiers; }
    choices(you) { if (!this.v || !you.ev.length) return []; const cur = this.animals.find((a) => a.id === you.a); return orderChoices(you.ev, this.animals, cur ? cur.biome : null); }
    /** Enter key: take the first (suggested) choice. */
    takeFirst(you) { const c = this.choices(you); if (!c.length || !this.cfg.choices.enterTakesFirst) return false; this.onEvolve(c[0]); return true; }
    toggleTree() { if (this.devTree) { this.treeOpen = !this.treeOpen; this.scroll = 0; } }
    mouse(mx, my) { this.mx = mx; this.my = my; }
    wheel(dy) { if (this.treeOpen) this.scroll = Math.max(0, this.scroll + dy); }
    /** Returns true if the click was consumed. */
    click(mx, my, vw, vh, you) {
      if (!this.v) return false;
      if (this.treeOpen) {
        const lay = this.lay || layout(this.animals, this.cfg.tree, vw, vh, this.scroll), k = cardAt(lay, mx, my);
        if (k && stateOf(k.id, you.a, you.xp, this.animals, this.edges) === 'available') { this.onEvolve(k.id); this.treeOpen = false; }
        else if (!k) { const p = lay.panel; if (mx < p.x || mx > p.x + p.w || my < p.y || my > p.y + p.h) this.treeOpen = false; }
        return true;
      }
      const b = choiceAt(choiceLayout(this.choices(you), this.cfg, vw, vh), mx, my);
      if (b) { this.onEvolve(b.id); return true; }
      return false;
    }
    draw(ctx, vw, vh, you, now) {
      if (!this.v) return;
      const C = this.cfg.choices;
      if (!this.treeOpen) {
        this.buttons = choiceLayout(this.choices(you), this.cfg, vw, vh);
        for (const b of this.buttons) {
          const a = this.animals.find((x) => x.id === b.id), hov = this.mx >= b.x && this.mx <= b.x + b.w && this.my >= b.y && this.my <= b.y + b.h;
          ctx.save(); ctx.globalAlpha = C.fillAlpha; ctx.fillStyle = C.biomeColors[a.biome]; ctx.fillRect(b.x, b.y, b.w, b.h);
          if (hov) { ctx.globalAlpha = C.highlightAlpha; ctx.fillStyle = '#fff'; ctx.fillRect(b.x, b.y, b.w, b.h); }
          ctx.globalAlpha = 1; const top = C.namePosition === 'top', d = C.iconRadiusFactor * b.w / M.Sprites.BODY_FRAC; ctx.drawImage(M.Sprites.getIcon(a), b.x + b.w / 2 - d / 2, b.y + b.h * (top ? 0.58 : 0.46) - d / 2, d, d); // body diameter = iconRadiusFactor * button width
          ctx.fillStyle = C.nameColor; ctx.font = C.nameFont; ctx.textAlign = 'center'; ctx.textBaseline = top ? 'top' : 'alphabetic'; ctx.fillText(a.name, b.x + b.w / 2, top ? b.y + 7 : b.y + b.h - 8); // 2018: name at the top of the button (archived draw code)
          ctx.restore();
        }
        if (this.devTree) { const r = this.badgeRect(vw, vh); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#fff'; ctx.font = '13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('[U] tree (dev)', r.x + r.w / 2, r.y + r.h / 2); }
        return;
      }
      const T = this.cfg.tree, lay = (this.lay = layout(this.animals, T, vw, vh, this.scroll)); this.scroll = lay.scroll;
      const P = lay.panel;
      ctx.save();
      ctx.fillStyle = T.panel.background; ctx.strokeStyle = T.panel.border; ctx.lineWidth = 2; roundRect(ctx, P.x, P.y, P.w, P.h, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(T.panel.title, P.x + P.w / 2, P.y + 22);
      ctx.beginPath(); ctx.rect(lay.clip.x, lay.clip.y, lay.clip.w, lay.clip.h); ctx.clip();
      const byId = Object.fromEntries(lay.cards.map((k) => [k.id, k]));
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      for (const e of this.edges) { const a = byId[e.from], b = byId[e.to]; if (a && b) { ctx.beginPath(); ctx.moveTo(a.x + a.w, a.y + a.h / 2); ctx.lineTo(b.x, b.y + b.h / 2); ctx.stroke(); } }
      const hover = cardAt(lay, this.mx, this.my);
      for (const k of lay.cards) {
        const a = this.animals.find((x) => x.id === k.id), st = stateOf(k.id, you.a, you.xp, this.animals, this.edges), S = T.states[st];
        ctx.fillStyle = hover && hover.id === k.id && st === 'available' ? S.hoverFill : S.fill; ctx.strokeStyle = S.border; ctx.lineWidth = st === 'current' || st === 'available' ? 3 : 2;
        roundRect(ctx, k.x, k.y, k.w, k.h, T.card.radius); ctx.fill(); ctx.stroke();
        const tc = (this.tiers.find((t) => t.tier === a.tier) || {}).color || '#fff'; ctx.fillStyle = tc; ctx.fillRect(k.x + 8, k.y + 6, k.w - 16, 4);
        ctx.globalAlpha = st === 'future' || st === 'needsXp' ? 0.45 : 1; const s = 70 * T.card.iconScale; ctx.drawImage(M.Sprites.getIcon(a), k.x + k.w / 2 - s / 2, k.y + 44 - s / 2, s, s); ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff'; ctx.font = T.card.nameFont; ctx.textAlign = 'center'; ctx.fillText(a.name, k.x + k.w / 2, k.y + 82);
        ctx.font = T.card.xpFont; ctx.fillStyle = st === 'needsXp' ? '#ffd36b' : '#cfd8cf'; ctx.fillText(st === 'current' ? 'You' : st === 'past' ? 'Evolved' : a.xpRequired + ' XP', k.x + k.w / 2, k.y + 102);
        ctx.fillStyle = C.biomeColors[a.biome]; ctx.fillRect(k.x + 8, k.y + k.h - 8, k.w - 16, 3);
      }
      ctx.restore();
    }
    badgeRect(vw, vh) { return { x: 12, y: vh - 70, w: 120, h: 26 }; }
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  Object.assign(UpgradeMenu, { orderChoices, choiceLayout, choiceAt, layout, stateOf, cardAt, ancestors, roundRect, BIOME_ORDER });
  M.UpgradeMenu = UpgradeMenu;
  if (typeof module !== 'undefined') module.exports = { UpgradeMenu };
})(typeof window !== 'undefined' ? window : globalThis);
