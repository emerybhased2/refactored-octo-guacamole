/* Food sprites (ORIGINAL art, Mope.io style: flat colour, darker rim, soft highlight). 128x128, centred, radius ~ 0.8 of half-frame. */
(function (g) {
  const A = g.MopeArt, P = A.P, sh = A.shade, FOOD_FRAC = 0.8;
  const body = (c, col, r = 50) => { P.ell(c, 0, 0, r + 3, r + 3, sh(col, -0.4)); P.ell(c, 0, 0, r, r, col); P.ell(c, -r * 0.32, -r * 0.34, r * 0.26, r * 0.2, 'rgba(255,255,255,0.5)', -0.6); };
  const leaf = (c, x, y, rot = 0, col = '#4a9a3a') => { c.save(); c.translate(x, y); c.rotate(rot); P.ell(c, 10, 0, 14, 7, col); c.restore(); };
  const F = {
    red_berry(c, col) { body(c, col); leaf(c, 0, -44, -0.5); P.ell(c, 0, -46, 4, 4, '#2d6a2a'); },
    blue_berry(c, col) { body(c, col); P.ell(c, 0, -34, 9, 7, sh(col, -0.4)); for (let i = 0; i < 5; i++) { const a = i * 1.2566 - 1.57; P.ell(c, Math.cos(a) * 8, -34 + Math.sin(a) * 6, 3, 3, sh(col, 0.2)); } },
    orange_fruit(c, col) { body(c, col); leaf(c, 0, -46, -0.4); for (const [x, y] of [[-22, 6], [10, 20], [26, -8], [-6, -16], [4, 34]]) P.ell(c, x, y, 2.5, 2.5, sh(col, -0.22)); },
    raspberry(c, col) { const pts = [[0, 0], [-24, -12], [24, -12], [-24, 20], [24, 20], [0, 36], [0, -30], [-38, 4], [38, 4]]; for (const [x, y] of pts) P.ell(c, x, y, 17, 17, sh(col, -0.4)); for (const [x, y] of pts) { P.ell(c, x, y, 15, 15, col); P.ell(c, x - 5, y - 5, 5, 4, 'rgba(255,255,255,0.45)'); } leaf(c, 0, -40, -0.3); },
    pear(c, col) { P.ell(c, 0, 18, 44, 40, sh(col, -0.4)); P.ell(c, 0, -22, 30, 32, sh(col, -0.4)); P.ell(c, 0, 18, 41, 37, col); P.ell(c, 0, -22, 27, 29, col); P.ell(c, -14, 12, 9, 12, 'rgba(255,255,255,0.45)', -0.4); P.line(c, [[0, -48], [4, -62]], 6, '#6a4a2a'); leaf(c, 4, -58, -0.4); },
    banana(c, col) { c.strokeStyle = sh(col, -0.42); c.lineWidth = 34; c.lineCap = 'round'; c.beginPath(); c.arc(0, -10, 50, 0.45, Math.PI - 0.45); c.stroke(); c.strokeStyle = col; c.lineWidth = 26; c.beginPath(); c.arc(0, -10, 50, 0.45, Math.PI - 0.45); c.stroke(); c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 6; c.beginPath(); c.arc(0, -10, 56, 0.9, Math.PI - 1.3); c.stroke(); P.ell(c, 46, 14, 7, 7, '#5a4020'); P.ell(c, -46, 14, 7, 7, '#5a4020'); },
    coconut(c, col) { body(c, col); for (const [x, y] of [[-10, -6], [10, -6], [0, 12]]) P.ell(c, x, y, 7, 7, '#2a1a0c'); P.ell(c, -3, 10, 2, 2, 'rgba(255,255,255,0.4)'); },
    lillypad(c, col) { c.fillStyle = sh(col, -0.42); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 54, 0.35, TAU - 0.35); c.closePath(); c.fill(); c.fillStyle = col; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 49, 0.35, TAU - 0.35); c.closePath(); c.fill(); P.line(c, [[0, 0], [30, -20]], 3, sh(col, 0.25)); P.line(c, [[0, 0], [-10, -34]], 3, sh(col, 0.25)); P.line(c, [[0, 0], [-34, 8]], 3, sh(col, 0.25)); P.ell(c, 20, 26, 8, 7, '#f6a8c8'); },
  };
  F.watermelon = function (c, col) { body(c, col); c.save(); c.beginPath(); c.arc(0, 0, 50, 0, 7); c.clip(); c.strokeStyle = sh(col, -0.42); c.lineWidth = 7; c.lineCap = 'round'; for (const x of [-30, -15, 0, 15, 30]) { c.beginPath(); c.moveTo(x, -50); c.quadraticCurveTo(x * 1.35, 0, x, 50); c.stroke(); } c.restore(); P.ell(c, -16, -17, 12, 8, 'rgba(255,255,255,0.45)', -0.6); P.line(c, [[0, -50], [3, -60]], 5, '#5a7a2a'); };
  F.cactus_fruit = function (c, col) { P.ell(c, 0, 4, 40, 46, sh(col, -0.4)); P.ell(c, 0, 4, 37, 43, col); for (const [x, y] of [[-16, -14], [14, -18], [-20, 10], [18, 8], [0, 26], [-2, -2], [22, 28], [-18, 30]]) { P.ell(c, x, y, 3, 3, '#f6e8c4'); P.line(c, [[x, y], [x + (x > 0 ? 6 : -6), y - 6]], 1.8, '#f6e8c4'); } P.ell(c, -14, -10, 9, 13, 'rgba(255,255,255,0.35)', -0.4); P.ell(c, 0, -42, 10, 5, '#e8b030'); };
  F.ember_fruit = function (c, col) { body(c, col, 46); P.ell(c, 0, 4, 30, 30, sh(col, 0.25)); P.ell(c, 0, 8, 16, 16, '#ffe08a'); P.poly(c, [[-12, -34], [0, -62], [12, -34], [4, -40], [0, -50], [-4, -40]], '#ffb02a'); P.poly(c, [[-5, -38], [0, -54], [5, -38]], '#fff0a0'); };
  const TAU = Math.PI * 2;
  g.MopeFood = { FOOD_FRAC, draw(ctx, id, color, S) { ctx.save(); ctx.clearRect(0, 0, S, S); ctx.translate(S / 2, S / 2); ctx.scale(S / 128, S / 128); (F[id] || F.red_berry)(ctx, color); ctx.restore(); }, ids: Object.keys(F) };
  if (typeof module !== 'undefined') module.exports = g.MopeFood;
})(typeof window !== 'undefined' ? window : globalThis);
