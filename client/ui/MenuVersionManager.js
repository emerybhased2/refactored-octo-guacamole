(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Lists historical versions and loads the version-specific main-menu configuration. Never falls back to a different era's menu. */
  const MenuVersionManager = {
    versions: [], current: null, menuCfg: null,
    async init(fetchFn = fetch) {
      this.versions = await (await fetchFn('api/versions')).json();
      this.versions.sort((a, b) => a.date.localeCompare(b.date));
      return this.versions;
    },
    async select(id, fetchFn = fetch) {
      const v = this.versions.find((x) => x.id === id);
      if (!v) throw new Error('Unknown version ' + id);
      const res = await fetchFn(v.menu);
      if (!res.ok) throw new Error('Menu config missing for ' + id + ' (' + v.menu + ')');
      this.current = v; this.menuCfg = await res.json();
      if (this.menuCfg.version !== id) throw new Error('Menu config version mismatch: ' + this.menuCfg.version + ' != ' + id);
      return this.menuCfg;
    },
  };
  M.MenuVersionManager = MenuVersionManager;
  if (typeof module !== 'undefined') module.exports = { MenuVersionManager };
})(typeof window !== 'undefined' ? window : globalThis);
