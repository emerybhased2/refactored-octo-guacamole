(function (g) {
  const M = (g.Mope = g.Mope || {});
  /**
   * Sprite cache.
   *  - spriteStatus "recreated" | "original": PNG loaded from animal.sprite (recreated = this project's own art in the Mope.io style, see tools/art + docs/ART_STYLE.md).
   *  - anything else (or while the PNG is still loading / missing): a flat-colour PLACEHOLDER, never an unrelated graphic.
   * Sprites are 256x256 facing +x. BODY_FRAC = body radius / half-frame (must equal tools/art/draw.js BODY_FRAC; unit-tested).
   */
  const BODY_FRAC = 0.5625, FOOD_FRAC = 0.8, SIZE = 128;
  const phCache = new Map(), imgCache = new Map(), iconCache = new Map();
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
    return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }
  function placeholder(animal) {
    let cv = phCache.get(animal.id); if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = cv.height = SIZE; const ctx = cv.getContext('2d'), c = animal.placeholderColor || '#888', R = BODY_FRAC * SIZE / 2;
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.fillStyle = c; ctx.strokeStyle = shade(c, -0.4); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(R * 0.5, s * R * 0.35, R * 0.2, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#111'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(R * 0.56, s * R * 0.35, R * 0.1, 0, 7); ctx.fill(); }
    phCache.set(animal.id, cv); return cv;
  }
  function image(src) {
    let im = imgCache.get(src); if (im) return im;
    im = new Image(); im.src = src; imgCache.set(src, im); return im;
  }
  const ready = (im) => im.complete && im.naturalWidth > 0;
  /** Drawable for in-world use (faces +x, frame half-size = radius / BODY_FRAC). */
  function get(animal) {
    if (animal.spriteStatus === 'recreated' || animal.spriteStatus === 'original') { const im = image(animal.sprite); if (ready(im)) return im; }
    return placeholder(animal);
  }
  /** Upright icon for menus (head pointing down, like the Mope.io skin sheets). Cached once the PNG has loaded. */
  function getIcon(animal) {
    const hit = iconCache.get(animal.id); if (hit) return hit;
    const src = get(animal), cv = document.createElement('canvas'); cv.width = cv.height = SIZE; const ctx = cv.getContext('2d');
    ctx.translate(SIZE / 2, SIZE / 2); ctx.rotate(Math.PI / 2); ctx.drawImage(src, -SIZE / 2, -SIZE / 2, SIZE, SIZE);
    if (src !== phCache.get(animal.id)) iconCache.set(animal.id, cv);
    return cv;
  }
  function getFood(def) { if (def.spriteStatus === 'recreated' || def.spriteStatus === 'original') { const im = image(def.sprite); if (ready(im)) return im; } return null; }
  /** Ability icon / terrain tile images, or null until loaded (callers fall back to flat colour / no icon). */
  function getAbilityIcon(def) { if (!def || !def.icon) return null; const im = image(def.icon); return ready(im) ? im : null; }
  function getTile(biome) { if (!biome || !biome.tile) return null; const im = image(biome.tile); return ready(im) ? im : null; }
  M.Sprites = { get, getIcon, getFood, getAbilityIcon, getTile, TILE_WORLD: 256, BODY_FRAC, FOOD_FRAC, SIZE, shade };
  if (typeof module !== 'undefined') module.exports = M.Sprites;
})(typeof window !== 'undefined' ? window : globalThis);
