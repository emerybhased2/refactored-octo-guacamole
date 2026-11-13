(function (g) {
  const M = (g.Mope = g.Mope || {});
  M.Leaderboard = {
    draw(ctx, vw, cfg, rows, myId) {
      const L = cfg, x = vw - L.width - L.marginRight, y = L.marginTop, rowH = 20, h = 30 + rows.length * rowH;
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, y, L.width, h);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(L.title, x + L.width / 2, y + 15);
      ctx.font = '13px Arial';
      rows.slice(0, L.max).forEach((r, i) => {
        const yy = y + 30 + i * rowH + rowH / 2; ctx.fillStyle = r[2] === myId ? '#ffe27a' : '#fff';
        ctx.textAlign = 'left'; ctx.fillText((i + 1) + '. ' + r[0].slice(0, 12), x + 8, yy); ctx.textAlign = 'right'; ctx.fillText(r[1], x + L.width - 8, yy);
      });
      ctx.restore();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
