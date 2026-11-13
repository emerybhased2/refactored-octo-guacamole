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

const vinfo = J('versions/2017/february-13/version.json');
const animals = J('data/progression/animals.json').filter((a) => a.releaseDate <= vinfo.date && (!a.removalDate || vinfo.date < a.removalDate));
const allEdges = J('data/progression/evolution.json'), tiers = J('data/progression/tiers.json');
const edges = allEdges.filter((e) => e.releaseDate <= vinfo.date && (!e.removalDate || vinfo.date < e.removalDate)); // the 2017-02-13 tree
const ucfg = J(vinfo.upgradeMenu), mcfg = J(vinfo.menu), hudcfg = J(vinfo.hud);
const arch = J('data/research/archive-2017-02-13-animals.json').animals;

(async () => {
  // ---- data integrity / provenance
  await t('data validation passes', () => { const r = validate(); assert.deepStrictEqual(r.errors, []); });
  await t('validator catches a broken edge', () => {
    const fx = path.join(ROOT, 'data/progression/evolution.json'), orig = fs.readFileSync(fx);
    try { const bad = J('data/progression/evolution.json'); bad.push({ from: 'mouse', to: 'ghost', releaseDate: '2017-02-13' }); fs.writeFileSync(fx, JSON.stringify(bad));
      assert.ok(validate().errors.some((e) => e.includes('ghost'))); } finally { fs.writeFileSync(fx, orig); }
  });
  await t('archive extraction: 44 animals, ids 1..44, all present in roster with matching internalId', () => {
    assert.strictEqual(arch.length, 44); assert.deepStrictEqual(arch.map((a) => a.internalId), Array.from({ length: 44 }, (_, i) => i + 1));
    for (const r of arch) { const a = animals.find((x) => x.id === r.skin.split('/').pop()); assert.ok(a, r.skin); assert.strictEqual(a.internalId, r.internalId); assert.strictEqual(a.placeholderColor, r.color); }
  });
  await t('arctic animals are exactly those whose archived skin path is arctic/', () => {
    const arcticIds = new Set(arch.filter((a) => a.skin.startsWith('arctic/')).map((a) => a.skin.split('/').pop()));
    for (const a of animals) assert.strictEqual(a.biome === 'arctic', arcticIds.has(a.id), a.id);
  });
  await t('every inferred value is flagged (tier/xp/stats confidence = inferred)', () => { for (const a of animals) { assert.strictEqual(a.confidence.tier, 'inferred'); assert.strictEqual(a.confidence.xp, 'inferred'); assert.strictEqual(a.confidence.stats, 'inferred'); } });
  await t('verified ability: cheetah extra_boost has the archived 8 s cooldown', () => { const ab = J('data/abilities/abilities.json').find((x) => x.id === 'extra_boost'); assert.strictEqual(ab.cooldownMs, 8000); });

  // ---- art pipeline (original art in the Mope.io style, tools/art)
  const png = (f) => { const b = fs.readFileSync(path.join(ROOT, f)); assert.strictEqual(b.toString('latin1', 1, 4), 'PNG'); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], type: b[25], size: b.length }; };
  await t('every animal has a recipe and a 256x256 RGBA PNG', () => {
    global.MopeArt = require('../tools/art/draw.js'); const specs = require('../tools/art/specs.js');
    for (const a of animals) { assert.ok(specs[a.id], 'no art recipe for ' + a.id); assert.strictEqual(a.spriteStatus, 'recreated'); const i = png(a.sprite); assert.deepStrictEqual([i.w, i.h, i.depth, i.type], [256, 256, 8, 6], a.id); assert.ok(i.size > 1500, a.id + ' looks empty'); }
    assert.deepStrictEqual(Object.keys(specs).sort(), J('data/progression/animals.json').map((a) => a.id).sort()); // one recipe per animal across all versions
  });
  await t('no stray sprites: every PNG under assets/animals is exactly some animal\'s declared sprite path', () => {
    const declared = new Set(J('data/progression/animals.json').map((x) => x.sprite)), dir = path.join(ROOT, 'assets/animals');
    for (const v of fs.readdirSync(dir)) { if (v.startsWith('.')) continue; for (const f of fs.readdirSync(path.join(dir, v))) { if (f.startsWith('.')) continue; assert.ok(declared.has('assets/animals/' + v + '/' + f), 'stray or misplaced sprite: ' + v + '/' + f); } }
    const r17 = animals.map((x) => x.sprite); for (const sp of r17) assert.ok(sp.includes('/2017-02-13/'), 'a 2017 animal points outside its version dir: ' + sp);
  });
  await t('every food has a 128x128 RGBA PNG', () => { for (const f of J('data/food/foods.json')) { const i = png(f.sprite); assert.deepStrictEqual([i.w, i.h, i.type], [128, 128, 6], f.id); } });
  await t('sprite sizing constants agree between art engine and client', () => {
    const Sprites = require('../client/sprites.js'), art = require('../tools/art/draw.js'), food = require('../tools/art/food.js');
    assert.strictEqual(Sprites.BODY_FRAC, art.BODY_FRAC); assert.strictEqual(Sprites.FOOD_FRAC, food.FOOD_FRAC);
  });
  await t('art provenance is recorded and never claims to be archived art', () => {
    const m = J('assets/manifest.json').versions['2017-02-13'].animals; assert.strictEqual(m.status, 'recreated'); assert.ok(/not.*Mope\.io's own art|original artwork/i.test(m.provenance));
  });

  await t('GUI art exists: ability icons, muted icon, terrain tiles', () => {
    for (const a of J('data/abilities/abilities.json')) { const i = png(a.icon); assert.deepStrictEqual([i.w, i.h, i.type], [64, 64, 6], a.id); }
    for (const b of J('data/biomes/biomes.json')) { const i = png(b.tile); assert.deepStrictEqual([i.w, i.h], [256, 256], b.id); }
    const s = png(mcfg.icons.muteOff.src); assert.deepStrictEqual([s.w, s.h], [60, 60]);
    const gui = require('../tools/art/gui.js'); for (const a of J('data/abilities/abilities.json')) assert.ok(gui.abilityIds.includes(a.id), 'no glyph for ' + a.id);
  });
  await t('HUD ability button state (cooldown from server)', () => {
    const ab = J('data/abilities/abilities.json'), cheetah = animals.find((a) => a.id === 'cheetah');
    assert.strictEqual(HUD.abilityState(animals.find((a) => a.id === 'mouse'), ab, 0), null);
    const ready = HUD.abilityState(cheetah, ab, 0); assert.ok(ready.ready && ready.implemented && ready.name === 'Extra Boost');
    const cd = HUD.abilityState(cheetah, ab, 6000); assert.ok(!cd.ready && cd.remainingSec === 6 && Math.abs(cd.frac - 0.75) < 1e-9);
    assert.strictEqual(HUD.abilityState(animals.find((a) => a.id === 'kraken'), ab, 0).implemented, false);
  });
  await t('muted icon is wired in the menu config', () => assert.ok(mcfg.icons.muteOff && mcfg.icons.mute));

  // ---- upgrade menu: archived choice UI
  const A = (id) => animals.find((a) => a.id === id);
  await t('choices sorted by biome; suggested = first in own biome', () => {
    assert.deepStrictEqual(UpgradeMenu.orderChoices(['arctichare', 'trout', 'mole', 'rabbit'], animals, 'land'), ['rabbit', 'mole', 'trout', 'arctichare']);
    assert.deepStrictEqual(UpgradeMenu.orderChoices(['arctichare', 'trout', 'rabbit'], animals, 'ocean'), ['trout', 'rabbit', 'arctichare']);
    assert.deepStrictEqual(UpgradeMenu.orderChoices(['arctichare', 'trout'], animals, 'land'), ['trout', 'arctichare']);
  });
  await t('choice layout: square buttons 100x100, suggested bigger+leftmost, centred, bottom anchored', () => {
    const b = UpgradeMenu.choiceLayout(['rabbit', 'mole', 'trout'], ucfg, 1280, 720), C = ucfg.choices;
    assert.strictEqual(b[1].w, C.button.w); assert.strictEqual(b[1].h, C.button.h); assert.ok(b[0].w > b[1].w && b[0].x < b[1].x && b[0].suggested);
    const left = b[0].x, right = b[2].x + b[2].w; assert.ok(Math.abs((left + right) / 2 - 640) <= 1);
    for (const x of b) assert.strictEqual(x.y + x.h, 720 - C.marginBottom); assert.strictEqual(b[1].x - (b[0].x + b[0].w), C.gap);
  });
  await t('choice menu: click requests evolve, Enter takes first, nothing offered when none available', () => {
    const sent = []; const m = new UpgradeMenu((id) => sent.push(id)); m.setVersion({ animals, edges, tiers, upgradeMenu: ucfg });
    const you = { a: 'mouse', xp: 80, ev: ['trout', 'rabbit', 'mole', 'arctichare', 'crab'] };
    assert.strictEqual(m.choices(you)[0], 'rabbit');
    assert.ok(m.takeFirst(you)); assert.deepStrictEqual(sent, ['rabbit']);
    const lay = UpgradeMenu.choiceLayout(m.choices(you), ucfg, 1280, 720); const trout = lay.find((x) => x.id === 'trout');
    assert.ok(m.click(trout.x + 3, trout.y + 3, 1280, 720, you)); assert.strictEqual(sent[1], 'trout');
    assert.strictEqual(m.click(5, 5, 1280, 720, you), false);
    assert.deepStrictEqual(m.choices({ a: 'mouse', xp: 0, ev: [] }), []); assert.strictEqual(m.takeFirst({ a: 'mouse', xp: 0, ev: [] }), false);
  });
  await t('archived biome button colours', () => { assert.deepStrictEqual(ucfg.choices.biomeColors, { land: '#26A73A', ocean: '#1C91B8', arctic: '#B2B2B2' }); assert.strictEqual(ucfg.choices.fillAlpha, 0.75); assert.strictEqual(ucfg.choices.highlightAlpha, 0.2); });
  // ---- dev tree
  const lay = UpgradeMenu.layout(animals, ucfg.tree, 1280, 720);
  await t('tree: one card per animal, columns by tier (8 tiers)', () => {
    assert.strictEqual(lay.cards.length, 44); assert.strictEqual(new Set(lay.cards.map((c) => c.col)).size, 8);
    const col = {}; for (const c of lay.cards) col[c.id] = c.col; assert.strictEqual(col.mouse, 0); assert.strictEqual(col.rabbit, 1); assert.strictEqual(col.dragon, 7); assert.strictEqual(col.kraken, col.yeti);
  });
  await t('tree: panel inside viewport; scroll clamps; hit test', () => {
    const p = lay.panel; assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 1280 && p.y + p.h <= 720); assert.ok(lay.maxScroll > 0);
    const s = UpgradeMenu.layout(animals, ucfg.tree, 1280, 720, 99999); assert.strictEqual(s.scroll, s.maxScroll);
    const k = lay.cards.find((c) => c.id === 'fox'); assert.strictEqual(UpgradeMenu.cardAt(lay, k.x + 5, k.y + 5).id, 'fox'); assert.strictEqual(UpgradeMenu.cardAt(lay, 1, 1), null);
  });
  await t('tree: states', () => {
    const S = (id, cur, xp) => UpgradeMenu.stateOf(id, cur, xp, animals, edges);
    assert.strictEqual(S('mouse', 'mouse', 0), 'current'); assert.strictEqual(S('rabbit', 'mouse', 10), 'needsXp'); assert.strictEqual(S('rabbit', 'mouse', 60), 'available');
    assert.strictEqual(S('dragon', 'mouse', 1e6), 'future'); assert.strictEqual(S('mouse', 'rabbit', 0), 'past'); assert.strictEqual(S('mouse', 'trout', 0), 'past'); assert.strictEqual(S('mouse', 'dragon', 0), 'past');
  });
  await t('tree is dev-only: toggle ignored in non-dev', () => { const m = new UpgradeMenu(() => {}, false); m.setVersion({ animals, edges, tiers, upgradeMenu: ucfg }); m.toggleTree(); assert.strictEqual(m.treeOpen, false); const d = new UpgradeMenu(() => {}, true); d.toggleTree(); assert.strictEqual(d.treeOpen, true); });

  // ---- main menu (numbers from the archived main.css / index.html)
  await t('main menu theme matches archived CSS values', () => {
    const v = MenuRenderer.themeVars(mcfg);
    assert.strictEqual(v['--page-bg'], '#3FBA54'); assert.strictEqual(v['--nick-border'], '4px solid #1c9c25'); assert.strictEqual(v['--nick-w'], '250px');
    assert.strictEqual(v['--play-w'], '250px'); assert.strictEqual(v['--play-h'], '40px'); assert.strictEqual(v['--play-bg'], '#0aa633'); assert.strictEqual(v['--play-hover'], '#16932A'); assert.strictEqual(v['--play-bb'], '4px solid #116c17');
    assert.strictEqual(v['--logo-w'], '350px'); assert.strictEqual(v['--logo-h'], '178px'); assert.strictEqual(v['--col-w'], '350px'); assert.strictEqual(v['--opt-bg'], 'rgba(11,164,52,0.95)');
  });
  await t('main menu: elements of this version; none from later eras', () => {
    const e = MenuRenderer.elementsPresent(mcfg); assert.deepStrictEqual(e, { modes: true, sandbox: true, settings: true, mute: true, howToPlay: true, updates: true, options: true });
    for (const k of ['login', 'register', 'shop', 'currency', 'events']) assert.ok(mcfg.absentInThisVersion.includes(k)); assert.strictEqual(mcfg.animation, null);
    const stripped = JSON.parse(JSON.stringify(mcfg)); delete stripped.modes.sandbox; assert.strictEqual(MenuRenderer.elementsPresent(stripped).sandbox, false);
  });
  await t('main menu: logo asset is the archived 350x178 PNG', () => {
    const buf = fs.readFileSync(path.join(ROOT, mcfg.logo.src)); assert.strictEqual(buf.readUInt32BE(16), 350); assert.strictEqual(buf.readUInt32BE(20), 178);
    for (const m of [mcfg.modes.normal, mcfg.modes.sandbox]) { const b = fs.readFileSync(path.join(ROOT, m.src)); assert.strictEqual(b.readUInt32BE(16), 124); assert.strictEqual(b.readUInt32BE(20), 48); }
  });
  await t('main menu: version manager loads matching config & rejects mismatch', async () => {
    const files = { [vinfo.menu]: mcfg, bad: Object.assign({}, mcfg, { version: '2026-01-01' }) };
    const f = async (u) => u === 'api/versions' ? { json: async () => [{ id: '2017-02-13', date: '2017-02-13', menu: vinfo.menu }, { id: 'x', date: '2018-01-01', menu: 'bad' }] } : { ok: u in files, json: async () => files[u] };
    await MenuVersionManager.init(f); assert.strictEqual((await MenuVersionManager.select('2017-02-13', f)).version, '2017-02-13'); await assert.rejects(() => MenuVersionManager.select('x', f), /mismatch/);
  });

  // ---- misc client logic
  await t('HUD: water bar configured; next xp', () => { assert.ok(hudcfg.waterBar); assert.strictEqual(HUD.nextXp(animals, edges, 'mouse'), 60); assert.strictEqual(HUD.nextXp(animals, edges, 'dragon'), null); });
  await t('interpolation midpoint + angle wrap', () => {
    const i = new Interpolator(0); i.push(0, [{ id: 1, x: 0, y: 0, angle: 3.0 }]); i.push(100, [{ id: 1, x: 100, y: 50, angle: -3.0 }]);
    const e = i.sample(50)[0]; assert.ok(Math.abs(e.x - 50) < 1e-9 && Math.abs(e.y - 25) < 1e-9); assert.ok(Math.abs(Math.abs(e.angle) - Math.PI) < 0.2);
  });
  await t('input mapping', () => { assert.strictEqual(pointerToInput(500, 400, 1000, 800).mag, 0); const r = pointerToInput(1000, 400, 1000, 800); assert.strictEqual(r.mag, 1); assert.ok(Math.abs(r.angle) < 1e-9); });
  await t('camera zoom out with tier + round trip', () => { const c = new Camera(); c.follow(0, 0, 8, 10); assert.ok(c.zoom < 0.6); const [sx, sy] = c.worldToScreen(30, 40, 800, 600); const [wx, wy] = c.screenToWorld(sx, sy, 800, 600); assert.ok(Math.abs(wx - 30) < 1e-9 && Math.abs(wy - 40) < 1e-9); });

  // ---- version 2018-04-21
  const v18 = J('versions/2018/april-21/version.json'), all = J('data/progression/animals.json'), m18 = J(v18.menu), u18 = J(v18.upgradeMenu), h18 = J(v18.hud), arch18 = J('data/research/archive-2018-04-21-animals.json').animals;
  const act = (a, d) => a.releaseDate <= d && (!a.removalDate || d < a.removalDate);
  await t('2018 roster is exactly the archived client: 61 animals, ids 1..61, 2017 unchanged', () => {
    assert.strictEqual(arch18.length, 61); assert.deepStrictEqual(arch18.map((a) => a.internalId), Array.from({ length: 61 }, (_, i) => i + 1));
    const r18 = all.filter((a) => act(a, v18.date)), r17 = all.filter((a) => act(a, vinfo.date));
    assert.strictEqual(r18.length, 61); assert.strictEqual(r17.length, 44);
    for (const r of arch18) { const a = r18.find((x) => x.internalId === r.internalId); assert.ok(a, r.skin); assert.strictEqual(a.id, r.skin.split('/').pop().toLowerCase()); }
    for (const a of r17) assert.ok(a.internalId <= 44);
  });
  await t('no anachronisms: 2018-only animals/abilities are absent from 2017', () => {
    const ab = J('data/abilities/abilities.json'), new17 = all.filter((a) => act(a, vinfo.date)).map((a) => a.id);
    for (const id of ['tiger', 'giraffe', 'eagle', 'kingcrab', 'blackdragon', 'snail', 'duckling']) assert.ok(!new17.includes(id), id);
    assert.ok(ab.filter((a) => act(a, vinfo.date)).every((a) => a.releaseDate <= vinfo.date)); assert.ok(ab.find((a) => a.id === 'venom_spit').releaseDate === '2018-04-21');
    for (const a of all.filter((x) => x.releaseDate === '2018-04-21' && x.ability)) assert.ok(ab.find((x) => x.id === a.ability), a.id);
  });
  await t('2018 art exists for every animal and ability icon', () => {
    global.MopeArt = require('../tools/art/draw.js'); const specs = require('../tools/art/specs.js');
    for (const a of all) { assert.ok(specs[a.id], 'recipe ' + a.id); const i = png(a.sprite); assert.deepStrictEqual([i.w, i.h, i.type], [256, 256, 6], a.id); }
    for (const a of J('data/abilities/abilities.json')) { const i = png(a.icon); assert.deepStrictEqual([i.w, i.h], [64, 64], a.id); }
  });
  await t('2018 main menu: archived wordmark 350x99, no modes, no How-to-play, 5 options, 3 update notes', () => {
    const i = png(m18.logo.src); assert.deepStrictEqual([i.w, i.h], [350, 99]); assert.strictEqual(m18.logo.h, 99);
    const e = MenuRenderer.elementsPresent(m18); assert.deepStrictEqual(e, { modes: false, sandbox: false, settings: true, mute: true, howToPlay: false, updates: true, options: true });
    assert.ok(!m18.options.checkboxes.some((c) => c.id === 'christmasSkins')); assert.strictEqual(m18.options.checkboxes.length, 5);
    assert.strictEqual(m18.panels.updates.sections.length, 3); assert.ok(m18.absentInThisVersion.includes('sandbox'));
  });
  await t('2018 menu theme: same page colour/Play/nickname; shifted column; light update text', () => {
    const v = MenuRenderer.themeVars(m18), v17 = MenuRenderer.themeVars(mcfg);
    for (const k of ['--page-bg', '--nick-border', '--play-bg', '--play-w', '--play-h']) assert.strictEqual(v[k], v17[k], k);
    assert.strictEqual(v['--logo-h'], '99px'); assert.strictEqual(v['--onc-mt'], '-10px'); assert.strictEqual(v['--upd-text'], '#f8f8f8'); assert.strictEqual(v17['--upd-text'], '#000000');
  });
  await t('2018 HUD ability button uses the verified recharge-bar style; 2017 keeps the sweep', () => {
    assert.strictEqual(h18.abilityButton.style, 'rechargeBar'); assert.strictEqual(h18.abilityButton.rechargeFill, '#F3C553'); assert.strictEqual(hudcfg.abilityButton.style, 'sweep');
  });
  await t('2018 upgrade buttons: name at the top; 2017 at the bottom; same biome colours', () => {
    assert.strictEqual(u18.choices.namePosition, 'top'); assert.strictEqual(ucfg.choices.namePosition, 'bottom'); assert.deepStrictEqual(u18.choices.biomeColors, ucfg.choices.biomeColors);
  });
  await t('2018 tree: all 2017 edges kept, every animal reachable from a starter, tier 9 exists', () => {
    const e17 = allEdges.filter((e) => e.releaseDate <= vinfo.date), e18 = allEdges.filter((e) => e.releaseDate <= v18.date), keys = new Set(e18.map((e) => e.from + '>' + e.to));
    for (const e of e17) assert.ok(keys.has(e.from + '>' + e.to));
    const reach = new Set(v18.starters); let ch = true; while (ch) { ch = false; for (const e of e18) if (reach.has(e.from) && !reach.has(e.to)) { reach.add(e.to); ch = true; } }
    for (const a of all.filter((x) => act(x, v18.date))) assert.ok(reach.has(a.id), 'unreachable ' + a.id); assert.ok(tiers.some((x) => x.tier === 9 && x.releaseDate === '2018-04-21'));
  });

  console.log(`unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
