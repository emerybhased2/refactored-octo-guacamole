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
    if (!fs.existsSync(sp)) (a.spriteStatus === 'original' ? err : warn)(`${a.id}: sprite missing (${a.sprite}) [${a.spriteStatus}]`);
    if (a.spriteStatus === 'placeholder' && !a.placeholderColor) err(`${a.id}: placeholder without placeholderColor`);
  }
  // xp must be non-decreasing along evolution edges; tier must strictly increase
  const seenEdge = new Set();
  for (const e of edges) {
    const k = e.from + '>' + e.to; if (seenEdge.has(k)) err('duplicate edge ' + k); seenEdge.add(k);
    const f = ids.get(e.from), t = ids.get(e.to);
    if (!f || !t) { err(`broken evolution edge ${k}: unknown animal`); continue; }
    if (t.tier <= f.tier) err(`edge ${k}: tier must increase`);
    if (t.xpRequired < f.xpRequired) err(`edge ${k}: xp requirement decreases`);
    if (e.releaseDate < f.releaseDate || e.releaseDate < t.releaseDate) err(`edge ${k}: released before one of its animals`);
  }
  for (const a of animals) if (a.xpRequired > 0 && !edges.some((e) => e.to === a.id)) err(`${a.id}: unreachable (no predecessor)`);
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
    const roster = animals.filter((a) => activeAt(a.releaseDate, a.removalDate, v.date) && v.biomes.includes(a.biome)).map((a) => a.id);
    const listed = avail.versions[v.id];
    if (!listed) err(`${v.id}: missing in historical-availability.json`);
    else if (JSON.stringify([...roster].sort()) !== JSON.stringify([...listed.animals].sort())) err(`${v.id}: derived roster [${roster}] != listed [${listed.animals}]`);
    for (const a of animals) if (a.releaseDate > v.date && roster.includes(a.id)) err(`${v.id}: ${a.id} appears before release`);
    for (const f of v.foods) { const d = foods.find((x) => x.id === f); if (!d) err(`${v.id}: unknown food ${f}`); else if (!activeAt(d.releaseDate, d.removalDate, v.date)) err(`${v.id}: food ${f} not yet released`); }
    for (const b of v.biomes) { const d = biomes.find((x) => x.id === b); if (!d) err(`${v.id}: unknown biome ${b}`); else if (!activeAt(d.releaseDate, d.removalDate, v.date)) err(`${v.id}: biome ${b} not yet released`); }
    if (!roster.length) err(`${v.id}: empty roster`);
    if (!roster.some((id) => ids.get(id).xpRequired === 0 && !edges.some((e) => e.to === id))) err(`${v.id}: no start animal`);
  }
  for (const f of foods) { for (const b of f.biomes) if (!biomeIds.has(b)) err(`food ${f.id}: unknown biome ${b}`); if (!(f.xp > 0)) err(`food ${f.id}: invalid xp`); }
  const cl = J('data/versions/changelog.json'); for (const c of cl) if (!vids.has(c.date) && !versions.some((v) => v.date === c.date)) warn(`changelog ${c.version}: no version dated ${c.date}`);
  return { errors, warnings, animalCount: animals.length, versionCount: versions.length };
}
module.exports = { validate };
if (require.main === module) {
  const r = validate();
  r.warnings.forEach((w) => console.log('warn : ' + w)); r.errors.forEach((e) => console.log('ERROR: ' + e));
  console.log(`validate-data: ${r.errors.length} errors, ${r.warnings.length} warnings (${r.animalCount} animals, ${r.versionCount} versions)`);
  process.exit(r.errors.length ? 1 : 0);
}
