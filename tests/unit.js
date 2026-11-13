// Node unit tests for pure client logic + data integrity. Run: node tests/unit.js
const assert = require('assert'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
global.Mope = {};
const { Interpolator } = require('../client/interpolation.js');
const { Camera } = require('../client/camera.js');
const { pointerToInput } = require('../client/input.js');
const { UpgradeMenu } = require('../client/ui/UpgradeMenu.js');
const MenuRenderer = require('../client/ui/MenuRenderer.js');
const { MenuVersionManager } = require('../client/ui/MenuVersionManager.js');
const HUD = require('../client/ui/HUD.js');
const { validate } = require('../scripts/validate-data.js');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; } catch (e) { fail++; console.log('FAIL: ' + name + '\n   ' + e.message); } }

// Rebuild what the server sends for 2017-04-07 (same filtering rules) to test UI generation from the progression DB.
const vinfo = J('versions/2017/april-07/version.json');
const animals = J('data/progression/animals.json').filter((a) => a.releaseDate <= vinfo.date && (!a.removalDate || vinfo.date < a.removalDate));
const edges = J('data/progression/evolution.json');
const ucfg = J(vinfo.upgradeMenu), mcfg = J(vinfo.menu);

(async () => {
  await t('data validation passes', () => { const r = validate(); assert.deepStrictEqual(r.errors, []); });
  await t('validator catches a broken edge', () => { /* negative test via fixture */
    const fx = path.join(ROOT, 'data/progression/evolution.json'), orig = fs.readFileSync(fx);
    try { const bad = J('data/progression/evolution.json'); bad.push({ from: 'mouse', to: 'ghost', releaseDate: '2017-04-07' }); fs.writeFileSync(fx, JSON.stringify(bad));
      assert.ok(validate().errors.some((e) => e.includes('ghost'))); } finally { fs.writeFileSync(fx, orig); }
  });

  // Upgrade menu
  const lay = UpgradeMenu.layout(animals, ucfg, 1280, 720);
  await t('upgrade menu: one card per animal, columns by tier', () => {
    assert.strictEqual(lay.cards.length, animals.length);
    const cols = {}; for (const c of lay.cards) cols[c.id] = c.col;
    assert.strictEqual(cols.mouse, 0); assert.strictEqual(cols.rabbit, 1); assert.strictEqual(cols.deer, cols.fox); assert.strictEqual(cols.bear, 4);
  });
  await t('upgrade menu: panel centred and inside viewport', () => { const p = lay.panel; assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 1280 && p.y + p.h <= 720); assert.ok(Math.abs(p.x + p.w / 2 - 640) <= 1); });
  await t('upgrade menu: card geometry matches config', () => { const c = lay.cards[0]; assert.strictEqual(c.w, ucfg.card.w); assert.strictEqual(c.h, ucfg.card.h); const r = lay.cards.find((k) => k.id === 'rabbit'); assert.strictEqual(r.x - c.x, ucfg.card.w + ucfg.card.gap); });
  await t('upgrade menu: states', () => {
    const S = (id, cur, xp) => UpgradeMenu.stateOf(id, cur, xp, animals, edges);
    assert.strictEqual(S('mouse', 'mouse', 0), 'current'); assert.strictEqual(S('rabbit', 'mouse', 10), 'needsXp'); assert.strictEqual(S('rabbit', 'mouse', 60), 'available');
    assert.strictEqual(S('bear', 'mouse', 99999), 'future'); assert.strictEqual(S('mouse', 'rabbit', 0), 'past'); assert.strictEqual(S('mouse', 'wolf', 0), 'past');
  });
  await t('upgrade menu: hit test + scroll clipping', () => {
    const k = lay.cards.find((c) => c.id === 'fox'); assert.strictEqual(UpgradeMenu.cardAt(lay, k.x + 5, k.y + 5).id, 'fox'); assert.strictEqual(UpgradeMenu.cardAt(lay, 1, 1), null);
    const small = UpgradeMenu.layout(animals, ucfg, 1280, 260, 9999); assert.ok(small.maxScroll > 0 && small.scroll === small.maxScroll);
  });
  await t('upgrade menu: tree differs when roster differs', () => {
    const fewer = animals.filter((a) => a.tier <= 3); assert.strictEqual(UpgradeMenu.layout(fewer, ucfg, 1280, 720).cards.length, fewer.length);
  });
  await t('upgrade menu: click requests evolution only when available', () => {
    const sent = []; const m = new UpgradeMenu((id) => sent.push(id)); m.setVersion({ animals, edges, tiers: J('data/progression/tiers.json'), upgradeMenu: ucfg });
    m.open = true; m.lay = UpgradeMenu.layout(animals, ucfg, 1280, 720);
    const r = m.lay.cards.find((c) => c.id === 'rabbit');
    m.click(r.x + 5, r.y + 5, 1280, 720, { a: 'mouse', xp: 10, ev: [] }); assert.deepStrictEqual(sent, []);
    m.open = true; m.click(r.x + 5, r.y + 5, 1280, 720, { a: 'mouse', xp: 80, ev: ['rabbit'] }); assert.deepStrictEqual(sent, ['rabbit']);
  });

  // Main menu
  await t('main menu: layout centred, offsets honoured', () => {
    const r = MenuRenderer.layoutElements(mcfg, 1000, 800);
    assert.strictEqual(r.play.x + r.play.w / 2, 500); assert.strictEqual(r.play.y + r.play.h / 2, 400 + mcfg.elements.play.offsetY); assert.strictEqual(r.logo.y, 400 + mcfg.logo.offsetY);
    assert.ok(r.nickname.y < r.play.y);
  });
  await t('main menu: 2017 config has no later-era elements', () => { for (const k of ['serverSelect', 'settings', 'login', 'shop']) assert.ok(!(k in mcfg.elements)); });
  await t('main menu: version manager loads matching config & rejects mismatch', async () => {
    const files = { 'data/menus/main-2017-04-07.json': mcfg, bad: Object.assign({}, mcfg, { version: '2026-01-01' }) };
    const f = async (u) => u === 'api/versions' ? { json: async () => [{ id: '2017-04-07', date: '2017-04-07', menu: 'data/menus/main-2017-04-07.json' }, { id: 'x', date: '2018-01-01', menu: 'bad' }] } : { ok: u in files, json: async () => files[u] };
    await MenuVersionManager.init(f); assert.strictEqual((await MenuVersionManager.select('2017-04-07', f)).version, '2017-04-07');
    await assert.rejects(() => MenuVersionManager.select('x', f), /mismatch/);
  });

  // Misc client logic
  await t('interpolation midpoint + angle wrap', () => {
    const i = new Interpolator(0); i.push(0, [{ id: 1, x: 0, y: 0, angle: 3.0 }]); i.push(100, [{ id: 1, x: 100, y: 50, angle: -3.0 }]);
    const e = i.sample(50)[0]; assert.ok(Math.abs(e.x - 50) < 1e-9 && Math.abs(e.y - 25) < 1e-9); assert.ok(Math.abs(Math.abs(e.angle) - Math.PI) < 0.2);
  });
  await t('input mapping', () => { assert.strictEqual(pointerToInput(500, 400, 1000, 800).mag, 0); const r = pointerToInput(1000, 400, 1000, 800); assert.strictEqual(r.mag, 1); assert.ok(Math.abs(r.angle) < 1e-9); });
  await t('camera zoom out with tier + round trip', () => { const c = new Camera(); c.follow(0, 0, 5, 10); assert.ok(c.zoom < 0.7); const [sx, sy] = c.worldToScreen(30, 40, 800, 600); const [wx, wy] = c.screenToWorld(sx, sy, 800, 600); assert.ok(Math.abs(wx - 30) < 1e-9 && Math.abs(wy - 40) < 1e-9); });
  await t('HUD next xp', () => { assert.strictEqual(HUD.nextXp(animals, edges, 'mouse'), 60); assert.strictEqual(HUD.nextXp(animals, edges, 'bear'), null); });

  console.log(`unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
