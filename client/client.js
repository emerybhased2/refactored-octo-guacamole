/* Client orchestration: menu -> join -> play loop. Authoritative state lives on the server; the client predicts only its own movement. */
(function () {
  const M = window.Mope, $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search), DEV = params.get('dev') === '1';
  const serverUrl = params.get('server') || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':8081');

  const renderer = new M.Renderer($('gCanvas')); renderer.resize();
  const camera = new M.Camera(), input = new M.Input($('gCanvas')), interp = new M.Interpolator(100), net = new M.Net(serverUrl);
  let mode = 'menu', V = null, you = null, lakes = [], terrain = [], foods = [], lb = [], count = 0, pred = null, selectedVersion = null, lastJoin = null, wantJoin = false, boost = false;
  const chats = new Map();
  let frames = 0, fpsT = performance.now(), lastInputSent = 0, lastSent = '', lastFrame = performance.now(), dbg = { fps: 0, ping: 0, kbps: 0, mem: '-' }, lastBytes = 0;
  const upgrade = new M.UpgradeMenu((id) => net.send({ t: 'evolve', id }), DEV);
  const menu = new M.MainMenu({ onPlay: (name, m) => startJoin(name, m) });
  const setStatus = (t) => ($('status').textContent = t || '');
  const connecting = (on) => ($('connecting').style.display = on ? 'block' : 'none');

  async function loadVersion(id) {
    selectedVersion = id; const cfg = await M.MenuVersionManager.select(id);
    menu.setConfig(cfg); if ($('versionLabel')) $('versionLabel').textContent = M.MenuVersionManager.current.label;
  }
  function startJoin(name, m) {
    lastJoin = { t: 'join', name, v: selectedVersion, mode: m }; wantJoin = true; connecting(true); setStatus('');
    if (net.open) net.send(lastJoin); else if (!net.wantOpen) net.connect();
  }
  net.on('open', () => { if (wantJoin && lastJoin) net.send(lastJoin); });
  net.on('close', () => { if (mode === 'play') { setStatus('Connection lost - reconnecting...'); } else if (wantJoin) { connecting(false); setStatus('Cannot reach server (' + serverUrl + ')'); } });
  net.on('welcome', (m) => {
    V = m.version; V.__sandbox = m.mode === 'sandbox'; lakes = m.lakes || []; terrain = m.terrain || []; mode = 'play'; chats.clear();
    you = { id: m.id, x: 0, y: 0, xp: 0, hp: 100, w: 100, a: V.startAnimal, ev: [], cd: 0 };
    upgrade.setVersion(V); menu.hide(); connecting(false); setStatus(''); $('deathMsg').style.display = 'none'; interp.snaps.length = 0; pred = null;
  });
  net.on('snap', (m) => {
    if (mode !== 'play') return;
    you = Object.assign({}, m.you); count = m.n;
    interp.push(performance.now(), m.p.map((p) => ({ id: p[0], x: p[1], y: p[2], ai: p[3], angle: p[4], hp: p[5], name: p[6] }))); foods = m.f; lb = m.lb;
    const ai = V.animals.findIndex((a) => a.id === you.a);
    if (!pred) { pred = { id: you.id, x: you.x, y: you.y, ai, angle: 0, hp: 100, name: lastJoin.name || 'Mope', serverX: you.x, serverY: you.y }; camera.snap(you.x, you.y); }
    if (Math.hypot(you.x - pred.serverX, you.y - pred.serverY) > 600) { pred.x = you.x; pred.y = you.y; camera.snap(you.x, you.y); } // teleport (biome change / respawn)
    pred.ai = ai; pred.hp = Math.round(100 * you.hp / V.animals[ai].health); pred.serverX = you.x; pred.serverY = you.y;
  });
  net.on('chat', (m) => { if (V) chats.set(m.id, { text: m.m, until: performance.now() + 5000 }); });
  net.on('died', (m) => {
    mode = 'dead'; wantJoin = false; const msgs = V.hud.messages;
    $('deathMsg').textContent = (m.r === 4 ? msgs.thirst : msgs.eaten) + '\nFinal XP: ' + m.xp + (m.r === 1 ? '  (eaten by ' + m.by + ')' : ''); $('deathMsg').style.display = 'block';
    setTimeout(() => { if (mode !== 'dead') return; $('deathMsg').style.display = 'none'; mode = 'menu'; menu.show(); }, 2500);
  });
  net.on('error', (m) => { connecting(false); setStatus(m.err); });

  // ---- controls
  const feature = (f) => V && V.features && V.features[f];
  const chatEl = $('chatinput');
  function openChat() { chatEl.style.visibility = 'visible'; chatEl.value = ''; chatEl.focus(); }
  function closeChat(send) { const t = chatEl.value.trim(); chatEl.style.visibility = 'hidden'; chatEl.blur(); if (send && t) net.send({ t: 'chat', m: t }); $('gCanvas').focus(); }
  chatEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { closeChat(true); e.preventDefault(); } else if (e.key === 'Escape') closeChat(false); e.stopPropagation(); });
  input.on('enter', () => { if (mode !== 'play') return; if (upgrade.takeFirst(you)) return; if (feature('chat') && !menu.options.noNames) openChat(); });
  input.on('w', () => { if (mode === 'play') net.send({ t: 'ability' }); });
  input.on('arrowup', (e) => { if (mode === 'play' && V.__sandbox) { net.send({ t: 'sandbox', d: 1 }); e.preventDefault(); } });
  input.on('arrowdown', (e) => { if (mode === 'play' && V.__sandbox) { net.send({ t: 'sandbox', d: -1 }); e.preventDefault(); } });
  input.on('u', () => { if (mode === 'play') upgrade.toggleTree(); });
  $('gCanvas').addEventListener('mousemove', (e) => upgrade.mouse(e.clientX, e.clientY));
  $('gCanvas').addEventListener('mousedown', (e) => { if (e.button !== 0 || mode !== 'play') return; if (!upgrade.click(e.clientX, e.clientY, renderer.vw, renderer.vh, you)) boost = true; });
  addEventListener('mouseup', () => (boost = false));
  $('gCanvas').addEventListener('wheel', (e) => upgrade.wheel(e.deltaY), { passive: true });
  $('gCanvas').addEventListener('contextmenu', (e) => e.preventDefault());

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - lastFrame) / 1000); lastFrame = t;
    frames++; if (t - fpsT >= 1000) { dbg.fps = frames; frames = 0; fpsT = t; dbg.ping = net.ping; dbg.kbps = ((net.bytesIn - lastBytes) / 1024).toFixed(1); lastBytes = net.bytesIn; dbg.mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : 'n/a'; }
    renderer.begin(); renderer.opts = { lowGraphics: menu.options.lowGraphics, noImages: menu.options.noImages, noNames: menu.options.noNames };
    if (mode === 'menu' || !V || !you || !pred) { renderer.ctx.fillStyle = getComputedStyle(document.body).backgroundColor; renderer.ctx.fillRect(0, 0, renderer.vw, renderer.vh); return; }
    const inp = input.current(renderer.vw, renderer.vh);
    if (mode === 'play') {
      const b = boost ? 1 : 0, key = inp.angle.toFixed(2) + ':' + inp.mag.toFixed(2) + ':' + b;
      if ((key !== lastSent && t - lastInputSent > 50) || t - lastInputSent > 500) { net.send({ t: 'input', a: +inp.angle.toFixed(3), m: +inp.mag.toFixed(3), b }); lastSent = key; lastInputSent = t; }
      const a = V.animals[pred.ai], sp = 220 * a.speed * inp.mag * (boost && you.w > 5 ? 1.5 : 1); if (inp.mag > 0.05) pred.angle = inp.angle;
      pred.x += Math.cos(inp.angle) * sp * dt; pred.y += Math.sin(inp.angle) * sp * dt; // client-side prediction (server stays authoritative)
    }
    const k = 1 - Math.exp(-dt * 6); pred.x += (pred.serverX - pred.x) * k; pred.y += (pred.serverY - pred.y) * k;
    camera.follow(pred.x, pred.y, V.animals[pred.ai].tier, dt);
    renderer.drawWorld(camera, V, lakes, interp.sample(performance.now()), foods, you.id, pred, chats, performance.now(), terrain);
    const ctx = renderer.ctx;
    M.HUD.draw(ctx, renderer.vw, renderer.vh, V, you, V.animals[pred.ai], lb, DEV ? dbg : null, count);
    if (mode === 'play') upgrade.draw(ctx, renderer.vw, renderer.vh, you, t);
  }
  addEventListener('resize', () => renderer.resize());

  (async function boot() {
    try {
      const list = await M.MenuVersionManager.init();
      if (DEV) { const sel = $('versionSelect'); $('devbar').style.display = 'flex'; for (const v of list) sel.add(new Option(v.date + ' - ' + v.label, v.id)); sel.onchange = () => loadVersion(sel.value); }
      const want = params.get('v'), id = list.find((v) => v.id === want) ? want : list[0].id;
      if (DEV) $('versionSelect').value = id;
      await loadVersion(id); menu.show(); requestAnimationFrame(frame);
    } catch (e) { setStatus('Failed to load: ' + e.message); console.error(e); }
  })();
  window.__mope = { net, get state() { return { mode, you, V, lakes, terrain, foods }; } }; // debugging / automated tests
})();
