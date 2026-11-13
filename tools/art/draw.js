/* Procedural sprite engine in the style of Mope.io's art (top-down "blob" animals: round body, head peeking out the front,
 * big glossy black eyes with white highlights, flat muted colours with tonal shading, flat disc ears, thin tails).
 * ORIGINAL artwork: every shape is drawn by this code; no archived Mope.io image is copied or traced.
 * Coordinates: centred on (0,0) in a 256x256 frame, head toward +y ("down"), body radius ~ 96. Exported facing +x by export.js. */
(function (g) {
  const TAU = Math.PI * 2, FIT = 0.8, BODY_R = 90, BODY_FRAC = BODY_R * FIT / 128; // body radius as a fraction of the half-frame (renderer uses it to size sprites)
  const shade_ = null;
  function rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function shade(h, a) { const c = rgb(h).map((v) => Math.max(0, Math.min(255, Math.round(a >= 0 ? v + (255 - v) * a : v * (1 + a))))); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); }
  function lum(h) { const c = rgb(h); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
  function mix(a, b, t) { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const P = {
    ell(c, x, y, rx, ry, fill, rot = 0) { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); c.fill(); },
    poly(c, pts, fill) { c.fillStyle = fill; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); },
    line(c, pts, w, col, cap = 'round') { c.strokeStyle = col; c.lineWidth = w; c.lineCap = cap; c.lineJoin = 'round'; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke(); },
    curve(c, x0, y0, cx, cy, x1, y1, w, col) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.stroke(); },
  };

  /* ---- layers ---- */
  function tail(c, s, pal) {
    const t = s.tail; if (!t) return; const ry = s.body.ry, col = t.c || pal.dark, L = t.len || 40;
    if (t.kind === 'thin') P.curve(c, 0, -ry + 8, t.bend || 20, -ry - L * 0.5, -(t.bend || 20) * 0.5, -ry - L, t.w || 9, col);
    else if (t.kind === 'fluff') { P.ell(c, 0, -ry - L * 0.35, t.w || 30, L, col); if (t.tip) P.ell(c, 0, -ry - L * 1.05, (t.w || 30) * 0.85, L * 0.3, t.tip); }
    else if (t.kind === 'short') P.ell(c, 0, -ry - 4, t.w || 14, L * 0.5, col);
    else if (t.kind === 'curl') { c.strokeStyle = col; c.lineWidth = t.w || 8; c.lineCap = 'round'; c.beginPath(); c.arc(0, -ry - 8, 12, 0.3, TAU - 0.5, true); c.stroke(); }
    else if (t.kind === 'curlBig') { c.strokeStyle = col; c.lineWidth = t.w || 14; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -ry + 10); c.bezierCurveTo(0, -ry - 24, 34, -ry - 30, 30, -ry - 6); c.bezierCurveTo(28, -ry + 8, 14, -ry + 4, 16, -ry - 10); c.stroke(); }
    else if (t.kind === 'tuft') { P.curve(c, 0, -ry + 6, 8, -ry - L * 0.5, 0, -ry - L, t.w || 9, col); P.ell(c, 0, -ry - L, 7, 10, t.tip || '#222'); }
  }
  function body(c, s, pal) {
    const b = s.body; P.ell(c, 0, 0, b.rx + 3, b.ry + 3, pal.rim); P.ell(c, 0, 0, b.rx, b.ry, pal.body);
    c.save(); c.beginPath(); c.ellipse(0, 0, b.rx, b.ry, 0, 0, TAU); c.clip(); P.ell(c, -b.rx * 0.22, -b.ry * 0.28, b.rx * 0.62, b.ry * 0.5, 'rgba(255,255,255,' + (lum(pal.body) < 0.28 ? 0.035 : 0.10) + ')'); P.ell(c, b.rx * 0.1, b.ry * 0.42, b.rx * 0.95, b.ry * 0.5, 'rgba(0,0,0,0.045)'); c.restore();
    if (b.belly) { c.save(); c.beginPath(); c.ellipse(0, 0, b.rx, b.ry, 0, 0, TAU); c.clip(); P.ell(c, 0, b.ry * 0.35, b.rx * 0.8, b.ry * 0.75, b.belly); c.restore(); }
  }
  function pattern(c, s, pal) {
    const p = s.pattern; if (!p) return; const b = s.body, R = rng(p.seed || 7); c.save(); c.beginPath(); c.ellipse(0, 0, b.rx, b.ry, 0, 0, TAU); c.clip();
    const col = p.c || pal.dark;
    if (p.kind === 'spots') for (let i = 0; i < (p.n || 24); i++) { const a = R() * TAU, r = Math.sqrt(R()) * 0.95; const x = Math.cos(a) * r * b.rx, y = Math.sin(a) * r * b.ry; if (y > b.ry * 0.45) continue; P.ell(c, x, y, (p.r || 9) * (0.6 + R() * 0.7), (p.r || 9) * (0.6 + R() * 0.7), col, R() * 3); }
    else if (p.kind === 'rosettes') for (let i = 0; i < (p.n || 22); i++) { const a = R() * TAU, r = Math.sqrt(R()) * 0.9; const x = Math.cos(a) * r * b.rx, y = Math.sin(a) * r * b.ry; if (y > b.ry * 0.4) continue; c.strokeStyle = col; c.lineWidth = 5; c.beginPath(); c.arc(x, y, p.r || 9, R() * 2, R() * 2 + 4.2); c.stroke(); }
    else if (p.kind === 'stripes') for (let y = -b.ry; y < b.ry * 0.5; y += p.gap || 26) { c.fillStyle = col; c.beginPath(); c.moveTo(-b.rx, y); c.quadraticCurveTo(0, y + (p.curve || 14), b.rx, y); c.lineTo(b.rx, y + (p.w || 11)); c.quadraticCurveTo(0, y + (p.curve || 14) + (p.w || 11), -b.rx, y + (p.w || 11)); c.fill(); }
    else if (p.kind === 'long') for (const x of p.xs || [-30, 0, 30]) P.ell(c, x, -b.ry * 0.1, p.w || 7, b.ry * 0.75, col);
    else if (p.kind === 'patches') for (let i = 0; i < (p.n || 7); i++) { const a = R() * TAU, r = Math.sqrt(R()) * 0.85; P.ell(c, Math.cos(a) * r * b.rx, Math.sin(a) * r * b.ry - 6, (p.s || 1) * (16 + R() * 14), (p.s || 1) * (12 + R() * 12), col, R() * 3); }
    else if (p.kind === 'scutes') for (let row = 0; row < 5; row++) for (let i = -3; i <= 3; i++) { const x = i * 24 + (row % 2) * 12, y = -b.ry * 0.85 + row * 26; c.strokeStyle = col; c.lineWidth = 3.5; c.beginPath(); c.arc(x, y, 12, 0.2, Math.PI - 0.2); c.stroke(); }
    else if (p.kind === 'shell') { for (let row = -1; row <= 1; row++) for (let i = -2; i <= 2; i++) { const x = i * 40 + (row % 2) * 20, y = row * 34 - 8; c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + 0.5236; c.lineTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20); } c.closePath(); c.stroke(); } }
    else if (p.kind === 'fur') { c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round'; const FR = R; for (let i = 0; i < (p.n || 22); i++) { const x = (FR() - 0.5) * b.rx * 1.6, y = (FR() - 0.7) * b.ry * 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (FR() - 0.5) * 8, y + 14); c.stroke(); } }
    c.restore();
  }
  function ears(c, s, pal) {
    const e = s.ears; if (!e) return; const col = e.c || pal.dark, inn = e.inner || pal.light;
    for (const sd of [-1, 1]) {
      const x = sd * (e.x || 56), y = e.y || 22, z = e.size || 28;
      if (e.kind === 'round') { P.ell(c, x, y, z, z, col); P.ell(c, x, y + 2, z * 0.62, z * 0.62, inn); }
      else if (e.kind === 'flat') P.ell(c, x, y, z, z * 0.9, col);
      else if (e.kind === 'point') { P.poly(c, [[x - sd * z * 0.7, y + z * 0.7], [x + sd * z * 0.55, y + z * 0.5], [x + sd * z * 0.9, y - z * 1.2]], col); P.poly(c, [[x - sd * z * 0.3, y + z * 0.4], [x + sd * z * 0.3, y + z * 0.3], [x + sd * z * 0.6, y - z * 0.6]], inn); }
      else if (e.kind === 'long') { c.save(); c.translate(x, y); c.rotate(sd * (e.rot || 0.5)); P.ell(c, 0, -z * 0.9, z * 0.42, z * 1.25, col); P.ell(c, 0, -z * 0.9, z * 0.2, z * 0.9, inn); c.restore(); }
      else if (e.kind === 'small') P.ell(c, x, y, z * 0.7, z * 0.7, col);
    }
  }
  function head(c, s, pal) {
    const h = s.head; if (!h) return; const y = h.y;
    if (h.neck) P.ell(c, 0, y - h.r * 0.5, h.r * 0.9, h.r * 0.9, pal.rim);
    P.ell(c, 0, y, h.r + 2.5, h.r * (h.ry || 1) + 2.5, pal.rim); P.ell(c, 0, y, h.r, h.r * (h.ry || 1), pal.head);
    if (h.snout) { const sn = h.snout; P.ell(c, 0, y + h.r * 0.62, sn.w, sn.len, sn.c || pal.head); if (sn.shade) P.ell(c, 0, y + h.r * 0.62 + sn.len * 0.3, sn.w * 0.8, sn.len * 0.6, shade(sn.c || pal.head, 0.12)); }
    if (h.nose) { const n = h.nose; P.ell(c, 0, y + h.r * (h.snout ? 0.62 + (h.snout.len || 0) / h.r * 0.85 : 0.88), n.w || 7, n.h || 5, n.c || '#2a2222'); }
    if (h.nostrils) for (const sd of [-1, 1]) P.ell(c, sd * 9, y + h.r * 0.62 + h.snout.len * 0.4, 3.5, 5, '#3a2a2a');
  }
  function eyes(c, s, pal) {
    const e = s.eyes; if (!e) return; const r = e.tiny ? e.r : e.r * 1.12, tiny = e.tiny; // style pass: slightly bigger glossy eyes
    for (const sd of [-1, 1]) {
      const x = sd * e.gap, y = e.y;
      if (e.sleepy) { P.ell(c, x, y, r * 1.15, r * 1.15, e.ring || pal.rim); }
      if (e.iris) P.ell(c, x, y, r, r, e.iris);
      P.ell(c, x, y, e.iris ? r * 0.62 : r, e.iris ? r * 0.62 : r, '#0b0b0b');
      if (!tiny) { P.ell(c, x - r * 0.3, y - r * 0.32, r * 0.34, r * 0.34, '#fff'); P.ell(c, x + r * 0.32, y + r * 0.38, r * 0.14, r * 0.14, 'rgba(255,255,255,0.75)'); }
      if (e.angry) P.poly(c, [[x - sd * r * 1.3, y - r * 1.25 - sd * 0], [x + sd * r * 1.3, y - r * 0.2], [x - sd * r * 1.3, y - r * 0.4]].map((p) => [p[0], p[1]]), pal.dark);
    }
  }
  const H = (s) => s.head || { y: s.body.ry * 0.55, r: 34 }; // fish etc. have no distinct head: decorate the front of the body
  const X = {
    mane(c, s, pal, o) { const hy = H(s).y; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; P.ell(c, Math.cos(a) * o.r, hy - 6 + Math.sin(a) * o.r * 0.9, o.s, o.s, i % 2 ? o.c : shade(o.c, -0.12)); } P.ell(c, 0, hy - 6, o.r, o.r * 0.9, o.c); },
    antlers(c, s, pal, o) { const hy = H(s).y; for (const sd of [-1, 1]) { const col = o.c; P.line(c, [[sd * 14, hy - 8], [sd * 38, hy - 36], [sd * 52, hy - 64]], 7, col); P.line(c, [[sd * 30, hy - 26], [sd * 56, hy - 28]], 6, col); P.line(c, [[sd * 42, hy - 48], [sd * 66, hy - 54]], 6, col); P.line(c, [[sd * 50, hy - 62], [sd * 44, hy - 84]], 5, col); } },
    horn(c, s, pal, o) { const hy = H(s).y + (o.dy || 24); P.poly(c, [[-o.w, hy], [o.w, hy], [0, hy + o.len]], o.c); P.poly(c, [[-o.w * 0.4, hy + 2], [o.w * 0.1, hy + 2], [0, hy + o.len * 0.8]], shade(o.c, 0.25)); },
    hornBack(c, s, pal, o) { P.poly(c, [[-o.w, -s.body.ry * 0.7], [o.w, -s.body.ry * 0.7], [0, -s.body.ry * 0.7 - o.len]], o.c); },
    tusks(c, s, pal, o) { const hy = H(s).y + H(s).r * 0.5; for (const sd of [-1, 1]) P.curve(c, sd * (o.x || 12), hy, sd * (o.x || 12) + sd * 6, hy + o.len * 0.6, sd * (o.x || 12) + sd * (o.out || 4), hy + o.len, o.w || 9, o.c || '#f1ead6'); },
    spikes(c, s, pal, o) { const b = s.body; for (let i = 0; i < o.n; i++) { const a = (o.from + (o.to - o.from) * i / (o.n - 1)); const x = Math.cos(a) * b.rx, y = Math.sin(a) * b.ry, nx = Math.cos(a), ny = Math.sin(a); P.poly(c, [[x - ny * o.w, y + nx * o.w], [x + ny * o.w, y - nx * o.w], [x + nx * o.len, y + ny * o.len]], o.c); } },
    wings(c, s, pal, o) { for (const sd of [-1, 1]) { const x0 = sd * s.body.rx * 0.5, y0 = -s.body.ry * 0.05; c.fillStyle = o.c; c.beginPath(); c.moveTo(x0, y0 - 18); c.lineTo(sd * (s.body.rx + o.len), y0 - 60); c.lineTo(sd * (s.body.rx + o.len * 0.85), y0 + 6); c.lineTo(sd * (s.body.rx + o.len * 0.55), y0 + 30); c.lineTo(sd * (s.body.rx + o.len * 0.3), y0 + 18); c.lineTo(x0, y0 + 40); c.closePath(); c.fill(); P.line(c, [[x0, y0], [sd * (s.body.rx + o.len), y0 - 60]], 5, shade(o.c, -0.25)); P.line(c, [[x0, y0 + 6], [sd * (s.body.rx + o.len * 0.85), y0 + 6]], 4, shade(o.c, -0.25)); } },
    trunk(c, s, pal, o) { const hy = H(s).y; P.curve(c, 0, hy + 6, o.bend || 18, hy + o.len * 0.6, -(o.bend || 18) * 0.5, hy + o.len, o.w || 22, o.c); P.ell(c, -(o.bend || 18) * 0.5, hy + o.len, (o.w || 22) * 0.55, (o.w || 22) * 0.45, shade(o.c, -0.1)); },
    claws(c, s, pal, o) { for (const sd of [-1, 1]) { const x = sd * o.x, y = o.y + 16; P.line(c, [[sd * s.body.rx * 0.5, s.body.ry * 0.3], [x, y - 8]], 15, o.c); P.ell(c, x, y, o.r, o.r * 1.15, o.c); P.poly(c, [[x - o.r * 0.2, y + o.r * 1.25], [x + o.r * 0.2, y + o.r * 1.25], [x, y + o.r * 0.3]], shade(o.c, -0.4)); P.ell(c, x - sd * o.r * 0.25, y - o.r * 0.25, o.r * 0.35, o.r * 0.28, shade(o.c, 0.18)); } },
    paws(c, s, pal, o) { for (const sd of [-1, 1]) { const x = sd * o.x, y = o.y; P.ell(c, x, y, o.r, o.r * 1.15, o.c); for (const k of [-1, 0, 1]) P.line(c, [[x + k * o.r * 0.55, y + o.r * 0.6], [x + k * o.r * 0.65, y + o.r * 1.5]], 4.5, o.cl || '#f5efe6'); } },
    fins(c, s, pal, o) { for (const sd of [-1, 1]) { const x = sd * s.body.rx * 0.9, y = o.y; P.poly(c, [[x, y - o.w], [sd * (s.body.rx + o.len), y + o.w * 1.6], [x, y + o.w]], o.c); } },
    tailfin(c, s, pal, o) { const y = -s.body.ry + 6; P.poly(c, [[0, y], [-o.w, y - o.len], [0, y - o.len * 0.62], [o.w, y - o.len]], o.c); },
    dorsal(c, s, pal, o) { P.poly(c, [[-o.w, -o.len * 0.2], [o.w, -o.len * 0.2], [0, -o.len * 1.2]], o.c); P.line(c, [[0, -o.len * 1.1], [0, o.len * 0.5]], 5, shade(o.c, -0.18)); },
    sword(c, s, pal, o) { const y = s.body.ry - 6; P.poly(c, [[-o.w, y], [o.w, y], [0, y + o.len]], o.c); },
    tentacles(c, s, pal, o) { for (let i = 0; i < o.n; i++) { const t = o.n === 1 ? 0 : i / (o.n - 1) - 0.5, x0 = t * s.body.rx * 1.5; c.strokeStyle = i % 2 ? shade(o.c, -0.1) : o.c; c.lineWidth = o.w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, -s.body.ry * 0.5); for (let k = 1; k <= 6; k++) c.lineTo(x0 * (1 + k * 0.08) + Math.sin(k * 1.4 + i) * 12, -s.body.ry * 0.5 - k * (o.len / 6)); c.stroke(); } },
    arms(c, s, pal, o) { for (const sd of [-1, 1]) { P.ell(c, sd * (s.body.rx - 6), s.body.ry * 0.38, o.w, o.len, o.c); P.ell(c, sd * (s.body.rx - 4), s.body.ry * 0.38 + o.len * 0.7, o.w * 0.9, o.w * 0.9, shade(o.c, 0.1)); } },
    flippers(c, s, pal, o) { for (const sd of [-1, 1]) { c.save(); c.translate(sd * (s.body.rx - 4), o.y); c.rotate(sd * o.rot); P.ell(c, 0, o.len * 0.5, o.w, o.len, o.c); c.restore(); } },
    beak(c, s, pal, o) { const y = H(s).y + H(s).r * 0.6; P.poly(c, [[-o.w, y], [o.w, y], [0, y + o.len]], o.c); },
    crest(c, s, pal, o) { for (let i = 0; i < o.n; i++) { const y = -s.body.ry * 0.8 + i * (s.body.ry * 1.4 / o.n); P.ell(c, 0, y, o.w, o.w * 0.8, o.c); } },
    whiskers(c, s, pal, o) { const y = H(s).y + H(s).r * 0.7; for (const sd of [-1, 1]) for (const k of [-1, 0, 1]) P.line(c, [[sd * 8, y], [sd * (o.len), y + k * 8 - 3]], 2.5, o.c || 'rgba(255,255,255,.8)'); },
    mask(c, s, pal, o) { const hy = H(s).y; P.ell(c, 0, hy + 4, H(s).r * 0.78, H(s).r * 0.62, o.c); },
    tuftHead(c, s, pal, o) { P.ell(c, 0, H(s).y - H(s).r * 0.6, o.w, o.h, o.c); },
    spiral(c, s, pal, o) { c.strokeStyle = o.c; c.lineWidth = o.w || 6; c.lineCap = 'round'; c.beginPath(); for (let t = 0; t < 17; t += 0.25) { const r = 2 + t * (o.r || 4.2); const x = (o.x || 0) + Math.cos(t) * r, y = (o.y || -10) + Math.sin(t) * r; t ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); },
    hood(c, s, pal, o) { const hy = H(s).y; c.fillStyle = shade(o.c, -0.22); c.beginPath(); c.moveTo(0, hy + 24); c.bezierCurveTo(-o.w - 4, hy + 20, -o.w - 4, hy - 40, 0, hy - 60); c.bezierCurveTo(o.w + 4, hy - 40, o.w + 4, hy + 20, 0, hy + 24); c.fill(); c.fillStyle = o.c; c.beginPath(); c.moveTo(0, hy + 24); c.bezierCurveTo(-o.w, hy + 20, -o.w, hy - 40, 0, hy - 56); c.bezierCurveTo(o.w, hy - 40, o.w, hy + 20, 0, hy + 24); c.fill(); P.ell(c, 0, hy - 14, o.w * 0.5, 16, o.mark || shade(o.c, 0.25)); },
    legs(c, s, pal, o) { for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) { const a = -0.5 + i * 0.5, x0 = sd * s.body.rx * 0.55, y0 = s.body.ry * (0.35 - i * 0.3); P.line(c, [[x0, y0], [sd * (s.body.rx + o.len * 0.6), y0 + Math.sin(a) * 30 - 6], [sd * (s.body.rx + o.len), y0 + 26 + i * 10]], o.w || 8, o.c); } },
    featherWings(c, s, pal, o) { for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) { const x = sd * (s.body.rx * 0.5 + i * (o.len / 6)), y = -6 + i * 6 - 10; c.save(); c.translate(x, y); c.rotate(sd * (0.25 + i * 0.05)); P.ell(c, sd * 6, 0, 22 + (5 - i) * 2.5, 46 - i * 4, shade(o.c, -0.28)); P.ell(c, sd * 6, 0, 19 + (5 - i) * 2.5, 43 - i * 4, i % 2 ? o.c : shade(o.c, -0.1)); c.restore(); } },
    ossicones(c, s, pal, o) { const hy = H(s).y; for (const sd of [-1, 1]) { P.line(c, [[sd * 12, hy - 20], [sd * 18, hy - 46]], 7, o.c); P.ell(c, sd * 18, hy - 48, 7, 7, o.tip || '#3a2a1a'); } },
    tentaclesT(c, s, pal, o) { // tapered tentacles with sucker dots, fanning out behind the body
      for (let i = 0; i < o.n; i++) {
        const t = o.n === 1 ? 0 : i / (o.n - 1) - 0.5, x0 = t * (o.spread || s.body.rx * 1.3), y0 = -s.body.ry * (o.from || 0.45), dir = t * (o.fan || 0.9), ph = i * 1.7;
        for (let k = 0; k <= 16; k++) {
          const u = k / 16, wob = Math.sin(u * 5 + ph) * (o.wave || 9) * u, x = x0 + Math.sin(dir) * u * o.len + wob, y = y0 - Math.cos(dir) * u * o.len, r = o.w * (1 - u * 0.72) / 2;
          P.ell(c, x, y, r + 1.2, r + 1.2, shade(o.c, -0.2)); P.ell(c, x, y, r, r, i % 2 ? shade(o.c, -0.06) : o.c);
          if (o.suckers && k > 2 && k % 3 === 0 && r > 2.2) P.ell(c, x - r * 0.15, y, r * 0.4, r * 0.4, shade(o.c, 0.35));
        }
      }
    },
    pincers(c, s, pal, o) { // two-lobed crab claws on jointed arms
      for (const sd of [-1, 1]) {
        const bx = sd * s.body.rx * 0.62, by = s.body.ry * 0.3, ex = sd * (s.body.rx + o.out * 0.55), ey = by + o.reach * 0.5, cx = sd * (s.body.rx * 0.78 + o.out * 0.3), cy = by + o.reach;
        P.line(c, [[bx, by], [ex, ey], [cx, cy]], o.arm || 16, shade(o.c, -0.15)); P.line(c, [[bx, by], [ex, ey], [cx, cy]], (o.arm || 16) - 5, o.c);
        for (const lobe of [-1, 1]) { c.save(); c.translate(cx + lobe * sd * o.r * 0.34, cy + o.r * 0.5); c.rotate(-sd * lobe * 0.32); P.ell(c, 0, 0, o.r * 0.5 + 2.5, o.r * 1.12 + 2.5, shade(o.c, -0.22)); P.ell(c, 0, 0, o.r * 0.5, o.r * 1.12, o.c); P.ell(c, -o.r * 0.12, -o.r * 0.3, o.r * 0.16, o.r * 0.4, 'rgba(255,255,255,0.22)'); c.restore(); }
        P.ell(c, cx, cy - o.r * 0.15, o.r * 0.82, o.r * 0.7, o.c); P.ell(c, cx - sd * o.r * 0.2, cy - o.r * 0.3, o.r * 0.28, o.r * 0.2, 'rgba(255,255,255,0.22)');
      }
    },
    sideLegs(c, s, pal, o) { for (const sd of [-1, 1]) for (let i = 0; i < o.n; i++) { const y = s.body.ry * (0.3 - i * (0.9 / o.n)), x0 = sd * s.body.rx * 0.75, kx = sd * (s.body.rx + o.len * 0.55), ky = y + 12 - i * 4, ex = sd * (s.body.rx + o.len), ey = y + 34 - i * 6; P.line(c, [[x0, y], [kx, ky], [ex, ey]], o.w, shade(o.c, -0.2)); P.line(c, [[x0, y], [kx, ky], [ex, ey]], o.w - 3, o.c); } },
    stalks(c, s, pal, o) { for (const sd of [-1, 1]) { P.line(c, [[sd * o.x0, s.body.ry * 0.45], [sd * s.eyes.gap, s.eyes.y]], 7, shade(s.pal.body, -0.1)); } },
    fangs(c, s, pal, o) { const hy = H(s).y + H(s).r * 0.55; for (const sd of [-1, 1]) P.poly(c, [[sd * o.x - 4, hy], [sd * o.x + 4, hy], [sd * o.x, hy + o.len]], '#f8f4e6'); },
    fanFin(c, s, pal, o) { for (const sd of [-1, 1]) { c.fillStyle = o.c; c.beginPath(); c.moveTo(sd * s.body.rx * 0.8, o.y0); c.quadraticCurveTo(sd * (s.body.rx + o.w), o.y0 + o.h * 0.5, sd * s.body.rx * 0.8, o.y0 + o.h); c.closePath(); c.fill(); for (const k of [0.25, 0.5, 0.75]) P.line(c, [[sd * s.body.rx * 0.8, o.y0 + o.h * k], [sd * (s.body.rx + o.w * 0.7), o.y0 + o.h * (0.5 + (k - 0.5) * 0.7)]], 2, shade(o.c, -0.2)); } },
    halo(c, s, pal, o) { P.ell(c, 0, 0, s.body.rx + o.w, s.body.ry + o.w, o.c); },
    furTufts(c, s, pal, o) { const b = s.body; for (let i = 0; i < o.n; i++) { const a = o.from + (o.to - o.from) * i / (o.n - 1), x = Math.cos(a) * b.rx * 0.96, y = Math.sin(a) * b.ry * 0.96; c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2); P.poly(c, [[-o.w, 0], [o.w, 0], [0, -o.len]].map((p) => [p[0], p[1]]), i % 2 ? o.c : shade(o.c, -0.08)); c.restore(); } },
    birdWings(c, s, pal, o) {
      for (const sd of [-1, 1]) {
        const sx = sd * s.body.rx * 0.35, sy = 6, tx = sd * (s.body.rx + o.len), ty = -22, rx = sd * (s.body.rx * 0.45), ry = -s.body.ry * 1.0;
        c.fillStyle = shade(o.c, -0.25); c.beginPath(); c.moveTo(sx, sy - 14); c.lineTo(tx + sd * 4, ty - 4); c.lineTo(rx + sd * 4, ry - 4); c.lineTo(sx, sy + 24); c.closePath(); c.fill();
        c.fillStyle = o.c; c.beginPath(); c.moveTo(sx, sy - 12); c.lineTo(tx, ty); c.lineTo(rx, ry); c.lineTo(sx, sy + 22); c.closePath(); c.fill();
        for (let i = 0; i <= 6; i++) { const u = i / 6, x = tx + (rx - tx) * u, y = ty + (ry - ty) * u; c.save(); c.translate(x, y); c.rotate(sd * (-0.15 - u * 0.2)); P.ell(c, 0, -6, 11 - u * 2, 20 - u * 2, i % 2 ? o.c : shade(o.c, 0.12)); c.restore(); }
        P.line(c, [[sx, sy], [tx, ty]], 4, shade(o.c, -0.3));
      }
    },
    fan(c, s, pal, o) { // peacock-style tail fan: feathers radiating behind the body, each with an eye spot
      for (let i = 0; i < o.n; i++) { const a = -Math.PI / 2 + (i / (o.n - 1) - 0.5) * o.spread, x = Math.cos(a) * o.r, y = Math.sin(a) * o.r - s.body.ry * 0.25; c.save(); c.translate(x * 0.2, y * 0.2 - s.body.ry * 0.2); c.rotate(a + Math.PI / 2); P.ell(c, 0, -o.r * 0.55, 15, o.r * 0.62, shade(o.c, -0.18)); P.ell(c, 0, -o.r * 0.55, 12.5, o.r * 0.58, i % 2 ? o.c : shade(o.c, 0.08)); P.ell(c, 0, -o.r * 1.0, 8, 10, o.eye || '#2a58c8'); P.ell(c, 0, -o.r * 1.0, 3.6, 4.6, '#e8c43a'); c.restore(); }
    },
    jaws(c, s, pal, o) { // venus-flytrap style open trap
      const hy = H(s).y + 14; for (const sd of [-1, 1]) { c.save(); c.translate(sd * 8, hy); c.rotate(sd * 0.55); P.ell(c, sd * 14, 20, 30, 44, shade(o.c, -0.25)); P.ell(c, sd * 14, 20, 27, 41, o.c); P.ell(c, sd * 14, 20, 19, 32, o.inner); for (let i = 0; i < 6; i++) P.poly(c, [[sd * (-9), -10 + i * 12], [sd * (-9) - sd * 4, -10 + i * 12 + 6], [sd * 2, -10 + i * 12 + 6]], '#f6f2e0'); c.restore(); }
    },
    pouch(c, s, pal, o) { const y = H(s).y + H(s).r * 0.4; P.ell(c, 0, y + o.len * 0.5, o.w, o.len * 0.62, shade(o.c, -0.15)); P.poly(c, [[-o.w * 0.55, y], [o.w * 0.55, y], [0, y + o.len]], o.c); P.ell(c, 0, y + o.len * 0.62, o.w * 0.78, o.len * 0.34, shade(o.c, 0.15)); },
    crystals(c, s, pal, o) { const b = s.body; for (let i = 0; i < o.n; i++) { const a = o.from + (o.to - o.from) * i / (o.n - 1), x = Math.cos(a) * b.rx * 0.92, y = Math.sin(a) * b.ry * 0.92, L = o.len * (0.7 + 0.5 * ((i * 7) % 5) / 4); c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2); P.poly(c, [[-o.w, 0], [0, -L], [o.w, 0], [o.w * 0.4, o.w * 0.9], [-o.w * 0.4, o.w * 0.9]], shade(o.c, -0.2)); P.poly(c, [[-o.w * 0.5, -2], [0, -L * 0.85], [o.w * 0.15, -2]], shade(o.c, 0.3)); c.restore(); } },
    crown(c, s, pal, o) { const hy = H(s).y - H(s).r * 0.55; P.poly(c, [[-26, hy], [-26, hy - 20], [-14, hy - 8], [-7, hy - 28], [0, hy - 10], [7, hy - 28], [14, hy - 8], [26, hy - 20], [26, hy]], shade(o.c, -0.25)); P.poly(c, [[-23, hy - 2], [-23, hy - 16], [-13, hy - 6], [-7, hy - 24], [0, hy - 8], [7, hy - 24], [13, hy - 6], [23, hy - 16], [23, hy - 2]], o.c); for (const x of [-14, 0, 14]) P.ell(c, x, hy - 5, 3.6, 3.6, o.gem || '#d8362f'); },
    comb(c, s, pal, o) { const hy = H(s).y - H(s).r * 0.62; for (let i = -1; i <= 1; i++) P.ell(c, i * 8, hy - Math.abs(i) * -3, 7, 9, o.c); P.ell(c, 0, H(s).y + H(s).r * 0.7, 5, 9, o.c); },
    hammer(c, s, pal, o) { const y = H(s).y + 6; P.ell(c, 0, y, o.w + 3, o.h + 3, shade(o.c, -0.25)); P.ell(c, 0, y, o.w, o.h, o.c); P.ell(c, -o.w * 0.35, y - o.h * 0.3, o.w * 0.25, o.h * 0.3, 'rgba(255,255,255,.18)'); },
    underbody(c, s, pal, o) { /* drawn before body */ },
  };

  /* style pass: thin dark silhouette outline (every Mope-style sprite reads as a flat shape with a darker edge) */
  function outlined(ctx, S, outlineCol, draw) {
    const t = document.createElement('canvas'); t.width = t.height = S; const tc = t.getContext('2d'); draw(tc);
    const sil = document.createElement('canvas'); sil.width = sil.height = S; const sc = sil.getContext('2d'); sc.drawImage(t, 0, 0); sc.globalCompositeOperation = 'source-in'; sc.fillStyle = outlineCol; sc.fillRect(0, 0, S, S);
    const w = Math.max(1.5, S / 256 * 3.2); ctx.save(); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; ctx.drawImage(sil, Math.cos(a) * w, Math.sin(a) * w); } ctx.restore(); ctx.drawImage(t, 0, 0);
  }
  function drawAnimal(ctx, spec, S) {
    if (typeof document !== 'undefined' && !spec.__inner) { const col = shade(spec.color, -0.5); ctx.clearRect(0, 0, S, S); spec.__inner = true; try { outlined(ctx, S, col, (tc) => drawAnimal(tc, spec, S)); } finally { spec.__inner = false; } return; }
    const pal = { body: spec.color, head: spec.headColor || shade(spec.color, 0.1), dark: spec.darkColor || shade(spec.color, -0.22), light: spec.lightColor || shade(spec.color, 0.3), rim: shade(spec.color, -0.14) };
    pal.rim = spec.rimColor || pal.rim; spec.pal = pal;
    ctx.save(); ctx.clearRect(0, 0, S, S); ctx.translate(S / 2, S / 2); ctx.scale(S / 256 * FIT, S / 256 * FIT);
    for (const e of spec.under || []) X[e[0]](ctx, spec, pal, e[1]);
    tail(ctx, spec, pal);
    body(ctx, spec, pal); pattern(ctx, spec, pal);
    for (const e of spec.mid || []) X[e[0]](ctx, spec, pal, e[1]);
    ears(ctx, spec, pal);
    head(ctx, spec, pal);
    for (const e of spec.over || []) X[e[0]](ctx, spec, pal, e[1]);
    eyes(ctx, spec, pal);
    for (const e of spec.top || []) X[e[0]](ctx, spec, pal, e[1]);
    ctx.restore();
  }
  const api = { BODY_FRAC, drawAnimal, shade, mix, rng, P, X };
  if (typeof module !== 'undefined') module.exports = api; else g.MopeArt = api;
})(typeof window !== 'undefined' ? window : globalThis);
