#!/usr/bin/env node
// Zero-dependency static dev server. / -> client/, plus /data, /assets, /versions mapped to project dirs. /api/versions lists version.json files.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), PORT = +process.env.MOPE_WEB_PORT || 8080;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const MOUNTS = { data: 'data', assets: 'assets', versions: 'versions' };

function listVersions() {
  const out = [], walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'version.json') out.push(JSON.parse(fs.readFileSync(p, 'utf8'))); } };
  walk(path.join(ROOT, 'versions'));
  const animals = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/progression/animals.json'), 'utf8'));
  const shop = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data/shop/shop.json'), 'utf8')).items; } catch (e) { return []; } })();
  for (const v of out) v.animalDefs = animals.filter((a) => a.releaseDate && a.releaseDate <= v.date && (!a.removalDate || v.date < a.removalDate)); // same rule as the server
  for (const v of out) if (v.features && v.features.shop) v.shopItems = shop.filter((i) => i.releaseDate <= v.date && (i.type !== 'skin' && i.type !== 'animal' ? true : animals.some((a) => a.id === i.animal && a.releaseDate <= v.date))).map((i) => (v.shopPriceOverrides && i.id in v.shopPriceOverrides ? Object.assign({}, i, { price: v.shopPriceOverrides[i.id], free: v.shopPriceOverrides[i.id] === 0 }) : i));
  return out;
}
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/api/versions') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(listVersions())); }
  const parts = url.split('/').filter(Boolean); let base = path.join(ROOT, 'client'), rel = parts.join('/');
  if (MOUNTS[parts[0]]) { base = path.join(ROOT, MOUNTS[parts[0]]); rel = parts.slice(1).join('/'); }
  let file = path.join(base, rel || 'index.html');
  if (!file.startsWith(base + path.sep) && file !== base) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (e, buf) => {
      if (e) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(buf);
    });
  });
}).listen(PORT, () => console.log('[web] http://localhost:' + PORT + '  (add ?dev=1 for the version selector + FPS/ping overlay)'));
