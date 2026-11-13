(function (g) {
  const M = (g.Mope = g.Mope || {});
  M.Leaderboard = {
    draw(ctx, vw, cfg, rows, myId) {
      const small = typeof window !== 'undefined' && window.innerHeight < 520, L = small ? Object.assign({}, cfg, { width: Math.min(cfg.width, 150), max: Math.min(cfg.max, 5), marginTop: 6, marginRight: 6 }) : cfg, x = vw - L.width - L.marginRight, y = L.marginTop, rowH = small ? 16 : 20, shown = Math.min(rows.length, L.max), h = (small ? 22 : 30) + shown * rowH; // compact on short (phone landscape) screens
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, y, L.width, h);
      ctx.fillStyle = '#fff'; ctx.font = (small ? 'bold 12px' : 'bold 15px') + ' Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(L.title, x + L.width / 2, y + (small ? 11 : 15));
      ctx.font = (small ? '11px' : '13px') + ' Arial';
      rows.slice(0, L.max).forEach((r, i) => {
        const yy = y + (small ? 22 : 30) + i * rowH + rowH / 2; ctx.fillStyle = r[2] === myId ? '#ffe27a' : '#fff';
        ctx.textAlign = 'left'; ctx.fillText((i + 1) + '. ' + r[0].slice(0, 12), x + 8, yy); ctx.textAlign = 'right'; ctx.fillText(r[1], x + L.width - 8, yy);
      });
      ctx.restore();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
