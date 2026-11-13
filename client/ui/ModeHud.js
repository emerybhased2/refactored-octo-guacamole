(function (g) {
  const M = (g.Mope = g.Mope || {});
  /* ---------- game mode picker (pure) + overlays for Battle Royale / Team / Zombie / Pandemic / Wild / Redemption (original visuals) ---------- */
  const TEAM_COL = ['#888', '#f2cf2e', '#22d3e8', '#a15bff'], TEAM_NAME = ['', 'Yellow', 'Cyan', 'Purple'];
  /** Menu options: every mode is playable in every version that can host it; the original era is shown so nothing is passed off as historical. */
  function modeOptions(modes, version, acct) {
    const f = (k) => !!(version && version.features && version.features[k]), date = version ? version.date : '9999-12-31', out = [];
    for (const m of modes) {
      if (!m.implemented) { out.push({ id: m.id, label: m.name + ' (not implemented)', disabled: true, era: '', note: m.description }); continue; }
      let disabled = false, why = '';
      if (m.id === 'sandbox' && !(version && version.modes && version.modes.includes('sandbox'))) { disabled = true; why = 'only in the 2017 build'; }
      if (m.id === 'arena' && !f('arena')) { disabled = true; why = 'needs a 2019+ build'; }
      if (m.id === 'redemption' && !(f('shop') && f('accounts'))) { disabled = true; why = 'needs accounts + shop (2019-12+ builds)'; }
      if (m.id === 'redemption' && acct && acct.user) why = (acct.credits || 0) + ' credit(s)';
      const inEra = (!m.released || m.released <= date) && (!m.removed || date < m.removed), y0 = m.released ? m.released.slice(0, 4) : '', y1 = m.removed ? m.removed.slice(0, 4) : '', era = y0 && y1 ? (y0 === y1 ? y0 : y0 + '-' + y1) : y0 ? y0 + '+' : '';
      out.push({ id: m.id, label: m.name + (era && m.id !== 'normal' ? ' (' + era + ')' : '') + (inEra || m.id === 'normal' ? '' : ' - bonus') + (why ? ' - ' + why : ''), disabled, inEra, era, note: m.description });
    }
    return out;
  }
  const flagsOf = (f) => ({ team: (f | 0) & 3, zombie: !!((f | 0) & 4), infected: !!((f | 0) & 8) });

  function banner(ctx, vw, text, y, color) { ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold 22px Arial'; ctx.fillStyle = color || '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4; ctx.strokeText(text, vw / 2, y); ctx.fillText(text, vw / 2, y); ctx.restore(); }
  function bar(ctx, x, y, w, h, frac, fill, label) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = fill; ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * Math.min(1, frac)), h - 4); if (label) { ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + w / 2, y + h / 2); } ctx.restore(); }

  /** World-space layer (under the animals): red zone, team stones, meteors, viruses, pickups. */
  function drawWorld(ctx, cam, vw, vh, md, now) {
    if (!md) return; const t = now / 1000;
    if (md.m === 'royale' && md.z) {
      const [sx, sy] = cam.worldToScreen(md.z[0], md.z[1], vw, vh), r = md.z[2] * cam.zoom;
      ctx.save(); ctx.fillStyle = 'rgba(214,40,20,' + (0.30 + 0.06 * Math.sin(t * 3)) + ')'; ctx.beginPath(); ctx.rect(-5, -5, vw + 10, vh + 10); ctx.arc(sx, sy, Math.max(1, r), 0, Math.PI * 2, true); ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(255,120,60,.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, r), 0, 7); ctx.stroke(); ctx.restore();
    }
    if (md.m === 'team') {
      for (const s of md.st || []) {
        const [sx, sy] = cam.worldToScreen(s[1], s[2], vw, vh), r = 70 * cam.zoom; if (sx < -r || sy < -r || sx > vw + r || sy > vh + r) continue;
        const col = TEAM_COL[s[3]]; ctx.save(); ctx.translate(sx, sy); ctx.globalAlpha = 0.18; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 110 * cam.zoom, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = s[3] ? col : '#c9ccd2'; ctx.strokeStyle = '#2a2d34'; ctx.lineWidth = 3; for (let k = 0; k < 6; k++) { const a = k * 1.0472 + 0.2, rr = r * (k % 2 ? 0.8 : 1); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.35) * rr * 0.9, Math.sin(a - 0.35) * rr * 0.9); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.lineTo(Math.cos(a + 0.35) * rr * 0.9, Math.sin(a + 0.35) * rr * 0.9); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        bar(ctx, -r, r + 6, r * 2, 9, s[4] / 100, s[3] ? col : '#fff', null); ctx.restore();
      }
      for (const m of md.mt || []) { const [sx, sy] = cam.worldToScreen(m[0], m[1], vw, vh), k = Math.max(0, m[2]) / 1200; ctx.save(); ctx.strokeStyle = 'rgba(255,90,40,.9)'; ctx.fillStyle = 'rgba(255,90,40,.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, 120 * cam.zoom * (1 - 0.25 * k), 0, 7); ctx.fill(); ctx.stroke(); const fy = sy - k * 400 * cam.zoom; ctx.fillStyle = '#ffb04a'; ctx.beginPath(); ctx.arc(sx, fy, 16 * cam.zoom, 0, 7); ctx.fill(); ctx.restore(); }
    }
    if (md.m === 'pandemic') {
      for (const k of md.pk || []) { const [sx, sy] = cam.worldToScreen(k[1], k[2], vw, vh), r = 18 * cam.zoom; ctx.save(); ctx.translate(sx, sy); if (k[3] === 1) { ctx.fillStyle = '#d8c8a0'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * 0.8, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.7, Math.PI, 0); ctx.fill(); } else { ctx.fillStyle = '#4ea84a'; for (let a = 0; a < 5; a++) { ctx.beginPath(); ctx.ellipse(Math.cos(a * 1.26) * r * 0.5, Math.sin(a * 1.26) * r * 0.5, r * 0.45, r * 0.18, a * 1.26, 0, 7); ctx.fill(); } } ctx.restore(); }
      for (const v of md.vr || []) { const [sx, sy] = cam.worldToScreen(v[0], v[1], vw, vh), r = 11 * cam.zoom; ctx.save(); ctx.translate(sx, sy); ctx.rotate(t); ctx.fillStyle = '#9be35a'; ctx.strokeStyle = '#3f7a1a'; ctx.lineWidth = 2; for (let a = 0; a < 8; a++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a * 0.785) * r * 1.7, Math.sin(a * 0.785) * r * 1.7); ctx.stroke(); } ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
    }
  }
  /** Screen-space HUD for the mode. `gm` = game mode id; `red` = Redemption state. */
  function drawHud(ctx, vw, vh, gm, md, red, now) {
    if (md && md.m === 'royale') {
      banner(ctx, vw, md.over ? 'ROUND OVER' : 'ALIVE: ' + md.al + (md.nx > 0 ? '   -   zone shrinks in ' + md.nx + 's' : '   -   zone closing!'), 78, md.over ? '#ffe15a' : '#fff');
      if (md.out) banner(ctx, vw, "You can't stay out of the safe area for long!", vh * 0.22, '#ffb09a');
    }
    if (md && md.m === 'team') {
      const tm = md.tm || [0, 0, 0], tot = Math.max(1, tm[0] + tm[1] + tm[2]), cx = 60, cy = 150, R = 36; let a0 = -Math.PI / 2;
      ctx.save(); for (let i = 0; i < 3; i++) { const a1 = a0 + tm[i] / tot * Math.PI * 2; ctx.fillStyle = TEAM_COL[i + 1]; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill(); a0 = a1; } ctx.strokeStyle = TEAM_COL[md.me] || '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, 7); ctx.stroke();
      ctx.font = 'bold 12px Arial'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText('You: ' + TEAM_NAME[md.me] + ' team', 12, cy + 58); for (let i = 0; i < 3; i++) { ctx.fillStyle = TEAM_COL[i + 1]; ctx.fillText(TEAM_NAME[i + 1] + ': ' + tm[i] + ' players, ' + (md.own ? md.own[i] : 0) + ' stones', 12, cy + 74 + i * 15); } ctx.restore();
      if (md.ap > 0) banner(ctx, vw, 'APOCALYPSE! meteors for ' + Math.ceil(md.ap / 1000) + 's', 78, '#ff9a4a');
    }
    if (md && md.m === 'zombie') { if (md.zb) banner(ctx, vw, 'YOU ARE A ZOMBIE - bite everything! (evolve to be cured)', 78, '#8ee06a'); else if (md.inf > 0) bar(ctx, vw / 2 - 110, vh - 128, 220, 16, md.inf / 100, '#d33', 'INFECTION ' + md.inf + '%  (evolve or swim to cure)'); }
    if (md && md.m === 'pandemic') { bar(ctx, vw / 2 - 110, vh - 128, 220, 14, md.im / 100, '#ff7ac8', 'IMMUNITY ' + md.im + '%'); if (md.inf > 0) bar(ctx, vw / 2 - 110, vh - 110, 220, 14, md.inf / 100, '#c03030', 'INFECTION ' + md.inf + '%'); if (md.mask > 0) banner(ctx, vw, 'MASK ' + md.mask + 's', 78, '#e8d8a0'); else if (md.san > 0) banner(ctx, vw, 'SANITIZED ' + md.san + 's', 78, '#8ee06a'); }
    if (md && md.m === 'wild') banner(ctx, vw, 'WILD MOPE - abilities are stronger!', 78, '#ffb04a');
    if (red) banner(ctx, vw, 'REDEMPTION  -  level ' + red.lv + ' / 10' + (red.pro ? '  (PRO)' : ''), 78, '#ffe15a');
    if (gm === 'classic') banner(ctx, vw, 'CLASSIC MODE (Old Mope)', 78, '#cfe');
  }
  M.ModeHud = { modeOptions, flagsOf, drawWorld, drawHud, TEAM_COL, TEAM_NAME };
  if (typeof module !== 'undefined') module.exports = M.ModeHud;
})(typeof window !== 'undefined' ? window : globalThis);
