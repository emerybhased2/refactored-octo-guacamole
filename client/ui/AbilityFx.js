(function (g) {
  const M = (g.Mope = g.Mope || {});
  /* Visuals for special abilities (original, cosmetic): lingering zones, projectiles and one-shot rings. The server applies all effects. */
  const KINDS = ['ring', 'fire', 'venom', 'fruit', 'spit', 'spear', 'snow', 'ink', 'whirl', 'frost', 'wave', 'web', 'stink', 'sink', 'firetornado', 'camp', 'slash', 'boom']; // same order as Abilities.KINDS (server)
  const COL = { ring: '#ffffff', fire: '#ff8a2a', venom: '#9be05a', fruit: '#f2d43d', spit: '#bfe6a0', spear: '#caa070', snow: '#e6f6ff', ink: '#1f2430', whirl: '#7ad0ff', frost: '#bfe6f7', wave: '#4fb4dc', web: '#f4f4f4', stink: '#c8e07a', sink: '#3a2a1c', firetornado: '#ff5a2a', camp: '#ffd06a', slash: '#ffffff', boom: '#ff9a4a' };
  /** Flag bits shared with the server: 1-3 team, 4 zombie, 8 infected, 16 stunned, 32 shielded, 64 hidden, 128 flying, 256 invisible, 512 carried, 1024 poisoned. */
  const flagsOf = (f) => ({ team: (f | 0) & 3, zombie: !!((f | 0) & 4), infected: !!((f | 0) & 8), stun: !!((f | 0) & 16), shield: !!((f | 0) & 32), hidden: !!((f | 0) & 64), fly: !!((f | 0) & 128), invis: !!((f | 0) & 256), carried: !!((f | 0) & 512), poison: !!((f | 0) & 1024) });
  function drawZone(ctx, z, sx, sy, r, t) {
    const k = KINDS[z[3]] || 'ring', col = COL[k]; ctx.save(); ctx.translate(sx, sy);
    if (k === 'fire' || k === 'firetornado' || k === 'camp') { const gr = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r); gr.addColorStop(0, k === 'camp' ? 'rgba(255,220,120,.85)' : 'rgba(255,230,120,.8)'); gr.addColorStop(0.6, 'rgba(255,120,40,' + (0.45 + 0.15 * Math.sin(t * 9)) + ')'); gr.addColorStop(1, 'rgba(200,40,20,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); if (k === 'firetornado') { ctx.rotate(t * 5); ctx.strokeStyle = 'rgba(255,200,120,.8)'; ctx.lineWidth = Math.max(3, r * 0.08); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, r * (0.35 + 0.2 * i), i, i + 2.4); ctx.stroke(); } } }
    else if (k === 'web') { ctx.globalAlpha = 0.18; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.globalAlpha = 0.8; ctx.strokeStyle = col; ctx.lineWidth = 1.5; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * 0.785) * r, Math.sin(i * 0.785) * r); ctx.stroke(); } for (const q of [0.35, 0.65, 0.95]) { ctx.beginPath(); for (let i = 0; i <= 8; i++) { const a = i * 0.785; i ? ctx.lineTo(Math.cos(a) * r * q, Math.sin(a) * r * q) : ctx.moveTo(r * q, 0); } ctx.stroke(); } }
    else if (k === 'whirl' || k === 'sink') { ctx.rotate(-t * 3); ctx.globalAlpha = k === 'sink' ? 0.55 : 0.35; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.globalAlpha = 0.8; ctx.strokeStyle = k === 'sink' ? '#6a4a2c' : '#e8f6ff'; ctx.lineWidth = Math.max(2, r * 0.05); ctx.beginPath(); for (let a = 0; a < 12; a += 0.2) { const rr = r * (0.1 + a * 0.075); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.stroke(); }
    else if (k === 'ink') { ctx.globalAlpha = 0.72; ctx.fillStyle = col; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.05 + t) * r * 0.35, Math.sin(i * 1.05 + t) * r * 0.35, r * 0.55, 0, 7); ctx.fill(); } }
    else if (k === 'stink') { ctx.globalAlpha = 0.4; ctx.fillStyle = col; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.3 + t * 0.6) * r * 0.4, Math.sin(i * 1.3 + t * 0.6) * r * 0.4, r * 0.55, 0, 7); ctx.fill(); } }
    else if (k === 'wave') { ctx.globalAlpha = 0.4; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.globalAlpha = 0.8; ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = 3; for (const q of [0.5, 0.75, 1]) { ctx.beginPath(); ctx.arc(0, 0, r * ((q + t * 0.6) % 1), 0, 7); ctx.stroke(); } }
    else { ctx.globalAlpha = 0.28; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.globalAlpha = 0.7; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); }
    ctx.restore();
  }
  /** World layer (under the animals). ab = snapshot "ab" {zn, pj, fx}. */
  function draw(ctx, cam, vw, vh, ab, now) {
    if (!ab) return; const t = now / 1000;
    for (const z of ab.zn || []) { const [sx, sy] = cam.worldToScreen(z[0], z[1], vw, vh), r = z[2] * cam.zoom; if (sx + r < 0 || sy + r < 0 || sx - r > vw || sy - r > vh) continue; drawZone(ctx, z, sx, sy, r, t); }
    for (const f of ab.fx || []) { const [sx, sy] = cam.worldToScreen(f[0], f[1], vw, vh), k = 1 - Math.max(0, f[4]) / 330, r = f[2] * cam.zoom * (0.4 + 0.6 * Math.min(1, k)), kind = KINDS[f[3]] || 'ring'; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.strokeStyle = COL[kind] || '#fff'; ctx.lineWidth = Math.max(3, 6 * cam.zoom); ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.stroke(); ctx.restore(); }
    for (const p of ab.pj || []) { const [sx, sy] = cam.worldToScreen(p[0], p[1], vw, vh), r = Math.max(4, p[3] * cam.zoom), kind = KINDS[p[2]] || 'spit'; ctx.save(); ctx.fillStyle = COL[kind] || '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
  }
  /** Per-animal overlay after the sprite (screen space, centred on the animal). */
  function drawFlags(ctx, f, pr, now) {
    if (f.shield) { ctx.save(); ctx.strokeStyle = 'rgba(120,190,255,.95)'; ctx.lineWidth = Math.max(3, pr * 0.12); ctx.beginPath(); ctx.arc(0, 0, pr * 1.08, 0, 7); ctx.stroke(); ctx.restore(); }
    if (f.poison) { ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#7ad04a'; ctx.beginPath(); ctx.arc(0, 0, pr * 0.95, 0, 7); ctx.fill(); ctx.restore(); }
    if (f.stun) { ctx.save(); ctx.fillStyle = '#ffe15a'; for (let i = 0; i < 3; i++) { const a = now / 250 + i * 2.09, x = Math.cos(a) * pr * 0.7, y = -pr * 1.05 + Math.sin(a) * pr * 0.18; ctx.beginPath(); ctx.arc(x, y, Math.max(3, pr * 0.09), 0, 7); ctx.fill(); } ctx.restore(); }
    if (f.carried) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, pr * 1.05, 0, 7); ctx.stroke(); ctx.restore(); }
  }
  M.AbilityFx = { draw, drawFlags, flagsOf, KINDS };
  if (typeof module !== 'undefined') module.exports = M.AbilityFx;
})(typeof window !== 'undefined' ? window : globalThis);
