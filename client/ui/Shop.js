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
    constructor(send) { this.send = send; this.V = null; this.acct = null; }
    setVersion(V) { this.V = V; }
    setAccount(a) { this.acct = a; if (this.open) this.render(); }
    show() { this.open = true; document.getElementById('shopModal').style.display = 'flex'; this.send({ t: 'shop-info' }); this.render(); }
    hide() { this.open = false; document.getElementById('shopModal').style.display = 'none'; }
    error(msg) { const e = document.getElementById('shopErr'); if (e) e.textContent = msg || ''; }
    render() {
      const V = this.V; if (!V || !V.shop) return; const grid = document.getElementById('shopGrid'); grid.innerHTML = '';
      document.getElementById('shopCoins').textContent = this.acct && this.acct.user ? '(' + this.acct.coins + ' coins)' : '';
      document.getElementById('shopNote').textContent = 'Skins are cosmetic only. Prices are inferred (the archived notes name only a few items of the 59). No real-money purchases here.';
      for (const item of V.shop.items) {
        const st = itemState(item, this.acct), card = document.createElement('div'); card.className = 'shopItem';
        const cv = document.createElement('canvas'); cv.width = cv.height = 96; card.appendChild(cv);
        const src = item.type === 'skin' ? M.Sprites.getSkin(item) : (V.animals.find((a) => a.id === item.animal) && M.Sprites.getIcon(V.animals.find((a) => a.id === item.animal)));
        if (src) { const c = cv.getContext('2d'); c.translate(48, 48); if (item.type === 'skin') c.rotate(Math.PI / 2); c.drawImage(src, -48, -48, 96, 96); }
        const b = document.createElement('b'); b.textContent = item.name; card.appendChild(b);
        const s = document.createElement('small'); s.textContent = (item.type === 'animal' ? 'Animal unlock' : 'Skin') + ' - ' + item.price + ' coins'; card.appendChild(s);
        const btn = document.createElement('button'); btn.textContent = LABEL[st]; btn.disabled = st === 'login' || st === 'poor' || st === 'owned';
        btn.addEventListener('click', () => { this.error(''); if (st === 'buy') this.send({ t: 'buy', item: item.id }); else if (st === 'equip') this.send({ t: 'equip', item: item.id }); else if (st === 'equipped') this.send({ t: 'unequip', animal: item.animal }); });
        card.appendChild(btn); grid.appendChild(card);
      }
    }
  }
  M.Shop = { available, itemState, ShopUI, implemented: true };
  if (typeof module !== 'undefined') module.exports = M.Shop;
})(typeof window !== 'undefined' ? window : globalThis);
