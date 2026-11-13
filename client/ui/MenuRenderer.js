(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Pure: CSS custom properties derived from a main-menu config (so each historical version restyles the same DOM). */
  function themeVars(cfg) {
    const n = cfg.nickname, p = cfg.play, o = cfg.options, v = {
      '--page-bg': cfg.page.background, '--col-w': cfg.column.w + 'px', '--col-h': cfg.column.h + 'px',
      '--logo-w': cfg.logo.w + 'px', '--logo-h': cfg.logo.h + 'px', '--logo-mt': cfg.logo.marginTop + 'px',
      '--nick-w': n.w + 'px', '--nick-border': n.border, '--nick-font': n.font, '--nick-pad': n.padding + 'px', '--nick-radius': n.radius + 'px', '--nick-bg': n.background, '--nick-color': n.color,
      '--play-w': p.w + 'px', '--play-h': p.h + 'px', '--play-mt': p.marginTop + 'px', '--play-bg': p.background, '--play-hover': p.hover, '--play-bb': p.borderBottom, '--play-color': p.color, '--play-radius': p.radius + 'px',
      '--opt-bg': o.background, '--opt-top': o.top + 'px', '--sel-bg': o.select.background, '--sel-border': o.select.border, '--inactive-op': String(cfg.modes ? cfg.modes.inactiveOpacity : 0.4), '--onc-mt': (cfg.column.onconnectMarginTop || 0) + 'px', '--col-top': (cfg.column.top || 0) + 'px', '--play-fs': p.fontSize || 'large',
    };
    const how = cfg.panels && cfg.panels.howToPlay, upd = cfg.panels && cfg.panels.updates;
    if (how) v['--how-bg'] = how.background;
    if (upd) { v['--upd-bg'] = upd.background; v['--upd-text'] = upd.textColor || '#000000'; v['--upd-shadow'] = upd.textShadow || 'none'; v['--upd-title'] = upd.titleColor || '#095A00'; v['--upd-title-shadow'] = upd.titleShadow || 'none'; v['--upd-maxh'] = upd.maxHeight ? upd.maxHeight + 'px' : 'none'; v['--upd-ov'] = upd.scroll ? 'scroll' : 'visible'; }
    if (cfg.menuPanel) { if (cfg.menuPanel.border) v['--menu-border'] = cfg.menuPanel.border; v['--menu-bg'] = cfg.menuPanel.background; v['--menu-radius'] = cfg.menuPanel.radius + 'px'; v['--menu-pad'] = cfg.menuPanel.padding + 'px'; }
    if (cfg.column.onconnectMinHeight) v['--onc-minh'] = cfg.column.onconnectMinHeight + 'px';
    const st = cfg.account && cfg.account.style; if (st) { v['--login-w'] = st.width + 'px'; v['--login-bg'] = st.background; v['--login-radius'] = st.radius + 'px'; v['--login-pad'] = st.padding + 'px'; v['--login-name'] = st.name.color; v['--avatar-bg'] = st.avatar.background; v['--avatar-size'] = st.avatar.size + 'px'; v['--fb-bg'] = st.facebook.background; v['--fb-bb'] = st.facebook.borderBottom; v['--fb-hover'] = st.facebook.hover; v['--g-bg'] = st.google.background; v['--g-bb'] = st.google.borderBottom; v['--g-hover'] = st.google.hover; v['--lbtn-fs'] = st.button.fontSize; }
    if (cfg.options && cfg.options.width) v['--opt-w'] = cfg.options.width + 'px';
    if (cfg.spectate) { v['--spec-bg'] = cfg.spectate.background; v['--spec-hover'] = cfg.spectate.hover; v['--spec-w'] = cfg.spectate.w + 'px'; }
    return v;
  }
  /** Pure: which optional menu elements this version's config actually contains (nothing from later eras leaks in). */
  function elementsPresent(cfg) {
    return { modes: !!(cfg.modes && cfg.modes.normal), sandbox: !!(cfg.modes && cfg.modes.sandbox), settings: !!(cfg.icons && cfg.icons.settings), mute: !!(cfg.icons && cfg.icons.mute),
      howToPlay: !!(cfg.panels && cfg.panels.howToPlay), updates: !!(cfg.panels && cfg.panels.updates), options: !!cfg.options, spectate: !!cfg.spectate, account: !!cfg.account };
  }
  /** Panels are either {title, items} or {sections:[{title, items}]} (the 2018 update panel stacks dated notes). */
  function fillList(el, panel) {
    el.innerHTML = '';
    for (const sec of panel.sections || [{ title: panel.title, items: panel.items }]) {
      const h = document.createElement('h2'); h.textContent = sec.title; el.appendChild(h);
      const ul = document.createElement('ul'); for (const t of sec.items) { const li = document.createElement('li'); li.textContent = '- ' + t; ul.appendChild(li); } el.appendChild(ul);
    }
  }
  /** Applies a config to the static DOM skeleton. */
  function apply(cfg, doc) {
    const $ = (id) => doc.getElementById(id), vars = themeVars(cfg), has = elementsPresent(cfg);
    for (const [k, val] of Object.entries(vars)) doc.documentElement.style.setProperty(k, val);
    const L = $('logo'); L.src = cfg.logo.src;
    const set = (id, c) => { const im = $(id).querySelector('img'); im.src = c.src; im.width = c.w; im.height = c.h; im.title = c.title || ''; };
    $('button_GMnormal').style.display = has.modes ? '' : 'none'; if (has.modes) set('button_GMnormal', cfg.modes.normal);
    $('button_GMsandbox').style.display = has.sandbox ? '' : 'none'; if (has.sandbox) set('button_GMsandbox', cfg.modes.sandbox);
    $('settingsButton').style.display = has.settings ? '' : 'none'; if (has.settings) set('settingsButton', cfg.icons.settings);
    $('button_mute').style.display = has.mute ? '' : 'none'; if (has.mute) set('button_mute', cfg.icons.mute);
    set('closeBut', Object.assign({ title: 'Close' }, cfg.icons.close));
    $('btnSpectate').style.display = has.spectate ? 'block' : 'none'; if (has.spectate) $('btnSpectate').textContent = cfg.spectate.label;
    // 2020 settings panel: region select removed, mute/spectate/logout live inside settings, graphics block (all from the archived HTML)
    $('regionSelect').style.display = cfg.options && cfg.options.regionSelect === false ? 'none' : '';
    const extras = $('settingsExtras'), place = (el, where) => { if (where === 'settings') extras.appendChild(el); else if (el.dataset.home && $(el.dataset.home)) $(el.dataset.home).appendChild(el); };
    for (const id of ['button_mute', 'btnSpectate', 'logoutbut']) { const el = $(id); if (!el.dataset.home) el.dataset.home = el.parentElement.id || 'onconnectDiv'; }
    place($('button_mute'), cfg.icons && cfg.icons.mutePlacement); place($('btnSpectate'), cfg.spectate && cfg.spectate.placement); place($('logoutbut'), cfg.account && cfg.account.logoutPlacement);
    const gfx = $('options_graphicsButs'); gfx.style.display = cfg.graphics ? '' : 'none'; if (cfg.graphics) { $('graphics_title').textContent = cfg.graphics.title; $('graphicsBut_mid').textContent = cfg.graphics.lowLabel; $('graphicsBut_hd').textContent = cfg.graphics.hdLabel; }
    const hs = doc.querySelectorAll('#optionsDiv > h3'); if (hs.length >= 2) { hs[0].textContent = (cfg.options && cfg.options.settingsTitle) || 'Region/Server:'; hs[1].textContent = (cfg.options && cfg.options.optionsLabel) || 'Options:'; }
    doc.body.classList.toggle('t2021', cfg.theme === '2021');
    const wb = $('wardrobeButton'); wb.style.display = has.account ? 'block' : 'none'; // versions with accounts + shop
    const sb = $('storeButton'); sb.style.display = cfg.store ? 'block' : 'none'; if (cfg.store) sb.textContent = cfg.store.label;
    const fl = $('footerLinks'); fl.style.display = cfg.footerLinks ? 'flex' : 'none'; fl.innerHTML = ''; for (const l of cfg.footerLinks || []) { const sp = doc.createElement('span'); sp.textContent = l.label; sp.dataset.action = l.action; fl.appendChild(sp); }
    const gl = $('graphicsBut_low'); gl.style.display = cfg.graphics && cfg.graphics.levels ? '' : 'none'; if (cfg.graphics && cfg.graphics.levels) { gl.textContent = cfg.graphics.levels[0]; $('graphicsBut_mid').textContent = cfg.graphics.levels[1]; $('graphicsBut_hd').textContent = cfg.graphics.levels[2]; }
    $('loginDiv').style.display = has.account ? '' : 'none';
    if (has.account) { const A = cfg.account; $('notLoggedInTxt').textContent = A.loggedOutText; $('facebookLoginBtn').textContent = A.providers[0].label; $('googleLoginBtn').textContent = A.providers[1].label; for (const id of ['facebookLoginBtn', 'googleLoginBtn']) $(id).className = 'na'; $('coinImg').src = A.coinIcon; $('plusCoinsImg').src = A.coinIcon; $('login_coins').title = A.loggedIn.coinsTitle; $('shopbutton').textContent = A.loggedIn.shopButton; $('logoutbut').textContent = A.loggedIn.logout; $('authNote').textContent = A.providerNote; }
    const ni = $('nickInput'); ni.placeholder = cfg.nickname.placeholder; ni.maxLength = cfg.nickname.maxLength;
    $('startButton').textContent = cfg.play.label;
    $('howToPlayDiv').style.display = has.howToPlay ? '' : 'none'; if (has.howToPlay) fillList($('howToPlayDiv'), cfg.panels.howToPlay);
    $('updatesDiv').style.display = has.updates ? '' : 'none'; if (has.updates) fillList($('updatesDiv'), cfg.panels.updates);
    return has;
  }
  M.MenuRenderer = { themeVars, elementsPresent, apply };
  if (typeof module !== 'undefined') module.exports = M.MenuRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
