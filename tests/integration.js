// End-to-end test against a real server process (Node 22 global WebSocket). Run: node tests/integration.js
const assert = require('assert'), { spawn } = require('child_process'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), PORT = 18081;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; } catch (e) { fail++; console.log('FAIL: ' + name + '\n   ' + e.message); } }

function client() {
  const ws = new WebSocket('ws://127.0.0.1:' + PORT), c = { ws, msgs: [], last: {}, ready: new Promise((r) => (ws.onopen = r)) };
  ws.onmessage = (e) => { const m = JSON.parse(e.data); c.msgs.push(m); c.last[m.t] = m; };
  c.send = (o) => ws.send(JSON.stringify(o));
  c.until = async (type, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = c.msgs.find((x) => x.t === type); if (m) return m; await sleep(25); } throw new Error('timeout waiting for ' + type); };
  return c;
}

(async () => {
  const srv = spawn('java', ['-Dmope.root=' + ROOT, '-jar', path.join(ROOT, 'server/target/mope-server.jar')], { env: Object.assign({}, process.env, { MOPE_PORT: PORT }), stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', (d) => (log += d)); srv.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 100 && !log.includes('listening'); i++) await sleep(100);
  try {
    const a = client(), b = client(); await a.ready; await b.ready;
    await t('join unknown version -> error', async () => { a.send({ t: 'join', name: 'x', v: '1999-01-01' }); await a.until('error'); });
    await t('join -> welcome with version data', async () => {
      a.send({ t: 'join', name: 'Alice', v: '2017-04-07' }); b.send({ t: 'join', name: '<b>Bob</b>', v: '2017-04-07' });
      const wa = await a.until('welcome'), wb = await b.until('welcome');
      assert.notStrictEqual(wa.id, wb.id); assert.strictEqual(wa.version.animals.length, 6); assert.strictEqual(wa.version.animals[0].id, 'mouse');
      assert.ok(wa.version.upgradeMenu.card && wa.version.hud.xpBar);
    });
    await t('snapshots stream to both clients in sync', async () => {
      const sa = await a.until('snap'), sb = await b.until('snap'); await sleep(600);
      const la = a.last.snap, lb = b.last.snap; assert.ok(Math.abs(la.k - lb.k) <= 30, 'tick drift ' + (la.k - lb.k)); assert.ok(la.f.length > 0, 'no food visible');
      assert.strictEqual(la.you.a, 'mouse'); assert.ok(la.lb.length > 0);
    });
    await t('input moves the player (server-side movement)', async () => {
      const s0 = a.last.snap.you; a.send({ t: 'input', a: 0, m: 1 }); await sleep(800); const s1 = a.last.snap.you;
      assert.ok(s1.x - s0.x > 80 || s1.x >= 3980, `moved ${s1.x - s0.x}`);
    });
    await t('server rejects evolution without xp', async () => {
      a.send({ t: 'evolve', id: 'rabbit' }); a.send({ t: 'evolve', id: 'bear' }); await sleep(400); assert.strictEqual(a.last.snap.you.a, 'mouse');
    });
    await t('ping/pong', async () => { b.send({ t: 'ping', ts: 5 }); await b.until('pong'); });
    await t('malformed/oversized messages are ignored', async () => {
      a.ws.send('not json'); a.ws.send('x'.repeat(5000)); a.ws.send(JSON.stringify({ t: 'input', a: 'NaN', m: {} })); await sleep(300); assert.ok(a.ws.readyState === 1);
    });
    await t('accounts unavailable in 2017 build', async () => { a.send({ t: 'register', v: '2017-04-07', u: 'carol', p: 'secret12' }); const m = await a.until('auth'); assert.strictEqual(m.ok, false); });
    await t('disconnect and reconnect rejoin', async () => { b.ws.close(); await sleep(200); const b2 = client(); await b2.ready; b2.send({ t: 'join', name: 'Bob2', v: '2017-04-07' }); await b2.until('welcome'); await b2.until('snap'); b2.ws.close(); });
    a.ws.close();
  } finally { srv.kill('SIGTERM'); }
  console.log(`integration: ${pass} passed, ${fail} failed`); if (fail) console.log(log.slice(-1500)); process.exit(fail ? 1 : 0);
})();
