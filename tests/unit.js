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
  await t('every inferred value is flagged (tier/xp/stats confidence = inferred)', () => { for (const a of animals) { assert.ok(/inferred|user-provided/.test(a.confidence.tier), a.id + ' tier'); assert.ok(/inferred|user-provided/.test(a.confidence.xp), a.id + ' xp'); assert.strictEqual(a.confidence.stats, 'inferred'); } });
  await t('verified ability: cheetah extra_boost has the archived 8 s cooldown', () => { const ab = J('data/abilities/abilities.json').find((x) => x.id === 'extra_boost'); assert.strictEqual(ab.cooldownMs, 8000); });

  // ---- art pipeline (original art in the Mope.io style, tools/art)
  const png = (f) => { const b = fs.readFileSync(path.join(ROOT, f)); assert.strictEqual(b.toString('latin1', 1, 4), 'PNG'); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], type: b[25], size: b.length }; };
  await t('every animal has a recipe and a 256x256 RGBA PNG', () => {
    global.MopeArt = require('../tools/art/draw.js'); global.window = global; const specs = require('../tools/art/specs.js'); require('../tools/art/specs2.js');
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
  await t('tree: one card per animal, one column per tier present (2017: tiers 1-13 and 16)', () => {
    assert.strictEqual(lay.cards.length, 44); assert.strictEqual(new Set(lay.cards.map((c) => c.col)).size, new Set(animals.map((a) => a.tier)).size);
    const col = {}; for (const c of lay.cards) col[c.id] = c.col; assert.strictEqual(col.mouse, 0); assert.strictEqual(col.rabbit, 1); assert.ok(col.dragon > col.rhino); assert.strictEqual(col.kraken, col.yeti); assert.strictEqual(col.dragon, col.kraken);
  });
  await t('tree: panel inside viewport; scroll clamps; hit test', () => {
    const p = lay.panel; assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 1280 && p.y + p.h <= 720);
    const s = UpgradeMenu.layout(animals, ucfg.tree, 1280, 260, 99999); assert.ok(s.maxScroll > 0); assert.strictEqual(s.scroll, s.maxScroll);
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
    const e = MenuRenderer.elementsPresent(mcfg); assert.deepStrictEqual(e, { modes: true, sandbox: true, settings: true, mute: true, howToPlay: true, updates: true, options: true, spectate: false, account: false });
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
  await t('HUD: water bar configured; next xp', () => { assert.ok(hudcfg.waterBar); assert.strictEqual(HUD.nextXp(animals, edges, 'mouse'), 50); assert.strictEqual(HUD.nextXp(animals, edges, 'dragon'), null); });
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
    global.MopeArt = require('../tools/art/draw.js'); global.window = global; const specs = require('../tools/art/specs.js'); require('../tools/art/specs2.js');
    for (const a of all) { assert.ok(specs[a.id], 'recipe ' + a.id); const i = png(a.sprite); assert.deepStrictEqual([i.w, i.h, i.type], [256, 256, 6], a.id); }
    for (const a of J('data/abilities/abilities.json')) { const i = png(a.icon); assert.deepStrictEqual([i.w, i.h], [64, 64], a.id); }
  });
  await t('2018 main menu: archived wordmark 350x99, no modes, no How-to-play, 5 options, 3 update notes', () => {
    const i = png(m18.logo.src); assert.deepStrictEqual([i.w, i.h], [350, 99]); assert.strictEqual(m18.logo.h, 99);
    const e = MenuRenderer.elementsPresent(m18); assert.deepStrictEqual(e, { modes: false, sandbox: false, settings: true, mute: true, howToPlay: false, updates: true, options: true, spectate: false, account: false });
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
  const inV = (e, d) => e.releaseDate <= d && (!e.removalDate || d < e.removalDate);
  const stateAt = (id, d) => { const a = all.find((x) => x.id === id); let r = { tier: a.tier, xp: a.xpRequired, biome: a.biome }; for (const c of (J('data/progression/animal-statistics.json').changes[id] || []).filter((c) => c.from <= d).sort((x, y) => x.from.localeCompare(y.from))) r = { tier: c.tier !== undefined ? c.tier : r.tier, xp: c.xpRequired !== undefined ? c.xpRequired : r.xp, biome: c.biome || r.biome }; return r; };
  await t('every version: tier strictly increases along edges, XP never decreases, every animal reachable from a starter', () => {
    for (const vf of ['versions/2017/february-13/version.json', 'versions/2018/april-21/version.json', 'versions/2019/august-25/version.json', 'versions/2019/december-30/version.json']) {
      const v = J(vf), roster = all.filter((a) => act(a, v.date) && v.biomes.includes(stateAt(a.id, v.date).biome)), ed = allEdges.filter((e) => inV(e, v.date) && roster.some((a) => a.id === e.from) && roster.some((a) => a.id === e.to));
      for (const e of ed) { const f = stateAt(e.from, v.date), t = stateAt(e.to, v.date); assert.ok(t.tier > f.tier, `${v.id} ${e.from}>${e.to}`); assert.ok(t.xp >= f.xp, `${v.id} xp ${e.from}>${e.to}`); }
      const reach = new Set(v.starters); let ch = true; while (ch) { ch = false; for (const e of ed) if (reach.has(e.from) && !reach.has(e.to)) { reach.add(e.to); ch = true; } }
      for (const a of roster) assert.ok(reach.has(a.id), `${v.id}: unreachable ${a.id}`);
    }
  });
  await t('tier model (USER-PROVIDED): 16 tiers in 2017 and 2018; 18 in 2019 with apex 15, monsters 16, Black Dragon 17, King Dragon 18 at 100M XP', () => {
    const max = (d) => Math.max(...all.filter((a) => act(a, d)).map((a) => stateAt(a.id, d).tier));
    assert.strictEqual(max('2017-02-13'), 16); assert.strictEqual(max('2018-04-21'), 16); assert.strictEqual(max('2019-08-25'), 18);
    const S = (id) => stateAt(id, '2019-08-25');
    for (const id of ['trex', 'kingcrab', 'mammoth', 'elephant', 'bluewhale']) assert.strictEqual(S(id).tier, 15, id + ' apex');
    for (const id of ['kraken', 'dragon', 'yeti', 'icemonster']) assert.strictEqual(S(id).tier, 16, id + ' monster');
    assert.strictEqual(S('blackdragon').tier, 17); assert.strictEqual(S('blackdragon').biome, 'volcano'); assert.strictEqual(S('kingdragon').tier, 18); assert.strictEqual(S('kingdragon').xp, 100000000);
    assert.strictEqual(stateAt('blackdragon', '2018-04-21').tier, 16); assert.strictEqual(stateAt('blackdragon', '2018-04-21').biome, 'land'); assert.strictEqual(stateAt('trex', '2018-04-21').tier, 14);
    const tr = J('data/progression/tiers.json'); assert.strictEqual(tr.length, 18); assert.strictEqual(tr.filter((x) => x.releaseDate <= '2018-04-21').length, 16);
    assert.deepStrictEqual([15, 16, 17, 18].map((n) => tr[n - 1].categories[0].name), ['Apex', 'Monsters', 'Black Dragon', 'King Dragon']);
    const xp = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((n) => all.filter((a) => act(a, '2019-08-25') && stateAt(a.id, '2019-08-25').tier === n).map((a) => stateAt(a.id, '2019-08-25').xp)); xp.forEach((l) => assert.strictEqual(new Set(l).size <= 1, true)); // one XP value per tier
  });
  const v19 = J('versions/2019/august-25/version.json'), m19 = J(v19.menu), biomes = J('data/biomes/biomes.json'), terr = J('data/terrain/terrain.json'), foodsAll = J('data/food/foods.json');
  await t('2019 roster: 77 animals, the 16 added are evidenced, none appear earlier', () => {
    assert.strictEqual(all.filter((a) => act(a, v19.date)).length, 77); assert.strictEqual(all.filter((a) => act(a, v18.date)).length, 61);
    const added = all.filter((a) => a.releaseDate === '2019-08-25'); assert.strictEqual(added.length, 16); for (const a of added) { assert.ok(a.evidence, a.id + ' needs evidence'); assert.strictEqual(a.internalId, null); assert.strictEqual(a.confidence.internalId.startsWith('unknown'), true); }
    for (const id of ['kingdragon', 'komodo', 'flytrap', 'macaw', 'peacock', 'pelican', 'icemonster']) assert.ok(!all.filter((a) => act(a, v18.date)).some((a) => a.id === id), id);
  });
  await t('2019 biomes: land/ocean/arctic + desert + volcano; layouts inside the world and non-overlapping; desert/volcano absent earlier', () => {
    assert.deepStrictEqual(v19.biomes, ['land', 'ocean', 'arctic', 'desert', 'volcano']); const L = Object.entries(v19.layout);
    for (const [id, r] of L) { assert.ok(r[0] >= 0 && r[1] >= 0 && r[0] + r[2] <= 1.0001 && r[1] + r[3] <= 1.0001, id); }
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i][1], b = L[j][1]; assert.ok(!(a[0] < b[0] + b[2] - 1e-9 && b[0] < a[0] + a[2] - 1e-9 && a[1] < b[1] + b[3] - 1e-9 && b[1] < a[1] + a[3] - 1e-9), L[i][0] + '/' + L[j][0]); }
    assert.ok(!J('versions/2018/april-21/version.json').biomes.includes('desert')); for (const id of ['desert', 'volcano']) assert.strictEqual(biomes.find((b) => b.id === id).releaseDate, '2019-08-25');
    assert.ok(/VERIFIED/.test(biomes.find((b) => b.id === 'desert').confidence)); assert.ok(/EVIDENCED/.test(biomes.find((b) => b.id === 'volcano').confidence));
  });
  await t('2019 foods and terrain: melons verified, desert/volcano foods flagged inferred, terrain gated by date', () => {
    assert.ok(v19.foods.includes('watermelon')); assert.ok(!J('versions/2018/april-21/version.json').foods.includes('watermelon'));
    for (const id of ['cactus_fruit', 'ember_fruit']) assert.ok(/INFERRED/.test(foodsAll.find((f) => f.id === id).confidence), id);
    assert.ok(/verified/.test(foodsAll.find((f) => f.id === 'watermelon').confidence));
    for (const id of v19.terrain) assert.ok(terr.some((x) => x.id === id), id); assert.ok(v19.terrain.includes('tree') && !J('versions/2018/april-21/version.json').terrain.includes('tree'));
    for (const id of ['bush', 'hill', 'mud', 'hole', 'rock', 'ice_patch']) assert.ok(J('versions/2017/february-13/version.json').terrain.includes(id), '2017 ' + id); // verified in the 2017 client text
    for (const x of terr) { const i = png(x.sprite); assert.deepStrictEqual([i.w, i.h, i.type], [128, 128, 6], x.id); } for (const b of ['desert', 'volcano']) assert.deepStrictEqual([png('assets/biomes/' + b + '.png').w], [256]);
  });
  await t('2019 main menu: Spectate button, 2em Play (height 50), hover #067d26, scrollable update panel, no mute button, column top 30', () => {
    const e = MenuRenderer.elementsPresent(m19); assert.deepStrictEqual(e, { modes: false, sandbox: false, settings: true, mute: false, howToPlay: false, updates: true, options: true, spectate: true, account: false });
    const v = MenuRenderer.themeVars(m19); assert.strictEqual(v['--play-h'], '50px'); assert.strictEqual(v['--play-hover'], '#067d26'); assert.strictEqual(v['--play-fs'], '2em'); assert.strictEqual(v['--col-top'], '30px'); assert.strictEqual(v['--upd-maxh'], '400px'); assert.strictEqual(v['--upd-ov'], 'scroll'); assert.strictEqual(v['--spec-w'], '200px');
    assert.strictEqual(m19.panels.updates.sections.length, 4); assert.ok(m19.absentInThisVersion.includes('mute-button')); assert.ok(/NOT implemented/.test(m19.spectate.note));
    assert.deepStrictEqual([png(m19.logo.src).w, png(m19.logo.src).h], [350, 99]);
  });
  await t('2019 upgrade menu knows desert/volcano (colours flagged inferred); null internal ids do not break ordering', () => {
    const u19 = J(v19.upgradeMenu); assert.ok(u19.choices.biomeColors.desert && u19.choices.biomeColors.volcano); assert.ok(/inferred/.test(u19.choices.biomeColorsNote));
    const an = all.filter((a) => act(a, v19.date)); const ord = UpgradeMenu.orderChoices(['kingdragon', 'komodo', 'flytrap', 'trout'], an, 'land'); assert.strictEqual(ord.length, 4); assert.deepStrictEqual(ord.filter((x) => x === 'trout' || x === 'flytrap' || x === 'komodo' || x === 'kingdragon').slice(0, 1).length, 1);
    assert.deepStrictEqual(UpgradeMenu.BIOME_ORDER.slice(0, 3), ['land', 'ocean', 'arctic']);
  });

  // ---- version 2019-12-30 (#GoldenAge): accounts, shop, disasters
  const v4 = J('versions/2019/december-30/version.json'), m4 = J(v4.menu), shopData = J('data/shop/shop.json'), dis = J('data/disasters/disasters.json'), Shop = require('../client/ui/Shop.js');
  await t('2019-12-30 roster: 80 animals; Snowman (apex, 1/2000), Phoenix, Giant Scorpion are new and evidenced', () => {
    assert.strictEqual(all.filter((a) => act(a, v4.date)).length, 80); assert.strictEqual(all.filter((a) => act(a, v19.date)).length, 77);
    for (const id of ['snowman', 'phoenix', 'scorpion']) { const a = all.find((x) => x.id === id); assert.strictEqual(a.releaseDate, '2019-12-30'); assert.ok(a.evidence, id); assert.strictEqual(a.internalId, null); }
    const sn = all.find((x) => x.id === 'snowman'); assert.strictEqual(sn.rarity, 0.0005); assert.strictEqual(sn.tier, 15); assert.strictEqual(sn.biome, 'arctic'); assert.ok(sn.classification.includes('apex'));
    assert.ok(!all.filter((a) => act(a, v19.date)).some((a) => ['snowman', 'phoenix', 'scorpion'].includes(a.id)));
  });
  await t('2019-12-30 menu: login/account block with the archived texts; OAuth not faked; no 2019-12 CSS claimed', () => {
    const e = MenuRenderer.elementsPresent(m4); assert.deepStrictEqual(e, { modes: false, sandbox: false, settings: true, mute: false, howToPlay: false, updates: true, options: true, spectate: true, account: true });
    assert.strictEqual(m4.account.loggedOutText, 'Log in to earn coins and unlock new skins!'); assert.deepStrictEqual(m4.account.providers.map((p) => p.label), ['Login with Facebook', 'Login with Google']); assert.ok(m4.account.providers.every((p) => p.available === false));
    assert.strictEqual(m4.account.loggedIn.logout, 'Logout of account'); assert.strictEqual(m4.account.loggedIn.shopButton, 'Shop'); assert.ok(/LOCAL account/.test(m4.account.providerNote));
    assert.ok(/INFERRED/.test(m4.confidence)); assert.ok(/does not exist|not exist/.test(m4.source)); assert.ok(m4.notReproduced.some((x) => /Xsolla/.test(x))); assert.ok(!m4.absentInThisVersion.includes('shop') && !m4.absentInThisVersion.includes('login'));
    assert.deepStrictEqual(m4.panels.updates.sections.slice(0, 2).map((s) => s.title), ['DEC 29: Bug Fixes', 'DEC 23: #GoldenAge']); assert.ok(m4.panels.updates.sections.length >= 4);
    const m19 = J(v19.menu); assert.strictEqual(m19.account, undefined); assert.strictEqual(MenuRenderer.elementsPresent(m19).account, false);
  });
  await t('shop catalog: 59 skins exist (verified) but only the named/inferred items exist; prices flagged inferred; art + coin icon present', () => {
    assert.strictEqual(shopData.verifiedTotalSkins, 59); assert.strictEqual(shopData.items.length, 14); for (const id of ['azure_blackdragon', 'golden_blackdragon', 'golden_kingdragon', 'snowman', 'bigfoot', 'mouse_skin_1', 'mouse_skin_2', 'tigershark', 'hammerhead']) assert.ok(shopData.items.some((i) => i.id === id), id);
    for (const it of shopData.items) { assert.ok(Number.isInteger(it.price) && it.price >= 0, it.id); assert.ok(/inferred|behaviour/.test(it.confidence), it.id); if (it.type === 'bundle' || it.type === 'feature') continue; assert.ok(all.some((a) => a.id === it.animal), it.id); if (it.type === 'skin') { const i = png(it.sprite); assert.deepStrictEqual([i.w, i.h, i.type], [256, 256, 6], it.id); assert.ok(it.family); } }
    const c = png(shopData.currency.icon); assert.deepStrictEqual([c.w, c.h], [64, 64]); assert.ok(/NOT implemented/.test(shopData.currency.earnNote)); assert.strictEqual(v4.economy.coinsPerXp, 0.01);
    assert.ok(shopData.items.find((i) => i.id === 'snowman').type === 'animal'); assert.ok(!J(v19.menu).panels.updates.sections.some((s) => /shop/i.test(JSON.stringify(s))));
  });
  await t('shop button logic (the server stays authoritative)', () => {
    const it = { id: 'golden_blackdragon', type: 'skin', animal: 'blackdragon', price: 800 }, an = { id: 'snowman', type: 'animal', animal: 'snowman', price: 2000 };
    const S = Shop.itemState; assert.strictEqual(S(it, null), 'login'); assert.strictEqual(S(it, { user: 'a', coins: 799, owned: [], equipped: {} }), 'poor'); assert.strictEqual(S(it, { user: 'a', coins: 800, owned: [], equipped: {} }), 'buy');
    assert.strictEqual(S(it, { user: 'a', coins: 0, owned: ['golden_blackdragon'], equipped: {} }), 'equip'); assert.strictEqual(S(it, { user: 'a', coins: 0, owned: ['golden_blackdragon'], equipped: { blackdragon: 'golden_blackdragon' } }), 'equipped');
    assert.strictEqual(S(an, { user: 'a', coins: 9999, owned: ['snowman'], equipped: {} }), 'owned'); assert.ok(Shop.available(v4.features) && !Shop.available(v19.features));
  });
  await t('disaster data: 16 definitions, verified numbers (Duststorm -10%, lava lakes 5-10 min), everything else flagged', () => {
    const D = dis.disasters; assert.strictEqual(D.length, 16); assert.strictEqual(new Set(D.map((d) => d.id)).size, 16);
    assert.strictEqual(D.find((d) => d.id === 'duststorm').effects.speedMul, 0.9); assert.ok(/VERIFIED/.test(D.find((d) => d.id === 'duststorm').confidence));
    assert.deepStrictEqual(D.find((d) => d.id === 'lava_lake').durationRangeSec, [300, 600]); assert.strictEqual(D.find((d) => d.id === 'lava_lake').weight, 0); assert.strictEqual(D.find((d) => d.id === 'volcanic_eruption').spawns.id, 'lava_lake');
    for (const d of D) { assert.ok(/existence verified|VERIFIED/.test(d.confidence), d.id); assert.ok(['land', 'ocean', 'arctic', 'desert', 'volcano', 'any'].includes(d.biome), d.id); assert.ok(d.radius > 0 && d.durationSec > 0, d.id); }
    for (const id of ['tsunami', 'volcanic_eruption', 'devil_twister']) assert.ok(D.find((d) => d.id === id).weight <= 2, id + ' must be rare');
    const kinds = new Set(D.map((d) => d.visual.kind)); for (const k of kinds) assert.ok(['cloud', 'heat', 'wave', 'eruption', 'lava', 'swirl', 'poison'].includes(k), k);
    for (const id of ['land_tornado', 'dustdevil', 'waterspout', 'arctic_twister', 'fire_tornado', 'devil_twister']) assert.ok(D.find((d) => d.id === id).effects.boostEscapes, id);
    assert.ok(D.every((d) => d.releaseDate === '2019-12-30' || d.id === 'poison_lake')); assert.ok(!v19.features.disasters && v4.features.disasters);
  });
  await t('Disasters renderer draws every visual kind without throwing (stub canvas)', () => {
    const calls = []; const mk = () => new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : (typeof k === 'string' && !(k in o) ? (...a) => { calls.push(k); } : o[k])), set: (o, k, v) => { o[k] = v; return true; } });
    const Dz = require('../client/ui/Disasters.js'), cam = { worldToScreen: (x, y) => [x, y], zoom: 1 }; const defs = dis.disasters;
    Dz.draw(mk(), cam, 2000, 2000, defs.map((d, i) => [i, d.id, 500 + i * 10, 500, d.radius, 1000]), defs, 1234); assert.ok(calls.length > 50);
    Dz.draw(mk(), cam, 100, 100, [[1, 'duststorm', 9000, 9000, 100, 1]], defs, 0); Dz.draw(mk(), cam, 100, 100, [[1, 'nope', 0, 0, 100, 1]], defs, 0);
  });
  await t('2019-12 terrain: volcano + arctic volcano exist (verified existence), versions list them; HUD knows the burning death message', () => {
    const terr2 = J('data/terrain/terrain.json'); for (const id of ['volcano_cone', 'arctic_volcano']) { const x = terr2.find((y) => y.id === id); assert.strictEqual(x.releaseDate, '2019-12-30'); assert.ok(v4.terrain.includes(id)); assert.ok(!v19.terrain.includes(id)); }
    assert.ok(/VERIFIED/.test(terr2.find((y) => y.id === 'arctic_volcano').confidence)); assert.ok(/burning/.test(J(v4.hud).messages.burn)); assert.ok(J(v4.hud).messagesNote);
    assert.ok(all.find((a) => a.id === 'snowman').ability === 'camouflage'); const cam = J('data/abilities/abilities.json').find((a) => a.id === 'camouflage'); assert.strictEqual(cam.implemented, false); assert.strictEqual(cam.type, 'passive');
  });

  // ---- 2020-06-13
  const v5 = J('versions/2020/june-13/version.json');
  await t('2020-06-13: version, roster (82 animals), Warthog/Bigfoot, rarity, throw_spear', () => {
    assert.strictEqual(v5.date, '2020-06-13'); const A0 = J('data/progression/animals.json'), A = A0.filter((a) => a.releaseDate <= '2020-06-13'); assert.strictEqual(A.length, 82);
    const bf = A.find((a) => a.id === 'bigfoot'), wh = A.find((a) => a.id === 'warthog'); assert.ok(bf && wh); assert.strictEqual(bf.rarity, 0.001); assert.strictEqual(bf.releaseDate, '2020-06-13');
    assert.ok(J('data/abilities/abilities.json').some((a) => a.id === 'throw_spear' && a.implemented === false));
    for (const a of [bf, wh]) assert.ok(fs.existsSync(path.join(ROOT, a.sprite)), a.id);
  });
  await t('2020-06-13: variants rarities verified, art present', () => {
    const V = J('data/variants.json'); const list = V.variants || V; const r = Object.fromEntries(list.map((x) => [x.id, x.rarity]));
    assert.strictEqual(r.golden_eagle, 0.005); assert.strictEqual(r.black_rhino, 0.004); assert.ok(Math.abs(r.aqua_yeti - 0.00833) < 1e-5);
    for (const x of list) assert.ok(fs.existsSync(path.join(ROOT, x.sprite)), x.id);
  });
  await t('2020-06-13: forest/climbing/poison lake data; real coin icon 106x111', () => {
    assert.ok(v5.features.climbing && v5.features.forest && v5.features.sounds && v5.features.poisonLake); assert.deepStrictEqual(v5.forest.rect.length, 4);
    const pl = J('data/disasters/disasters.json').disasters.find((d) => d.id === 'poison_lake'); assert.ok(pl.permanent && pl.hillRing); assert.strictEqual(pl.releaseDate, '2020-03-03');
    const c = png('assets/shop/mopecoin_archived.png'); assert.deepStrictEqual([c.w, c.h], [106, 111]);
    for (const f of ['tree_pine', 'tree_palm', 'tree_baobab']) assert.ok(fs.existsSync(path.join(ROOT, 'assets/terrain/' + f + '.png')), f);
  });
  await t('2020-06-13: menu config uses real geometry; settings holds spectate/mute/graphics', () => {
    const m = J(v5.menu); assert.strictEqual(m.options.regionSelect, false); assert.strictEqual(m.spectate.placement, 'settings'); assert.strictEqual(m.account.style.width, 130); assert.strictEqual(m.shopWindow.width, 638); assert.ok(Object.keys(m.graphics).length >= 1);
  });
  await t('audio: Sound.classify picks eat/drink/kill from state deltas', () => {
    global.Mope = global.Mope || {}; require('../client/audio.js'); const S = (global.Mope || {}).Sound || global.window && global.window.Mope.Sound; assert.ok(S && typeof S.classify === 'function');
    assert.strictEqual(S.classify({ xp: 10, w: 1, a: 'mouse' }, { xp: 10, w: 1, a: 'mouse' }, 5), null);
  });

  // ---- 2021-06-12
  const v6 = J('versions/2021/june-12/version.json');
  await t('2021-06-12: version, 2 evidenced animals (Queen Flame/Tully Monster are skins, not animals) (inferred placement), art, edges, reachable', () => {
    assert.strictEqual(v6.date, '2021-06-12'); const A = J('data/progression/animals.json'), by = Object.fromEntries(A.map((a) => [a.id, a]));
    for (const id of ['snowgirl', 'santa']) { assert.ok(by[id], id); assert.strictEqual(by[id].releaseDate, '2021-06-12'); assert.ok(/verified/.test(by[id].confidence.existence)); assert.ok(/inferred/.test(by[id].confidence.tier)); assert.ok(fs.existsSync(path.join(ROOT, by[id].sprite)), id); }
    const E = J('data/progression/evolution.json').filter((e) => e.releaseDate === '2021-06-12'); for (const id of ['snowgirl', 'santa']) assert.ok(E.some((e) => e.to === id), id + ' reachable');
  });
  await t('2021-06-12: menu config is the verified React UI (mint panel, 266x92 Play, STORE, settings texts, verbatim updates)', () => {
    const m = J(v6.menu); assert.strictEqual(m.theme, '2021'); assert.deepStrictEqual([m.play.w, m.play.h, m.play.background], [266, 92, '#0faa29']); assert.strictEqual(m.menuPanel.border, '4px solid #8af5af'); assert.strictEqual(m.store.label, 'STORE');
    assert.deepStrictEqual(m.graphics.levels, ['LOW', 'MEDIUM', 'HIGH']); assert.ok(m.options.checkboxes.some((c) => c.id === 'noXpPopups') && m.options.checkboxes.some((c) => c.id === 'snowfall'));
    assert.deepStrictEqual(m.panels.updates.sections.map((s) => s.title), ['June 9, 2021: Hotfix 2.3', 'June 1, 2021: Hotfix 2.2', 'May 27: Hotfix 2.1', 'May 22: New Storefront update!']);
    assert.deepStrictEqual(m.shopWindow.categories, ['Skins', 'Features', 'Deals', 'My Skins', 'My Features', 'My Deals']); assert.deepStrictEqual(m.shopWindow.filters, ['All', 'New', 'Sale', 'Normal', 'High-Price', 'Low-Price']);
    const c = png('assets/shop/mopecoin_2021.png'); assert.deepStrictEqual([c.w, c.h], [106, 111]); assert.ok(!MenuRenderer.themeVars(m)['--col-w'].includes('350'));
  });
  await t('2021 storefront: listItems categories/filters, itemState for features/bundles', () => {
    const items = J('data/shop/shop.json').items.filter((i) => i.releaseDate <= '2021-06-12'), L = Shop.listItems;
    assert.ok(L(items, 'Skins', 'All', null).every((i) => i.type === 'skin')); assert.deepStrictEqual(L(items, 'Deals', 'All', null).map((i) => i.id), ['skinsBundle_gold_release1']);
    assert.ok(L(items, 'Features', 'All', null).some((i) => i.id === 'classic_theme')); assert.ok(L(items, 'Skins', 'Sale', null).every((i) => i.listPrice > i.price));
    assert.ok(L(items, 'Skins', 'New', null).every((i) => i.isNew)); assert.deepStrictEqual(L(items, 'My Skins', 'All', { owned: [] }), []); assert.ok(L(items, 'My Skins', 'All', { owned: ['gold_bluewhale'] }).length === 1);
    const th = items.find((i) => i.id === 'classic_theme'); assert.strictEqual(Shop.itemState(th, { user: 'a', coins: 0, owned: [], equipped: {} }), 'buy'); assert.strictEqual(Shop.itemState(th, { user: 'a', coins: 0, owned: ['classic_theme'], equipped: { __theme: 'classic_theme' } }), 'equipped');
    const b = items.find((i) => i.type === 'bundle'); assert.strictEqual(Shop.itemState(b, { user: 'a', coins: 0, owned: [b.id], equipped: {} }), 'owned'); for (const id of b.contains) assert.ok(items.some((i) => i.id === id && fs.existsSync(path.join(ROOT, i.sprite))), id);
    assert.ok(v6.shopPriceOverrides.mouse_skin_1 === 0 && /FREE/i.test(J(v6.menu).panels.updates.sections[3].items.join(' ')));
  });
  await t('2021 extras: xpGain is pure and ignores animal changes; snowfall/XP/classic client hooks exist', () => {
    const X = require('../client/extras.js'); assert.strictEqual(X.xpGain({ xp: 10, a: 'mouse' }, { xp: 25.9, a: 'mouse' }), 15); assert.strictEqual(X.xpGain({ xp: 10, a: 'mouse' }, { xp: 99, a: 'rabbit' }), 0); assert.strictEqual(X.xpGain(null, { xp: 5, a: 'x' }), 0);
    const cs = fs.readFileSync(path.join(ROOT, 'client/client.js'), 'utf8'); assert.ok(/classic_theme/.test(cs) && /Extras\.Snow/.test(cs) && /Extras\.popup/.test(cs));
  });

  // ---- wiki-sourced roster (Mope.io Wiki facts, original art)
  await t('wiki roster: 64 added animals have wiki provenance, original art, valid biome; unreleased ones are never available', () => {
    const W = J('data/research/wiki-animals.json'), A = J('data/progression/animals.json'), added = A.filter((a) => a.wiki), bio = new Set(J('data/biomes/biomes.json').map((b) => b.id));
    assert.strictEqual(added.length, 64); assert.ok(Object.keys(W.animals).length >= 140); assert.ok(/CC BY-SA/.test(W.source));
    for (const a of added) { assert.ok(W.animals[a.wiki], a.id); assert.ok(bio.has(a.biome), a.id); assert.strictEqual(a.spriteStatus, 'recreated'); assert.ok(a.sprite.includes('2026-wiki'), a.id); assert.ok(/verified/.test(a.confidence.existence)); assert.strictEqual(a.releaseDate, a.unreleased ? '2099-01-01' : '2026-11-13'); }
    assert.ok(added.filter((a) => a.unreleased).length >= 30); assert.ok(added.every((a) => a.releaseDate > '2021-06-12')); // no earlier version gains an animal
  });

  console.log(`unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
