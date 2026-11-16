# Project status (what is done, what is evidence, what cannot be done)

"Complete" here means: everything the Mope.io Wiki and the archives document is either implemented or explicitly marked not applicable, with provenance recorded. It does **not** mean pixel-perfect reproduction: no original art, audio, client code or server code of Mope.io is used or available.

## Implemented
| Area | State |
|---|---|
| Historical versions | 7 playable builds (2017-02-13, 2018-04-21, 2019-08-25, 2019-12-30, 2020-06-13, 2021-06-12, 2026-11-13). Version dropdown for everyone. |
| Animals | 148 (84 playable somewhere, 34 unreleased + 8 removed kept as art/data; Beta mode makes the unreleased ones playable). All art original. |
| Skins | 17 hand-made + 375 wiki-listed skins with original generated art (unique markings, QA-tested), wardrobe, store, bundles, credits. |
| Abilities | 64/64 special abilities (effects, visuals, sounds, icons), 26/28 passives simulated, the other 2 not applicable (no river current / biome debuffs). |
| Terrain effects | bushes, holes, mud, ice, lava pools, hills/rocks (2020+ builds; hills/rocks blocking only in the wiki build). |
| Game modes | FFA, Sandbox, 1v1 Arena, 1v1 Redemption, Classic, Zombie Infection, Battle Royale, Team Mode, Wild Mope, Viral Pandemic, Beta. |
| Platforms | desktop + phones/tablets (touch joystick and buttons, portrait and landscape), Docker/Render/Sevalla-ready single-port hosting. |
| Tests | validator, 215 server tests (incl. a soak test of ability-spamming players of every animal in every mode/version), 72 client/data tests, 32 integration tests. |

## Provenance (see docs/RESEARCH.md for detail)
- **Verified** from archives or the Mope.io Wiki: names, tiers, biomes, XP thresholds, ability names/users/activation, mode rules and dates, skin names/categories/dates, 2017-2021 menu text and CSS.
- **Inferred** (flagged in the data): every balance number (cooldowns, radii, damage, zone sizes, boss strength, perk strengths, prices), the 2026 look and feel, terrain placement, bot behaviour.

## Not possible / not done (and why)
- **2022-2026 original UI/art/client:** Arquivo only holds Cloudflare challenge pages for those years; the 2026 build reuses the verified 2021 menu and says so.
- **Original audio and art:** never captured / not reusable; everything is original and in the Mope.io style, not a copy.
- **Per-animal Wild Mope wave tables** and **berry-bush infection orbs:** not reproduced (documented in data/modes/modes.json).
- **Forest biome as a playable biome** (Forest Monster): the wiki's forest is a tree-covered region here, not a separate habitat.
- **Real-money store, Facebook/Google login, ads:** replaced by coins, local accounts and nothing.
- **Balance:** no human playtesting has been done; every number above that is inferred may need tuning.
- **Docker image build:** the Dockerfile has not been built in this environment (no Docker daemon); the container layout was simulated step by step instead.
