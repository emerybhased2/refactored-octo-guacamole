(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Pure shop rules shared by the UI and tests. The SERVER is authoritative: this only decides which button to show. */
  function itemState(item, acct) {
    if (!acct || !acct.user) return 'login';
    if ((acct.owned || []).includes(item.id)) return item.type === 'skin' ? ((acct.equipped || {})[item.animal] === item.id ? 'equipped' : 'equip') : 'owned';
    return acct.coins >= item.price ? 'buy' : 'poor';
  }
  const LABEL = { login: 'Log in to buy', buy: 'Buy', poor: 'Not enough coins', owned: 'Owned', equip: 'Equip', equipped: 'Unequip' };
  const available = (features) => !!(features && features.shop);

  /** DOM controller for the shop modal. send(msg) talks to the server; state updates arrive through update(). */
  class ShopUI {
    constructor(send) { this.send = send; this.V = null; this.acct = null; this.tab = 'skin'; this.style = null; }
    setStyle(cfg) { this.style = cfg || null; const box = document.querySelector('#shopModal .modalBox'); if (box && cfg) { box.style.width = cfg.width + 'px'; box.style.border = cfg.border; box.style.background = cfg.background; box.style.color = '#fff'; } }
    setVersion(V) { this.V = V; }
    setAccount(a) { this.acct = a; if (this.open) this.render(); }
    show() { this.open = true; document.getElementById('shopModal').style.display = 'flex'; this.send({ t: 'shop-info' }); this.render(); }
    hide() { this.open = false; document.getElementById('shopModal').style.display = 'none'; }
    error(msg) { const e = document.getElementById('shopErr'); if (e) e.textContent = msg || ''; }
    render() {
      const V = this.V; if (!V || !V.shop) return; const grid = document.getElementById('shopGrid'); grid.innerHTML = '';
      document.getElementById('shopCoins').textContent = this.acct && this.acct.user ? '(' + this.acct.coins + ' coins)' : '';
      document.getElementById('shopNote').textContent = 'Skins are cosmetic only. Prices are inferred (the archived notes name only a few items of the 59). No real-money purchases here.';
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
  M.Shop = { available, itemState, ShopUI, implemented: true };
  if (typeof module !== 'undefined') module.exports = M.Shop;
})(typeof window !== 'undefined' ? window : globalThis);
