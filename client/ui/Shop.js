(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Pure shop rules shared by the UI and tests. The SERVER is authoritative: this only decides which button to show. */
  function itemState(item, acct) {
    if (!acct || !acct.user) return 'login';
    if ((acct.owned || []).includes(item.id)) return item.type === 'skin' || item.type === 'feature' ? ((acct.equipped || {})[item.type === 'feature' ? '__theme' : item.animal] === item.id ? 'equipped' : 'equip') : 'owned';
    return acct.coins >= item.price ? 'buy' : 'poor';
  }
  const LABEL = { login: 'Log in to buy', buy: 'Buy', poor: 'Not enough coins', owned: 'Owned', equip: 'Equip', equipped: 'Unequip' };
  /** 2021 storefront listing (categories/filters verified from the bundle; filter semantics INFERRED). */
  const CAT_TYPES = { Skins: ['skin'], Features: ['feature', 'animal'], Deals: ['bundle'] };
  function listItems(items, category, filter, acct) {
    const mine = /^My /.test(category), base = mine ? category.slice(3) : category, types = CAT_TYPES[base] || [], own = (acct && acct.owned) || [];
    let out = items.filter((i) => types.includes(i.type) && (mine ? own.includes(i.id) : true));
    const sale = (i) => i.listPrice != null && i.listPrice > i.price;
    if (filter === 'New') out = out.filter((i) => i.isNew); else if (filter === 'Sale') out = out.filter(sale); else if (filter === 'Normal') out = out.filter((i) => !sale(i) && !i.isNew);
    else if (filter === 'High-Price') out = out.filter((i) => i.price >= 1000).sort((a, b) => b.price - a.price); else if (filter === 'Low-Price') out = out.filter((i) => i.price < 1000).sort((a, b) => a.price - b.price);
    return out;
  }
  const available = (features) => !!(features && features.shop);

  /** DOM controller for the shop modal. send(msg) talks to the server; state updates arrive through update(). */
  class ShopUI {
    constructor(send) { this.send = send; this.V = null; this.acct = null; this.tab = 'skin'; this.style = null; }
    setStyle(cfg) { this.style = cfg || null; const box = document.querySelector('#shopModal .modalBox'); if (box && cfg) { box.style.width = cfg.width + 'px'; box.style.border = cfg.border; box.style.background = cfg.background; box.style.color = '#fff'; } }
    setVersion(V) { this.V = V; }
    setAccount(a) { this.acct = a; if (this.open) this.render(); }
    purchased() { const ok = this.justBought && this.style && this.style.texts; this.justBought = false; this.error(ok ? this.style.texts.success : ''); }
    show() { this.open = true; document.getElementById('shopModal').style.display = 'flex'; if (this.acct && this.acct.user) this.send({ t: 'shop-info' }); this.error(''); this.render(); for (const ms of [250, 700]) setTimeout(() => { if (this.open) this.render(); }, ms); } // re-render once the sprite images have loaded
    hide() { this.open = false; document.getElementById('shopModal').style.display = 'none'; }
    error(msg) { const e = document.getElementById('shopErr'); if (e) e.textContent = msg || ''; }
    renderStore() {
      const V = this.V, st = this.style, T = st.texts, grid = document.getElementById('shopGrid'), cats = document.getElementById('shopCats'), flt = document.getElementById('shopFilters');
      document.getElementById('shopTabs').style.display = 'none'; document.getElementById('shopNote').textContent = T.coinsNote + '. Prices are inferred.'; flt.style.display = 'flex';
      this.cat = this.cat || 'Skins'; this.flt = this.flt || 'All'; cats.innerHTML = ''; flt.innerHTML = '<b>' + T.filter + '</b>';
      for (const c of st.categories) { const b = document.createElement('button'); b.textContent = c; b.className = this.cat === c ? 'sel' : ''; b.addEventListener('click', () => { this.cat = c; this.render(); }); cats.appendChild(b); }
      for (const f of st.filters) { const b = document.createElement('button'); b.textContent = f; b.className = this.flt === f ? 'sel' : ''; b.addEventListener('click', () => { this.flt = f; this.render(); }); flt.appendChild(b); }
      const items = listItems(V.shop.items, this.cat, this.flt, this.acct); if (!items.length) { grid.textContent = T.empty; return; }
      for (const item of items) {
        const st2 = itemState(item, this.acct), card = document.createElement('div'); card.className = 'shopItem';
        const cv = document.createElement('canvas'); cv.width = cv.height = 96; const img = document.createElement('div'); img.className = 'image'; img.style.position = 'relative'; img.appendChild(cv); card.appendChild(img);
        const an = V.animals.find((a) => a.id === item.animal); let src = null;
        if (item.type === 'skin') src = M.Sprites.getSkin(item); else if (item.type === 'bundle') { const first = V.shop.items.find((i) => i.id === (item.contains || [])[0]); src = first && M.Sprites.getSkin(first); } else if (an) src = M.Sprites.getIcon(an);
        if (src) { const c = cv.getContext('2d'); c.translate(48, 48); if (item.type !== 'animal') c.rotate(Math.PI / 2); c.drawImage(src, -48, -48, 96, 96); }
        if (item.isNew || (item.listPrice != null && item.listPrice > item.price) || item.free) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = item.free ? 'FREE' : item.isNew ? 'NEW' : 'SALE'; img.appendChild(tag); }
        const b = document.createElement('b'); b.textContent = item.name; card.appendChild(b);
        const pb = document.createElement('div'); pb.className = 'priceBar'; pb.innerHTML = (item.listPrice != null && item.listPrice > item.price ? '<s>' + item.listPrice + '</s>' : '') + (item.price === 0 ? 'FREE' : item.price + ' coins'); card.appendChild(pb);
        const btn = document.createElement('button'); btn.textContent = LABEL[st2]; btn.disabled = st2 === 'poor' || st2 === 'owned';
        btn.addEventListener('click', () => { this.error('');
          if (st2 === 'login') return this.confirm({ login: true });
          if (st2 === 'buy') return this.confirm({ item });
          const key = item.type === 'feature' ? '__theme' : item.animal;
          if (st2 === 'equip') this.send({ t: 'equip', item: item.id }); else if (st2 === 'equipped') this.send({ t: 'unequip', animal: key }); });
        card.appendChild(btn); grid.appendChild(card);
      }
    }
    /** Purchase confirmation (texts verified from the 2021 bundle). */
    confirm(o) {
      const T = this.style.texts, box = document.getElementById('shopConfirm'); box.style.display = 'flex'; box.innerHTML = ''; const d = document.createElement('div'); box.appendChild(d);
      const line = (t) => { const p = document.createElement('p'); p.textContent = t; d.appendChild(p); }, btn = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.addEventListener('click', fn); d.appendChild(b); };
      const close = () => { box.style.display = 'none'; };
      if (o.login) { line(T.login); btn('OK', close); return; }
      const coins = this.acct.coins; line(T.confirm); line(o.item.name); line(T.before + ' ' + coins); line(T.after + ' ' + (coins - o.item.price));
      btn(T.confirmBtn, () => { close(); this.send({ t: 'buy', item: o.item.id }); this.justBought = true; }); btn(T.cancelBtn, close);
    }
    render() {
      const V = this.V; if (!V || !V.shop) return; const grid = document.getElementById('shopGrid'); grid.innerHTML = '';
      document.getElementById('shopCoins').textContent = this.acct && this.acct.user ? '(' + this.acct.coins + ' coins)' : '';
      document.getElementById('shopNote').textContent = 'Skins are cosmetic only. Prices are inferred (the archived notes name only a few items of the 59). No real-money purchases here.';
      const sf = this.style && this.style.storefront; document.getElementById('shopModal').classList.toggle('shopStore', !!sf);
      if (sf) return this.renderStore();
      const tabs = document.getElementById('shopTabs'); if (tabs && this.style) { tabs.innerHTML = ''; for (const [k, n] of [['skin', 'Skins'], ['animal', 'Animals']]) { const b = document.createElement('button'); b.textContent = n; b.className = this.tab === k ? 'sel' : ''; b.addEventListener('click', () => { this.tab = k; this.render(); }); tabs.appendChild(b); } }
      for (const item of V.shop.items) {
        if (this.style && item.type !== this.tab) continue;
        const st = itemState(item, this.acct), card = document.createElement('div'); card.className = 'shopItem';
        const cv = document.createElement('canvas'); cv.width = cv.height = 96; const img = document.createElement('div'); img.className = 'image'; img.appendChild(cv); card.appendChild(img);
        const an = V.animals.find((a) => a.id === item.animal), tint = this.style && an && this.style.biomeTints && this.style.biomeTints[an.biome]; if (tint) { const dot = document.createElement('i'); dot.style.cssText = 'position:absolute;top:4px;right:4px;width:14px;height:14px;border-radius:50%;border:2px solid #fff;background:' + tint; img.style.position = 'relative'; img.appendChild(dot); }
        const src = item.type === 'skin' ? M.Sprites.getSkin(item) : (V.animals.find((a) => a.id === item.animal) && M.Sprites.getIcon(V.animals.find((a) => a.id === item.animal)));
        if (src) { const c = cv.getContext('2d'); c.translate(48, 48); if (item.type === 'skin') c.rotate(Math.PI / 2); c.drawImage(src, -48, -48, 96, 96); }
        const b = document.createElement('b'); b.textContent = item.name; card.appendChild(b);
        const s = document.createElement('small'); s.textContent = item.type === 'animal' ? 'Animal unlock' : 'Skin'; card.appendChild(s); const pb = document.createElement('div'); pb.className = 'priceBar'; pb.textContent = item.price + ' coins'; card.appendChild(pb);
        const btn = document.createElement('button'); btn.textContent = LABEL[st]; btn.disabled = st === 'login' || st === 'poor' || st === 'owned';
        btn.addEventListener('click', () => { this.error(''); if (st === 'buy') this.send({ t: 'buy', item: item.id }); else if (st === 'equip') this.send({ t: 'equip', item: item.id }); else if (st === 'equipped') this.send({ t: 'unequip', animal: item.animal }); });
        card.appendChild(btn); grid.appendChild(card);
      }
    }
  }
  M.Shop = { available, itemState, listItems, ShopUI, implemented: true };
  if (typeof module !== 'undefined') module.exports = M.Shop;
})(typeof window !== 'undefined' ? window : globalThis);
