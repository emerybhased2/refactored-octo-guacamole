#!/usr/bin/env node
// Validates the historical databases. Exit code 1 on errors; warnings (e.g. placeholder sprites) do not fail.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const activeAt = (rel, rem, d) => !!rel && d >= rel && (!rem || d < rem);

function validate() {
  const errors = [], warnings = [], err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  let animals, edges, tiers, xp, stats, avail, foods, biomes, abilities;
  try {
    animals = J('data/progression/animals.json'); edges = J('data/progression/evolution.json'); tiers = J('data/progression/tiers.json');
    xp = J('data/progression/xp-requirements.json'); stats = J('data/progression/animal-statistics.json'); avail = J('data/progression/historical-availability.json');
    foods = J('data/food/foods.json'); biomes = J('data/biomes/biomes.json'); abilities = J('data/abilities/abilities.json'); J('data/progression/animal-classifications.json');
  } catch (e) { return { errors: ['JSON load failed: ' + e.message], warnings }; }

  const placeholders = [];
  for (const a of abilities) if (a.iconStatus === 'recreated' && !fs.existsSync(path.join(ROOT, a.icon || ''))) err(`ability ${a.id}: icon missing (${a.icon})`);
  for (const b of biomes) if (b.tileStatus === 'recreated' && !fs.existsSync(path.join(ROOT, b.tile || ''))) err(`biome ${b.id}: tile missing (${b.tile})`);
  const ids = new Map(), tierSet = new Set(tiers.map((t) => t.tier)), biomeIds = new Set(biomes.map((b) => b.id)), abilityIds = new Set(abilities.map((a) => a.id));
  for (const t of tiers) if (tiers.filter((x) => x.tier === t.tier).length > 1) err('duplicate tier ' + t.tier);
  for (const a of animals) {
    if (ids.has(a.id)) err('duplicate animal id ' + a.id); ids.set(a.id, a);
    for (const f of ['id', 'name', 'tier', 'biome', 'xpRequired', 'health', 'speed', 'size', 'damage', 'sprite', 'releaseDate', 'confidence']) if (a[f] === undefined) err(`${a.id}: missing field ${f}`);
    if (!tierSet.has(a.tier)) err(`${a.id}: invalid tier ${a.tier}`);
    if (!biomeIds.has(a.biome)) err(`${a.id}: unknown biome ${a.biome}`);
    if (!(a.xpRequired >= 0)) err(`${a.id}: invalid xpRequired ${a.xpRequired}`);
    if (a.ability && !abilityIds.has(a.ability)) err(`${a.id}: unknown ability ${a.ability}`);
    if (a.removalDate && a.removalDate <= a.releaseDate) err(`${a.id}: removalDate before releaseDate`);
    const sp = path.join(ROOT, a.sprite || '');
    if (!fs.existsSync(sp)) { if (a.spriteStatus === 'original' || a.spriteStatus === 'recreated') err(`${a.id}: sprite missing (${a.sprite}) [${a.spriteStatus}]`); else placeholders.push(a.id); }
    if (a.spriteStatus === 'placeholder' && !a.placeholderColor) err(`${a.id}: placeholder without placeholderColor`);
  }
  // internal ids must match the archive extraction (verified source)
  try { const arch = J('data/research/archive-2017-02-13-animals.json').animals; for (const r of arch) { const key = r.skin.split('/').pop(), a = ids.get(key); if (!a) err(`archive animal ${key} missing from animals.json`); else if (a.internalId !== r.internalId) err(`${key}: internalId ${a.internalId} != archive ${r.internalId}`); } } catch (e) { warn('archive cross-check skipped: ' + e.message); }
  // edges: structural checks here; tier/xp monotonicity and reachability are checked per version below (tiers can change between versions)
  const seenEdge = new Set();
  for (const e of edges) {
    const k = e.from + '>' + e.to + '@' + e.releaseDate; if (seenEdge.has(k)) err('duplicate edge ' + k); seenEdge.add(k);
    const f = ids.get(e.from), t = ids.get(e.to);
    if (!f || !t) { err(`broken evolution edge ${e.from}>${e.to}: unknown animal`); continue; }
    if (e.releaseDate < f.releaseDate || e.releaseDate < t.releaseDate) err(`edge ${e.from}>${e.to}: released before one of its animals`);
    if (e.removalDate && e.removalDate <= e.releaseDate) err(`edge ${e.from}>${e.to}: removal before release`);
  }
  // xp overrides / stats refer to real animals
  for (const en of xp.entries) for (const id of Object.keys(en.xp)) if (!ids.has(id)) err(`xp-requirements references unknown ${id}`);
  for (const id of Object.keys(stats.changes)) { if (!ids.has(id)) err(`animal-statistics references unknown ${id}`); }
  // versions
  const vdir = path.join(ROOT, 'versions'), versions = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'version.json') versions.push(JSON.parse(fs.readFileSync(p, 'utf8'))); } })(vdir);
  const vids = new Set();
  for (const v of versions) {
    if (vids.has(v.id)) err('duplicate version ' + v.id); vids.add(v.id);
    for (const f of ['menu', 'upgradeMenu', 'hud']) { if (!fs.existsSync(path.join(ROOT, v[f]))) err(`${v.id}: missing ${f} config ${v[f]}`); else { const c = J(v[f]); if (c.version !== v.id) err(`${v.id}: ${f} config is for version ${c.version}`); } }
    // per-version animal state: base values + dated overrides (tier / xpRequired / biome)
    const st = {}; for (const a of animals) if (activeAt(a.releaseDate, a.removalDate, v.date)) { st[a.id] = { tier: a.tier, xp: a.xpRequired, biome: a.biome }; for (const c of (stats.changes[a.id] || []).filter((c) => c.from <= v.date).sort((x, y) => x.from.localeCompare(y.from))) Object.assign(st[a.id], { tier: c.tier !== undefined ? c.tier : st[a.id].tier, xp: c.xpRequired !== undefined ? c.xpRequired : st[a.id].xp, biome: c.biome || st[a.id].biome }); }
    for (const id of Object.keys(st)) if (!v.biomes.includes(st[id].biome)) delete st[id];
    const roster = Object.keys(st);
    const vEdges = edges.filter((e) => activeAt(e.releaseDate, e.removalDate, v.date) && st[e.from] && st[e.to]);
    for (const e of vEdges) { const f = st[e.from], t = st[e.to]; if (t.tier <= f.tier) err(`${v.id}: edge ${e.from}>${e.to}: tier must increase (${f.tier} -> ${t.tier})`); if (t.xp < f.xp) err(`${v.id}: edge ${e.from}>${e.to}: xp requirement decreases`); }
    { const reach = new Set([...(v.starters || [v.startAnimal])].filter((x) => st[x])); let ch = true; while (ch) { ch = false; for (const e of vEdges) if (reach.has(e.from) && !reach.has(e.to)) { reach.add(e.to); ch = true; } } for (const id of roster) if (!reach.has(id)) err(`${v.id}: ${id} is unreachable from any starter`); }
    if (v.tierStructure && Math.max(...roster.map((id) => st[id].tier)) !== v.tierStructure.tiers) err(`${v.id}: highest tier is ${Math.max(...roster.map((id) => st[id].tier))} but tierStructure says ${v.tierStructure.tiers}`);
    const tcheck = J("data/progression/tiers.json").filter((t) => activeAt(t.releaseDate, t.removalDate, v.date)); if (tcheck.length !== (v.tierStructure ? v.tierStructure.tiers : tcheck.length)) err(`${v.id}: tiers.json has ${tcheck.length} tiers active, expected ${v.tierStructure.tiers}`);
    const listed = avail.versions[v.id];
    if (!listed) err(`${v.id}: missing in historical-availability.json`);
    else if (JSON.stringify([...roster].sort()) !== JSON.stringify([...listed.animals].sort())) err(`${v.id}: derived roster [${roster}] != listed [${listed.animals}]`);
    for (const a of animals) if (a.releaseDate > v.date && roster.includes(a.id)) err(`${v.id}: ${a.id} appears before release`);
    for (const f of v.foods) { const d = foods.find((x) => x.id === f); if (!d) err(`${v.id}: unknown food ${f}`); else if (!activeAt(d.releaseDate, d.removalDate, v.date)) err(`${v.id}: food ${f} not yet released`); }
    for (const tid of v.terrain || []) { const d = J('data/terrain/terrain.json').find((x) => x.id === tid); if (!d) err(`${v.id}: unknown terrain ${tid}`); else if (!activeAt(d.releaseDate, d.removalDate, v.date)) err(`${v.id}: terrain ${tid} not yet released`); }
    if (v.layout) for (const [bid, r] of Object.entries(v.layout)) { if (!v.biomes.includes(bid)) err(`${v.id}: layout for unknown biome ${bid}`); if (r.length !== 4 || r[0] < 0 || r[1] < 0 || r[0] + r[2] > 1.0001 || r[1] + r[3] > 1.0001) err(`${v.id}: layout rect for ${bid} out of bounds`); }
    if (v.layout) { const L = Object.entries(v.layout); for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i][1], b = L[j][1]; if (a[0] < b[0] + b[2] - 1e-9 && b[0] < a[0] + a[2] - 1e-9 && a[1] < b[1] + b[3] - 1e-9 && b[1] < a[1] + a[3] - 1e-9) err(`${v.id}: biome layouts overlap: ${L[i][0]} / ${L[j][0]}`); } }
    for (const b of v.biomes) { const d = biomes.find((x) => x.id === b); if (!d) err(`${v.id}: unknown biome ${b}`); else if (!activeAt(d.releaseDate, d.removalDate, v.date)) err(`${v.id}: biome ${b} not yet released`); }
    if (!roster.length) err(`${v.id}: empty roster`);
    if (!roster.includes(v.startAnimal)) err(`${v.id}: startAnimal ${v.startAnimal} not in roster`);
    for (const s of v.starters || []) if (!roster.includes(s)) err(`${v.id}: starter ${s} not in roster`);
    if (!(v.starters || []).includes(v.startAnimal)) warn(`${v.id}: startAnimal is not listed in starters`);
    const mc = J(v.menu), mfiles = [mc.logo && mc.logo.src, ...Object.values(mc.modes || {}).map((m) => m && m.src), ...Object.values(mc.icons || {}).map((i) => i && i.src)].filter(Boolean);
    for (const f of mfiles) if (!fs.existsSync(path.join(ROOT, f))) err(`${v.id}: menu asset missing ${f}`);
    for (const m of v.modes || []) if (!['normal', 'sandbox'].includes(m)) err(`${v.id}: unknown mode ${m}`);
    if (!roster.some((id) => ids.get(id).xpRequired === 0 && !edges.some((e) => e.to === id))) err(`${v.id}: no start animal`);
  }
  for (const t of J('data/terrain/terrain.json')) { if (t.spriteStatus === 'recreated' && !fs.existsSync(path.join(ROOT, t.sprite))) err(`terrain ${t.id}: sprite missing (${t.sprite})`); for (const b of t.biomes) if (!biomeIds.has(b)) err(`terrain ${t.id}: unknown biome ${b}`); }
  for (const f of foods) { if ((f.spriteStatus === 'recreated' || f.spriteStatus === 'original') && !fs.existsSync(path.join(ROOT, f.sprite))) err(`food ${f.id}: sprite missing (${f.sprite})`); for (const b of f.biomes) if (!biomeIds.has(b)) err(`food ${f.id}: unknown biome ${b}`); if (!(f.xp > 0)) err(`food ${f.id}: invalid xp`); }
  const cl = J('data/versions/changelog.json'); for (const c of cl) if (!vids.has(c.date) && !versions.some((v) => v.date === c.date)) warn(`changelog ${c.version}: no version dated ${c.date}`);
  if (placeholders.length) warn(`${placeholders.length} animal sprites are placeholders (no archived art): ${placeholders.join(', ')}`);
  return { errors, warnings, animalCount: animals.length, versionCount: versions.length };
}
module.exports = { validate };
if (require.main === module) {
  const r = validate();
  r.warnings.forEach((w) => console.log('warn : ' + w)); r.errors.forEach((e) => console.log('ERROR: ' + e));
  console.log(`validate-data: ${r.errors.length} errors, ${r.warnings.length} warnings (${r.animalCount} animals, ${r.versionCount} versions)`);
  process.exit(r.errors.length ? 1 : 0);
}
