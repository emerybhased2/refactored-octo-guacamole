(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** XP needed for the next evolution (lowest threshold among current options), or null when none remain. */
  function nextXp(animals, edges, currentId) {
    const t = edges.filter((e) => e.from === currentId).map((e) => animals.find((a) => a.id === e.to).xpRequired);
    return t.length ? Math.min(...t) : null;
  }
  function bar(ctx, cfg, cx, bottomY, frac, label) {
    const x = cx - cfg.w / 2, y = bottomY - cfg.h;
    ctx.fillStyle = cfg.back; ctx.fillRect(x, y, cfg.w, cfg.h);
    ctx.fillStyle = cfg.fill; ctx.fillRect(x, y, cfg.w * Math.max(0, Math.min(1, frac)), cfg.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.strokeRect(x, y, cfg.w, cfg.h);
    if (label) { ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, cx, y + cfg.h / 2 + 1); }
  }
  M.HUD = {
    nextXp,
    draw(ctx, vw, vh, v, you, animal, rows, dbg, count) {
      const h = v.hud, cx = vw / 2, nxt = nextXp(v.animals, v.edges, you.a);
      bar(ctx, h.xpBar, cx, vh - h.xpBar.marginBottom, nxt ? you.xp / nxt : 1, you.xp + (nxt ? ' / ' + nxt + ' XP' : ' XP'));
      bar(ctx, h.healthBar, cx, vh - h.healthBar.marginBottom, you.hp / animal.health, null);
      if (v.features.waterBar && h.waterBar) bar(ctx, h.waterBar, cx, vh - h.waterBar.marginBottom, you.w / 100, null);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(animal.name, cx, vh - (v.features.waterBar && h.waterBar ? h.waterBar.marginBottom + h.waterBar.h : h.healthBar.marginBottom + h.healthBar.h) - 10);
      M.Leaderboard.draw(ctx, vw, h.leaderboard, rows, you.id);
      if (h.playerCount && count != null) { ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(count + h.playerCount.suffix, vw - h.playerCount.marginRight, h.leaderboard.marginTop + 40 + rows.length * 20 + h.playerCount.marginTop); }
      if (dbg) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(8, 8, 190, 62); ctx.fillStyle = '#9f9'; ctx.font = '13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('FPS  ' + dbg.fps, 14, 12); ctx.fillText('Ping ' + dbg.ping + ' ms', 14, 28); ctx.fillText('Net  ' + dbg.kbps + ' KB/s  mem ' + dbg.mem, 14, 44); }
    },
  };
  if (typeof module !== 'undefined') module.exports = M.HUD;
})(typeof window !== 'undefined' ? window : globalThis);
