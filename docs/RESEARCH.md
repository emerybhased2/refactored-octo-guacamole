# Historical research log

Confidence levels: **verified** (primary source: archived code/asset/screenshot), **medium** (multiple secondary sources),
**low** (reconstruction / assumption), **none** (not attempted). Every data file carries a per-record `confidence`.

## Session 1 findings (honest status)

| Source | Result |
|---|---|
| Wayback availability API (`archive.org/wayback/available`) | Reachable. Reports a `mope.io` snapshot at `20170402155227`. |
| Wayback snapshot bodies (`web.archive.org/web/...`) | **Blocked** in this environment (egress policy: "Blocked by egress policy" / connection reset). Not bypassed. |
| Web search for April 2017 roster / tiers | Nothing verifiable. Fandom wiki history pages for early versions were empty or missing. |

Consequence: **no archived client JS, CSS, sprites, or screenshots were obtained.** Everything below for 2017-04-07 is a
placeholder reconstruction and must be replaced when references are available.

### 2017-04-07 baseline: what is and is not known

| Item | Value in repo | Confidence | To verify |
|---|---|---|---|
| Launch date 2017-04-07 | given by project brief | taken from brief | Wayback first-capture, dev posts |
| Mouse is the starting animal | yes | medium (multiple modern sources say you start as a mouse) | early gameplay video |
| Roster mouse/rabbit/deer/fox/wolf/bear | placeholder | **low** | archived client animal list |
| XP thresholds 0/60/250/250/800/2000 | invented | **low** | archived client or wiki XP table |
| Evolution edges | invented | **low** | archived client |
| Food: berry, carrot | placeholder | **low** | screenshots |
| Single land biome | plausible | medium | screenshots |
| No abilities, accounts, shop, settings, events | assumed for launch | low | screenshots / changelog |
| Menu: green gradient, "Mope.io" text logo, nickname box, orange Play button | approximation | **low** | archived `index.html`/CSS/screenshot |
| Upgrade menu: per-tier columns, evolve badge | design of this project | **low** (original UI unknown) | screenshots |
| Balance (speed, size, eat rule, 220px/s) | invented | **low** | gameplay footage |
| Eat rule: strictly higher tier eats on contact | modern game rule, assumed | medium | footage |

### Next research steps
1. Obtain snapshot content (needs egress allow-list for `web.archive.org`, or user-supplied files placed in `archive/` - never overwritten).
2. Extract animal identifiers, sprite filenames, XP table, menu CSS from the archived client.
3. Replace placeholder sprites; set `spriteStatus: "original"` and fill `assets/manifest.json` provenance.
4. Fill `animal-statistics.json` / `xp-requirements.json` per update date; add `versions/<year>/<slug>/version.json` + changelog entries.

## Session 2: archive access found (Arquivo.pt) - IMPORTANT CORRECTIONS

Reachable: **Arquivo.pt** (CDX API `https://arquivo.pt/wayback/cdx`, replay `https://arquivo.pt/noFrame/replay/<ts>id_/<url>`).
Blocked: web.archive.org snapshots, archive.ph, Common Crawl, Memento. Arquivo captures of `mope.io` exist for
2017-02-13, 2018-04-21, 2018-07-16, 2019-03-27 and later. **None fall in April 2017.** `updates.txt` (the original changelog) is not captured.
Re-fetch with `scripts/fetch-archive.sh` (files land in git-ignored `archive/`).

### Verified from the 2017-02-13 capture (primary source)
- **The game existed before 2017-04-07**, and already had far more than my baseline: 44 animals (ids 1-44, see
  `data/research/archive-2017-02-13-animals.json`), land + ocean + arctic biomes, Sandbox and Normal modes, chat, party links,
  region/server select, settings (Winter skins, no images, no names & chat, low graphics, joystick options), mute button, water-spit (S), run (hold click), ability key W.
- The page's own update notes (dated "Feb 10") mention arctic teleporting, up/down arrows to up/downgrade in sandbox,
  upgrade UI "animals sorted by biome", Enter to take first upgrade choice, music removed.
- Main menu (real): body `#3FBA54`; 350x178 PNG logo (`img/logo.png`, dragon + mouse + "mope.io"); nickname input 250px wide,
  4px `#1c9c25` border, 30px font, placeholder "Your name", max 15; Play button 250x40, `#0aa633`, 4px bottom border `#116c17`,
  hover `#16932A`; mode buttons `mode_norm.png`/`mode_sandbox.png` 124x48; settings/mute icons 30x30; options panel `rgba(11,164,52,.95)`;
  left info panels ("How to play", "Update") 200px wide; right column 160px (party link, app ads, promo).
- Footer comment: "copyright 2016 Stan Tatarnykov, You may use images/videos of mope.io commercially. All rights reserved."
  Images/videos: permitted by that notice. **Code is not licensed**: archived JS is analysed locally and not committed.

### Still unknown (server-side, not in client)
Evolution tree, XP thresholds, speeds/sizes, damage, spawn rules. Needs another source (wiki, videos, the Reddit/forum posts).

### Corrections to the baseline above
My 2017-04-07 roster (6 animals), no-settings/no-chat/no-server-select assumption, text logo, gradient background and orange
Play button are **contradicted by evidence**. They must be replaced; see open question on the start date in the session notes.
