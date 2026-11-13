(function (g) {
  const M = (g.Mope = g.Mope || {});
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  /** Main menu controller (DOM, themed by the version's config). */
  class MainMenu {
    constructor({ onPlay }) {
      const $ = (id) => document.getElementById(id);
      this.$ = $; this.onPlay = onPlay; this.cfg = null; this.mode = store.get('mope.mode', 'normal'); this.options = {}; this.muted = store.get('mope.muted', '0') === '1';
      $('nickInput').value = store.get('mope.nick', '');
      const go = () => { const n = $('nickInput').value.trim(); store.set('mope.nick', n); this.onPlay(n, this.mode); };
      $('startButton').addEventListener('click', go);
      $('nickInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      $('button_GMnormal').addEventListener('click', () => this.setMode('normal'));
      $('button_GMsandbox').addEventListener('click', () => this.setMode('sandbox'));
      $('settingsButton').addEventListener('click', () => { const o = $('optionsDiv'); o.style.display = o.style.display === 'block' ? 'none' : 'block'; });
      $('closeBut').addEventListener('click', () => ($('optionsDiv').style.display = 'none'));
      $('button_mute').addEventListener('click', () => { this.muted = !this.muted; store.set('mope.muted', this.muted ? '1' : '0'); this.paintMute(); });
    }
    setConfig(cfg) {
      this.cfg = cfg; const $ = this.$, has = M.MenuRenderer.apply(cfg, document);
      if (!has.sandbox && this.mode === 'sandbox') this.mode = 'normal';
      this.setMode(this.mode);
      // Region/server: this project has one local server; the control exists because the original menu has it.
      const fill = (sel, text) => { sel.innerHTML = ''; sel.add(new Option(text)); };
      fill($('regionSelect'), 'Local'); fill($('serverSelect'), 'Local server #1');
      const list = $('optionsList'); list.innerHTML = '';
      for (const c of cfg.options.checkboxes) {
        const lab = document.createElement('label'), cb = document.createElement('input'), sp = document.createElement('span');
        cb.type = 'checkbox'; cb.id = 'options_' + c.id; cb.disabled = !c.implemented; cb.checked = c.implemented && store.get('mope.opt.' + c.id, '0') === '1';
        sp.style.color = c.color; sp.textContent = c.label + (c.implemented ? '' : ' (not implemented)'); if (!c.implemented) lab.className = 'na';
        this.options[c.id] = cb.checked;
        cb.addEventListener('change', () => { this.options[c.id] = cb.checked; store.set('mope.opt.' + c.id, cb.checked ? '1' : '0'); });
        lab.appendChild(cb); lab.appendChild(sp); list.appendChild(lab);
      }
      this.paintMute();
    }
    setMode(m) {
      this.mode = m; store.set('mope.mode', m); const $ = this.$, op = this.cfg ? this.cfg.modes.inactiveOpacity : 0.4;
      $('button_GMnormal').className = m === 'normal' ? 'button' : 'button buttonDisabled';
      $('button_GMsandbox').className = m === 'sandbox' ? 'button' : 'button buttonDisabled';
    }
    paintMute() { const i = this.cfg && this.cfg.icons, im = this.$('button_mute_img'); if (i && i.muteOff) im.src = this.muted ? i.muteOff.src : i.mute.src; } // sound_on.png is archived; sound_off.png is our recreation
    show() { this.$('startMenuWrapper').style.display = 'block'; this.$('gameAreaWrapper').style.opacity = 1; }
    hide() { this.$('startMenuWrapper').style.display = 'none'; this.$('optionsDiv').style.display = 'none'; }
    setSpawnLabel(t) { this.$('spawnXpLabel').textContent = t || ''; }
  }
  M.MainMenu = MainMenu;
})(typeof window !== 'undefined' ? window : globalThis);
