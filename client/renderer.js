(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** World renderer (Canvas 2D). Draws only what the camera can see. opts: {lowGraphics, noImages, noNames} */
  class Renderer {
    constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.vw = 0; this.vh = 0; this.dpr = 1; this.opts = {}; this.quality = 1; }
    resize() {
      this.dpr = Math.min(2, g.devicePixelRatio || 1) * this.quality; this.vw = innerWidth; this.vh = innerHeight;
      this.canvas.width = this.vw * this.dpr; this.canvas.height = this.vh * this.dpr;
    }
    /** Terrain pattern anchored to world space (ox,oy = screen position of the world point the tile starts at). Tiles are cached per image. */
    pattern(img, zoom, ox, oy) {
      const key = img.src; this._pat = this._pat || new Map(); let p = this._pat.get(key); if (!p) { p = this.ctx.createPattern(img, 'repeat'); this._pat.set(key, p); }
      const k = zoom * M.Sprites.TILE_WORLD / img.naturalWidth; if (p.setTransform) p.setTransform(new DOMMatrix([k, 0, 0, k, ox, oy])); return p;
    }
    begin() { this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
    drawWorld(cam, v, lakes, players, foods, meId, myPred, chats, now, terrain) {
      const ctx = this.ctx, vw = this.vw, vh = this.vh, z = cam.zoom, ws = v.worldSize, low = this.opts.lowGraphics;
      ctx.fillStyle = '#1b3a1f'; ctx.fillRect(0, 0, vw, vh);
      for (const b of v.biomes) { // biome rectangles (layout inferred)
        const [sx, sy] = cam.worldToScreen(b.rect[0] * ws, b.rect[1] * ws, vw, vh), tile = low ? null : M.Sprites.getTile(b);
        ctx.fillStyle = tile ? this.pattern(tile, z, sx, sy) : b.color; ctx.fillRect(sx, sy, b.rect[2] * ws * z, b.rect[3] * ws * z);
      }
      const oceanTile = low ? null : M.Sprites.getTile(v.biomes.find((b) => b.id === 'ocean') || {});
      if (v.forest && !low) { const [fx, fy] = cam.worldToScreen(v.forest[0] * ws, v.forest[1] * ws, vw, vh); ctx.fillStyle = 'rgba(16,70,28,0.16)'; ctx.fillRect(fx, fy, v.forest[2] * ws * z, v.forest[3] * ws * z); } // forest floor (1/4 of the land; placement inferred)
      for (const l of lakes) { const [sx, sy] = cam.worldToScreen(l[0], l[1], vw, vh); ctx.fillStyle = oceanTile ? this.pattern(oceanTile, z, sx - l[0] * z + 0, sy - l[1] * z) : '#2f9fd0'; ctx.beginPath(); ctx.arc(sx, sy, l[2] * z, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(20,90,130,.55)'; ctx.lineWidth = Math.max(2, 4 * z); ctx.stroke(); }
      if (!low) {
        const [ox, oy] = cam.worldToScreen(0, 0, vw, vh), step = 100 * z; ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = ((ox % step) + step) % step; x < vw; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, vh); }
        for (let y = ((oy % step) + step) % step; y < vh; y += step) { ctx.moveTo(0, y); ctx.lineTo(vw, y); }
        ctx.stroke();
      }
      if (terrain && terrain.length && !low) { // static decoration (effects such as hide/mud/hills are not simulated)
        for (const o of terrain) { const def = v.terrain[o[0]]; if (!def || !cam.visible(o[1], o[2], def.radius, vw, vh)) continue; const img = M.Sprites.getTerrain(def); if (!img) continue; const [sx, sy] = cam.worldToScreen(o[1], o[2], vw, vh), h = def.radius * z / M.Sprites.TERRAIN_FRAC;
          const treeFade = v.features && v.features.treeTransparency && def.id.startsWith('tree') && myPred && Math.hypot(o[1] - myPred.x, o[2] - myPred.y) < def.radius + 18 * v.animals[myPred.ai].size + 40; // 2020-03-03: trees turn transparent when a player gets close
          if (treeFade) ctx.globalAlpha = 0.35; ctx.drawImage(img, sx - h, sy - h, 2 * h, 2 * h); ctx.globalAlpha = 1; }
      }
      const edge = '#8dff8d';
      for (const f of foods) { // food: light-green outline = edible (archived how-to-play text)
        const def = v.foods[f[3]]; if (!def || !cam.visible(f[1], f[2], def.radius, vw, vh)) continue;
        const [sx, sy] = cam.worldToScreen(f[1], f[2], vw, vh);
        const img = M.Sprites.getFood(def), fr = def.radius * z;
        if (img) { const h = fr / M.Sprites.FOOD_FRAC; ctx.drawImage(img, sx - h, sy - h, 2 * h, 2 * h); ctx.strokeStyle = edge; ctx.lineWidth = Math.max(1.5, 2.2 * z); ctx.beginPath(); ctx.arc(sx, sy, fr * 1.06, 0, 7); ctx.stroke(); }
        else { ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(sx, sy, fr, 0, 7); ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = Math.max(1.5, 2.5 * z); ctx.stroke(); }
      }
      if (this.underAnimals) this.underAnimals(ctx, cam, vw, vh, now);
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
      const fgl = p.flags ? M.ModeHud.flagsOf(p.flags) : null;
      if (p.climb) { ctx.scale(0.88, 0.88); ctx.globalAlpha = 0.8; } // up in a tree
      if (fgl && fgl.fly) ctx.scale(1.12, 1.12); // airborne
      if (fgl && (fgl.hidden || fgl.invis)) ctx.globalAlpha = 0.4; // you can see yourself while hidden; others cannot
      if (v.__arena && !isMe) ctx.globalAlpha = 0.5; // archived 2019 note: inside the Arena opponents go semi-transparent so they can see through each other
      if (this.opts.noImages) { ctx.fillStyle = a.placeholderColor; ctx.beginPath(); ctx.arc(0, 0, pr, 0, 7); ctx.fill(); }
      else { const h = pr / M.Sprites.BODY_FRAC, skinItem = p.skin ? ((v.shop ? v.shop.items : []).concat(v.variants || [])).find((i) => i.id === p.skin) : null, skin = skinItem ? M.Sprites.getSkin(skinItem) : null; ctx.drawImage(skin || (isMe && this.opts.classic && M.Sprites.getClassic(a)) || M.Sprites.get(a), -h, -h, 2 * h, 2 * h); } // equipped skin if loaded, else the normal sprite // frame sized so the drawn body matches the hitbox
      ctx.globalAlpha = 1; ctx.restore();
      if (p.flags) { const f = M.ModeHud.flagsOf(p.flags); ctx.save(); ctx.translate(sx, sy); M.AbilityFx.drawFlags(ctx, f, pr, now); ctx.restore(); // team outline / zombie tint / infected glow (mode overlays)
        if (f.team) { ctx.strokeStyle = M.ModeHud.TEAM_COL[f.team]; ctx.lineWidth = Math.max(3, 4 * cam.zoom); ctx.beginPath(); ctx.arc(sx, sy, pr * 1.04, 0, 7); ctx.stroke(); }
        if (f.zombie) { ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#5ac83a'; ctx.beginPath(); ctx.arc(sx, sy, pr * 0.95, 0, 7); ctx.fill(); ctx.restore(); }
        else if (f.infected) { ctx.save(); ctx.globalAlpha = 0.22 + 0.12 * Math.sin(now / 200); ctx.fillStyle = '#c83a3a'; ctx.beginPath(); ctx.arc(sx, sy, pr * 0.95, 0, 7); ctx.fill(); ctx.restore(); } }
      if (!isMe && !v.__spectate) { // (spectators have no body, so no edible/dangerous outlines) outline: LIGHT-GREEN = you can eat it, RED = it can eat you (archived how-to-play text)
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
