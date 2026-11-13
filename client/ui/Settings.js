(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Settings exist only in versions whose features.settings is true. Dev flags (?dev=1) are not player settings. */
  M.Settings = {
    available: (features) => !!(features && features.settings),
    load() { try { return JSON.parse(localStorage.getItem('mope.settings') || '{}'); } catch (e) { return {}; } },
    save(s) { try { localStorage.setItem('mope.settings', JSON.stringify(s)); } catch (e) {} },
  };
})(typeof window !== 'undefined' ? window : globalThis);
