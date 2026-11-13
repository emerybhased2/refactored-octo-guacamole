(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** World renderer (Canvas 2D). Draws only what the camera can see. opts: {lowGraphics, noImages, noNames} */
  class Renderer {
    constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.vw = 0; this.vh = 0; this.dpr = 1; this.opts = {}; }
    resize() {
      this.dpr = Math.min(2, g.devicePixelRatio || 1); this.vw = innerWidth; this.vh = innerHeight;
      this.canvas.width = this.vw * this.dpr; this.canvas.height = this.vh * this.dpr;
    }
    begin() { this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
    drawWorld(cam, v, lakes, players, foods, meId, myPred, chats, now) {
      const ctx = this.ctx, vw = this.vw, vh = this.vh, z = cam.zoom, ws = v.worldSize, low = this.opts.lowGraphics;
      ctx.fillStyle = '#1b3a1f'; ctx.fillRect(0, 0, vw, vh);
      for (const b of v.biomes) { // biome rectangles (layout inferred)
        const [sx, sy] = cam.worldToScreen(b.rect[0] * ws, b.rect[1] * ws, vw, vh);
        ctx.fillStyle = b.color; ctx.fillRect(sx, sy, b.rect[2] * ws * z, b.rect[3] * ws * z);
      }
      for (const l of lakes) { const [sx, sy] = cam.worldToScreen(l[0], l[1], vw, vh); ctx.fillStyle = '#2f9fd0'; ctx.beginPath(); ctx.arc(sx, sy, l[2] * z, 0, 7); ctx.fill(); }
      if (!low) {
        const [ox, oy] = cam.worldToScreen(0, 0, vw, vh), step = 100 * z; ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = ((ox % step) + step) % step; x < vw; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, vh); }
        for (let y = ((oy % step) + step) % step; y < vh; y += step) { ctx.moveTo(0, y); ctx.lineTo(vw, y); }
        ctx.stroke();
      }
      const edge = '#8dff8d';
      for (const f of foods) { // food: light-green outline = edible (archived how-to-play text)
        const def = v.foods[f[3]]; if (!def || !cam.visible(f[1], f[2], def.radius, vw, vh)) continue;
        const [sx, sy] = cam.worldToScreen(f[1], f[2], vw, vh);
        ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(sx, sy, def.radius * z, 0, 7); ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = Math.max(1.5, 2.5 * z); ctx.stroke();
      }
      const list = players.filter((p) => p.id !== meId); if (myPred) list.push(myPred);
      list.sort((a, b) => v.animals[a.ai].size - v.animals[b.ai].size);
      const myTier = myPred ? v.animals[myPred.ai].tier : 0;
      for (const p of list) this.drawAnimal(cam, v, p, p.id === meId, myTier, chats, now);
    }
    drawAnimal(cam, v, p, isMe, myTier, chats, now) {
      const ctx = this.ctx, a = v.animals[p.ai], r = 18 * a.size;
      if (!cam.visible(p.x, p.y, r, this.vw, this.vh)) return;
      const [sx, sy] = cam.worldToScreen(p.x, p.y, this.vw, this.vh), pr = r * cam.zoom, low = this.opts.lowGraphics;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.angle);
      if (!low) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(4, 6, pr, pr * 0.9, 0, 0, 7); ctx.fill(); }
      if (this.opts.noImages) { ctx.fillStyle = a.placeholderColor; ctx.beginPath(); ctx.arc(0, 0, pr, 0, 7); ctx.fill(); }
      else ctx.drawImage(M.Sprites.get(a), -pr * 1.1, -pr * 1.1, pr * 2.2, pr * 2.2);
      ctx.restore();
      if (!isMe) { // outline: LIGHT-GREEN = you can eat it, RED = it can eat you (archived how-to-play text)
        const sand = v.__sandbox, col = sand || a.tier < myTier ? '#8dff8d' : a.tier > myTier ? '#ff4d4d' : null;
        if (col) { ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, 3.5 * cam.zoom); ctx.beginPath(); ctx.arc(sx, sy, pr * 1.02, 0, 7); ctx.stroke(); }
      }
      if (this.opts.noNames) return;
      ctx.font = 'bold ' + Math.max(11, 14 * Math.min(1.4, cam.zoom + 0.3)) + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(p.name, sx, sy - pr - 4); ctx.fillStyle = isMe ? '#fff3a0' : '#fff'; ctx.fillText(p.name, sx, sy - pr - 4);
      const c = chats && chats.get(p.id); if (c && c.until > now) { ctx.font = 'bold 15px Arial'; ctx.fillStyle = '#F1C34C'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 4; ctx.strokeText(c.text, sx, sy - pr - 24); ctx.fillText(c.text, sx, sy - pr - 24); }
      if (p.hp < 100) { const w = pr * 1.6; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx - w / 2, sy + pr + 4, w, 5); ctx.fillStyle = '#e24b4b'; ctx.fillRect(sx - w / 2, sy + pr + 4, w * p.hp / 100, 5); }
    }
  }
  M.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
