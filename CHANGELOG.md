# Project changelog

## 0.6.0 - Version 5: 2020-06-13 (Forest, Bigfoot, Sounds)
- New version from the 2020-06-13 homepage/CSS (2020-03-14 skipped): Warthog, **Bigfoot** (tier 16, 1/1000 or shop), Forest (1/4 of land, pine/palm/baobab), **climbable trees** (S key, climbers/fliers only), tree transparency, **poison lakes** with hill rings, **rare skin variants** (Golden Eagle, Black Rhino, Aqua Yeti with archived rarities), synthesized **sounds** + mute, **graphics options**.
- Menu rebuilt from real HTML/CSS: settings panel (graphics, mute, spectate, logout), +coins popup, real login geometry, 638px shop window with Skins/Animals tabs; real coin icon.
- Shop: Bigfoot, Mouse skins, Tiger Shark, Hammerhead added (prices inferred). Login/account panel now hides during play.
- Tests: server 143, client/data 56, integration 25.

## 0.5.0 - Version 4: 2019-12-30 (#GoldenAge)
- New version from the 2019-12-30 homepage (no client/CSS exists): Snowman (1/2000 rarity or bought), Phoenix, Giant Scorpion, Arctic Volcano and volcano terrain, **accounts + coin shop** (server-validated; Golden/Azure Black Dragon and Golden King Dragon skins, Snowman unlock), **15 disasters** (tornados, storms, tsunami, eruptions with 5-10 min lava lakes).
- Menu: login/account block from the archived element ids; Facebook/Google OAuth replaced by a clearly labelled local account form.
- Security: dev-only commands (dev-coins, dev-disaster) are ignored unless the server is started with MOPE_DEV=1; sessions can be logged out; the database path is configurable (MOPE_DB).
- Fixes found by tests: stale disaster speed multipliers are always reset.
- Tests: server 143, client/data 51, integration 25 (two servers: normal and dev).


## 0.4.1 - Spectate and 1v1 Arena (2019)
- **Spectate** (2019 menu button now works): a body-less spectator follows the XP leader, Space/click cycles targets, Esc leaves. Behaviour inferred; the button is the archived part.
- **1v1 Arena** (evidence: 2019-06-18 notes; rules INFERRED): small land-only world per match, health-based contact combat, no healing, bot opponent after 4 s, simultaneous knockouts resolve to one winner, opponents drawn semi-transparent (archived note). Reachable from the dev bar only (the archived menu HTML has no Arena button).
- Tests: server 102, client/data 44, integration 18.


## 0.4.0 - Version 3: 2019-08-25
- New version from the 2019-08-25 homepage/CSS and 2019 skin captures (no 2019 client exists): 16 new animals (incl. King Dragon, Ice Monster, Komodo Dragon, birds, big cats), Desert and Volcano biomes, watermelon + inferred desert/volcano foods, 9 terrain object types with art, Spectate menu button.
- **Tier model rebuilt (user-provided):** 16 tiers in 2017 and 2018; 18 in 2019 (apex 15, monsters 16, Black Dragon 17, King Dragon 18 at 100,000,000 XP). Tier/XP/biome are now per-version overrides; evolution links regenerated per version with validity windows; food XP scales with tier.
- Validator is version-aware (tier monotonicity, reachability, layouts, terrain). Tests: server 88, client/data 44, integration 14.
- Fixed: terrain no longer spawns inside lakes.


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
