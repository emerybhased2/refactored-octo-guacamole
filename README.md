# Mope.io Historical Evolution

A playable, data-driven recreation of how Mope.io evolved (target span: 2017-04-07 to 2026-11-13).
**Status: Milestone 1.** Only the 2017-04-07 baseline exists, and its content is a *low-confidence reconstruction* because archived
snapshots were not retrievable from the build environment (see [docs/RESEARCH.md](docs/RESEARCH.md)). Later versions are not implemented.

## Run
```bash
./build.sh        # validate data, build server, run all tests
./start-all.sh    # server ws://localhost:8081, client http://localhost:8080/?dev=1
./stop-all.sh
```
Requires Java 17+, Node 18+ (22 for the integration test's global `WebSocket`), and Gradle (preferred) or Maven (`MOPE_USE_MAVEN=1`).
Move with the mouse; `U` or the "Evolve!" badge opens the evolution menu; Space uses an ability (none assigned in 2017-04-07).

## Layout
- `server/` Java server (`mope.*`): `VersionManager`, `World`, `EvolutionEngine`, `AbilityEngine`, `BiomeEngine`, `FoodEngine`, `QuadTree`, `NetworkManager`, `AccountManager`, `SelfTest`.
- `client/` canvas client; `client/ui/` menus, HUD, leaderboard.
- `data/` all game data as JSON; `versions/<year>/<slug>/version.json` defines a historical build (date, menus, enabled biomes/food/features).
- `scripts/` dev server + data validator; `tests/` unit + integration; `docs/` research and gaps.

## Adding a historical version
1. Research and record sources in `docs/RESEARCH.md`.
2. Add animals/edges with `releaseDate`/`removalDate`; add `xp-requirements.json` / `animal-statistics.json` entries with a `from` date.
3. Add menu/upgrade/hud configs *for that version* (never reuse a different era's), and `versions/<year>/<slug>/version.json`.
4. List the expected roster in `historical-availability.json`, add a changelog entry, run `./build.sh`.

## Not yet done (honest list)
Original assets and menu fidelity; every version after 2017-04-07; shop/cosmetics/events; most abilities (engine supports dash only);
additional biomes; admin/developer panel (only the `?dev=1` version selector + FPS/ping overlay exist); account UI (server side only, gated off in 2017);
Safari/mobile verification; visual-regression tests (no reference screenshots); binary protocol; PostgreSQL adapter.
