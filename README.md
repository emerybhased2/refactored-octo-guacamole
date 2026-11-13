# Mope.io Historical Evolution

A playable, data-driven recreation of how Mope.io evolved. **Status: Milestone 7.** Six versions (latest **2021-06-12**: new React-style UI, storefront, Queen Flame; earlier 2020-06-13: Forest, Bigfoot, climbing, sounds). Earlier: **2017-02-13** (44 animals, 16 tiers), **2018-04-21** (61 animals, 16 tiers), **2019-08-25** (77 animals, 18 tiers, Desert + Volcano, Spectate, Arena) and **2019-12-30** (80 animals, accounts + shop, disasters). Pick one with the dev version selector or `?v=<id>`. The brief's April 7, 2017 start is not supported by the archive (the game had already shipped
44 animals by then), so it is not used. See [docs/RESEARCH.md](docs/RESEARCH.md) for exactly what is verified and what is inferred.

## What is verified vs inferred (short)
- **Verified from the archived client:** the 44-animal roster, ids, names, base colours, biomes' existence, abilities and their keys, the main menu
  (layout, colours, assets), game modes, controls, water/thirst, choice-button upgrade UI, light-green/red outlines.
- **Inferred (not archived anywhere reachable):** tiers, XP, evolution links, stats, world layout, balance. Flagged `inferred` in every record.

## Run
```bash
./build.sh        # validate data, build server, run all tests
./start-all.sh    # server ws://localhost:8081, client http://localhost:8080/?dev=1
./stop-all.sh
```
Requires Java 17+, Node 22 (global `WebSocket` for the integration test), Gradle (preferred) or Maven (`MOPE_USE_MAVEN=1`).

Controls: mouse = move, **hold left-click = run** (uses water), **W** = ability, **Enter** = take first upgrade choice (otherwise chat), click a choice button to evolve,
Sandbox: **Up/Down** arrows change animal. Dev (`?dev=1`): version selector, FPS/ping overlay, **U** = full progression tree (project tool, not historical).
Water: stay near lakes or in the ocean; at 0 water you take damage and can die of thirst.

## Layout
- `server/` Java server (`mope.*`): `VersionManager`, `World`, `EvolutionEngine`, `AbilityEngine`, `BiomeEngine`, `FoodEngine`, `QuadTree`, `NetworkManager`, `AccountManager`, `SelfTest`.
- `client/` canvas client + DOM main menu; `client/ui/` menus, HUD, leaderboard.
- `data/` game data (JSON); `data/research/` extracted archive facts; `versions/<year>/<slug>/version.json` defines a build.
- `scripts/` dev server, validator, `fetch-archive.sh`; `tests/` unit + integration; `docs/` research + gaps.

## Adding a historical version
1. Fetch/inspect captures (`scripts/fetch-archive.sh`), record findings and confidence in `docs/RESEARCH.md`.
2. Add animals/edges with `releaseDate`/`removalDate`; dated overrides in `xp-requirements.json` / `animal-statistics.json`.
3. Add menu/upgrade/hud configs *for that version* (never reuse another era's), then `versions/<year>/<slug>/version.json`.
4. List the expected roster in `historical-availability.json`, add a changelog entry, run `./build.sh`.

## Not done (honest list)
Evolution tree/XP/stats from a real source; animal and food art (not in archive); party links; S water-spit; Winter skins; joystick options;
most abilities (only Charge and Extra Boost move you; the rest are catalogued but inert); mud/hills/bushes/hide-holes; sounds; real HUD geometry;
every later version; shop/events/accounts UI (accounts exist server-side, gated off); admin panel; Safari/mobile verification; visual-regression tests; binary protocol; PostgreSQL adapter.


## Deploying (single public port)
`Dockerfile` builds the Java server and runs it with the Node web server; the web server listens on `$PORT` (default 8080), serves the client and proxies WebSockets on `/ws` to the game server, so one public port is enough (e.g. Sevalla/any Docker host: build from this repo's Dockerfile, container port 8080). Account data lives in `/app/database` (mount a persistent disk there to keep accounts across redeploys). **Never set `MOPE_DEV` in production** (it enables the dev-only coin/disaster cheats).

**Render:** `render.yaml` is a Blueprint for the same Dockerfile (New + > Blueprint, pick this repo). Render sets `$PORT` itself; free plans have no disk, so accounts reset on redeploy.
