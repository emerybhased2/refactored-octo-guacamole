/* Client orchestration: menu -> join -> play loop. Authoritative state lives on the server; the client predicts only its own movement. */
(function () {
  const M = window.Mope, $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search), DEV = params.get('dev') === '1';
  const serverUrl = params.get('server') || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':8081');

  const renderer = new M.Renderer($('gCanvas')); renderer.resize();
  const camera = new M.Camera(), input = new M.Input($('gCanvas')), interp = new M.Interpolator(100), net = new M.Net(serverUrl);
  let lastEarned = 0, mySkin = null, myClimb = false, prevYou = null;
  const acct = { user: null, coins: 0, owned: [], equipped: {} }; let zones = [];
  let camMoved = false, spectating = false, specName = '', arenaState = '', arenaMsg = '', mode = 'menu', V = null, you = null, lakes = [], terrain = [], foods = [], lb = [], count = 0, pred = null, selectedVersion = null, lastJoin = null, wantJoin = false, boost = false;
  const chats = new Map();
  let frames = 0, fpsT = performance.now(), lastInputSent = 0, lastSent = '', lastFrame = performance.now(), dbg = { fps: 0, ping: 0, kbps: 0, mem: '-' }, lastBytes = 0;
  const upgrade = new M.UpgradeMenu((id) => net.send({ t: 'evolve', id }), DEV);
  const menu = new M.MainMenu({ onPlay: (name, m) => startJoin(name, devMode() === 'arena' ? 'arena' : m), onSpectate: (name) => startJoin(name, 'spectate') });
  const devMode = () => (DEV && $('modeSelect') ? $('modeSelect').value : 'normal');
  const shopUI = new M.Shop.ShopUI((m) => net.send(Object.assign({ v: selectedVersion }, m)));
  const setStatus = (t) => ($('status').textContent = t || '');
  const connecting = (on) => ($('connecting').style.display = on ? 'block' : 'none');

  function refreshAccountUI() {
    const li = !!acct.user; document.getElementById('notLoggedInDiv').style.display = li ? 'none' : ''; document.getElementById('onloggedInDiv').style.display = li ? '' : 'none';
    if (li) { document.getElementById('loggedInNameTxt').textContent = acct.user; document.getElementById('loggedInUserImg').textContent = acct.user[0].toUpperCase(); document.getElementById('loginCoins').textContent = acct.coins; }
    shopUI.setAccount(li ? acct : null);
  }
  function tokenKey() { return 'mope.token'; }
  const authErr = (t) => (document.getElementById('authErr').textContent = t || '');
  function openAuth() { authErr(''); document.getElementById('authModal').style.display = 'flex'; if (!net.open && !net.wantOpen) net.connect(); }
  function doAuth(kind) { authErr(''); const u = document.getElementById('authUser').value.trim(), p = document.getElementById('authPass').value; if (!net.open) { authErr('Not connected to the server yet - try again in a moment.'); if (!net.wantOpen) net.connect(); return; } net.send({ t: kind, v: selectedVersion, u, p }); }
  document.getElementById('facebookLoginBtn').addEventListener('click', openAuth); document.getElementById('googleLoginBtn').addEventListener('click', openAuth);
  document.getElementById('authClose').addEventListener('click', () => (document.getElementById('authModal').style.display = 'none'));
  document.getElementById('authLogin').addEventListener('click', () => doAuth('login')); document.getElementById('authRegister').addEventListener('click', () => doAuth('register'));
  document.getElementById('shopbutton').addEventListener('click', () => shopUI.show()); document.getElementById('shopClose').addEventListener('click', () => shopUI.hide());
  document.getElementById('logoutbut').addEventListener('click', () => { let t = null; try { t = localStorage.getItem(tokenKey()); localStorage.removeItem(tokenKey()); } catch (e) {} if (t) net.send({ t: 'logout', token: t }); Object.assign(acct, { user: null, coins: 0, owned: [], equipped: {} }); refreshAccountUI(); });
  async function loadVersion(id) {
    selectedVersion = id; const cfg = await M.MenuVersionManager.select(id);
    const vi0 = M.MenuVersionManager.current; shopUI.setStyle((cfg && cfg.shopWindow) || null); shopUI.setVersion({ shop: vi0.shopItems ? { items: vi0.shopItems } : null, animals: vi0.animalDefs || [] });
    if (vi0.features && vi0.features.accounts) { if (!net.open && !net.wantOpen) net.connect(); } refreshAccountUI();
    menu.setConfig(cfg); if ($('versionLabel')) $('versionLabel').textContent = M.MenuVersionManager.current.label; if (window.__arenaUi) window.__arenaUi();
  }
  function startJoin(name, m) {
    lastJoin = { t: 'join', name, v: selectedVersion, mode: m }; if (m === 'arena' && $('arenaAnimal')) lastJoin.animal = $('arenaAnimal').value; wantJoin = true; connecting(true); setStatus('');
    if (net.open) net.send(lastJoin); else if (!net.wantOpen) net.connect();
  }
  net.on('open', () => { if (wantJoin && lastJoin) net.send(lastJoin); let t = null; try { t = localStorage.getItem(tokenKey()); } catch (e) {} const vi = M.MenuVersionManager.current; if (t && !acct.user && vi && vi.features && vi.features.accounts) net.send({ t: 'resume', token: t, v: selectedVersion }); });
  net.on('auth', (m) => { if (m.ok) { Object.assign(acct, { user: m.user, coins: m.coins || 0, owned: m.owned || [], equipped: m.equipped || {} }); try { localStorage.setItem(tokenKey(), m.token); } catch (e) {} document.getElementById('authModal').style.display = 'none'; document.getElementById('authPass').value = ''; refreshAccountUI(); } else authErr(m.err || 'failed'); });
  net.on('shop', (m) => { Object.assign(acct, { coins: m.coins, owned: m.owned, equipped: m.equipped }); shopUI.error(''); refreshAccountUI(); });
  net.on('shop-error', (m) => { shopUI.error(m.err); authErr(m.err); });
  net.on('coins', (m) => { acct.coins = m.coins; lastEarned = m.earned || 0; refreshAccountUI(); if (lastEarned > 0) { document.getElementById('plusCoinsLabel').textContent = '+' + lastEarned; document.getElementById('plusCoins').style.display = 'block'; } });
  net.on('disaster', (m) => { const el = document.getElementById('disasterMsg'); el.textContent = 'Disaster: ' + m.name + '!'; el.style.display = 'block'; clearTimeout(el._t); el._t = setTimeout(() => (el.style.display = 'none'), 4500); });
  net.on('close', () => { if (mode === 'play') { setStatus('Connection lost - reconnecting...'); } else if (wantJoin) { connecting(false); setStatus('Cannot reach server (' + serverUrl + ')'); } });
  net.on('welcome', (m) => {
    V = m.version; V.__sandbox = m.mode === 'sandbox'; V.__arena = m.mode === 'arena'; camMoved = false; spectating = m.mode === 'spectate'; V.__spectate = spectating; zones = []; prevYou = null; myClimb = false; document.getElementById('plusCoins').style.display = 'none'; specName = ''; arenaState = ''; arenaMsg = ''; lakes = m.lakes || []; terrain = m.terrain || []; mode = 'play'; chats.clear();
    you = { id: m.id, x: 0, y: 0, xp: 0, hp: 100, w: 100, a: V.startAnimal, ev: [], cd: 0 }; if (spectating) pred = null;
    upgrade.setVersion(V); menu.hide(); connecting(false); setStatus(''); $('deathMsg').style.display = 'none'; interp.snaps.length = 0; pred = null;
  });
  net.on('snap', (m) => {
    if (mode !== 'play') return;
    you = Object.assign({}, m.you); count = m.n;
    interp.push(performance.now(), m.p.map((p) => ({ id: p[0], x: p[1], y: p[2], ai: p[3], angle: p[4], hp: p[5], name: p[6], skin: p[7] || null, climb: p[8] === 1 }))); zones = m.dz || []; const meT = m.p.find((q) => q[0] === you.id); mySkin = meT ? meT[7] : null; myClimb = !!(meT && meT[8] === 1);
    if (V.features && V.features.sounds && prevYou && !spectating) { const maxFood = Math.max(...V.foods.map((f) => f.xp)) * Math.pow(1.35, Math.max(0, (V.animals.find((a) => a.id === you.a) || { tier: 1 }).tier - 1)); const snd = M.Sound.classify(prevYou, you, maxFood); if (snd) { M.Sound.muted = menu.muted; M.Sound.play(snd); } } prevYou = { xp: you.xp, w: you.w, a: you.a }; foods = m.f; lb = m.lb;
    const ai = V.animals.findIndex((a) => a.id === you.a);
    if (m.arena) arenaState = m.arena;
    if (spectating) { specName = m.spec || ''; if (!camMoved) { camera.snap(you.x, you.y); camMoved = true; } return; } // spectators have no body: the camera just follows the target
    if (!pred) { pred = { id: you.id, x: you.x, y: you.y, ai, angle: 0, hp: 100, name: lastJoin.name || 'Mope', serverX: you.x, serverY: you.y }; camera.snap(you.x, you.y); }
    if (Math.hypot(you.x - pred.serverX, you.y - pred.serverY) > 600) { pred.x = you.x; pred.y = you.y; camera.snap(you.x, you.y); } // teleport (biome change / respawn)
    pred.skin = mySkin; pred.climb = myClimb; pred.ai = ai; pred.hp = Math.round(100 * you.hp / V.animals[ai].health); pred.serverX = you.x; pred.serverY = you.y;
  });
  net.on('chat', (m) => { if (V) chats.set(m.id, { text: m.m, until: performance.now() + 5000 }); });
  net.on('died', (m) => {
    if (V && V.features && V.features.sounds) { M.Sound.muted = menu.muted; M.Sound.play('die'); }
    mode = 'dead'; wantJoin = false; const msgs = V.hud.messages;
    $('deathMsg').textContent = (m.r === 4 ? msgs.thirst : m.r === 13 ? (msgs.burn || msgs.eaten) : msgs.eaten) + '\nFinal XP: ' + m.xp + (m.r === 1 ? '  (eaten by ' + m.by + ')' : '') + (acct.user && V.shop ? '\n(+coins are added to your account)' : ''); $('deathMsg').style.display = 'block';
    setTimeout(() => { if (mode !== 'dead') return; $('deathMsg').style.display = 'none'; mode = 'menu'; menu.show(); }, 2500);
  });
  net.on('won', (m) => { mode = 'dead'; wantJoin = false; $('deathMsg').textContent = 'You won the arena!\n(you defeated ' + m.by + ')'; $('deathMsg').style.display = 'block'; setTimeout(() => { if (mode !== 'dead') return; $('deathMsg').style.display = 'none'; mode = 'menu'; menu.show(); }, 3000); });
  net.on('error', (m) => { connecting(false); setStatus(m.err); });

  // ---- controls
  const feature = (f) => V && V.features && V.features[f];
  const chatEl = $('chatinput');
  function openChat() { chatEl.style.visibility = 'visible'; chatEl.value = ''; chatEl.focus(); }
  function closeChat(send) { const t = chatEl.value.trim(); chatEl.style.visibility = 'hidden'; chatEl.blur(); if (send && t) net.send({ t: 'chat', m: t }); $('gCanvas').focus(); }
  chatEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { closeChat(true); e.preventDefault(); } else if (e.key === 'Escape') closeChat(false); e.stopPropagation(); });
  input.on('enter', () => { if (mode !== 'play') return; if (upgrade.takeFirst(you)) return; if (feature('chat') && !menu.options.noNames) openChat(); });
  input.on('w', () => { if (mode === 'play' && !spectating) net.send({ t: 'ability' }); });
  input.on(' ', (e) => { if (mode === 'play' && spectating) { net.send({ t: 'spectate-next' }); e.preventDefault(); } });
  input.on('escape', () => { if (mode === 'play' && spectating) { net.send({ t: 'leave' }); spectating = false; mode = 'menu'; wantJoin = false; menu.show(); } });
  input.on('arrowup', (e) => { if (mode === 'play' && V.__sandbox) { net.send({ t: 'sandbox', d: 1 }); e.preventDefault(); } });
  input.on('arrowdown', (e) => { if (mode === 'play' && V.__sandbox) { net.send({ t: 'sandbox', d: -1 }); e.preventDefault(); } });
  input.on('u', () => { if (mode === 'play') upgrade.toggleTree(); });
  input.on('s', () => { if (mode === 'play' && !spectating && feature('climbing')) net.send({ t: 'climb' }); }); // 2020-03-03: 'PRESS S TO CLIMB UP/DOWN trees'
  $('gCanvas').addEventListener('mousemove', (e) => upgrade.mouse(e.clientX, e.clientY));
  $('gCanvas').addEventListener('mousedown', (e) => { if (e.button !== 0 || mode !== 'play') return; if (spectating) { net.send({ t: 'spectate-next' }); return; } if (!upgrade.click(e.clientX, e.clientY, renderer.vw, renderer.vh, you)) boost = true; });
  addEventListener('mouseup', () => (boost = false));
  $('gCanvas').addEventListener('wheel', (e) => upgrade.wheel(e.deltaY), { passive: true });
  $('gCanvas').addEventListener('contextmenu', (e) => e.preventDefault());

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - lastFrame) / 1000); lastFrame = t;
    frames++; if (t - fpsT >= 1000) { dbg.fps = frames; frames = 0; fpsT = t; dbg.ping = net.ping; dbg.kbps = ((net.bytesIn - lastBytes) / 1024).toFixed(1); lastBytes = net.bytesIn; dbg.mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : 'n/a'; }
    renderer.begin(); renderer.opts = { lowGraphics: menu.options.lowGraphics, noImages: menu.options.noImages, noNames: menu.options.noNames };
    if (spectating && mode === 'play' && V && you && you.a) {
      renderer.begin(); const an = V.animals.find((x) => x.id === you.a); camera.follow(you.x, you.y, an ? an.tier : 1, dt);
      renderer.drawWorld(camera, V, lakes, interp.sample(performance.now()), foods, -1, null, chats, performance.now(), terrain); if (V.disasterDefs && zones.length) M.Disasters.draw(renderer.ctx, camera, renderer.vw, renderer.vh, zones, V.disasterDefs, performance.now());
      const ctx = renderer.ctx; if (an) M.HUD.draw(ctx, renderer.vw, renderer.vh, V, you, an, lb, DEV ? dbg : null, count);
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(renderer.vw / 2 - 190, 10, 380, 54); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 20px Arial'; ctx.fillText('Spectating: ' + (specName || '...'), renderer.vw / 2, 34); ctx.font = '13px Arial'; ctx.fillStyle = '#ddd'; ctx.fillText('[Space] / click: next player    [Esc]: leave', renderer.vw / 2, 54); ctx.restore(); return;
    }
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
    renderer.drawWorld(camera, V, lakes, interp.sample(performance.now()), foods, you.id, pred, chats, performance.now(), terrain); if (V.disasterDefs && zones.length) M.Disasters.draw(renderer.ctx, camera, renderer.vw, renderer.vh, zones, V.disasterDefs, performance.now());
    const ctx = renderer.ctx;
    M.HUD.draw(ctx, renderer.vw, renderer.vh, V, you, V.animals[pred.ai], lb, DEV ? dbg : null, count);
    if (mode === 'play') upgrade.draw(ctx, renderer.vw, renderer.vh, you, t);
    if (V.__arena && arenaState) { ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold 26px Arial'; ctx.fillStyle = '#F1C34C'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4; const msg = arenaState === 'waiting' ? 'Waiting for an opponent...' : arenaState === 'fight' ? '1v1 ARENA' : ''; if (msg) { ctx.strokeText(msg, renderer.vw / 2, 90); ctx.fillText(msg, renderer.vw / 2, 90); } ctx.restore(); }
  }
  addEventListener('resize', () => renderer.resize());
  addEventListener('pointerdown', () => M.Sound.unlock(), { once: true });
  // ---- 2020 settings: graphics (HD / lower resolution, 'it may look blurrier') + FPS readout
  const setGfx = (q) => { renderer.quality = q; try { localStorage.setItem('mope.gfx', String(q)); } catch (e) {} renderer.resize(); document.getElementById('graphicsBut_mid').classList.toggle('sel', q < 1); document.getElementById('graphicsBut_hd').classList.toggle('sel', q >= 1); };
  document.getElementById('graphicsBut_mid').addEventListener('click', () => setGfx(0.6)); document.getElementById('graphicsBut_hd').addEventListener('click', () => setGfx(1));
  { let q = 1; try { q = parseFloat(localStorage.getItem('mope.gfx')) || 1; } catch (e) {} setGfx(q); }
  setInterval(() => { const el = document.getElementById('graphics_fps'); if (el && el.offsetParent) el.textContent = 'FPS: ' + dbg.fps; }, 1000);

  (async function boot() {
    try {
      const list = await M.MenuVersionManager.init();
      if (DEV) { const sel = $('versionSelect'); $('devbar').style.display = 'flex'; const arenaUi = () => { const vi = M.MenuVersionManager.current; $('arenaCtl').style.display = vi && vi.features && vi.features.arena ? 'inline' : 'none'; const aa = $('arenaAnimal'); aa.innerHTML = ''; for (const a of (vi && vi.animalDefs) || []) if (a.biome === 'land' && a.tier >= 5) aa.add(new Option(a.name + ' (T' + a.tier + ')', a.id)); }; window.__arenaUi = arenaUi; for (const v of list) sel.add(new Option(v.date + ' - ' + v.label, v.id)); sel.onchange = () => loadVersion(sel.value); }
      const want = params.get('v'), id = list.find((v) => v.id === want) ? want : list[0].id;
      if (DEV) $('versionSelect').value = id;
      await loadVersion(id); menu.show(); requestAnimationFrame(frame);
    } catch (e) { setStatus('Failed to load: ' + e.message); console.error(e); }
  })();
  window.__mope = { net, get state() { return { mode, you, V, lakes, terrain, foods }; } }; // debugging / automated tests
})();
