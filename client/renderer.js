(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** World renderer (Canvas 2D). Draws only what the camera can see. */
  class Renderer {
    constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.vw = 0; this.vh = 0; this.dpr = 1; }
    resize() {
      this.dpr = Math.min(2, g.devicePixelRatio || 1);
      this.vw = innerWidth; this.vh = innerHeight;
      this.canvas.width = this.vw * this.dpr; this.canvas.height = this.vh * this.dpr;
      this.canvas.style.width = this.vw + 'px'; this.canvas.style.height = this.vh + 'px';
    }
    begin() { this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
    drawWorld(cam, v, players, foods, meId, myPred) {
      const ctx = this.ctx, vw = this.vw, vh = this.vh, z = cam.zoom, ws = v.worldSize;
      const biome = v.biomes[0] || { color: '#6dae4b' };
      ctx.fillStyle = '#244a1e'; ctx.fillRect(0, 0, vw, vh);
      const [ox, oy] = cam.worldToScreen(0, 0, vw, vh);
      ctx.fillStyle = biome.color; ctx.fillRect(ox, oy, ws * z, ws * z);
      // grid
      const step = 100 * z; ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = ((ox % step) + step) % step; x < vw; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, vh); }
      for (let y = ((oy % step) + step) % step; y < vh; y += step) { ctx.moveTo(0, y); ctx.lineTo(vw, y); }
      ctx.stroke();
      // food
      for (const f of foods) {
        const def = v.foods[f[3]]; if (!def || !cam.visible(f[1], f[2], def.radius, vw, vh)) continue;
        const [sx, sy] = cam.worldToScreen(f[1], f[2], vw, vh);
        ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(sx, sy, def.radius * z, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();
      }
      // animals (smaller first so big ones draw on top)
      const list = players.filter((p) => p.id !== meId); if (myPred) list.push(myPred);
      list.sort((a, b) => v.animals[a.ai].size - v.animals[b.ai].size);
      for (const p of list) this.drawAnimal(cam, v, p, p.id === meId);
    }
    drawAnimal(cam, v, p, isMe) {
      const ctx = this.ctx, a = v.animals[p.ai], r = 18 * a.size;
      if (!cam.visible(p.x, p.y, r, this.vw, this.vh)) return;
      const [sx, sy] = cam.worldToScreen(p.x, p.y, this.vw, this.vh), pr = r * cam.zoom;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(4, 6, pr, pr * 0.9, 0, 0, 7); ctx.fill(); // shadow
      ctx.drawImage(M.Sprites.get(a), -pr * 1.1, -pr * 1.1, pr * 2.2, pr * 2.2);
      ctx.restore();
      ctx.font = 'bold ' + Math.max(11, 14 * Math.min(1.4, cam.zoom + 0.3)) + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(p.name, sx, sy - pr - 4); ctx.fillStyle = isMe ? '#fff3a0' : '#fff'; ctx.fillText(p.name, sx, sy - pr - 4);
      if (p.hp < 100) { const w = pr * 1.6; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx - w / 2, sy + pr + 4, w, 5); ctx.fillStyle = '#e24b4b'; ctx.fillRect(sx - w / 2, sy + pr + 4, w * p.hp / 100, 5); }
    }
  }
  M.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
