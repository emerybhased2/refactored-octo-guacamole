(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Pure: CSS custom properties derived from a main-menu config (so each historical version restyles the same DOM). */
  function themeVars(cfg) {
    const n = cfg.nickname, p = cfg.play, o = cfg.options, v = {
      '--page-bg': cfg.page.background, '--col-w': cfg.column.w + 'px', '--col-h': cfg.column.h + 'px',
      '--logo-w': cfg.logo.w + 'px', '--logo-h': cfg.logo.h + 'px', '--logo-mt': cfg.logo.marginTop + 'px',
      '--nick-w': n.w + 'px', '--nick-border': n.border, '--nick-font': n.font, '--nick-pad': n.padding + 'px', '--nick-radius': n.radius + 'px', '--nick-bg': n.background, '--nick-color': n.color,
      '--play-w': p.w + 'px', '--play-h': p.h + 'px', '--play-mt': p.marginTop + 'px', '--play-bg': p.background, '--play-hover': p.hover, '--play-bb': p.borderBottom, '--play-color': p.color, '--play-radius': p.radius + 'px',
      '--opt-bg': o.background, '--opt-top': o.top + 'px', '--sel-bg': o.select.background, '--sel-border': o.select.border, '--inactive-op': String(cfg.modes.inactiveOpacity),
    };
    if (cfg.panels) { v['--how-bg'] = cfg.panels.howToPlay.background; v['--upd-bg'] = cfg.panels.updates.background; }
    return v;
  }
  /** Pure: which optional menu elements this version's config actually contains (nothing from later eras leaks in). */
  function elementsPresent(cfg) {
    return { modes: !!cfg.modes, sandbox: !!(cfg.modes && cfg.modes.sandbox), settings: !!(cfg.icons && cfg.icons.settings), mute: !!(cfg.icons && cfg.icons.mute),
      howToPlay: !!(cfg.panels && cfg.panels.howToPlay), updates: !!(cfg.panels && cfg.panels.updates), options: !!cfg.options };
  }
  function fillList(el, panel) {
    el.innerHTML = ''; const h = document.createElement('h2'); h.textContent = panel.title; el.appendChild(h);
    const ul = document.createElement('ul'); for (const t of panel.items) { const li = document.createElement('li'); li.textContent = '- ' + t; ul.appendChild(li); } el.appendChild(ul);
  }
  /** Applies a config to the static DOM skeleton. */
  function apply(cfg, doc) {
    const $ = (id) => doc.getElementById(id), vars = themeVars(cfg), has = elementsPresent(cfg);
    for (const [k, val] of Object.entries(vars)) doc.documentElement.style.setProperty(k, val);
    const L = $('logo'); L.src = cfg.logo.src;
    const set = (id, c) => { const im = $(id).querySelector('img'); im.src = c.src; im.width = c.w; im.height = c.h; im.title = c.title || ''; };
    set('button_GMnormal', cfg.modes.normal);
    $('button_GMsandbox').style.display = has.sandbox ? '' : 'none'; if (has.sandbox) set('button_GMsandbox', cfg.modes.sandbox);
    $('settingsButton').style.display = has.settings ? '' : 'none'; if (has.settings) set('settingsButton', cfg.icons.settings);
    $('button_mute').style.display = has.mute ? '' : 'none'; if (has.mute) set('button_mute', cfg.icons.mute);
    set('closeBut', Object.assign({ title: 'Close' }, cfg.icons.close));
    const ni = $('nickInput'); ni.placeholder = cfg.nickname.placeholder; ni.maxLength = cfg.nickname.maxLength;
    $('startButton').textContent = cfg.play.label;
    $('howToPlayDiv').style.display = has.howToPlay ? '' : 'none'; if (has.howToPlay) fillList($('howToPlayDiv'), cfg.panels.howToPlay);
    $('updatesDiv').style.display = has.updates ? '' : 'none'; if (has.updates) fillList($('updatesDiv'), cfg.panels.updates);
    return has;
  }
  M.MenuRenderer = { themeVars, elementsPresent, apply };
  if (typeof module !== 'undefined') module.exports = M.MenuRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
