#!/usr/bin/env node
/* Renders every animal sprite to assets/animals/<version>/<id>.png (256x256, facing +x) using headless Chromium via Playwright.
 * Dev tool only: the generated PNGs are committed, so playing the game needs no Playwright.
 * Usage: NODE_PATH=$(npm root -g) node tools/art/export.js [--version 2017-02-13] [--sheet /path/sheet.png] [id ...] */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2); let version = '2017-02-13', sheet = null; const only = []; // --version only names the menu assets folder
for (let i = 0; i < args.length; i++) { if (args[i] === '--version') version = args[++i]; else if (args[i] === '--sheet') sheet = args[++i]; else only.push(args[i]); }
(async () => {
  const animals = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/progression/animals.json'), 'utf8'));
  const b = await chromium.launch(), page = await b.newPage();
  await page.setContent('<canvas id="c" width="256" height="256"></canvas>');
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'draw.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'specs.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'food.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'gui.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'terrain.js'), 'utf8') });
  const list = animals.filter((a) => !only.length || only.includes(a.id));
  const out = await page.evaluate((list) => {
    const res = {}, src = document.createElement('canvas'); src.width = src.height = 256;
    for (const a of list) {
      const spec = window.MopeSpecs[a.id]; if (!spec) { res[a.id] = null; continue; }
      spec.color = spec.color || a.placeholderColor; window.MopeArt.drawAnimal(src.getContext('2d'), spec, 256);
      const dst = document.createElement('canvas'); dst.width = dst.height = 256; const d = dst.getContext('2d');
      d.translate(128, 128); d.rotate(-Math.PI / 2); d.drawImage(src, -128, -128); // head-down drawing -> facing +x
      res[a.id] = dst.toDataURL('image/png');
    }
    return res;
  }, list);
  let n = 0, missing = []; const byId = Object.fromEntries(animals.map((a) => [a.id, a]));
  for (const [id, url] of Object.entries(out)) { if (!url) { missing.push(id); continue; } const dest = path.join(ROOT, byId[id].sprite); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, Buffer.from(url.split(',')[1], 'base64')); n++; } // each sprite goes to the exact path named in animals.json
  console.log(`exported ${n} sprites (paths from animals.json)` + (missing.length ? `; NO SPEC for: ${missing.join(', ')}` : ''));
  if (sheet) {
    const cols = 8, cell = 160, rows = Math.ceil(list.length / cols);
    const html = '<body style="margin:0;background:#4fbf5a"><canvas id=s width=' + cols * cell + ' height=' + rows * cell + '></canvas></body>';
    const p2 = await b.newPage(); await p2.setContent(html);
    await p2.evaluate(async ({ out, list, cols, cell }) => { const c = document.getElementById('s').getContext('2d'); c.fillStyle = '#4fbf5a'; c.fillRect(0, 0, 9999, 9999);
      for (const [i, a] of list.entries()) { if (!out[a.id]) continue; const im = new Image(); im.src = out[a.id]; await im.decode(); c.save(); c.translate((i % cols) * cell + cell / 2, Math.floor(i / cols) * cell + cell / 2); c.rotate(Math.PI / 2); c.drawImage(im, -cell / 2, -cell / 2, cell, cell); c.restore(); c.fillStyle = '#fff'; c.font = '12px Arial'; c.fillText(a.id, (i % cols) * cell + 4, Math.floor(i / cols) * cell + 14); } }, { out, list, cols, cell });
    const png = await p2.evaluate(() => document.getElementById('s').toDataURL('image/png')); fs.writeFileSync(sheet, Buffer.from(png.split(',')[1], 'base64')); console.log('sheet ->', sheet);
  }
  // food sprites
  const foods = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/food/foods.json'), 'utf8')).filter((f) => !only.length || only.includes(f.id));
  const fo = await page.evaluate((foods) => { const r = {}, cv = document.createElement('canvas'); cv.width = cv.height = 128; for (const f of foods) { window.MopeFood.draw(cv.getContext('2d'), f.id, f.color, 128); r[f.id] = cv.toDataURL('image/png'); } return r; }, foods);
  const fdir = path.join(ROOT, 'assets/food'); fs.mkdirSync(fdir, { recursive: true });
  for (const [id, url] of Object.entries(fo)) fs.writeFileSync(path.join(fdir, id + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log(`exported ${Object.keys(fo).length} food sprites to assets/food`);
  if (sheet) { const p3 = await b.newPage(); await p3.setContent('<body style="margin:0;background:#4fbf5a"><canvas id=s width=1024 height=128></canvas></body>'); await p3.evaluate(async (fo) => { const c = document.getElementById('s').getContext('2d'); let i = 0; for (const u of Object.values(fo)) { const im = new Image(); im.src = u; await im.decode(); c.drawImage(im, i++ * 128, 0); } }, fo); const fpng = await p3.evaluate(() => document.getElementById('s').toDataURL('image/png')); fs.writeFileSync(sheet.replace('.png', '_food.png'), Buffer.from(fpng.split(',')[1], 'base64')); }
  // terrain object sprites (128x128)
  { const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/terrain/terrain.json'), 'utf8')).filter((t) => !only.length || only.includes(t.id));
    const tr = await page.evaluate((T) => { const r = {}, cv = document.createElement('canvas'); cv.width = cv.height = 128; for (const t of T) { window.MopeTerrain.draw(cv.getContext('2d'), t.id, 128); r[t.id] = cv.toDataURL('image/png'); } return r; }, T);
    for (const t of T) { const dest = path.join(ROOT, t.sprite); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, Buffer.from(tr[t.id].split(',')[1], 'base64')); }
    console.log(`exported ${T.length} terrain sprites`);
    if (sheet) { const p4 = await b.newPage(); await p4.setContent('<body style="margin:0;background:#4fbf5a"><canvas id=s width=1152 height=128></canvas></body>'); await p4.evaluate(async (tr) => { const c = document.getElementById('s').getContext('2d'); let i = 0; for (const u of Object.values(tr)) { const im = new Image(); im.src = u; await im.decode(); c.drawImage(im, i++ * 128, 0); } }, tr); const png = await p4.evaluate(() => document.getElementById('s').toDataURL('image/png')); fs.writeFileSync(sheet.replace('.png', '_terrain.png'), Buffer.from(png.split(',')[1], 'base64')); } }
  // GUI: ability icons (64x64), muted-sound icon, terrain tiles (256x256)
  if (!only.length) {
    const abil = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/abilities/abilities.json'), 'utf8')).map((a) => a.id);
    const biomes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/biomes/biomes.json'), 'utf8'));
    const gu = await page.evaluate(({ abil, biomes }) => { const r = { abilities: {}, tiles: {} }, cv = document.createElement('canvas');
      cv.width = cv.height = 64; for (const id of abil) { window.MopeGui.abilityIcon(cv.getContext('2d'), id, 64); r.abilities[id] = cv.toDataURL(); }
      cv.width = cv.height = 60; window.MopeGui.soundOff(cv.getContext('2d'), 60); r.soundOff = cv.toDataURL();
      cv.width = cv.height = 256; for (const b of biomes) { window.MopeGui.tile(cv.getContext('2d'), b.id, b.color, 256); r.tiles[b.id] = cv.toDataURL(); } return r; }, { abil, biomes });
    const w = (f, url) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); };
    for (const [id, u] of Object.entries(gu.abilities)) w(path.join(ROOT, 'assets/icons/abilities', id + '.png'), u);
    w(path.join(ROOT, 'assets/menus', version, 'sound_off.png'), gu.soundOff);
    for (const [id, u] of Object.entries(gu.tiles)) w(path.join(ROOT, 'assets/biomes', id + '.png'), u);
    console.log(`exported ${Object.keys(gu.abilities).length} ability icons, sound_off, ${Object.keys(gu.tiles).length} terrain tiles`);
  }
  await b.close();
})();
