/* Client orchestration: menu -> join -> play loop. Authoritative state lives on the server; the client predicts only its own movement. */
(function () {
  const M = window.Mope, $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search), DEV = params.get('dev') === '1';
  // local dev: game server on :8081; hosted (single public port): the web server proxies /ws to the game server
  const serverUrl = params.get('server') || (location.port === '8080' || location.port === '' && /^(localhost|127\.)/.test(location.hostname) ? 'ws://' + location.hostname + ':8081' : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');

  const renderer = new M.Renderer($('gCanvas')); renderer.resize();
  const camera = new M.Camera(), input = new M.Input($('gCanvas')), interp = new M.Interpolator(100), net = new M.Net(serverUrl);
  let lastEarned = 0, mySkin = null, myClimb = false, prevYou = null;
  const acct = { user: null, coins: 0, owned: [], equipped: {} }; let zones = [];
  let gm = 'normal', modeData = null, abData = null, redState = null, modesCatalog = [], myFlags = 0, camMoved = false, spectating = false, specName = '', arenaState = '', arenaMsg = '', mode = 'menu', V = null, you = null, lakes = [], terrain = [], foods = [], lb = [], count = 0, pred = null, selectedVersion = null, lastJoin = null, wantJoin = false, boost = false;
  const chats = new Map();
  let frames = 0, fpsT = performance.now(), lastInputSent = 0, lastSent = '', lastFrame = performance.now(), dbg = { fps: 0, ping: 0, kbps: 0, mem: '-' }, lastBytes = 0;
  const upgrade = new M.UpgradeMenu((id) => net.send({ t: 'evolve', id }), DEV);
  const touchDevice = M.isTouchDevice();
  const skinPop = new M.SkinPopover.SkinPopover(document, (m) => net.send(Object.assign({ v: selectedVersion }, m)));
  const equippedSkinSrc = (a) => { const id = acct.equipped && acct.equipped[a.id], it = id && V && V.shop && V.shop.items.find((i) => i.id === id); return it && it.sprite ? it.sprite : null; };
  const tray = new M.EvolveTray(document, { onEvolve: (id) => net.send({ t: 'evolve', id }), touch: touchDevice, icon: (a) => M.Sprites.getIcon(a), ready: (a) => M.Sprites.isReady(a), onSkins: (id, x, y) => skinPop.show(id, x, y), skinFor: equippedSkinSrc, sig: () => JSON.stringify(acct.equipped || {}) }); // ORIGINAL upgrade picker (default on touch devices and in the wiki-sourced version)
  const menu = new M.MainMenu({ onPlay: (name, m) => startJoin(name, devMode() === 'arena' ? 'arena' : m), onSpectate: (name) => startJoin(name, 'spectate') });
  const devMode = () => (DEV && $('modeSelect') ? $('modeSelect').value : 'normal');
  const shopUI = new M.Shop.ShopUI((m) => net.send(Object.assign({ v: selectedVersion }, m)));
  const wardrobe = new M.Wardrobe.WardrobeUI(document, (m) => net.send(Object.assign({ v: selectedVersion }, m)));
  const setStatus = (t) => ($('status').textContent = t || '');
  const connecting = (on) => ($('connecting').style.display = on ? 'block' : 'none');

  function refreshAccountUI() {
    const li = !!acct.user; document.getElementById('notLoggedInDiv').style.display = li ? 'none' : ''; document.getElementById('onloggedInDiv').style.display = li ? '' : 'none';
    if (li) { document.getElementById('loggedInNameTxt').textContent = acct.user; document.getElementById('loggedInUserImg').textContent = acct.user[0].toUpperCase(); document.getElementById('loginCoins').textContent = acct.coins; }
    shopUI.setAccount(li ? acct : null); wardrobe.setAccount(acct); skinPop.setAccount(acct);
  }
  function tokenKey() { return 'mope.token'; }
  const authErr = (t) => (document.getElementById('authErr').textContent = t || '');
  function openAuth() { authErr(''); document.getElementById('authModal').style.display = 'flex'; if (!net.open && !net.wantOpen) net.connect(); }
  function doAuth(kind) { authErr(''); const u = document.getElementById('authUser').value.trim(), p = document.getElementById('authPass').value; if (!net.open) { authErr('Not connected to the server yet - try again in a moment.'); if (!net.wantOpen) net.connect(); return; } net.send({ t: kind, v: selectedVersion, u, p }); }
  document.getElementById('facebookLoginBtn').addEventListener('click', openAuth); document.getElementById('googleLoginBtn').addEventListener('click', openAuth);
  document.getElementById('authClose').addEventListener('click', () => (document.getElementById('authModal').style.display = 'none'));
  document.getElementById('authLogin').addEventListener('click', () => doAuth('login')); document.getElementById('authRegister').addEventListener('click', () => doAuth('register'));
  document.getElementById('shopbutton').addEventListener('click', () => shopUI.show()); document.getElementById('storeButton').addEventListener('click', () => shopUI.show()); document.getElementById('wardrobeButton').addEventListener('click', () => wardrobe.show()); document.getElementById('wardrobeClose').addEventListener('click', () => wardrobe.hide()); document.getElementById('wardrobeSearch').addEventListener('input', (e) => { wardrobe.search = e.target.value; wardrobe.render(); }); document.getElementById('wardrobeOwned').addEventListener('change', (e) => { wardrobe.ownedOnly = e.target.checked; wardrobe.render(); }); // browsing is allowed logged out; purchases ask to log in
  document.getElementById('footerLinks').addEventListener('click', (e) => { if (e.target.dataset && e.target.dataset.action === 'updates') document.getElementById('updatesDiv').scrollIntoView({ behavior: 'smooth' }); }); document.getElementById('shopClose').addEventListener('click', () => shopUI.hide());
  document.getElementById('logoutbut').addEventListener('click', () => { let t = null; try { t = localStorage.getItem(tokenKey()); localStorage.removeItem(tokenKey()); } catch (e) {} if (t) net.send({ t: 'logout', token: t }); Object.assign(acct, { user: null, coins: 0, owned: [], equipped: {} }); refreshAccountUI(); });
  async function loadVersion(id) {
    selectedVersion = id; const cfg = await M.MenuVersionManager.select(id);
    const vi0 = M.MenuVersionManager.current; wardrobe.setVersion({ shop: vi0.shopItems ? { items: vi0.shopItems } : null, animals: vi0.animalDefs || [] }); shopUI.setStyle((cfg && cfg.shopWindow) || null); shopUI.setVersion({ shop: vi0.shopItems ? { items: vi0.shopItems } : null, animals: vi0.animalDefs || [] });
    if (vi0.features && vi0.features.accounts) { if (!net.open && !net.wantOpen) net.connect(); } refreshAccountUI();
    if (cfg.options && !cfg.options.checkboxes.some((o) => o.id === 'evoTray')) cfg.options.checkboxes.push({ id: 'evoTray', label: 'New upgrade tray', color: cfg.options.checkboxes[0].color, implemented: true, default: touchDevice || !!(vi0.features && vi0.features.wikiSourced) }); // project-only option, not part of any archived menu
    menu.setConfig(cfg); refreshModePicker(); setGfx(renderer.quality); if ($('versionLabel')) $('versionLabel').textContent = M.MenuVersionManager.current.label; if (window.__arenaUi) window.__arenaUi();
  }
  /* ---- game mode picker: every implemented mode is playable in every build that can host it (era shown in the label) ---- */
  const pickedGm = () => { const el = $('gmSelect'); return el && el.value ? el.value : 'normal'; };
  function refreshModePicker() {
    const el = $('gmSelect'), vi = M.MenuVersionManager.current; if (!el || !vi || !modesCatalog.length) return;
    let want = el.value; try { want = want || localStorage.getItem('mope.gm') || 'normal'; } catch (e) {}
    const opts = M.ModeHud.modeOptions(modesCatalog, vi, acct); el.innerHTML = ''; for (const o of opts) { const op = new Option(o.label, o.id); op.disabled = !!o.disabled; op.title = o.note || ''; el.add(op); }
    el.value = opts.some((o) => o.id === want && !o.disabled) ? want : 'normal'; onModeChange();
  }
  function onModeChange() {
    const g = pickedGm(), vi = M.MenuVersionManager.current, o = modesCatalog.find((x) => x.id === g); try { localStorage.setItem('mope.gm', g); } catch (e) {}
    $('gmNote').textContent = o ? o.description : ''; const ex = g === 'arena' || g === 'redemption'; $('gmExtras').style.display = ex ? 'flex' : 'none'; $('gmDiff').style.display = g === 'redemption' ? '' : 'none';
    const sel = $('gmAnimal'); sel.innerHTML = ''; if (ex && vi) for (const a of vi.animalDefs || []) if (a.tier >= (g === 'redemption' ? 15 : 15) && a.tier <= (g === 'redemption' ? 16 : 99) && a.biome !== 'volcano' || (a.tier >= 15 && a.tier <= 16)) sel.add(new Option(a.name + ' (T' + a.tier + ')', a.id));
    if (ex && !sel.options.length && vi) for (const a of vi.animalDefs || []) if (a.tier >= 10) sel.add(new Option(a.name + ' (T' + a.tier + ')', a.id));
  }
  fetch('data/modes/modes.json').then((r) => r.json()).then((j) => { modesCatalog = j.modes; refreshModePicker(); }).catch(() => {});
  $('gmSelect').addEventListener('change', onModeChange);
  function startJoin(name, m) {
    const g = pickedGm(); if (g !== 'normal' && g !== 'sandbox' && m !== 'spectate') m = g; // the picker wins over the legacy dev/sandbox buttons
    lastJoin = { t: 'join', name, v: selectedVersion, mode: m }; if ((m === 'arena' || m === 'redemption') && $('gmAnimal') && $('gmAnimal').value) lastJoin.animal = $('gmAnimal').value; else if (m === 'arena' && $('arenaAnimal')) lastJoin.animal = $('arenaAnimal').value; if (m === 'redemption') lastJoin.difficulty = $('gmDiff').value; if (m === 'spectate' && gm === 'royale') lastJoin.of = 'royale'; wantJoin = true; connecting(true); setStatus('');
    if (net.open) net.send(lastJoin); else if (!net.wantOpen) net.connect();
  }
  net.on('open', () => { if (DEV) net.send({ t: 'dev-info' }); if (wantJoin && lastJoin) net.send(lastJoin); let t = null; try { t = localStorage.getItem(tokenKey()); } catch (e) {} const vi = M.MenuVersionManager.current; if (t && !acct.user && vi && vi.features && vi.features.accounts) net.send({ t: 'resume', token: t, v: selectedVersion }); });
  net.on('auth', (m) => { if (m.ok) { Object.assign(acct, { user: m.user, coins: m.coins || 0, owned: m.owned || [], equipped: m.equipped || {} }); try { localStorage.setItem(tokenKey(), m.token); } catch (e) {} document.getElementById('authModal').style.display = 'none'; document.getElementById('authPass').value = ''; refreshAccountUI(); } else authErr(m.err || 'failed'); });
  // dev tools (only when ?dev=1 AND the server runs with MOPE_DEV=1; ordinary servers ignore these messages)
  net.on('dev', (m) => { const on = !!m.on && DEV; $('devTools').style.display = on ? 'inline' : 'none'; if (on && !$('devDisaster').options.length) for (const id of ['rainstorm', 'duststorm', 'heatwave', 'snowstorm', 'tsunami', 'volcanic_eruption', 'land_tornado', 'fire_tornado']) $('devDisaster').add(new Option(id)); });
  if (DEV) { $('devXp').addEventListener('click', () => net.send({ t: 'dev-xp', n: you ? Math.max(200, you.xp * 3) : 200 })); $('devCoins').addEventListener('click', () => { if (!acct.user) { $('devMsg').textContent = 'log in first'; return; } $('devMsg').textContent = ''; net.send({ t: 'dev-coins', v: selectedVersion, n: 1000 }); }); $('devDisasterGo').addEventListener('click', () => net.send({ t: 'dev-disaster', id: $('devDisaster').value })); }
  net.on('shop', (m) => { Object.assign(acct, { coins: m.coins, owned: m.owned, equipped: m.equipped, credits: m.credits != null ? m.credits : acct.credits }); refreshModePicker(); shopUI.purchased(); refreshAccountUI(); });
  net.on('shop-error', (m) => { shopUI.error(m.err); wardrobe.err(m.err); authErr(m.err); });
  net.on('coins', (m) => { acct.coins = m.coins; lastEarned = m.earned || 0; refreshAccountUI(); if (lastEarned > 0) { document.getElementById('plusCoinsLabel').textContent = '+' + lastEarned; document.getElementById('plusCoins').style.display = 'block'; } });
  net.on('disaster', (m) => { const el = document.getElementById('disasterMsg'); el.textContent = 'Disaster: ' + m.name + '!'; el.style.display = 'block'; clearTimeout(el._t); el._t = setTimeout(() => (el.style.display = 'none'), 4500); });
  net.on('close', () => { if (mode === 'play') { setStatus('Connection lost - reconnecting...'); } else if (wantJoin) { connecting(false); setStatus('Cannot reach server (' + serverUrl + ')'); } });
  net.on('welcome', (m) => {
    if (m.gm !== 'spectate') gm = m.gm || 'normal'; modeData = null; redState = null; V = m.version; V.__sandbox = m.mode === 'sandbox'; V.__arena = m.mode === 'arena'; camMoved = false; spectating = m.mode === 'spectate'; V.__spectate = spectating; zones = []; prevYou = null; myClimb = false; document.getElementById('plusCoins').style.display = 'none'; specName = ''; arenaState = ''; arenaMsg = ''; lakes = m.lakes || []; terrain = m.terrain || []; mode = 'play'; chats.clear();
    you = { id: m.id, x: 0, y: 0, xp: 0, hp: 100, w: 100, a: V.startAnimal, ev: [], cd: 0 }; if (spectating) pred = null;
    upgrade.setVersion(V); tray.setVersion(V); skinPop.setVersion(V); touch.enable(touchDevice, { climb: !!(V.features && V.features.climbing), chat: !!(V.features && V.features.chat) }); menu.hide(); connecting(false); setStatus(''); $('deathMsg').style.display = 'none'; interp.snaps.length = 0; pred = null;
  });
  net.on('snap', (m) => {
    if (mode !== 'play') return;
    you = Object.assign({}, m.you); count = m.n;
    interp.push(performance.now(), m.p.map((p) => ({ id: p[0], x: p[1], y: p[2], ai: p[3], angle: p[4], hp: p[5], name: p[6], skin: p[7] || null, climb: p[8] === 1, flags: p[9] | 0 }))); zones = m.dz || []; const meT = m.p.find((q) => q[0] === you.id); mySkin = meT ? meT[7] : null; myFlags = meT ? meT[9] | 0 : 0; modeData = m.md || null; abData = m.ab || null; redState = m.red || null; if (modeData && modeData.m === 'royale' && you.x != null && modeData.z) { const dx = you.x - modeData.z[0], dy = you.y - modeData.z[1]; modeData.out = dx * dx + dy * dy > modeData.z[2] * modeData.z[2] ? 1 : 0; } myClimb = !!(meT && meT[8] === 1);
    if (V.features && V.features.sounds && prevYou && !spectating) { const maxFood = Math.max(...V.foods.map((f) => f.xp)) * Math.pow(1.35, Math.max(0, (V.animals.find((a) => a.id === you.a) || { tier: 1 }).tier - 1)); const snd = M.Sound.classify(prevYou, you, maxFood); if (snd) { M.Sound.muted = menu.muted; M.Sound.play(snd); } } if (V.features && V.features.noXpPopups && !menu.options.noXpPopups && !spectating) { const gn = M.Extras.xpGain(prevYou, you); if (gn >= 5) M.Extras.popup(document, gn); } prevYou = { xp: you.xp, w: you.w, a: you.a }; foods = m.f; lb = m.lb;
    const ai = V.animals.findIndex((a) => a.id === you.a);
    if (m.arena) arenaState = m.arena;
    if (spectating) { specName = m.spec || ''; if (!camMoved) { camera.snap(you.x, you.y); camMoved = true; } return; } // spectators have no body: the camera just follows the target
    if (!pred) { pred = { id: you.id, x: you.x, y: you.y, ai, angle: 0, hp: 100, name: lastJoin.name || 'Mope', serverX: you.x, serverY: you.y }; camera.snap(you.x, you.y); }
    if (Math.hypot(you.x - pred.serverX, you.y - pred.serverY) > 600) { pred.x = you.x; pred.y = you.y; camera.snap(you.x, you.y); } // teleport (biome change / respawn)
    pred.flags = myFlags; pred.skin = mySkin; pred.climb = myClimb; pred.ai = ai; pred.hp = Math.round(100 * you.hp / V.animals[ai].health); pred.serverX = you.x; pred.serverY = you.y;
  });
  net.on('chat', (m) => { if (V) chats.set(m.id, { text: m.m, until: performance.now() + 5000 }); });
  net.on('round', (m) => { if (m.over) { $('deathMsg').textContent = 'Round over!\nWinner: ' + m.winner + '\n(next round in ' + m.restart + 's)'; $('deathMsg').style.display = 'block'; setTimeout(() => { if (mode !== 'dead') $('deathMsg').style.display = 'none'; }, 4000); } });
  net.on('round-restart', () => { if (gm === 'royale' && lastJoin) { spectating = false; const nm = lastJoin.name; lastJoin = Object.assign({}, lastJoin, { mode: 'royale' }); delete lastJoin.of; wantJoin = true; net.send(lastJoin); } });
  net.on('apocalypse', (m) => { if (m.team) { $('disasterMsg').textContent = 'APOCALYPSE! The ' + M.ModeHud.TEAM_NAME[m.team] + ' team captured 10 stones - meteors incoming!'; $('disasterMsg').style.display = 'block'; setTimeout(() => ($('disasterMsg').style.display = 'none'), 5000); } });
  net.on('error', (m) => { if (m.err) { connecting(false); wantJoin = false; mode = 'menu'; menu.show(); setStatus(m.err); } });
  net.on('died', (m) => {
    if (gm === 'royale' && V && !V.__arena) { mode = 'play'; spectating = true; $('deathMsg').textContent = "You are out!\nSpectating until the round ends"; $('deathMsg').style.display = 'block'; setTimeout(() => ($('deathMsg').style.display = 'none'), 3000); lastJoin = Object.assign({}, lastJoin, { mode: 'spectate', of: 'royale' }); net.send(lastJoin); return; }
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
  // abilities: W / right click (slot 0) and S (slot 1, e.g. King Dragon's tail slap); press abilities fire on key down, hold abilities run until the key is released
  const abilityKey = (slot, down) => { if (mode === 'play' && !spectating) net.send({ t: 'ability', slot, d: down ? 1 : 0 }); };
  input.on('w', (e) => { if (!e.repeat) abilityKey(0, true); }); input.onUp('w', () => abilityKey(0, false));
  input.on(' ', (e) => { if (mode === 'play' && spectating) { net.send({ t: 'spectate-next' }); e.preventDefault(); } });
  input.on('escape', () => { if (mode === 'play' && spectating) { net.send({ t: 'leave' }); spectating = false; mode = 'menu'; wantJoin = false; menu.show(); } });
  input.on('arrowup', (e) => { if (mode === 'play' && V.__sandbox) { net.send({ t: 'sandbox', d: 1 }); e.preventDefault(); } });
  input.on('arrowdown', (e) => { if (mode === 'play' && V.__sandbox) { net.send({ t: 'sandbox', d: -1 }); e.preventDefault(); } });
  input.on('u', () => { if (mode === 'play') upgrade.toggleTree(); });
  input.on('s', (e) => { if (e.repeat) return; if (mode === 'play' && !spectating && you && you.a2) { abilityKey(1, true); return; } if (mode === 'play' && !spectating && feature('climbing')) net.send({ t: 'climb' }); }); input.onUp('s', () => { if (you && you.a2) abilityKey(1, false); }); // 2020-03-03: 'PRESS S TO CLIMB UP/DOWN trees'
  const touch = new M.TouchControls(document, input, {
    boost: (on) => { if (mode === 'play' && !spectating) boost = on; },
    ability: (down) => { if (mode !== 'play') return; if (spectating) { if (down) { net.send({ t: 'leave' }); spectating = false; mode = 'menu'; wantJoin = false; menu.show(); } return; } net.send({ t: 'ability', slot: 0, d: down ? 1 : 0 }); },
    ability2: (down) => abilityKey(1, down), hasSecond: () => !!(you && you.a2),
    climb: () => { if (mode === 'play' && !spectating && feature('climbing')) net.send({ t: 'climb' }); },
    chat: () => { if (mode === 'play' && feature('chat') && !menu.options.noNames) openChat(); },
    spectating: () => mode === 'play' && spectating, next: () => net.send({ t: 'spectate-next' }),
  });
  renderer.underAnimals = (ctx, cam, vw, vh, now) => { M.AbilityFx.draw(ctx, cam, vw, vh, abData, now); M.ModeHud.drawWorld(ctx, cam, vw, vh, modeData, now); };
  $('gCanvas').addEventListener('mousemove', (e) => upgrade.mouse(e.clientX, e.clientY));
  $('gCanvas').addEventListener('mousedown', (e) => { if (e.button === 2 && mode === 'play' && !spectating) { if (!(upgrade.hitChoice && upgrade.hitChoice(e.clientX, e.clientY, renderer.vw, renderer.vh, you))) abilityKey(0, true); return; } if (e.button !== 0 || mode !== 'play') return; if (spectating) { net.send({ t: 'spectate-next' }); return; } if (!upgrade.click(e.clientX, e.clientY, renderer.vw, renderer.vh, you)) boost = true; });
  addEventListener('mouseup', (e) => { boost = false; if (e.button === 2) abilityKey(0, false); });
  $('gCanvas').addEventListener('wheel', (e) => upgrade.wheel(e.deltaY), { passive: true });
  $('gCanvas').addEventListener('contextmenu', (e) => { e.preventDefault(); const id = upgrade.hitChoice && upgrade.hitChoice(e.clientX, e.clientY, renderer.vw, renderer.vh, you); if (id) skinPop.show(id, e.clientX, e.clientY); }); // right-click an archived-style choice button: your skins for it

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (t - lastFrame) / 1000); lastFrame = t;
    frames++; if (t - fpsT >= 1000) { dbg.fps = frames; frames = 0; fpsT = t; dbg.ping = net.ping; dbg.kbps = ((net.bytesIn - lastBytes) / 1024).toFixed(1); lastBytes = net.bytesIn; dbg.mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : 'n/a'; }
    renderer.begin(); renderer.opts = { classic: !!(acct.user && acct.equipped && acct.equipped.__theme === 'classic_theme'), lowGraphics: menu.options.lowGraphics, noImages: menu.options.noImages, noNames: menu.options.noNames };
    if (spectating && mode === 'play' && V && you && you.a) {
      renderer.begin(); const an = V.animals.find((x) => x.id === you.a); camera.follow(you.x, you.y, an ? an.tier : 1, dt);
      renderer.drawWorld(camera, V, lakes, interp.sample(performance.now()), foods, -1, null, chats, performance.now(), terrain); if (V.disasterDefs && zones.length) M.Disasters.draw(renderer.ctx, camera, renderer.vw, renderer.vh, zones, V.disasterDefs, performance.now());
      const ctx = renderer.ctx; if (an) M.HUD.draw(ctx, renderer.vw, renderer.vh, V, you, an, lb, DEV ? dbg : null, count);
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(renderer.vw / 2 - 190, 10, 380, 54); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 20px Arial'; ctx.fillText('Spectating: ' + (specName || '...'), renderer.vw / 2, 34); ctx.font = '13px Arial'; ctx.fillStyle = '#ddd'; ctx.fillText('[Space] / click: next player    [Esc]: leave', renderer.vw / 2, 54); ctx.restore(); return;
    }
    document.body.classList.toggle('playing', mode === 'play');
    if (mode === 'menu' || !V || !you || !pred) { tray.hide(); renderer.ctx.fillStyle = getComputedStyle(document.body).backgroundColor; renderer.ctx.fillRect(0, 0, renderer.vw, renderer.vh); return; }
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
    M.ModeHud.drawHud(ctx, renderer.vw, renderer.vh, gm, modeData, redState, t);
    if (you.a2 && V.hud && V.hud.abilityButton) { // second ability (S key), e.g. the King Dragon's tail slap
      const A = V.hud.abilityButton, s = A.size * 0.8, x = renderer.vw - A.marginRight - A.size * 2 - 14, y = renderer.vh - A.marginBottom - s, d2 = (V.abilities || []).find((q) => q.id === you.a2), icon = d2 && M.Sprites.getAbilityIcon(d2);
      ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, y, s, s); if (icon) { ctx.globalAlpha = you.cd2 > 0 ? 0.5 : 1; ctx.drawImage(icon, x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8); }
      if (d2 && you.cd2 > 0) { ctx.globalAlpha = 0.65; ctx.fillStyle = '#000'; ctx.fillRect(x, y, s, s * Math.min(1, you.cd2 / Math.max(1, d2.cooldownMs))); }
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillText('S', x + s - 8, y + s - 5); ctx.restore(); }
    if (touchDevice) $('tuAbility2').style.display = you.a2 ? '' : 'none';
    upgrade.hideChoices = !!menu.options.evoTray;
    if (mode === 'play') upgrade.draw(ctx, renderer.vw, renderer.vh, you, t);
    if (mode === 'play' && !spectating && menu.options.evoTray && !upgrade.treeOpen) tray.update(you, upgrade.choices(you), t); else tray.hide();
    if (menu.options.snowfall) M.Extras.Snow.draw(ctx, renderer.vw, renderer.vh, t);
    if (V.__arena && arenaState) { ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold 26px Arial'; ctx.fillStyle = '#F1C34C'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4; const msg = arenaState === 'waiting' ? 'Waiting for an opponent...' : arenaState === 'fight' ? '1v1 ARENA' : ''; if (msg) { ctx.strokeText(msg, renderer.vw / 2, 90); ctx.fillText(msg, renderer.vw / 2, 90); } ctx.restore(); }
  }
  addEventListener('resize', () => renderer.resize());
  addEventListener('pointerdown', () => M.Sound.unlock(), { once: true });
  // ---- 2020 settings: graphics (HD / lower resolution, 'it may look blurrier') + FPS readout
  const setGfx = (q) => { renderer.quality = q; try { localStorage.setItem('mope.gfx', String(q)); } catch (e) {} renderer.resize(); const three = !!(menu.cfg && menu.cfg.graphics && menu.cfg.graphics.levels); const lowQ = three ? 0.45 : 0.6; for (const [id, on] of [['graphicsBut_low', q <= 0.45], ['graphicsBut_mid', three ? (q > 0.45 && q < 1) : q < 1], ['graphicsBut_hd', q >= 1]]) document.getElementById(id).classList.toggle('sel', on); };
  const gq = (which) => { const three = !!(menu.cfg && menu.cfg.graphics && menu.cfg.graphics.levels); return which === 'low' ? 0.45 : which === 'mid' ? (three ? 0.7 : 0.6) : 1; };
  document.getElementById('graphicsBut_low').addEventListener('click', () => setGfx(gq('low'))); document.getElementById('graphicsBut_mid').addEventListener('click', () => setGfx(gq('mid'))); document.getElementById('graphicsBut_hd').addEventListener('click', () => setGfx(gq('hi')));
  { let q = 1; try { q = parseFloat(localStorage.getItem('mope.gfx')) || 1; } catch (e) {} setGfx(q); }
  setInterval(() => { const el = document.getElementById('graphics_fps'); if (el && el.offsetParent) el.textContent = 'FPS: ' + dbg.fps; }, 1000);

  (async function boot() {
    try {
      const list = await M.MenuVersionManager.init();
      // Version dropdown for EVERYONE (all captures are playable); arena control stays dev-only
      const sel = $('versionSelect'); $('devbar').style.display = 'flex'; for (const v of list) sel.add(new Option(v.date + ' - ' + v.label, v.id));
      const arenaUi = () => { const vi = M.MenuVersionManager.current; $('arenaCtl').style.display = DEV && vi && vi.features && vi.features.arena ? 'inline' : 'none'; const aa = $('arenaAnimal'); aa.innerHTML = ''; for (const a of (vi && vi.animalDefs) || []) if (a.biome === 'land' && a.tier >= 5) aa.add(new Option(a.name + ' (T' + a.tier + ')', a.id)); }; window.__arenaUi = arenaUi;
      sel.onchange = () => { try { localStorage.setItem('mope.version', sel.value); } catch (e) {} const u = new URL(location.href); u.searchParams.set('v', sel.value); history.replaceState(null, '', u); loadVersion(sel.value); };
      let saved = null; try { saved = localStorage.getItem('mope.version'); } catch (e) {}
      const want = params.get('v') || saved, id = list.find((v) => v.id === want) ? want : list[0].id;
      sel.value = id;
      await loadVersion(id); menu.show(); requestAnimationFrame(frame);
    } catch (e) { setStatus('Failed to load: ' + e.message); console.error(e); }
  })();
  window.__mope = { net, get state() { return { mode, you, V, lakes, terrain, foods }; } }; // debugging / automated tests
})();
