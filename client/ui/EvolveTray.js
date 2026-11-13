(function (g) {
  const M = (g.Mope = g.Mope || {});
  /* ORIGINAL upgrade picker ("Evolution Tray"): a touch-friendly bottom sheet that shows every animal you can evolve into NOW (bright, tappable)
   * plus the next few you are working towards (dim, with an XP progress bar). Not a reproduction of any archived Mope.io menu. */
  const BIOME_COLORS = { land: '#3fae4c', ocean: '#2a8fd0', arctic: '#8cc8e8', desert: '#d9a441', volcano: '#d2542a', forest: '#2f7a36', deepocean: '#0b3a66', underground: '#7a5a44' };
  const pretty = (s) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'No special ability');
  const fmtXp = (n) => (n >= 1e6 ? +(n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? +(n / 1e3).toFixed(1) + 'K' : String(Math.round(n)));

  /** Pure model (unit-tested): who can I evolve into now (ordered by `choices`), and which are the nearest upcoming ones. */
  function trayModel(animals, edges, you, choices, maxSoon = 3) {
    const A = (id) => animals.find((a) => a.id === id), cur = A(you.a);
    const card = (a, avail) => ({ id: a.id, name: a.name, tier: a.tier, biome: a.biome, ability: pretty(a.ability), xpRequired: a.xpRequired, available: avail, progress: avail ? 1 : Math.max(0, Math.min(1, (you.xp || 0) / (a.xpRequired || 1))) });
    const available = (choices || []).map((id, i) => Object.assign(card(A(id), true), { suggested: i === 0 }));
    const have = new Set(choices || []);
    const soon = cur ? [...new Set(edges.filter((e) => e.from === cur.id && !have.has(e.to) && A(e.to)).map((e) => e.to))].map((id) => card(A(id), false)).sort((a, b) => a.xpRequired - b.xpRequired).slice(0, maxSoon) : [];
    return { available, soon, current: cur ? { id: cur.id, name: cur.name, tier: cur.tier } : null };
  }

  class EvolveTray {
    constructor(doc, opts) { this.doc = doc; this.onEvolve = opts.onEvolve; this.touch = !!opts.touch; this.icon = opts.icon; this.ready = opts.ready; this.retries = 0; this.v = null; this.key = ''; this.sel = null; this.iconCache = new Map(); this.last = 0; this.expanded = false; this.root = doc.getElementById('evoTray'); this.row = doc.getElementById('evoRow'); this.detail = doc.getElementById('evoDetail'); this.title = doc.getElementById('evoTitle'); }
    setVersion(v) { this.v = v; this.key = ''; this.sel = null; }
    hide() { if (this.root) this.root.classList.add('hidden'); this.key = ''; this.sel = null; }
    /** Data URL of the animal's own art. The grey placeholder is never cached: if the PNG has not loaded yet the tray rebuilds itself shortly after. */
    img(a) {
      let u = this.iconCache.get(a.id); if (u) return u;
      const cv = this.icon(a), ok = !this.ready || this.ready(a); try { u = cv.toDataURL('image/png'); } catch (e) { u = ''; }
      if (u && ok) this.iconCache.set(a.id, u); else this.pending = true;
      return u;
    }
    /** Called every frame (cheap): rebuilds the DOM only when the set of cards changes; progress bars refresh at ~4 Hz. */
    update(you, choices, now) {
      if (!this.root || !this.v) return;
      const m = trayModel(this.v.animals, this.v.edges, you, choices);
      if (!m.available.length && !m.soon.length) { this.hide(); return; }
      this.root.classList.remove('hidden'); this.root.classList.toggle('ready', m.available.length > 0);
      if (m.available.length) this.expanded = true; // something to pick: always open
      this.root.classList.toggle('compact', !m.available.length && !this.expanded);
      const key = m.current.id + '|' + m.available.map((c) => c.id).join(',') + '|' + m.soon.map((c) => c.id).join(',');
      if (key !== this.key) { this.key = key; this.sel = null; if (!m.available.length) this.expanded = false; this.build(m); this.root.classList.toggle('compact', !m.available.length && !this.expanded); }
      else if (now - this.last > 250) { this.last = now; for (const c of m.soon) { if (c === m.soon[0] && !m.available.length) { const hint = this.root.querySelector('.evoHint'); hint.textContent = fmtXp(you.xp || 0) + ' / ' + fmtXp(c.xpRequired) + ' XP - tap to ' + (this.expanded ? 'hide' : 'see more'); } const el = this.row.querySelector('[data-id="' + c.id + '"] .evoBar i'); if (el) el.style.width = Math.round(c.progress * 100) + '%'; const tx = this.row.querySelector('[data-id="' + c.id + '"] .evoXp'); if (tx) tx.textContent = fmtXp(you.xp || 0) + ' / ' + fmtXp(c.xpRequired) + ' XP'; } }
    }
    build(m) {
      const d = this.doc; this.pending = false; this.row.innerHTML = ''; this.detail.innerHTML = ''; this.detail.classList.remove('open');
      this.title.textContent = m.available.length ? 'EVOLVE!' : (m.soon[0] ? 'Next: ' + m.soon[0].name : 'NEXT EVOLUTION');
      if (!this.headBound) { this.headBound = true; this.root.querySelector('.evoHead').addEventListener('click', () => { if (this.root.classList.contains('ready')) return; this.expanded = !this.expanded; this.root.classList.toggle('compact', !this.expanded); }); }
      const mk = (c) => {
        const b = d.createElement('button'); b.type = 'button'; b.dataset.id = c.id; b.className = 'evoCard ' + (c.available ? 'avail' : 'soon') + (c.suggested ? ' suggested' : ''); b.style.setProperty('--biome', BIOME_COLORS[c.biome] || '#3fae4c');
        const a = this.v.animals.find((x) => x.id === c.id), im = d.createElement('img'); im.alt = ''; im.src = this.img(a); b.appendChild(im);
        const nm = d.createElement('b'); nm.textContent = c.name; b.appendChild(nm);
        const chip = d.createElement('span'); chip.className = 'evoChip'; chip.textContent = 'T' + c.tier; b.appendChild(chip);
        if (c.suggested) { const st = d.createElement('span'); st.className = 'evoStar'; st.textContent = '★'; st.title = 'Best fit for your biome'; b.appendChild(st); }
        if (!c.available) { const bar = d.createElement('div'); bar.className = 'evoBar'; bar.appendChild(d.createElement('i')); bar.firstChild.style.width = Math.round(c.progress * 100) + '%'; b.appendChild(bar); const x = d.createElement('small'); x.className = 'evoXp'; x.textContent = fmtXp(c.xpRequired) + ' XP'; b.appendChild(x); }
        b.addEventListener('click', () => this.pick(c));
        b.addEventListener('mouseenter', () => { if (!this.touch) this.showDetail(c, false); });
        return b;
      };
      for (const c of m.available) this.row.appendChild(mk(c));
      if (m.available.length && m.soon.length) { const sep = d.createElement('div'); sep.className = 'evoSep'; sep.textContent = 'later'; this.row.appendChild(sep); }
      for (const c of m.soon) this.row.appendChild(mk(c));
      this.root.querySelector('.evoHint').textContent = m.available.length ? (this.touch ? 'tap to choose' : 'click to evolve') : '';
      if (this.pending && this.retries < 12) { this.retries++; clearTimeout(this.rt); this.rt = setTimeout(() => { this.key = ''; }, 250); } else if (!this.pending) this.retries = 0; // art still loading: rebuild with the real sprites
      const first = this.row.querySelector('.avail'); if (first && first.scrollIntoView) first.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    /** Desktop: one click evolves. Touch: first tap selects (shows details), second tap on the button confirms - prevents mis-taps while steering. */
    pick(c) {
      if (!c.available) { this.showDetail(c, false); return; }
      if (!this.touch) { this.go(c); return; }
      if (this.sel === c.id) { this.go(c); return; }
      this.sel = c.id; for (const el of this.row.querySelectorAll('.evoCard')) el.classList.toggle('sel', el.dataset.id === c.id); this.showDetail(c, true);
    }
    go(c) { if (g.navigator && g.navigator.vibrate) { try { g.navigator.vibrate(25); } catch (e) {} } this.onEvolve(c.id); this.hide(); }
    showDetail(c, confirm) {
      const d = this.doc, el = this.detail; el.innerHTML = ''; el.classList.add('open');
      const a0 = this.v.animals.find((x) => x.id === c.id); if (a0) { const big = d.createElement('img'); big.className = 'evoBig'; big.alt = ''; big.src = this.img(a0); el.appendChild(big); }
      const t = d.createElement('div'); t.innerHTML = '<b></b> <span></span>'; t.firstChild.textContent = c.name; t.lastChild.textContent = ' - tier ' + c.tier + ' - ' + c.biome; el.appendChild(t);
      const p = d.createElement('div'); p.className = 'evoAbility'; p.textContent = 'Ability: ' + c.ability + (c.available ? '' : ' - needs ' + fmtXp(c.xpRequired) + ' XP'); el.appendChild(p);
      if (confirm && c.available) { const b = d.createElement('button'); b.type = 'button'; b.className = 'evoGo'; b.textContent = 'EVOLVE INTO ' + c.name.toUpperCase(); b.addEventListener('click', () => this.go(c)); el.appendChild(b); }
    }
  }
  M.EvolveTray = EvolveTray; M.EvolveTray.trayModel = trayModel; M.EvolveTray.BIOME_COLORS = BIOME_COLORS;
  if (typeof module !== 'undefined') module.exports = { EvolveTray, trayModel };
})(typeof window !== 'undefined' ? window : globalThis);
