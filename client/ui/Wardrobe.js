(function (g) {
  const M = (g.Mope = g.Mope || {});
  /* Wardrobe: pick an animal, see every skin for it (owned / equipped / locked), equip, unequip or buy. Original UI. The SERVER stays authoritative (equip needs ownership). */
  /** Pure model (unit-tested). items = shop items; acct = {user, coins, owned, equipped}. */
  function wardrobeModel(items, animals, acct, animalId, opts = {}) {
    const skins = items.filter((i) => i.type === 'skin'), own = (acct && acct.owned) || [], eq = (acct && acct.equipped) || {}, q = (opts.search || '').trim().toLowerCase();
    const byAnimal = new Map(); for (const s of skins) byAnimal.set(s.animal, (byAnimal.get(s.animal) || 0) + 1);
    const animalList = animals.filter((a) => byAnimal.has(a.id) && (!opts.ownedOnly || skins.some((s) => s.animal === a.id && own.includes(s.id)))).map((a) => ({ id: a.id, name: a.name, tier: a.tier, count: byAnimal.get(a.id), owned: skins.filter((s) => s.animal === a.id && own.includes(s.id)).length, equipped: eq[a.id] || null }));
    const cards = skins.filter((s) => s.animal === animalId && (!q || s.name.toLowerCase().includes(q))).map((s) => {
      const owned = own.includes(s.id), equipped = eq[animalId] === s.id; const coins = acct ? acct.coins : 0;
      return { id: s.id, name: s.name, category: s.category || '', price: s.price, listPrice: s.listPrice || null, state: !acct || !acct.user ? 'login' : equipped ? 'equipped' : owned ? 'owned' : coins >= s.price ? 'buy' : 'poor', item: s };
    }).sort((a, b) => ({ equipped: 0, owned: 1, buy: 2, poor: 3, login: 3 })[a.state] - ({ equipped: 0, owned: 1, buy: 2, poor: 3, login: 3 })[b.state] || a.price - b.price || a.name.localeCompare(b.name));
    return { animals: animalList, cards, equippedId: eq[animalId] || null };
  }
  class WardrobeUI {
    constructor(doc, send) { this.doc = doc; this.send = send; this.V = null; this.acct = null; this.animal = null; this.search = ''; this.ownedOnly = false; this.open = false; }
    setVersion(V) { this.V = V; this.animal = null; }
    setAccount(a) { this.acct = a; if (this.open) this.render(); }
    show() { this.open = true; this.doc.getElementById('wardrobeModal').style.display = 'flex'; this.render(); for (const ms of [250, 700]) setTimeout(() => { if (this.open) this.render(); }, ms); }
    hide() { this.open = false; this.doc.getElementById('wardrobeModal').style.display = 'none'; }
    err(t) { const e = this.doc.getElementById('wardrobeErr'); if (e) e.textContent = t || ''; }
    render() {
      const d = this.doc, V = this.V; if (!V || !V.shop) return;
      const m0 = wardrobeModel(V.shop.items, V.animals, this.acct, null, { ownedOnly: this.ownedOnly });
      if (!this.animal || !m0.animals.some((a) => a.id === this.animal)) { const cur = this.acct && this.acct.equipped ? Object.keys(this.acct.equipped)[0] : null; this.animal = (m0.animals.find((a) => a.id === cur) || m0.animals[0] || {}).id || null; }
      const m = wardrobeModel(V.shop.items, V.animals, this.acct, this.animal, { search: this.search, ownedOnly: this.ownedOnly });
      d.getElementById('wardrobeCoins').textContent = this.acct && this.acct.user ? this.acct.coins + ' coins' : 'log in to equip skins';
      const list = d.getElementById('wardrobeAnimals'); list.innerHTML = '';
      for (const a of m.animals) {
        const b = d.createElement('button'); b.type = 'button'; b.className = 'wdAnimal' + (a.id === this.animal ? ' sel' : ''); const def = V.animals.find((x) => x.id === a.id), im = d.createElement('img'); im.alt = ''; try { im.src = M.Sprites.getIcon(def).toDataURL(); } catch (e) {}
        const t = d.createElement('span'); t.textContent = a.name; const c = d.createElement('small'); c.textContent = a.owned + '/' + a.count; b.append(im, t, c); b.addEventListener('click', () => { this.animal = a.id; this.render(); }); list.appendChild(b);
      }
      const grid = d.getElementById('wardrobeGrid'); grid.innerHTML = '';
      const mk = (title, sub, imgSrc, state, label, onClick, tag) => {
        const card = d.createElement('div'); card.className = 'wdCard ' + state; const box = d.createElement('div'); box.className = 'wdImg'; if (imgSrc) { const i = d.createElement('img'); i.alt = ''; i.src = imgSrc; box.appendChild(i); } if (tag) { const tg = d.createElement('span'); tg.className = 'wdTag'; tg.textContent = tag; box.appendChild(tg); }
        const b = d.createElement('b'); b.textContent = title; const s = d.createElement('small'); s.textContent = sub; const btn = d.createElement('button'); btn.type = 'button'; btn.textContent = label; btn.disabled = state === 'poor' || state === 'login'; btn.addEventListener('click', onClick); card.append(box, b, s, btn); grid.appendChild(card);
      };
      const def = V.animals.find((x) => x.id === this.animal); let defImg = ''; try { if (def) defImg = M.Sprites.getIcon(def).toDataURL(); } catch (e) {}
      if (def) mk('Default', 'original look', defImg, m.equippedId ? 'owned' : 'equipped', m.equippedId ? 'Use default' : 'Equipped', () => { this.err(''); if (m.equippedId) this.send({ t: 'unequip', animal: this.animal }); });
      for (const c of m.cards) {
        let src = ''; if (c.item.sprite) src = c.item.sprite;
        const lab = { equipped: 'Equipped - remove', owned: 'Equip', buy: c.price === 0 ? 'Get (free)' : 'Buy ' + c.price, poor: c.price + ' coins', login: 'Log in' }[c.state];
        mk(c.name, c.category || (c.price === 0 ? 'free' : c.price + ' coins'), src, c.state, lab, () => { this.err(''); if (c.state === 'equipped') this.send({ t: 'unequip', animal: this.animal }); else if (c.state === 'owned') this.send({ t: 'equip', item: c.id }); else if (c.state === 'buy') this.send({ t: 'buy', item: c.id }); }, c.listPrice && c.listPrice > c.price ? 'SALE' : null);
      }
      if (!m.cards.length && def) { const n = d.createElement('p'); n.className = 'wdEmpty'; n.textContent = 'No skins for this animal match.'; grid.appendChild(n); }
    }
  }
  M.Wardrobe = { wardrobeModel, WardrobeUI };
  if (typeof module !== 'undefined') module.exports = { wardrobeModel, WardrobeUI };
})(typeof window !== 'undefined' ? window : globalThis);
