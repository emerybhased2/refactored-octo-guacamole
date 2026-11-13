/** 2021 settings extras: Snowfall overlay and "+XP" popups (labels verified in the 2021 settings bundle; visuals are original/inferred). */
(function (g) {
  const M = (g.Mope = g.Mope || {});
  const flakes = []; for (let i = 0; i < 90; i++) flakes.push({ x: Math.random(), y: Math.random(), r: 1.5 + Math.random() * 2.5, v: 0.04 + Math.random() * 0.08, s: Math.random() * 6 });
  const Snow = { draw(ctx, w, h, t) { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.85)'; for (const f of flakes) { const y = ((f.y + t / 1000 * f.v) % 1) * h, x = (f.x + Math.sin(t / 900 + f.s) * 0.02) * w; ctx.beginPath(); ctx.arc(x, y, f.r, 0, 7); ctx.fill(); } ctx.restore(); } };
  /** Pure: XP gained between two snapshots (0 when nothing was gained or the animal changed). */
  function xpGain(prev, cur) { if (!prev || !cur || prev.a !== cur.a) return 0; const d = Math.floor(cur.xp - prev.xp); return d > 0 ? d : 0; }
  function popup(doc, n) { const root = doc.getElementById('xpPopups'); if (!root) return; const s = doc.createElement('span'); s.textContent = '+' + n; s.style.left = (Math.random() * 120 - 60) + 'px'; root.appendChild(s); setTimeout(() => s.remove(), 1200); }
  M.Extras = { Snow, xpGain, popup };
  if (typeof module !== 'undefined') module.exports = M.Extras;
})(typeof window !== 'undefined' ? window : globalThis);
