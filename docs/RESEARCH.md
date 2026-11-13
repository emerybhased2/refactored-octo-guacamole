# Historical research log

Confidence: **verified** = read from an archived primary source (client/CSS/HTML/images); **inferred** = my reconstruction, not archived
(server-side data is not in any client); **unknown** = not researched. Each data record carries a per-field `confidence`.

## Sources and access
| Source | Status |
|---|---|
| Arquivo.pt (CDX `https://arquivo.pt/wayback/cdx`, replay `https://arquivo.pt/noFrame/replay/<ts>id_/<url>`) | **Works.** Captures of `mope.io`: 2017-02-13, 2018-04-21, 2018-07-16, 2019+. Re-fetch via `scripts/fetch-archive.sh` into git-ignored `archive/`. |
| web.archive.org snapshots, archive.ph, Common Crawl, Memento | Blocked/unreachable from this environment (not bypassed). The Wayback *availability* API answers but snapshot bodies are refused. |
| mopeio.fandom.com (wiki) | HTTP 403 (curl) / 402 (WebFetch). Not readable. |
| Web search | Nothing verifiable for early versions. |

**No Arquivo capture exists for April 2017.** The earliest evidence is **2017-02-13**, so that is the project's first version.
The brief's April 7, 2017 date is *not* reproduced: the earlier "April baseline" was fabricated and has been deleted.
Licence note from the captured page footer: "copyright 2016 Stan Tatarnykov, You may use images/videos of mope.io commercially. All rights reserved."
Images are used per that notice (provenance in `assets/manifest.json`); archived **code is not committed**.

## 2017-02-13 capture: what is verified
Source files: `index.html` (20170213100949), `main.css` (101002), `client.js` (101214), `img/*` (101026-101127).

| Area | Verified facts | Where used |
|---|---|---|
| Roster | 44 animals with client internal ids 1-44, display names, skin names, base colours (`data/research/archive-2017-02-13-animals.json`) | `animals.json` (cross-checked by validator + tests) |
| Arctic membership | 14 animals whose skin path is `arctic/` | `biome: arctic` |
| Biomes | Land, ocean, arctic exist; upgrade buttons coloured by biome: land #26A73A, ocean #1C91B8, arctic #B2B2B2 (alpha .75, white highlight .2); client biome numbers 0/1/2 | `biomes.json`, upgrade menu |
| Starter animals | Mouse, Shrimp, Chipmunk (sandbox welcome logic) | `version.json startAnimal`, sandbox |
| Modes | Normal + Sandbox; sandbox: up/down arrows upgrade/downgrade, eat any animal, eat food to heal | sandbox mode |
| Controls | Click = run (uses water), W = ability/swim, Enter = chat (and first upgrade choice), S = spit water | input |
| Water/thirst | Water bar; death reason 4 "died of thirst"; death reason 1 "eaten"; "Check out water areas" (lakes) | water mechanics |
| Upgrade UI | Server sends (animal, biome) list; 100x100 square buttons; sorted by biome; suggested choice bigger + leftmost; Enter takes first; arctic teleporting on cross-biome upgrade | upgrade menu, teleport |
| Outlines | Light-green = you can eat it, red = it can eat you | renderer |
| Abilities | 18 named abilities with client ids; per-animal ability keys from upgrade texts (e.g. Cheetah boost "every 8 seconds") | `abilities.json`, `animals.json` |
| Food | Image-based foods: banana, raspberry, pear, coconut, lily pad (+ coloured-circle foods: red #F35F53, blue #4655A6, orange #FF911E) | `foods.json` |
| Main menu | Page #3FBA54; 350x178 logo PNG; mode buttons 124x48; nickname 250px, 4px #1c9c25 border, 30px, "Your name", max 15; Play 250x40 #0aa633 (hover #16932A, 4px #116c17 bottom); settings/mute icons 30px; options panel rgba(11,164,52,.95) with region/server selects + 6 checkboxes; "How to play" and update panels; chat box 200x35 rgba(68,159,94,.8) 25px #F1C34C | main menu |
| Other | Party links (Make Party), region/server select, mute, left/right-hand joystick options, Winter skins option | menu (some not implemented) |

## Inferred (NOT in any archive) - all flagged `inferred` in the data
Tier numbers (8 tiers), XP thresholds (0/60/200/500/1100/2200/4000/7000), evolution links (next tier in same biome; mouse -> tier-2 of other biomes),
speed/size/health/damage, which biome each non-arctic animal belongs to (land vs ocean), world size (6000), biome layout (arctic strip / land / ocean strip),
lake counts, food XP/density/biome assignment, ability cooldown/duration/multiplier (except Cheetah's 8 s), suggested-choice rule, HUD bar positions, run speed (1.5x) and water rates, bot population.
Where the real values are found they replace these via `xp-requirements.json` / `animal-statistics.json` (dated overrides).

## Known gaps / next research
1. Evolution tree + XP: needs a readable source (wiki, forum posts, videos). The 2018-04-21 client (also fetchable) may show how upgrade options changed.
2. Animal art: no skins captured in Feb 2017 (`skins/` first appears in 2018-2019 captures, and not for these animals). Placeholders use the verified base colours.
3. HUD geometry: canvas-drawn in `client.js`; extract draw code next.
4. Next versions: 2018-04-21, 2018-07-16, 2019-03-27 captures exist; diff their clients against this one.
