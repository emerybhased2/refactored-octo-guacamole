/* GUI + terrain art (ORIGINAL, Mope.io style: flat shapes, darker rims, green rounded-icon look of the menu buttons). */
(function (g) {
  const A = g.MopeArt, P = A.P, sh = A.shade, TAU = Math.PI * 2;
  const CREAM = '#f6f2e4', INK = '#27402c';

  /* ---- ability icons (64x64): round green badge + simple glyph ---- */
  const GL = {
    hide_hole_dig(c) { P.ell(c, 0, 8, 17, 9, '#3a2a1c'); P.ell(c, -18, 14, 9, 5, '#8a6a44'); P.ell(c, 19, 14, 9, 5, '#8a6a44'); P.poly(c, [[-4, -16], [4, -16], [0, -4]], CREAM); P.line(c, [[0, -22], [0, -4]], 4, CREAM); },
    shell(c) { c.fillStyle = CREAM; c.beginPath(); c.arc(0, 8, 20, Math.PI, 0); c.closePath(); c.fill(); for (const x of [-10, 0, 10]) P.line(c, [[x, 8], [x * 0.6, -10]], 2.5, INK); P.line(c, [[-18, -2], [18, -2]], 2.5, INK); },
    shock(c) { P.poly(c, [[6, -24], [-12, 4], [-2, 4], [-8, 24], [14, -6], [3, -6]], '#ffd94a'); },
    ink(c) { P.ell(c, 0, 4, 14, 17, '#1f2430'); P.poly(c, [[-8, -8], [8, -8], [0, -26]], '#1f2430'); P.ell(c, -5, 0, 3, 5, 'rgba(255,255,255,.55)'); for (const [x, y] of [[-22, 12], [22, 14], [20, -12]]) P.ell(c, x, y, 3, 3, '#1f2430'); },
    disguise(c) { P.ell(c, 0, 0, 22, 15, CREAM); P.ell(c, -8, -2, 5, 5, INK); P.ell(c, 8, -2, 5, 5, INK); P.line(c, [[-12, 9], [0, 13], [12, 9]], 3, INK); },
    slide_on_ice(c) { P.poly(c, [[-20, 6], [-12, -10], [14, -10], [22, 6]], '#bfe6f7'); P.line(c, [[-12, -10], [-4, 6]], 2.5, '#fff'); P.line(c, [[-24, 18], [24, 18]], 4, CREAM); P.line(c, [[-16, 24], [10, 24]], 3, CREAM); },
    charge(c) { P.poly(c, [[24, 0], [-2, -18], [-2, -7], [-22, -7], [-22, 7], [-2, 7], [-2, 18]], CREAM); },
    inflate(c) { P.ell(c, 0, 0, 14, 14, CREAM); for (let i = 0; i < 10; i++) { const a = i * TAU / 10; P.poly(c, [[Math.cos(a - 0.2) * 13, Math.sin(a - 0.2) * 13], [Math.cos(a + 0.2) * 13, Math.sin(a + 0.2) * 13], [Math.cos(a) * 25, Math.sin(a) * 25]], CREAM); } P.ell(c, -4, -3, 3, 3, INK); P.ell(c, 5, -3, 3, 3, INK); },
    howl(c) { c.fillStyle = CREAM; c.beginPath(); c.arc(0, 0, 22, 0.5, TAU - 0.5); c.arc(9, 0, 17, TAU - 0.9, 0.9, true); c.closePath(); c.fill(); P.ell(c, 14, -14, 2.5, 2.5, CREAM); P.ell(c, 20, 4, 2, 2, CREAM); },
    throw_snow(c) { P.ell(c, -8, 8, 11, 11, CREAM); c.strokeStyle = CREAM; c.lineWidth = 3; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(-4, 0); c.quadraticCurveTo(10, -26, 24, -14); c.stroke(); c.setLineDash([]); },
    claw_slash(c) { for (const x of [-12, 0, 12]) P.poly(c, [[x - 5, -24], [x + 5, -24], [x + 11, 24], [x + 3, 24]], CREAM); },
    extra_boost(c) { for (const x of [-12, 4]) P.poly(c, [[x, -18], [x + 16, 0], [x, 18], [x - 8, 18], [x + 8, 0], [x - 8, -18]], CREAM); },
    drop_snow(c) { P.ell(c, 0, -8, 12, 12, CREAM); P.poly(c, [[-9, 8], [9, 8], [0, 24]], CREAM); },
    roll_snow(c) { P.ell(c, 4, 0, 19, 19, CREAM); P.ell(c, 4, 0, 19, 19, 'rgba(0,0,0,0)'); c.strokeStyle = 'rgba(39,64,44,.5)'; c.lineWidth = 3; c.beginPath(); c.arc(4, 0, 11, 0.8, 4.2); c.stroke(); P.line(c, [[-26, -8], [-18, -8]], 3, CREAM); P.line(c, [[-28, 2], [-20, 2]], 3, CREAM); },
    loud_noise(c) { P.poly(c, [[-22, -7], [-12, -7], [-2, -17], [-2, 17], [-12, 7], [-22, 7]], CREAM); for (const r of [10, 18]) { c.strokeStyle = CREAM; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.arc(2, 0, r, -0.9, 0.9); c.stroke(); } },
    fire(c) { P.poly(c, [[0, -26], [14, -6], [18, 10], [8, 24], [-8, 24], [-18, 10], [-12, -8], [-4, -2]], '#ff8a2a'); P.poly(c, [[0, -6], [8, 8], [4, 20], [-5, 20], [-8, 8]], '#ffd94a'); },
    bite_drag(c) { P.poly(c, [[-22, -4], [22, -4], [16, -18], [-16, -18]], CREAM); P.poly(c, [[-22, 4], [22, 4], [16, 18], [-16, 18]], CREAM); for (let i = -2; i <= 2; i++) { P.poly(c, [[i * 8 - 4, -4], [i * 8 + 4, -4], [i * 8, 3]], INK); P.poly(c, [[i * 8 - 4, 4], [i * 8 + 4, 4], [i * 8, -3]], INK); } },
    dive(c) { P.poly(c, [[-8, -22], [8, -22], [8, 0], [18, 0], [0, 20], [-18, 0], [-8, 0]], CREAM); P.line(c, [[-22, 22], [-12, 18], [-2, 22], [8, 18], [18, 22]], 2.5, '#bfe6f7'); },
    whirlpool(c) { c.strokeStyle = CREAM; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); for (let t = 0; t < 14; t += 0.2) { const r = 2 + t * 1.6; c.lineTo(Math.cos(t * 0.9) * r, Math.sin(t * 0.9) * r); } c.stroke(); },
    freeze(c) { for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; P.line(c, [[Math.cos(a) * -24, Math.sin(a) * -24], [Math.cos(a) * 24, Math.sin(a) * 24]], 4, '#e6f6ff'); } for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; P.line(c, [[Math.cos(a) * 14, Math.sin(a) * 14], [Math.cos(a + 0.6) * 20, Math.sin(a + 0.6) * 20]], 3, '#e6f6ff'); } },
    growl(c) { P.poly(c, [[-24, -12], [-14, -22], [-4, -12], [6, -22], [16, -12], [24, -20], [24, 14], [-24, 14]], CREAM); for (let i = -2; i <= 2; i++) P.poly(c, [[i * 9 - 4, 14], [i * 9 + 4, 14], [i * 9, 4]], INK); },
    tail_slap(c) { c.strokeStyle = CREAM; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(-20, 18); c.quadraticCurveTo(-18, -22, 12, -14); c.stroke(); for (const k of [0, 1, 2]) P.line(c, [[16 + k * 3, -22 + k * 9], [26 + k * 2, -24 + k * 9]], 3, CREAM); },
    trunk_hit(c) { c.strokeStyle = CREAM; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(-18, -18); c.quadraticCurveTo(-22, 14, 4, 16); c.stroke(); for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.5; P.line(c, [[14 + Math.cos(a) * 6, 14 + Math.sin(a) * 6], [14 + Math.cos(a) * 16, 14 + Math.sin(a) * 16]], 3, CREAM); } },
    dig_for_food(c) { P.ell(c, 0, 14, 22, 8, '#8a6a44'); P.ell(c, -6, 2, 7, 7, '#e8503a'); P.line(c, [[14, -22], [4, 6]], 5, CREAM); P.poly(c, [[-2, 8], [10, 8], [4, 20]], CREAM); },
    suffocate_prey(c) { c.strokeStyle = CREAM; c.lineWidth = 6; for (const r of [8, 15, 22]) { c.beginPath(); c.arc(0, 0, r, 0.4 + r * 0.05, 5.8 - r * 0.04); c.stroke(); } },
    burrow_hole(c) { P.ell(c, 0, 10, 20, 9, '#3a2a1c'); P.poly(c, [[-7, -22], [7, -22], [7, -8], [14, -8], [0, 4], [-14, -8], [-7, -8]], CREAM); },
    pull_from_hole(c) { P.ell(c, 0, 14, 20, 8, '#3a2a1c'); P.poly(c, [[-7, 6], [7, 6], [7, -8], [14, -8], [0, -22], [-14, -8], [-7, -8]], CREAM); },
    venom_spit(c) { P.ell(c, -6, 4, 11, 13, '#9be05a'); P.poly(c, [[-14, -4], [2, -4], [-6, -22]], '#9be05a'); for (const [x, y, r] of [[14, -6, 4], [20, 4, 3], [13, 12, 3]]) P.ell(c, x, y, r, r, '#9be05a'); },
    spin_web(c) { c.strokeStyle = CREAM; c.lineWidth = 2.5; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); c.stroke(); } for (const r of [8, 15, 22]) { c.beginPath(); for (let i = 0; i <= 8; i++) { const a = i * Math.PI / 4; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.stroke(); } },
    throw_banana(c) { c.strokeStyle = '#f2d43d'; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.arc(-4, -6, 18, 0.5, 2.6); c.stroke(); c.strokeStyle = CREAM; c.lineWidth = 3; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(8, 8); c.quadraticCurveTo(18, -18, 26, -12); c.stroke(); c.setLineDash([]); },
    cause_wave(c) { for (const y of [-14, 0, 14]) { c.strokeStyle = y === 0 ? '#bfe6f7' : CREAM; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-24, y); for (let x = -24; x <= 24; x += 4) c.lineTo(x, y + Math.sin(x * 0.28) * 6); c.stroke(); } },
    spikes(c) { for (let i = 0; i < 9; i++) { const a = -Math.PI + i * Math.PI / 8; P.poly(c, [[Math.cos(a - 0.14) * 10, Math.sin(a - 0.14) * 10 + 8], [Math.cos(a + 0.14) * 10, Math.sin(a + 0.14) * 10 + 8], [Math.cos(a) * 26, Math.sin(a) * 26 + 8]], CREAM); } P.ell(c, 0, 8, 12, 8, CREAM); },
    arm_smash(c) { P.ell(c, 0, -2, 17, 14, CREAM); P.poly(c, [[-6, 6], [6, 6], [0, 24]], CREAM); for (const a of [-1.0, 0, 1.0]) P.line(c, [[Math.sin(a) * 22, -Math.cos(a) * 22 - 2], [Math.sin(a) * 28, -Math.cos(a) * 28 - 2]], 3.5, CREAM); },
    jaws_bite(c) { P.poly(c, [[-22, -2], [22, -8], [18, -22], [-18, -18]], CREAM); P.poly(c, [[-22, 2], [22, 8], [18, 22], [-18, 18]], CREAM); for (let i = -2; i <= 2; i++) { P.poly(c, [[i * 8 - 3, -8], [i * 8 + 3, -8], [i * 8, -1]], INK); P.poly(c, [[i * 8 - 3, 8], [i * 8 + 3, 8], [i * 8, 1]], INK); } },
    ambush_attack(c) { for (const [x, y, r] of [[-10, 6, 13], [8, 8, 14], [0, -4, 14]]) P.ell(c, x, y, r, r, '#1f6a2a'); P.ell(c, -5, 2, 3.5, 3.5, '#ffd94a'); P.ell(c, 5, 2, 3.5, 3.5, '#ffd94a'); },
    stomp(c) { P.ell(c, 0, 6, 15, 18, CREAM); for (const x of [-9, 0, 9]) P.ell(c, x, -18, 4, 5, CREAM); for (const x of [-24, 24]) P.line(c, [[x, 0], [x * 1.25, 12]], 3.5, CREAM); },
    fly_with_prey(c) { for (const sd of [-1, 1]) P.poly(c, [[sd * 4, 6], [sd * 24, -14], [sd * 26, -2], [sd * 14, 14]], CREAM); P.ell(c, 0, 10, 7, 7, '#e8503a'); },
    stink(c) { c.strokeStyle = '#c8e07a'; c.lineWidth = 5; c.lineCap = 'round'; for (const x of [-14, 0, 14]) { c.beginPath(); c.moveTo(x, 22); c.bezierCurveTo(x - 12, 10, x + 12, 0, x, -10); c.bezierCurveTo(x - 8, -16, x + 6, -20, x, -24); c.stroke(); } },
    camouflage(c) { P.poly(c, [[-10, -22], [10, -22], [0, 22]], '#f08a1a'); for (const [x, y, r] of [[-18, -6, 4], [18, 0, 3.5], [-14, 14, 3], [14, 16, 4], [0, -26, 3]]) P.ell(c, x, y, r, r, CREAM); P.line(c, [[-6, -14], [6, -14]], 2.5, sh('#f08a1a', -0.3)); },
    back_kick(c) { P.poly(c, [[-22, 0], [-4, -16], [-4, -6], [20, -6], [20, 6], [-4, 6], [-4, 16]], CREAM); P.line(c, [[10, -18], [22, -18]], 3, CREAM); P.line(c, [[10, 18], [22, 18]], 3, CREAM); },
  };
  function abilityIcon(ctx, id, S) {
    ctx.save(); ctx.clearRect(0, 0, S, S); ctx.translate(S / 2, S / 2); ctx.scale(S / 64, S / 64);
    P.ell(ctx, 0, 0, 31, 31, '#1c6b30'); P.ell(ctx, 0, 0, 28, 28, '#2fa04a'); ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 23, 3.6, 5.2); ctx.stroke();
    ctx.save(); ctx.scale(0.88, 0.88); (GL[id] || GL.charge)(ctx); ctx.restore(); ctx.restore();
  }

  /* ---- menu icon in the style of the green rounded-square buttons: muted speaker (the archived client lists sound_off.png but it was never captured) ---- */
  function soundOff(ctx, S) {
    ctx.save(); ctx.clearRect(0, 0, S, S); ctx.scale(S / 60, S / 60);
    const rr = (x, y, w, h, r, f) => { ctx.fillStyle = f; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill(); };
    rr(2, 2, 56, 56, 12, '#1f8f35'); rr(5, 5, 50, 50, 10, '#3fba54');
    const gray = '#b8c2bb'; P.poly(ctx, [[14, 24], [24, 24], [34, 15], [34, 45], [24, 36], [14, 36]], gray);
    P.line(ctx, [[39, 24], [51, 36]], 4.5, '#d9534f'); P.line(ctx, [[51, 24], [39, 36]], 4.5, '#d9534f'); ctx.restore();
  }

  /* ---- seamless 256x256 terrain tiles ---- */
  function tile(ctx, kind, base, S) {
    const R = A.rng(kind.length * 977 + 11); ctx.save(); ctx.clearRect(0, 0, S, S); ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
    const wrap = (fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { ctx.save(); ctx.translate(dx, dy); fn(); ctx.restore(); } };
    if (kind === 'land') {
      for (let i = 0; i < 34; i++) { const x = R() * S, y = R() * S, dark = R() > 0.45, col = dark ? sh(base, -0.08) : sh(base, 0.07); wrap(() => { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(x + k * 5, y); ctx.quadraticCurveTo(x + k * 7, y - 7, x + k * 11, y - 13); ctx.stroke(); } }); }
      for (let i = 0; i < 10; i++) { const x = R() * S, y = R() * S; wrap(() => { P.ell(ctx, x, y, 9 + R() * 8, 6 + R() * 5, sh(base, -0.05)); }); }
    } else if (kind === 'ocean') {
      for (let i = 0; i < 26; i++) { const x = R() * S, y = R() * S, w = 18 + R() * 20; wrap(() => { ctx.strokeStyle = sh(base, 0.14); ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y + w * 0.6, w, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }); }
      for (let i = 0; i < 12; i++) { const x = R() * S, y = R() * S; wrap(() => { P.ell(ctx, x, y, 12 + R() * 14, 6 + R() * 6, sh(base, -0.06)); }); }
    } else if (kind === 'desert') {
      for (let i = 0; i < 14; i++) { const x = R() * S, y = R() * S, w = 40 + R() * 50; wrap(() => { ctx.strokeStyle = sh(base, -0.07); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y - 12, x + w, y); ctx.stroke(); ctx.strokeStyle = sh(base, 0.1); ctx.beginPath(); ctx.moveTo(x - w * 0.7, y + 7); ctx.quadraticCurveTo(x, y - 4, x + w * 0.7, y + 7); ctx.stroke(); }); }
      for (let i = 0; i < 30; i++) { const x = R() * S, y = R() * S; wrap(() => P.ell(ctx, x, y, 1.5 + R() * 3, 1 + R() * 2, sh(base, R() > 0.5 ? -0.14 : 0.16))); }
    } else if (kind === 'volcano') {
      for (let i = 0; i < 20; i++) { const x = R() * S, y = R() * S; wrap(() => P.ell(ctx, x, y, 8 + R() * 18, 6 + R() * 12, sh(base, R() > 0.5 ? -0.12 : 0.08), R() * 3)); }
      for (let i = 0; i < 9; i++) { let x = R() * S, y = R() * S; const pts = [[x, y]]; for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 50; y += (R() - 0.3) * 40; pts.push([x, y]); } wrap(() => { P.line(ctx, pts, 5, '#8a2a14'); P.line(ctx, pts, 2.4, '#ff8a2a'); }); }
    } else { // arctic
      for (let i = 0; i < 9; i++) { let x = R() * S, y = R() * S; const pts = [[x, y]]; for (let k = 0; k < 4; k++) { x += (R() - 0.5) * 60; y += (R() - 0.2) * 40; pts.push([x, y]); } wrap(() => P.line(ctx, pts, 2.5, sh(base, -0.1))); }
      for (let i = 0; i < 28; i++) { const x = R() * S, y = R() * S; wrap(() => P.ell(ctx, x, y, 2 + R() * 3, 2 + R() * 3, '#ffffff')); }
    }
    ctx.restore();
  }
  /* Shop currency icon (the archived page references shop/mopecoin.png, which was not captured): an original gold coin. */
  function coin(ctx, S) {
    ctx.save(); ctx.clearRect(0, 0, S, S); ctx.translate(S / 2, S / 2); ctx.scale(S / 64, S / 64);
    P.ell(ctx, 0, 0, 30, 30, '#9a6a10'); P.ell(ctx, 0, 0, 27, 27, '#f2c230'); P.ell(ctx, 0, 0, 21, 21, '#c8941c'); P.ell(ctx, 0, 0, 19, 19, '#f8d860');
    for (const [x, y, r] of [[0, 4, 7], [-10, -6, 4], [0, -10, 4], [10, -6, 4]]) P.ell(ctx, x, y, r, r * 0.9, '#c8941c'); P.ell(ctx, -10, -14, 9, 4, 'rgba(255,255,255,.55)', -0.5); ctx.restore();
  }
  g.MopeGui = { coin, abilityIcon, soundOff, tile, abilityIds: Object.keys(GL) };
  if (typeof module !== 'undefined') module.exports = g.MopeGui;
})(typeof window !== 'undefined' ? window : globalThis);
