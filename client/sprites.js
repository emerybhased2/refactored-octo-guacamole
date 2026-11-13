(function (g) {
  const M = (g.Mope = g.Mope || {});
  /**
   * Sprite cache. Historical PNGs are loaded from animal.sprite when spriteStatus == "original";
   * otherwise a DOCUMENTED PLACEHOLDER (flat coloured body, ears, eyes) is pre-rendered once per animal and reused.
   * Placeholders are intentionally generic and are listed in docs/MISSING_ASSETS.md.
   */
  const cache = new Map(), SIZE = 128;
  function drawPlaceholder(ctx, animal) {
    const c = animal.placeholderColor || '#888', R = SIZE / 2 - 6;
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.fillStyle = shade(c, -0.25); // ears (heading is +x)
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(-R * 0.1, s * R * 0.78, R * 0.3, 0, 7); ctx.fill(); }
    ctx.fillStyle = c; ctx.strokeStyle = shade(c, -0.4); ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(R * 0.5, s * R * 0.35, R * 0.2, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#111';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(R * 0.56, s * R * 0.35, R * 0.1, 0, 7); ctx.fill(); }
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
    return 'rgb(' + f(r) + ',' + f(gg) + ',' + f(b) + ')';
  }
  function get(animal) {
    let s = cache.get(animal.id);
    if (s) return s;
    const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    const ctx = cv.getContext('2d');
    if (animal.spriteStatus === 'original') {
      const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, SIZE, SIZE); img.src = animal.sprite;
    } else drawPlaceholder(ctx, animal);
    cache.set(animal.id, cv); return cv;
  }
  M.Sprites = { get, SIZE, shade };
})(typeof window !== 'undefined' ? window : globalThis);
