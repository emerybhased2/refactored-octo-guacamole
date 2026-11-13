#!/usr/bin/env python3
"""Builds data/shop/skins-wiki.json from data/research/wiki-skins-raw.json (names/animals/categories/dates from the wiki's 'List of skins'; NO images). Classic skins are skipped (they map to the Classic Theme feature)."""
import json,re,collections
raw=json.load(open('data/research/wiki-skins-raw.json'))
slug=lambda s: re.sub(r'[^a-z0-9]+','_',s.lower()).strip('_')
PRICE=[('Gold-trim',1000),('Golden',800),('Locked',1200),('Storefront',900),('Cosmic',1500),('Legends',1500),('Party',900),('Promo',0),('Halloween',800),('Summer',700),('Christmas',800),('Valentine',700),('May 2022',800),('March 2025',900)]
def price(cat):
    for k,p in PRICE:
        if k in cat: return p
    return 800
items=[];used=set()
for r in raw:
    if r['category'].startswith('Classic'): continue
    base=f"{r['animal']}_{slug(r['skin'])}"; i=base; n=2
    while i in used: i=f'{base}_{n}'; n+=1
    used.add(i)
    d=min(r['dates']) if r['dates'] else None
    yr=re.search(r'(20\d\d)',r['category']); 
    rel=d or (f"{yr.group(1)}-01-01" if yr else "2021-05-22")
    items.append({"id":i,"type":"skin","animal":r['animal'],"name":r['skin'],"category":r['category'],"wikiDates":r['dates'],"releaseDate":"2026-11-13","wikiReleaseDate":rel,"price":price(r['category']),"family":i,
      "sprite":f"assets/skins/wiki/{i}.png","spriteStatus":"recreated","confidence":"name/animal/category/date VERIFIED (Mope.io Wiki 'List of skins'); look and price are original/inferred"})
json.dump({"source":"Mope.io Wiki 'List of skins' (CC BY-SA 3.0): names, base animals, categories, dates only; art is original","count":len(items),"items":items},open('data/shop/skins-wiki.json','w'),indent=1)
print(len(items),collections.Counter(i['category'] for i in items).most_common(4))
