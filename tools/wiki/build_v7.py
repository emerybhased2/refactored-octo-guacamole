#!/usr/bin/env python3
"""Builds version 7 (2026-11-13, wiki-sourced): roster, per-version tier/XP/biome overrides, evolution edges, tier structure, configs. Idempotent-ish: run once on a clean tree."""
import json,re,copy,os
D='2026-11-13'
W=json.load(open('data/research/wiki-animals.json'))['animals']
A=json.load(open('data/progression/animals.json')); by={a['id']:a for a in A}
norm=lambda n: re.sub(r'[^a-z]','',n.lower()); ALIAS={'crocodile':'croc','blackwidowspider':'blackwidow','komododragon':'komodo','giantscorpion':'scorpion'}
page2id={}
for k in W:
    i=ALIAS.get(norm(k),norm(k)); 
    if i in by: page2id.setdefault(i,k)
XP={1:0,2:150,3:400,4:1000,5:2000,6:5000,7:12000,8:25000,9:40000,10:60000,11:90000,12:145000,13:350000,14:650000,15:1000000,16:5000000,17:10000000}
BIOME={'Land':'land','Arctic':'arctic','Ocean':'ocean','Desert':'desert','Volcano':'volcano','Forest':'forest','Deep Ocean':'deepocean','Underground':'underground'}
# --- 1. roster rules
REMOVED_NEW=['chukar','flyinglizard','kakapo','raven','swinehoe','tarsier','turkey','birdmonster']  # wiki: removed (2024-11-15 / 2026-06-20) before this version
for i in REMOVED_NEW:
    a=by[i]; a['releaseDate']='2099-01-01'; a['classification']=['removed']; a['removedOnWiki']=True; a['releaseDateNote']="Present on the Mope.io Wiki roster but removed before 2026-11-13 (see wikiReleased/wikiRemoved); not available in any version."
for i in ['snowman','snowgirl','bigfoot']:
    by[i]['removalDate']='2026-06-20'; by[i]['removalNote']='Removed 2026-06-20 per the Mope.io Wiki'
ABSENT=[i for i in by if i not in page2id and by[i]['releaseDate']<D and not by[i].get('wiki') and not by[i].get('removalDate')]
for i in ABSENT:
    by[i]['removalDate']=D; by[i]['removalNote']='Not listed on the Mope.io Wiki Animals category; excluded from the wiki-sourced version'
active=[a for a in A if a['releaseDate']<=D and (not a.get('removalDate') or D<a['removalDate'])]
print('active in v7:',len(active),'absent:',ABSENT)
# --- 2. per-version overrides (tier/xp/biome from the wiki; XP from the wiki's consistent per-tier thresholds)
S=json.load(open('data/progression/animal-statistics.json')); ch=S['changes']
tier_of={}
for a in active:
    pg=page2id.get(a['id']) or a.get('wiki'); r=W.get(pg) if pg else None
    if not r or not r['tier'].isdigit(): tier_of[a['id']]=a['tier']; continue
    t=int(r['tier']); b=BIOME.get(r['biome'],a['biome']); tier_of[a['id']]=t
    lst=ch.setdefault(a['id'],[]); lst[:]=[c for c in lst if c['from']!=D]
    lst.append({'from':D,'tier':t,'xpRequired':XP[t],'biome':b,'note':'Mope.io Wiki tier/biome; XP from the wiki per-tier upgrade thresholds'})
json.dump(S,open('data/progression/animal-statistics.json','w'),indent=2)
# --- 3. edges: supersede old, all-to-all between consecutive tiers (wiki: "upgrades from the <every tier t-1 animal>")
E=json.load(open('data/progression/evolution.json'))
for e in E:
    if not e.get('removalDate') and e['releaseDate']<D: e['removalDate']=D
bytier={}
for a in active: bytier.setdefault(tier_of[a['id']],[]).append(a['id'])
new=0
for t in sorted(bytier):
    if t+1 in bytier:
        for f in bytier[t]:
            for g in bytier[t+1]:
                E.append({'from':f,'to':g,'releaseDate':D,'removalDate':None,'confidence':'wiki (every animal of the tier below upgrades into every animal of the tier above)','basis':'Mope.io Wiki upgrade lists'}); new+=1
json.dump(E,open('data/progression/evolution.json','w'),indent=1); print('new edges',new,'tiers',sorted(bytier))
json.dump(A,open('data/progression/animals.json','w'),indent=2)
# --- 4. tiers: 17 tiers (Black Dragon and King Dragon share tier 17)
T=json.load(open('data/progression/tiers.json'))
for t in T:
    if t['tier']==18: t['removalDate']=D
    if t['tier']==17: t.setdefault('categories',[]).append({'from':D,'name':'Dragons'})
json.dump(T,open('data/progression/tiers.json','w'),indent=2)
# --- 5. availability
H=json.load(open('data/progression/historical-availability.json'))
H['versions'][D]={'animals':sorted(a['id'] for a in active),'confidence':'roster/tiers/biomes/XP from the Mope.io Wiki (facts); unreleased and removed animals excluded; abilities mostly not implemented'}
json.dump(H,open('data/progression/historical-availability.json','w'),indent=2)
# --- 6. version + menus
V=json.load(open('versions/2021/june-12/version.json')); V=copy.deepcopy(V)
V['id']=D; V['date']=D; V['label']='November 2026 - Wiki-sourced (17 tiers, current roster, 375+ skins)'
V['confidence']='mixed (wiki-sourced)'
V['notes']="Roster, tiers, biomes, XP thresholds and skin names/categories come from the Mope.io Wiki (CC BY-SA; facts only). NO 2022-2026 client, CSS or art was archived (Arquivo has only Cloudflare pages), so the menu is the 2021 UI reused, all art is original, and mechanics are the project's own."
for k in ('menu','upgradeMenu','hud'): V[k]=V[k].replace('2021-06-12',D)
V['tierStructure']={'source':'MOPE.IO WIKI','tiers':17,'note':'Black Dragon and King Dragon are both tier 17 (10M XP) on the wiki; no tier 18'}
V['starters']=['mouse','shrimp','chipmunk','lemming','kangaroorat']; V['startAnimal']='mouse'
V['features']['wikiSourced']=True
V.pop('shopPriceOverrides',None); V.pop('shopOverrideNote',None)
os.makedirs('versions/2026/november-13',exist_ok=True); json.dump(V,open('versions/2026/november-13/version.json','w'),indent=2)
m=json.load(open('data/menus/main-2021-06-12.json')); m['version']=D
m['confidence']="No 2022-2026 UI was archived: this is the VERIFIED 2021-06-12 menu reused. Update notes below are an 'About' text, not archived notes."
m['panels']['updates']['sections']=[{'title':'About this build','items':['Roster, tiers, XP and skin names come from the Mope.io Wiki (facts only).','All art is original; nothing from the game was copied.','Pick any version from the dropdown (bottom left) to play earlier eras.','Unreleased/removed animals (Deathworm, Bobbit Worm...) have art but are not playable.']}]
json.dump(m,open(f'data/menus/main-{D}.json','w'),indent=2)
for kind in ('upgrade','hud'):
    x=json.load(open(f'data/menus/{kind}-2021-06-12.json')); x['version']=D; json.dump(x,open(f'data/menus/{kind}-{D}.json','w'),indent=2)
