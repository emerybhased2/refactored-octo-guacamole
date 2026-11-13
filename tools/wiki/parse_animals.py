import json,re
raw=json.load(open('animal_wikitext.json'))
MONTHS={m:i+1 for i,m in enumerate('January February March April May June July August September October November December'.split())}
def block(t):
    m=re.search(r'\{\{\s*(Infobox animal|Infobox rare|Animal)\b',t,re.I)
    if not m: return None
    i=m.start(); depth=0; j=i
    while j<len(t)-1:
        if t[j:j+2]=='{{': depth+=1; j+=2
        elif t[j:j+2]=='}}':
            depth-=1; j+=2
            if depth==0: break
        else: j+=1
    return t[i:j], t[j:]
def fields(b):
    f={}; cur=None
    for line in b.split('\n'):
        mm=re.match(r'\|\s*([A-Za-z0-9_ ]+?)\s*=\s*(.*)$',line)
        if mm: cur=mm.group(1).strip().lower(); f[cur]=mm.group(2)
        elif cur and not line.startswith('<!--'): f[cur]+= '\n'+line
    return f
def clean(x):
    x=re.sub(r'<!--.*?-->','',x or '',flags=re.S); x=re.sub(r'<gallery>.*?</gallery>','',x,flags=re.S)
    x=re.sub(r'\{\{(?:sa/img|Pa|sa|ImageLink|c|Animals|tr)\|([^}|]*)(?:\|[^}]*)?\}\}',r'\1',x,flags=re.I)
    x=re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]',r'\1',x); x=re.sub(r'<[^>]+>',' ',x); x=re.sub(r'[{}]','',x); return re.sub(r'\s+',' ',x).strip(' *')
def dates(x):
    out=[]
    for m in re.finditer(r'\{\{upd\|([A-Za-z]+)\|(\d+)\|(\d{4})',x or '',re.I):
        mo=MONTHS.get(m.group(1).capitalize())
        if mo: out.append('%s-%02d-%02d'%(m.group(3),mo,int(m.group(2))))
    return out
def names(s):
    s=re.sub(r'\[\[|\]\]','',s); return [clean(x) for x in re.split(r',\s*(?:or |and )?|\s+or\s+|\s+and\s+',s) if clean(x)]
rows={}
for k,t in raw.items():
    r=block(t)
    if not r: continue
    b,rest=r; f=fields(b)
    row={'page':k,'tier':clean(f.get('tier')),'biome':clean(f.get('biome')),'passive':clean(f.get('passive')),'special':clean(f.get('special')),
         'releasedRaw':clean(f.get('released')),'releasedDates':dates(f.get('released')),'removedDates':dates(f.get('removed')),'unreleased':'unreleased' in (f.get('released') or '').lower(),
         'minXp':clean(f.get('minimum')).split(' ')[0] if f.get('minimum') else '', 'maxXp':clean(f.get('maximum')).split(' ')[0] if f.get('maximum') else ''}
    m=re.search(r"upgrades from the (.*?) at ([\d.,]+ ?[KMB]?)\s*\[\[XP",rest)
    if m: row['from']=names(m.group(1)); row['fromXp']=m.group(2).replace(' ','')
    m=re.search(r"(?:evolves|upgrades) into the (.*?) at ([\d.,]+ ?[KMB]?)\s*(?:\[\[)?XP",rest)
    if m: row['to']=names(m.group(1)); row['toXp']=m.group(2).replace(' ','')
    rows[k]=row
if __name__=='__main__':
    print(len(rows),[k for k in raw if k not in rows])
    json.dump(rows,open('animal_rows.json','w'),indent=1)
    for k in ['Fox','Cheetah','Deathworm','Honeybee','Dragon']: print(json.dumps(rows.get(k)))
