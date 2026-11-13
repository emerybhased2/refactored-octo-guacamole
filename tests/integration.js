// End-to-end test against a real server process (Node 22 global WebSocket). Run: node tests/integration.js
const assert = require('assert'), { spawn } = require('child_process'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), PORT = 18081, PORT_DEV = 18082, os = require('os'), fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; } catch (e) { fail++; console.log('FAIL: ' + name + '\n   ' + e.message); } }

function client(port = PORT) {
  const ws = new WebSocket('ws://127.0.0.1:' + port), c = { ws, msgs: [], last: {}, ready: new Promise((r) => (ws.onopen = r)) };
  ws.onmessage = (e) => { const m = JSON.parse(e.data); c.msgs.push(m); c.last[m.t] = m; };
  c.send = (o) => ws.send(JSON.stringify(o));
  c.until = async (type, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = c.msgs.find((x) => x.t === type); if (m) return m; await sleep(25); } throw new Error('timeout waiting for ' + type); };
  return c;
}

(async () => {
  const srv = spawn('java', ['-Dmope.root=' + ROOT, '-jar', path.join(ROOT, 'server/target/mope-server.jar')], { env: Object.assign({}, process.env, { MOPE_PORT: PORT }), stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', (d) => (log += d)); srv.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 100 && !log.includes('listening'); i++) await sleep(100);
  // second server: dev flag on (dev-only messages) + a throwaway database, so shop/disaster flows can be tested without touching the real one
  const dbFile = path.join(os.tmpdir(), 'mope-it-' + process.pid + '.db');
  const srvDev = spawn('java', ['-Dmope.root=' + ROOT, '-jar', path.join(ROOT, 'server/target/mope-server.jar')], { env: Object.assign({}, process.env, { MOPE_PORT: PORT_DEV, MOPE_DEV: '1', MOPE_DB: dbFile }), stdio: ['ignore', 'pipe', 'pipe'] });
  let logDev = ''; srvDev.stdout.on('data', (d) => (logDev += d)); srvDev.stderr.on('data', (d) => (logDev += d));
  for (let i = 0; i < 100 && !logDev.includes('listening'); i++) await sleep(100);
  try {
    const a = client(), b = client(); await a.ready; await b.ready;
    await t('join unknown version -> error', async () => { a.send({ t: 'join', name: 'x', v: '1999-01-01' }); await a.until('error'); });
    await t('join -> welcome with version data', async () => {
      a.send({ t: 'join', name: 'Alice', v: '2017-02-13' }); b.send({ t: 'join', name: '<b>Bob</b>', v: '2017-02-13' });
      const wa = await a.until('welcome'), wb = await b.until('welcome');
      assert.notStrictEqual(wa.id, wb.id); assert.strictEqual(wa.version.animals.length, 44); assert.strictEqual(wa.version.startAnimal, 'mouse'); assert.strictEqual(wa.mode, 'normal'); assert.ok(wa.lakes.length > 0);
      assert.ok(wa.version.abilities.some((x) => x.id === 'extra_boost' && x.icon)); assert.ok(wa.version.upgradeMenu.choices && wa.version.hud.xpBar && wa.version.features.chat);
    });
    await t('snapshots stream to both clients in sync', async () => {
      const sa = await a.until('snap'), sb = await b.until('snap'); await sleep(600);
      const la = a.last.snap, lb = b.last.snap; assert.ok(Math.abs(la.k - lb.k) <= 30, 'tick drift ' + (la.k - lb.k)); assert.ok(la.f.length > 0, 'no food visible');
      assert.strictEqual(la.you.a, 'mouse'); assert.ok(la.lb.length > 0); assert.ok(la.you.w > 0 && la.n > 30);
    });
    await t('input moves the player (server-side movement)', async () => {
      const s0 = a.last.snap.you; a.send({ t: 'input', a: 0, m: 1 }); await sleep(800); const s1 = a.last.snap.you;
      assert.ok(s1.x - s0.x > 80 || s1.x >= 5980, `moved ${s1.x - s0.x}`);
    });
    await t('server rejects evolution without xp', async () => {
      a.send({ t: 'evolve', id: 'rabbit' }); a.send({ t: 'evolve', id: 'bear' }); await sleep(400); assert.strictEqual(a.last.snap.you.a, 'mouse');
    });
    await t('chat is relayed (and rate limited) by the server', async () => {
      a.send({ t: 'chat', m: 'hello <b>there</b>' }); a.send({ t: 'chat', m: 'spam' }); const m = await a.until('chat'); await sleep(300);
      assert.strictEqual(m.m, 'hello bthere/b'); /* server strips < and > */ assert.strictEqual(a.msgs.filter((x) => x.t === 'chat').length, 1);
    });
    await t('sandbox mode: separate world, arrow stepping wraps to top tier', async () => {
      const s = client(); await s.ready; s.send({ t: 'join', name: 'Sbx', v: '2017-02-13', mode: 'sandbox' }); const w = await s.until('welcome'); assert.strictEqual(w.mode, 'sandbox');
      await s.until('snap'); assert.deepStrictEqual(s.last.snap.you.ev, []); s.send({ t: 'sandbox', d: -1 }); await sleep(400);
      const top = w.version.animals.find((x) => x.id === s.last.snap.you.a); assert.strictEqual(top.tier, 16); assert.ok(s.last.snap.n < 5, 'sandbox has no bots'); s.ws.close();
    });
    await t('version 2018-04-21: 61 animals, normal mode only (sandbox request ignored), 2018 abilities', async () => {
      const c = client(); await c.ready; c.send({ t: 'join', name: 'Y2018', v: '2018-04-21', mode: 'sandbox' }); const w = await c.until('welcome');
      assert.strictEqual(w.version.animals.length, 61); assert.deepStrictEqual(w.version.modes, ['normal']); assert.strictEqual(w.mode, 'normal');
      assert.ok(w.version.abilities.some((x) => x.id === 'venom_spit')); assert.ok(w.version.animals.some((x) => x.id === 'tiger'));
      await c.until('snap'); assert.ok(c.last.snap.n >= 25); c.ws.close();
    });
    await t('version 2019-08-25: 77 animals, 5 biomes, 18 tiers, terrain + desert lakes in the welcome, spectate is a menu button only', async () => {
      const c = client(); await c.ready; c.send({ t: 'join', name: 'Y2019', v: '2019-08-25', mode: 'sandbox' }); const w = await c.until('welcome');
      assert.strictEqual(w.version.animals.length, 77); assert.deepStrictEqual(w.version.biomes.map((b) => b.id), ['land', 'ocean', 'arctic', 'desert', 'volcano']); assert.strictEqual(w.version.tiers.length, 18);
      assert.strictEqual(w.version.tiers[17].name, 'King Dragon'); assert.strictEqual(w.version.animals.find((x) => x.id === 'kingdragon').xpRequired, 100000000); assert.strictEqual(w.mode, 'normal');
      assert.ok(w.terrain.length > 50 && w.version.terrain.some((x) => x.id === 'tree') && w.lakes.length > 8); assert.ok(w.version.foods.some((f) => f.id === 'watermelon'));
      await c.until('snap'); assert.ok(c.last.snap.n >= 30); c.ws.close();
    });
    await t('2017 build still serves 44 animals and no 2018 abilities', async () => {
      const c = client(); await c.ready; c.send({ t: 'join', name: 'Y2017', v: '2017-02-13' }); const w = await c.until('welcome');
      assert.strictEqual(w.version.animals.length, 44); assert.ok(!w.version.abilities.some((x) => x.id === 'venom_spit')); c.ws.close();
    });
    await t('spectate (2019): welcome without a body, snapshots name the followed player, next cycles, leave stops them', async () => {
      const c = client(); await c.ready; c.send({ t: 'join', name: 'Watcher', v: '2019-08-25', mode: 'spectate' }); const w = await c.until('welcome');
      assert.strictEqual(w.mode, 'spectate'); assert.strictEqual(w.id, -1); const s1 = await c.until('snap'); assert.ok(s1.spec && s1.spec.length > 0); assert.ok(s1.p.length > 0 && s1.n >= 30);
      const first = s1.spec; let changed = false; for (let i = 0; i < 4 && !changed; i++) { c.send({ t: 'spectate-next' }); await sleep(350); changed = c.last.snap.spec !== first; } assert.ok(changed, 'target did not change');
      c.send({ t: 'input', a: 0, m: 1 }); await sleep(200); c.send({ t: 'leave' }); await sleep(300); const n = c.msgs.length; await sleep(600); assert.strictEqual(c.msgs.length, n, 'snapshots continued after leave'); c.ws.close();
    });
    await t('spectate is not offered in 2018 or 2017: falls back to a normal join', async () => {
      for (const v of ['2018-04-21', '2017-02-13']) { const c = client(); await c.ready; c.send({ t: 'join', name: 'NoSpec', v, mode: 'spectate' }); const w = await c.until('welcome'); assert.strictEqual(w.mode, 'normal', v); assert.ok(w.id > 0); c.ws.close(); }
    });
    await t('1v1 arena (2019, inferred rules): small land-only world, waiting then a bot opponent after ~4s, fighters visible', async () => {
      const c = client(); await c.ready; c.send({ t: 'join', name: 'Duelist', v: '2019-08-25', mode: 'arena', animal: 'lion' }); const w = await c.until('welcome');
      assert.strictEqual(w.mode, 'arena'); assert.strictEqual(w.version.worldSize, 1600); assert.deepStrictEqual(w.version.biomes.map((b) => b.id), ['land']); assert.strictEqual(w.terrain.length, 0); assert.strictEqual(w.lakes.length, 0);
      const s1 = await c.until('snap'); assert.strictEqual(s1.arena, 'waiting'); assert.strictEqual(s1.you.a, 'lion'); assert.strictEqual(s1.f.length, 0);
      let fight = null; for (let i = 0; i < 80 && !fight; i++) { await sleep(100); if (c.last.snap.arena === 'fight') fight = c.last.snap; } assert.ok(fight, 'no bot opponent arrived'); assert.ok(fight.p.length >= 2, 'opponent not visible');
      c.ws.close();
    });
    await t('arena is not offered in 2018: falls back to a normal join', async () => { const c = client(); await c.ready; c.send({ t: 'join', name: 'NoArena', v: '2018-04-21', mode: 'arena' }); const w = await c.until('welcome'); assert.strictEqual(w.mode, 'normal'); c.ws.close(); });
    await t('ping/pong', async () => { b.send({ t: 'ping', ts: 5 }); await b.until('pong'); });
    await t('malformed/oversized messages are ignored', async () => {
      a.ws.send('not json'); a.ws.send('x'.repeat(5000)); a.ws.send(JSON.stringify({ t: 'input', a: 'NaN', m: {} })); await sleep(300); assert.ok(a.ws.readyState === 1);
    });
    await t('accounts unavailable in 2017 build', async () => { a.send({ t: 'register', v: '2017-02-13', u: 'carol', p: 'secret12' }); const m = await a.until('auth'); assert.strictEqual(m.ok, false); });
    await t('disconnect and reconnect rejoin', async () => { b.ws.close(); await sleep(200); const b2 = client(); await b2.ready; b2.send({ t: 'join', name: 'Bob2', v: '2017-02-13' }); await b2.until('welcome'); await b2.until('snap'); b2.ws.close(); });
    // ---------- version 2019-12-30: accounts, shop, disasters ----------
    const uniq = () => 'u' + Math.random().toString(36).slice(2, 9);
    const login = async (port, v = '2019-12-30') => { const c = client(port); await c.ready; const u = uniq(); c.send({ t: 'register', v, u, p: 'secret12' }); const r = await c.until('auth'); assert.strictEqual(r.ok, true, 'register failed'); c.user = u; c.token = r.token; c.auth = r; return c; };
    await t('2019-12-30 welcome carries the shop catalog and disaster definitions; 2019-08-25 does not', async () => {
      const c = client(); await c.ready; c.send({ t: 'join', name: 'V4', v: '2019-12-30' }); const w = await c.until('welcome');
      assert.strictEqual(w.version.animals.length, 80); assert.strictEqual(w.version.shop.items.length, 4); assert.strictEqual(w.version.shop.currency.id, 'coin'); assert.strictEqual(w.version.disasterDefs.length, 15); assert.ok(w.version.features.shop && w.version.features.disasters && w.version.features.accounts);
      const c2 = client(); await c2.ready; c2.send({ t: 'join', name: 'V3', v: '2019-08-25' }); const w2 = await c2.until('welcome'); assert.strictEqual(w2.version.shop, undefined); assert.strictEqual(w2.version.disasterDefs, undefined); c.ws.close(); c2.ws.close();
    });
    await t('normal server: dev-only commands (dev-coins, dev-disaster) are ignored', async () => {
      const c = await login(PORT); assert.strictEqual(c.auth.coins, 0); c.send({ t: 'join', name: 'Cheater', v: '2019-12-30' }); await c.until('welcome');
      c.send({ t: 'dev-coins', n: 99999 }); c.send({ t: 'dev-disaster', id: 'rainstorm' }); await sleep(700); c.send({ t: 'shop-info', v: '2019-12-30' }); const s = await c.until('shop');
      assert.strictEqual(s.coins, 0); assert.ok(!c.msgs.some((m) => m.t === 'disaster'), 'a normal player triggered a disaster'); c.ws.close();
    });
    await t('shop requires login and a version that has a shop', async () => {
      const c = client(PORT_DEV); await c.ready; c.send({ t: 'shop-info', v: '2019-12-30' }); const e1 = await c.until('shop-error'); assert.ok(/log in/.test(e1.err));
      const d = await login(PORT_DEV, '2018-04-21').catch((e) => e.message); assert.ok(typeof d === 'string', 'accounts must be unavailable in 2018'); c.ws.close();
    });
    await t('economy end to end: dev coins, buy, double-buy rejected, insufficient rejected, equip/unequip ownership rules', async () => {
      const c = await login(PORT_DEV); const msg = async (o, type = 'shop') => { const n = c.msgs.length; c.send(Object.assign({ v: '2019-12-30' }, o)); const t0 = Date.now(); while (Date.now() - t0 < 3000) { const m = c.msgs.slice(n).find((x) => x.t === type || x.t === 'shop-error'); if (m) return m; await sleep(20); } throw new Error('no reply to ' + JSON.stringify(o)); };
      let r = await msg({ t: 'buy', item: 'snowman' }); assert.strictEqual(r.t, 'shop-error'); // 0 coins
      r = await msg({ t: 'dev-coins', n: 3000 }); assert.strictEqual(r.coins, 3000);
      r = await msg({ t: 'buy', item: 'snowman' }); assert.deepStrictEqual([r.t, r.coins, r.owned.includes('snowman')], ['shop', 1000, true]);
      r = await msg({ t: 'buy', item: 'snowman' }); assert.strictEqual(r.t, 'shop-error'); // already owned
      r = await msg({ t: 'buy', item: 'golden_kingdragon' }); assert.strictEqual(r.t, 'shop-error'); // 1500 > 1000
      r = await msg({ t: 'equip', item: 'golden_blackdragon' }); assert.strictEqual(r.t, 'shop-error'); // not owned
      r = await msg({ t: 'buy', item: 'golden_blackdragon' }); assert.deepStrictEqual([r.t, r.coins], ['shop', 200]);
      r = await msg({ t: 'equip', item: 'golden_blackdragon' }); assert.strictEqual(r.equipped.blackdragon, 'golden_blackdragon');
      r = await msg({ t: 'equip', item: 'snowman' }); assert.strictEqual(r.t, 'shop-error'); // animals are unlocks, not skins
      r = await msg({ t: 'buy', item: 'no_such_item' }); assert.strictEqual(r.t, 'shop-error');
      r = await msg({ t: 'unequip', animal: 'blackdragon' }); assert.deepStrictEqual(r.equipped, {}); assert.ok(r.owned.includes('golden_blackdragon')); c.ws.close();
    });
    await t('2021 storefront: free skin, bundle grants contents atomically, classic theme equips as a feature', async () => {
      const c = await login(PORT_DEV, '2021-06-12'); const msg = async (m) => { const n = c.msgs.length; c.send(Object.assign({ v: '2021-06-12' }, m)); const t0 = Date.now(); while (Date.now() - t0 < 4000) { const r = c.msgs.slice(n).find((x) => x.t === 'shop' || x.t === 'shop-error'); if (r) return r; await sleep(30); } throw new Error('no reply'); };
      let r = await msg({ t: 'buy', item: 'mouse_skin_1' }); assert.deepStrictEqual([r.t, r.coins, r.owned.includes('mouse_skin_1')], ['shop', 0, true]); // free in 2021
      r = await msg({ t: 'buy', item: 'skinsBundle_gold_release1' }); assert.strictEqual(r.t, 'shop-error'); // no coins
      await msg({ t: 'dev-coins', n: 2500 }).catch(() => null);
      r = await msg({ t: 'buy', item: 'skinsBundle_gold_release1' }); assert.deepStrictEqual([r.t, r.coins], ['shop', 500]); for (const id of ['gold_bluewhale', 'gold_blackwidow', 'gold_cassowary', 'skinsBundle_gold_release1']) assert.ok(r.owned.includes(id), id);
      r = await msg({ t: 'buy', item: 'skinsBundle_gold_release1' }); assert.strictEqual(r.t, 'shop-error'); // already owned
      r = await msg({ t: 'buy', item: 'classic_theme' }); assert.strictEqual(r.t, 'shop'); r = await msg({ t: 'equip', item: 'classic_theme' }); assert.strictEqual(r.equipped.__theme, 'classic_theme');
      r = await msg({ t: 'unequip', animal: '__theme' }); assert.ok(!r.equipped.__theme); c.ws.close();
    });
    await t('sessions: resume restores coins/inventory; logout invalidates the token', async () => {
      const c = await login(PORT_DEV); c.send({ t: 'dev-coins', v: '2019-12-30', n: 500 }); await c.until('shop'); c.ws.close();
      const c2 = client(PORT_DEV); await c2.ready; c2.send({ t: 'resume', v: '2019-12-30', token: c.token }); const r = await c2.until('auth'); assert.deepStrictEqual([r.ok, r.user, r.coins], [true, c.user, 500]);
      c2.send({ t: 'logout', token: c.token }); await sleep(200); const c3 = client(PORT_DEV); await c3.ready; c3.send({ t: 'resume', v: '2019-12-30', token: c.token }); const r3 = await c3.until('auth'); assert.strictEqual(r3.ok, false); c2.ws.close(); c3.ws.close();
    });
    await t('passwords/tokens are never echoed; wrong password is rejected', async () => {
      const c = await login(PORT_DEV); assert.ok(!JSON.stringify(c.auth).includes('secret12')); assert.ok(!('hash' in c.auth) && !('salt' in c.auth));
      const w = client(PORT_DEV); await w.ready; w.send({ t: 'login', v: '2019-12-30', u: c.user, p: 'wrong-pass' }); const r = await w.until('auth'); assert.strictEqual(r.ok, false); assert.ok(!('token' in r)); w.ws.close(); c.ws.close();
    });
    await t('dev server: a disaster is announced to players in the world', async () => {
      const c = client(PORT_DEV); await c.ready; c.send({ t: 'join', name: 'Storm', v: '2019-12-30' }); await c.until('welcome');
      c.send({ t: 'dev-disaster', id: 'rainstorm' }); const m = await c.until('disaster'); assert.deepStrictEqual([m.id, m.name], ['rainstorm', 'Rainstorm']);
      const n = c.msgs.filter((x) => x.t === 'disaster').length; c.send({ t: 'dev-disaster', id: 'meteor' }); await sleep(400); assert.strictEqual(c.msgs.filter((x) => x.t === 'disaster').length, n, 'unknown disaster id was accepted'); c.ws.close();
    });
    a.ws.close();
  } finally { srv.kill('SIGTERM'); srvDev.kill('SIGTERM'); try { fs.unlinkSync(dbFile); } catch (e) {} }
  console.log(`integration: ${pass} passed, ${fail} failed`); if (fail) console.log(log.slice(-1500)); process.exit(fail ? 1 : 0);
})();
