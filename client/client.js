/* Client orchestration: menu -> join -> play loop. Authoritative state lives on the server; the client predicts only its own movement. */
(function () {
  const M = window.Mope, $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search), DEV = params.get('dev') === '1';
  const serverUrl = params.get('server') || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':8081');

  const renderer = new M.Renderer($('game')); renderer.resize();
  const camera = new M.Camera(), input = new M.Input($('game')), interp = new M.Interpolator(100);
  const net = new M.Net(serverUrl);
  let mode = 'menu', V = null, you = null, foods = [], lb = [], players = [], pred = null, myName = '', pendingJoin = null, selectedVersion = null;
  let fps = 0, frames = 0, fpsT = performance.now(), lastInputSent = 0, lastSent = '', lastFrame = performance.now(), dbg = { fps: 0, ping: 0, kbps: 0, mem: '-' }, lastBytes = 0;
  const upgrade = new M.UpgradeMenu((id) => net.send({ t: 'evolve', id }));

  const menu = new M.MainMenu({ canvas: $('menuBg'), root: $('menuUI'), nickEl: $('nick'), playEl: $('play'), onPlay: (name) => startJoin(name) });

  async function loadVersion(id) {
    selectedVersion = id;
    const cfg = await M.MenuVersionManager.select(id);
    const vinfo = M.MenuVersionManager.current;
    // Menu animation needs animal defs for that version (static data filtered by the version's roster).
    menu.setConfig(cfg, vinfo.animalDefs || []);
    if ($('versionLabel')) $('versionLabel').textContent = vinfo.label;
  }

  function startJoin(name) {
    myName = name; pendingJoin = { t: 'join', name, v: selectedVersion };
    $('status').textContent = 'Connecting...';
    if (net.open) { net.send(pendingJoin); } else if (!net.wantOpen) net.connect();
  }

  net.on('open', () => { $('status').textContent = ''; if (pendingJoin) net.send(pendingJoin); });
  net.on('close', () => { if (mode === 'play') { $('status').textContent = 'Connection lost - reconnecting...'; } else if (pendingJoin) $('status').textContent = 'Cannot reach server (' + serverUrl + ')'; });
  net.on('welcome', (m) => {
    V = m.version; mode = 'play'; you = { id: m.id, x: 0, y: 0, xp: 0, hp: 100, a: V.animals[0].id, ev: [], cd: 0 };
    upgrade.setVersion(V); menu.hide(); $('death').style.display = 'none'; $('status').textContent = ''; interp.snaps.length = 0; pred = null;
    input.on(V.upgradeMenu.toggleKey, () => { if (mode === 'play') upgrade.toggle(); });
  });
  net.on('snap', (m) => {
    if (mode !== 'play') return;
    you = Object.assign({ id: you.id }, m.you, { id: you.id });
    const ents = m.p.map((p) => ({ id: p[0], x: p[1], y: p[2], ai: p[3], angle: p[4], hp: p[5], name: p[6] }));
    interp.push(performance.now(), ents); foods = m.f; lb = m.lb;
    if (!pred) { pred = { id: you.id, x: you.x, y: you.y, ai: V.animals.findIndex((a) => a.id === you.a), angle: 0, hp: you.hp, name: myName || 'Mope' }; camera.snap(you.x, you.y); }
    pred.ai = V.animals.findIndex((a) => a.id === you.a); pred.hp = Math.round(100 * you.hp / V.animals[pred.ai].health);
    pred.serverX = you.x; pred.serverY = you.y;
  });
  net.on('died', (m) => {
    mode = 'dead'; pendingJoin = null;
    $('deathText').textContent = 'You were eaten by ' + m.by + '! Final XP: ' + m.xp;
    $('death').style.display = 'flex'; upgrade.open = false;
  });
  net.on('error', (m) => { $('status').textContent = m.err; });
  $('respawn').addEventListener('click', () => { $('death').style.display = 'none'; mode = 'menu'; menu.show(); });
  input.on(' ', (e) => { e.preventDefault(); net.send({ t: 'ability' }); });
  $('game').addEventListener('mousemove', (e) => upgrade.mouse(e.clientX, e.clientY));
  $('game').addEventListener('mousedown', (e) => { if (mode === 'play') upgrade.click(e.clientX, e.clientY, renderer.vw, renderer.vh, you); });
  $('game').addEventListener('wheel', (e) => upgrade.wheel(e.deltaY), { passive: true });

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - lastFrame) / 1000); lastFrame = t;
    frames++; if (t - fpsT >= 1000) { fps = frames; frames = 0; fpsT = t; dbg.fps = fps; dbg.ping = net.ping; dbg.kbps = ((net.bytesIn - lastBytes) / 1024).toFixed(1); lastBytes = net.bytesIn; dbg.mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : 'n/a'; }
    if (mode !== 'play' && mode !== 'dead') return;
    if (!V || !you || !pred) return;
    renderer.begin();
    const inp = input.current(renderer.vw, renderer.vh);
    if (mode === 'play' && !upgrade.open) {
      const key = inp.angle.toFixed(2) + ':' + inp.mag.toFixed(2);
      if ((key !== lastSent && t - lastInputSent > 50) || t - lastInputSent > 500) { net.send({ t: 'input', a: +inp.angle.toFixed(3), m: +inp.mag.toFixed(3) }); lastSent = key; lastInputSent = t; }
      // client-side prediction of our own movement (server remains authoritative; we ease toward its position)
      const a = V.animals[pred.ai], sp = 220 * a.speed * inp.mag; if (inp.mag > 0.05) pred.angle = inp.angle;
      pred.x += Math.cos(inp.angle) * sp * dt; pred.y += Math.sin(inp.angle) * sp * dt;
    }
    const k = 1 - Math.exp(-dt * 6); pred.x += (pred.serverX - pred.x) * k; pred.y += (pred.serverY - pred.y) * k;
    const tier = V.animals[pred.ai].tier; camera.follow(pred.x, pred.y, tier, dt);
    renderer.drawWorld(camera, V, interp.sample(performance.now()), foods, you.id, pred);
    const ctx = renderer.ctx;
    M.HUD.draw(ctx, renderer.vw, renderer.vh, V, you, V.animals[pred.ai], lb, DEV ? dbg : null);
    upgrade.draw(ctx, renderer.vw, renderer.vh, you, t);
  }

  addEventListener('resize', () => { renderer.resize(); menu.layout(); });

  (async function boot() {
    try {
      const list = await M.MenuVersionManager.init();
      if (DEV) {
        const sel = $('versionSelect'); $('devbar').style.display = 'flex';
        for (const v of list) sel.add(new Option(v.date + ' - ' + v.label, v.id));
        sel.onchange = () => loadVersion(sel.value);
      }
      const want = params.get('v'); const id = list.find((v) => v.id === want) ? want : list[0].id;
      if (DEV) $('versionSelect').value = id;
      await loadVersion(id); menu.show(); requestAnimationFrame(frame);
    } catch (e) { $('status').textContent = 'Failed to load: ' + e.message; console.error(e); }
  })();
  window.__mope = { net, get state() { return { mode, you, V }; } }; // debugging / automated tests
})();
