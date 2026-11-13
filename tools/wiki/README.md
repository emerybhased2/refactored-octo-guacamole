# Mope.io Wiki extraction (facts only)
Source: https://mopeio.fandom.com (Mope.io Wiki, text under CC BY-SA 3.0). Only facts (names, tiers, biomes, abilities, dates, XP, upgrade lists, skin *names*) are extracted; **no wiki images are downloaded or reproduced**. All art in this project is original.
`wiki.py` = MediaWiki API helper; `parse_animals.py` = infobox parser (expects animal_wikitext.json next to it, fetched with `wiki.api(action='query', prop='revisions', ...)`).
Outputs are committed under `data/research/`.
