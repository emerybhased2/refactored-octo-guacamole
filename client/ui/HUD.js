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
  /** Ability button state: {id,name,implemented,ready,remainingSec} or null if the animal has no ability. cdMs = remaining cooldown from the server. */
  function abilityState(animal, abilities, cdMs) {
    if (!animal.ability) return null; const d = (abilities || []).find((a) => a.id === animal.ability); if (!d) return null;
    return { id: d.id, name: d.name, implemented: !!d.implemented, ready: cdMs <= 0, remainingSec: Math.ceil(cdMs / 1000), frac: d.cooldownMs > 0 ? Math.max(0, Math.min(1, cdMs / d.cooldownMs)) : 0, def: d };
  }
  M.HUD = {
    nextXp, abilityState,
    draw(ctx, vw, vh, v, you, animal, rows, dbg, count) {
      const h = v.hud, cx = vw / 2, nxt = nextXp(v.animals, v.edges, you.a);
      bar(ctx, h.xpBar, cx, vh - h.xpBar.marginBottom, nxt ? you.xp / nxt : 1, you.xp + (nxt ? ' / ' + nxt + ' XP' : ' XP'));
      bar(ctx, h.healthBar, cx, vh - h.healthBar.marginBottom, you.hp / animal.health, null);
      if (v.features.waterBar && h.waterBar) bar(ctx, h.waterBar, cx, vh - h.waterBar.marginBottom, you.w / 100, null);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(animal.name, cx, vh - (v.features.waterBar && h.waterBar ? h.waterBar.marginBottom + h.waterBar.h : h.healthBar.marginBottom + h.healthBar.h) - 10);
      M.Leaderboard.draw(ctx, vw, h.leaderboard, rows, you.id);
      const ab = h.abilityButton && abilityState(animal, v.abilities, you.cd);
      if (ab) {
        const s = h.abilityButton.size, x = vw - h.abilityButton.marginRight - s, y = vh - h.abilityButton.marginBottom - s, icon = M.Sprites.getAbilityIcon(ab.def);
        ctx.save(); ctx.globalAlpha = ab.implemented ? 1 : 0.45; if (icon) ctx.drawImage(icon, x, y, s, s);
        if (!ab.ready) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(x + s / 2, y + s / 2); ctx.arc(x + s / 2, y + s / 2, s / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ab.frac); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ab.remainingSec, x + s / 2, y + s / 2); }
        ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(ab.name + ' [' + h.abilityButton.keyLabel + ']' + (ab.implemented ? '' : ' (inactive)'), x + s / 2, y - 6); ctx.restore();
      }
      if (h.playerCount && count != null) { ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(count + h.playerCount.suffix, vw - h.playerCount.marginRight, h.leaderboard.marginTop + 40 + rows.length * 20 + h.playerCount.marginTop); }
      if (dbg) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(8, 8, 190, 62); ctx.fillStyle = '#9f9'; ctx.font = '13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('FPS  ' + dbg.fps, 14, 12); ctx.fillText('Ping ' + dbg.ping + ' ms', 14, 28); ctx.fillText('Net  ' + dbg.kbps + ' KB/s  mem ' + dbg.mem, 14, 44); }
    },
  };
  if (typeof module !== 'undefined') module.exports = M.HUD;
})(typeof window !== 'undefined' ? window : globalThis);
