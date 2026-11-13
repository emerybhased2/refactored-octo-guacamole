(function (g) {
  const M = (g.Mope = g.Mope || {});
  /** Shop is gated by version features.shop. Not implemented yet: no shop is historically confirmed for 2017-04-07. */
  M.Shop = { available: (features) => !!(features && features.shop), implemented: false };
})(typeof window !== 'undefined' ? window : globalThis);
