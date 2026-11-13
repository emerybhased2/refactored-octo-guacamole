(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Draws disaster zones (data from the version's disasterDefs). Visual kinds: cloud, heat, wave, eruption, lava, swirl. Purely cosmetic; the server applies the effects. */
  function draw(ctx, cam, vw, vh, zones, defs, now) {
    for (const z of zones) {
      const def = defs.find((d) => d.id === z[1]); if (!def) continue; const [sx, sy] = cam.worldToScreen(z[2], z[3], vw, vh), r = z[4] * cam.zoom, v = def.visual || {}, col = v.color || '#888', t = now / 1000;
      if (sx + r < 0 || sy + r < 0 || sx - r > vw || sy - r > vh) continue;
      ctx.save(); ctx.translate(sx, sy);
      if (v.kind === 'poison') { const gr = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r); gr.addColorStop(0, '#b07ae0'); gr.addColorStop(0.7, '#7a3fb8'); gr.addColorStop(1, '#3f1f6a'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(220,190,255,.7)'; for (let k = 0; k < 8; k++) { const a = k * 0.8 + t * 0.4, d = r * (0.2 + 0.55 * ((k * 53) % 10) / 10), pr = Math.max(2, r * 0.04 * (1 + Math.sin(t * 2 + k))); ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, pr, 0, 7); ctx.fill(); } }
      else if (v.kind === 'lava') { const gr = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r); gr.addColorStop(0, '#ffe08a'); gr.addColorStop(0.45, '#ff9a2a'); gr.addColorStop(0.85, '#c8401a'); gr.addColorStop(1, '#2a1612'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); }
      else if (v.kind === 'swirl') { ctx.rotate(t * 3); ctx.strokeStyle = col; ctx.lineCap = 'round'; for (let k = 0; k < 5; k++) { ctx.globalAlpha = 0.5 - k * 0.07; ctx.lineWidth = Math.max(3, r * 0.1); ctx.beginPath(); for (let a = 0; a < 9; a += 0.2) { const rr = r * (0.12 + 0.88 * (a / 9)) * (1 - k * 0.12); ctx.lineTo(Math.cos(a + k * 1.2) * rr, Math.sin(a + k * 1.2) * rr); } ctx.stroke(); } ctx.globalAlpha = 1; ctx.rotate(-t * 3); if (v.face) { ctx.fillStyle = '#300'; ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.1, r * 0.06, 0, 7); ctx.arc(r * 0.15, -r * 0.1, r * 0.06, 0, 7); ctx.fill(); } }
      else if (v.kind === 'wave') { ctx.globalAlpha = 0.35; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.globalAlpha = 0.7; ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = Math.max(4, r * 0.04); for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(0, 0, r * (0.55 + ((t * 0.5 + k / 3) % 1) * 0.45), 0, 7); ctx.stroke(); } }
      else { // cloud / heat / eruption: soft translucent zone with drifting puffs
        const gr = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r); gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '11'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
        ctx.fillStyle = col; ctx.globalAlpha = 0.35; for (let k = 0; k < 7; k++) { const a = k * 0.9 + t * 0.35 * (k % 2 ? 1 : -1), d = r * (0.25 + 0.5 * ((k * 37) % 10) / 10); ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.2, 0, 7); ctx.fill(); }
        if (v.kind === 'eruption') { ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffb02a'; for (let k = 0; k < 6; k++) { const a = k * 1.047 + t * 2, d = r * (0.3 + ((t * 0.8 + k * 0.17) % 1) * 0.6); ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, Math.max(3, r * 0.03), 0, 7); ctx.fill(); } }
      }
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.max(12, Math.min(22, r * 0.12)) + 'px Arial'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(def.name, 0, r * 0.05); ctx.fillText(def.name, 0, r * 0.05);
      ctx.restore();
    }
  }
  M.Disasters = { draw };
  if (typeof module !== 'undefined') module.exports = M.Disasters;
})(typeof window !== 'undefined' ? window : globalThis);
