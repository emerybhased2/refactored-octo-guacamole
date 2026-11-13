# Project changelog

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
