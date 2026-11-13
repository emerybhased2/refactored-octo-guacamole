/* Original skin art generator: turns a base animal recipe into a themed variant from the skin's NAME + CATEGORY (wiki names only; no wiki art is used).
 * Colour words -> palette maps, costume words -> extras, pattern words -> patterns; anything else gets a deterministic hue shift + accent so every skin differs. */
(function (g) {
  const { recolor, lum } = g.MopeSpecHelpers, M = g.MopeArt;
  const mixc = (a, b, k) => (c) => M.mix(a, b, Math.min(1, lum(c) * k));
  const PAL = {
    golden: (c) => M.mix('#a86a00', '#ffe45a', Math.min(1, lum(c) * 1.5 + 0.3)),
    azure: mixc('#082a58', '#9fe0ff', 1.15), red: mixc('#3a0808', '#ff7a6a', 1.2), green: mixc('#0c3a14', '#a8f08a', 1.2), purple: mixc('#24104a', '#d8a8ff', 1.2),
    dark: mixc('#08080c', '#6c6c78', 1.1), pale: mixc('#cdbcbc', '#ffffff', 1.25), pink: mixc('#6a1a40', '#ffc8e4', 1.25), orange: mixc('#6a2a00', '#ffc060', 1.2),
    copper: mixc('#4a2210', '#f0a070', 1.2), steel: mixc('#2a3038', '#d8e2ee', 1.2), teal: mixc('#063a3a', '#9af0e0', 1.2), yellow: mixc('#5a4a00', '#fff59a', 1.25), brown: mixc('#2a180e', '#b88858', 1.2),
  };
  const WORDS = [
    [/gold|golden|sun|solar/, 'golden'], [/aqua|azure|blue|ocean|frost|ice|icy|glacier|winter|snow|sapphire|water|wave|tide|sea/, 'azure'], [/ruby|red|crimson|fire|flame|lava|magma|blood|ember|inferno|cherry|devil|demon|hell|phoenix/, 'red'],
    [/emerald|green|jungle|toxic|acid|slime|zombie|plague|swamp|moss|leaf|clover|forest|mint|lime|goo/, 'green'], [/violet|purple|amethyst|void|cosmic|galaxy|nebula|singularity|dark matter|witch|magic|mystic|wizard|grape|plum/, 'purple'],
    [/shadow|dark|night|black|ebony|obsidian|midnight|raven|coal|soot|abyss|eclipse|ninja|bat|shade/, 'dark'], [/white|albino|pale|ghost|pearl|ivory|cloud|cotton|angel|spirit|bone|skeleton|milk|marshmallow/, 'pale'],
    [/pink|candy|bubblegum|rose|floral|flower|blossom|love|valentine|heart|cupid|sweet|cake|cookie/, 'pink'], [/orange|pumpkin|amber|autumn|tiger|carrot|citrus|sunset|dawn|burlone|ginger/, 'orange'],
    [/copper|bronze|rust|brass|clay|mud|desert|sand|dune|cactus|cacti/, 'copper'], [/silver|steel|chrome|robot|cyber|bot|mech|metal|iron|titan|neon|electric|storm|thunder|platinum/, 'steel'],
    [/teal|turquoise|lagoon|coral|mermaid|tropical|beach|summer|pool|balloon/, 'teal'], [/yellow|banana|lemon|honey|bee|corn|sunny|party|piñata|pinata/, 'yellow'], [/brown|chocolate|choco|coffee|mocha|bear|wood|oak|nut/, 'brown'],
  ];
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const hueShift = (deg) => (c) => { const n = parseInt(c.slice(1), 16), r = (n >> 16) / 255, gg = ((n >> 8) & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((gg - b) / d) % 6 : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4; h = (h * 60 + deg + 360) % 360; const l = (mx + mn) / 2, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0, k = (1 - Math.abs(2 * l - 1)) * Math.max(s, 0.45), x = k * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - k / 2; const [r1, g1, b1] = h < 60 ? [k, x, 0] : h < 120 ? [x, k, 0] : h < 180 ? [0, k, x] : h < 240 ? [0, x, k] : h < 300 ? [x, 0, k] : [k, 0, x]; return '#' + [r1 + m, g1 + m, b1 + m].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join(''); };
  const ACC = [
    [/santa|claus|christmas|elf|jolly|gift|present|festive/, (s) => ['hood', { c: '#c42a2a', w: 28, mark: '#ffffff' }]], [/witch|wizard|warlock|sorcer|mage/, () => ['hood', { c: '#4a2a7a', w: 28, mark: '#e8b830' }]],
    [/crown|king|queen|royal|emperor|empress|prince|lord|noble|majestic|monarch/, () => ['crown', { c: '#ffd84a', gem: '#d8362f' }]], [/angel|halo|holy|divine|heaven/, () => ['halo', { c: '#ffe96a' }]],
    [/devil|demon|imp|satan|belphegor|hell|horned|horn/, () => ['horn', { w: 8, len: 22, c: '#8a1a14', dy: -26 }]], [/vampire|dracula|fang|bat|werewolf|wolf/, () => ['fangs', { x: 8, len: 10 }]],
    [/pirate|captain|buccaneer|ninja|bandit|assassin|mask/, () => ['mask', { c: '#1a1a22' }]], [/party|birthday|celebrat|cone|clown/, () => ['crest', { n: 3, w: 8, c: '#ff5aa8' }]],
    [/crystal|gem|diamond|jewel|ice|frost|spike|thorn/, () => ['crystals', { n: 9, from: 0, to: 6.28, w: 7, len: 18, c: '#9fe8ff' }]],
    [/robot|cyber|bot|mech|android|drone|tech/, () => ['crest', { n: 2, w: 5, c: '#9aa6b4' }]], [/flower|floral|blossom|rose|bloom|garden/, () => ['crest', { n: 5, w: 6, c: '#ff8ab8' }]],
  ];
  const PAT = [[/stripe|tiger|zebra|bengal|candy/, (c) => ({ kind: 'stripes', c, gap: 22, w: 7, curve: 10 })], [/spot|leopard|cheetah|dalmat|polka|dot|ladybug|cow/, (c) => ({ kind: 'spots', c, n: 14, r: 7, seed: 5 })], [/camo|patch|cow|moss|swamp|plague/, (c) => ({ kind: 'patches', c, n: 10, s: 0.45, seed: 9 })], [/scale|armor|knight|dragon|croc|lizard|bone|skeleton|robot|cyber|mech/, (c) => ({ kind: 'scutes', c })]];
  function pickPal(name) { for (const [re, k] of WORDS) if (re.test(name)) return k; return null; }
  /** Returns a new recipe for `skin` ({name, category}) built from base recipe `spec` of animal `baseId`. */
  function make(spec, baseId, skin) {
    const name = (skin.name + ' ' + (skin.category || '')).toLowerCase(), nm = skin.name.toLowerCase(), h = hash(skin.name + baseId);
    let o;
    if (/gold-trim/.test(name)) { o = recolor(spec, (c) => c, baseId); const gold = PAL.golden; for (const k of ['under', 'mid', 'top', 'over']) if (o[k]) o[k] = JSON.parse(JSON.stringify(o[k]), (kk, v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? gold(v) : v)); o.rimColor = '#d9a21c'; if (o.head) o.headColor = o.headColor || undefined; }
    else { const pk = pickPal(nm) || pickPal(name); o = recolor(spec, pk ? PAL[pk] : hueShift((h % 12) * 30 + 15), baseId); }
    for (const [re, mk] of ACC) if (re.test(nm)) { o.top = (o.top || []).concat([mk(spec)]); break; }
    if (!/gold-trim/.test(name)) for (const [re, mk] of PAT) if (re.test(nm)) { const dk = M.shade(o.color || '#888888', -0.35); o.pattern = mk(dk); break; }
    if (/ghost|wraith|spectre|phantom|spirit|spook/.test(nm)) o.ghost = true;
    if (!/gold-trim/.test(name) && !pickPal(nm) && !ACC.some(([re]) => re.test(nm))) o.top = (o.top || []).concat([['crest', { n: 3 + (h % 3), w: 6, c: hueShift(((h >> 4) % 12) * 30)('#c85a5a') }]]); // accent so unthemed names still differ from the base
    return o;
  }
  g.MopeSkinGen = { make, pickPal };
  if (typeof module !== 'undefined') module.exports = g.MopeSkinGen;
})(typeof window !== 'undefined' ? window : globalThis);
