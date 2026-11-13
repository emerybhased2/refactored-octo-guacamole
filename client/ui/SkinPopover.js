(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Pure (unit-tested): the skins the account OWNS for an animal, equipped first. items = shop items; acct = {owned, equipped}. */
  function ownedSkinsFor(items, acct, animalId) {
    const own = (acct && acct.owned) || [], eq = (acct && acct.equipped) || {};
    return (items || []).filter((i) => i.type === 'skin' && i.animal === animalId && own.includes(i.id)).map((i) => ({ id: i.id, name: i.name, sprite: i.sprite, equipped: eq[animalId] === i.id, item: i })).sort((a, b) => (b.equipped ? 1 : 0) - (a.equipped ? 1 : 0) || a.name.localeCompare(b.name));
  }
  /** Right-click / long-press popover on an upgrade choice: every skin the player bought for that animal; click one to equip it (or "Default"). */
  class SkinPopover {
    constructor(doc, send) { this.doc = doc; this.send = send; this.V = null; this.acct = null; this.animal = null; this.root = doc.getElementById('skinPop'); doc.addEventListener('pointerdown', (e) => { if (this.root && !this.root.contains(e.target) && !(e.target.closest && e.target.closest('.evoCard'))) this.hide(); }); doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide(); }); }
    setVersion(V) { this.V = V; this.hide(); }
    setAccount(a) { this.acct = a; if (this.animal && this.root.style.display !== 'none') this.render(); }
    hide() { if (this.root) this.root.style.display = 'none'; this.animal = null; }
    isOpen() { return !!this.animal; }
    show(animalId, x, y) { this.animal = animalId; this.x = x; this.y = y; this.render(); }
    render() {
      const d = this.doc, V = this.V, r = this.root; if (!V || !r || !this.animal) return; const a = V.animals.find((q) => q.id === this.animal); if (!a) return;
      const items = (V.shop && V.shop.items) || [], list = ownedSkinsFor(items, this.acct, this.animal), eq = this.acct && this.acct.equipped ? this.acct.equipped[this.animal] : null;
      r.innerHTML = ''; const h = d.createElement('div'); h.className = 'spTitle'; h.textContent = a.name + ' - your skins'; r.appendChild(h);
      const row = d.createElement('div'); row.className = 'spRow'; r.appendChild(row);
      const mk = (name, src, on, fn) => { const b = d.createElement('button'); b.type = 'button'; b.className = 'spItem' + (on ? ' on' : ''); if (src) { const im = d.createElement('img'); im.alt = ''; im.src = src; b.appendChild(im); } const s = d.createElement('span'); s.textContent = name; b.appendChild(s); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); row.appendChild(b); };
      let defSrc = ''; try { defSrc = M.Sprites.getIcon(a).toDataURL(); } catch (e) {}
      if (!this.acct || !this.acct.user) { const p = d.createElement('p'); p.textContent = 'Log in to use the skins you bought.'; r.appendChild(p); }
      else {
        mk('Default', defSrc, !eq, () => { if (eq) this.send({ t: 'unequip', animal: this.animal }); this.hide(); });
        for (const s of list) mk(s.name, s.sprite, s.equipped, () => { if (!s.equipped) this.send({ t: 'equip', item: s.id }); this.hide(); });
        if (!list.length) { const p = d.createElement('p'); p.textContent = 'You do not own any ' + a.name + ' skins yet - find them in the Store.'; r.appendChild(p); }
      }
      r.style.display = 'block'; const w = r.offsetWidth || 240, hh = r.offsetHeight || 120, vw = g.innerWidth, vh = g.innerHeight;
      r.style.left = Math.max(6, Math.min(vw - w - 6, this.x - w / 2)) + 'px'; r.style.top = Math.max(6, Math.min(vh - hh - 6, this.y - hh - 12)) + 'px';
    }
  }
  M.SkinPopover = { ownedSkinsFor, SkinPopover };
  if (typeof module !== 'undefined') module.exports = { ownedSkinsFor, SkinPopover };
})(typeof window !== 'undefined' ? window : globalThis);
