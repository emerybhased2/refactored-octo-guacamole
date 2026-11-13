# Project changelog

## 0.1.0 - Milestone 1: architecture + 2017-04-07 playable baseline (reconstruction)
- Version manager (server `VersionManager`, client `MenuVersionManager`): versions discovered from `versions/**/version.json`; animals/edges/food/biomes resolved by date.
- Data-driven progression DB (`data/progression/*`), abilities, biomes, food, menus, changelog.
- Java 17 authoritative server: tick loop, QuadTree, circle collision, eat rules, server-side XP/evolution validation, food engine, biome engine, ability engine, bots, WebSocket (JSON) protocol, SQLite accounts (PBKDF2).
- JS client: main menu, evolution tree menu (generated from server-provided progression), HUD, leaderboard, interpolation, own-movement prediction, auto-reconnect, dev version selector (`?dev=1`).
- Validators/tests: `scripts/validate-data.js`, `mope.SelfTest` (31), `tests/unit.js` (16), `tests/integration.js` (9, real server).
- Historical data for 2017-04-07 is **low confidence** (see `docs/RESEARCH.md`).

Historical (in-game) changelog: `data/versions/changelog.json`.
