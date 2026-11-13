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
