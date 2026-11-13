# Project changelog

## 0.3.1 - Art polish
- Redrew the weakest animals (kraken, octopus, squid, jellyfish, crab, king crab, yeti, penguin, seahorse, arctic fox, eagle, cobra, giraffe, wolf, croc, fox) with new engine primitives: tapered suckered tentacles, two-lobed pincers, bird wings, fur tufts, fangs, fan fins.
- Soft body shading on all animals; exporter writes to each animal's declared sprite path (no stray files); regression test added.


## 0.3.0 - Version 2: 2018-04-21
- New historical version built from the Arquivo.pt capture: 61 animals (17 new), 17 new abilities, tier 9, regenerated evolution links (the 2017 tree is asserted unchanged).
- 2018 main menu from the archived HTML/CSS: wordmark logo (350x99), no Normal/Sandbox buttons, no Winter Skins, hidden How-to-play, three-note update panel in light text; server and version manager now date-gate abilities per version.
- 2018 upgrade buttons (name at top) and HUD ability button (gold recharge bar), both from the archived draw code; 2017 keeps its own styles.
- Bots spawn from each version's starter list; sandbox is only offered where the version has it.
- Original art for the 17 new animals and 17 ability icons (tools/art).
- Tests: server 66, client/data 37, integration 13.


## 0.2.0 - Milestone 2: rebuilt on archived evidence (2017-02-13)
- Start date moved to **2017-02-13** (earliest Arquivo.pt capture); the fabricated April 7 baseline was removed.
- 44-animal roster, internal ids, names, colours and abilities taken from the archived client; 3 biomes (land/ocean/arctic) with teleport on cross-biome evolution.
- Main menu rebuilt as a DOM page matching the archived HTML/CSS (real logo, mode buttons, icons, options panel, info panels); computed geometry is unit-tested against the archive's numbers.
- Upgrade UI rebuilt as the archived choice-button design (biome colours, suggested choice bigger/leftmost, Enter takes first); full tree kept as a dev-only tool.
- New mechanics: water/thirst, run, chat, sandbox mode, light-green/red outlines, "Connecting..." overlay.
- Tests: server 52, client/data 22, integration 11. Tier/XP/tree/stats remain **inferred** and flagged.

## 0.1.0 - Milestone 1: architecture + 2017-04-07 playable baseline (reconstruction)
- Version manager (server `VersionManager`, client `MenuVersionManager`): versions discovered from `versions/**/version.json`; animals/edges/food/biomes resolved by date.
- Data-driven progression DB (`data/progression/*`), abilities, biomes, food, menus, changelog.
- Java 17 authoritative server: tick loop, QuadTree, circle collision, eat rules, server-side XP/evolution validation, food engine, biome engine, ability engine, bots, WebSocket (JSON) protocol, SQLite accounts (PBKDF2).
- JS client: main menu, evolution tree menu (generated from server-provided progression), HUD, leaderboard, interpolation, own-movement prediction, auto-reconnect, dev version selector (`?dev=1`).
- Validators/tests: `scripts/validate-data.js`, `mope.SelfTest` (31), `tests/unit.js` (16), `tests/integration.js` (9, real server).
- Historical data for 2017-04-07 is **low confidence** (see `docs/RESEARCH.md`).

Historical (in-game) changelog: `data/versions/changelog.json`.
