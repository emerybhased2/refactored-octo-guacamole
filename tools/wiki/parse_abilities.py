import json,re
raw=json.load(open('abilities_raw.json'))
def blocks(t,tname):
    out=[]; i=0
    while True:
        m=re.search(r'\{\{\s*'+tname+r'\b',t[i:],re.I)
        if not m: break
        s=i+m.start(); depth=0; j=s
        while j<len(t)-1:
            if t[j:j+2]=='{{': depth+=1; j+=2
            elif t[j:j+2]=='}}':
                depth-=1; j+=2
                if depth==0: break
            else: j+=1
        out.append(t[s:j]); i=j
    return out
def fields(b):
    f={}; cur=None
    for line in b.split('\n'):
        mm=re.match(r'\|\s*([A-Za-z0-9_ ]+?)\s*=\s*(.*)$',line)
        if mm: cur=mm.group(1).strip().lower(); f[cur]=mm.group(2)
        elif cur: f[cur]+='\n'+line
    return f
def clean(x):
    x=re.sub(r'<ref[^>]*>.*?</ref>','',x or '',flags=re.S); x=re.sub(r'<gallery>.*?</gallery>','',x,flags=re.S)
    x=re.sub(r'\{\{(?:ImageLink|tr|c|Animals|Tier)\|([^}|]*)(?:\|[^}]*)?\}\}',r'\1',x,flags=re.I)
    x=re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]',r'\1',x); x=re.sub(r"'''?",'',x); x=re.sub(r'<[^>]+>',' ',x); x=re.sub(r'\{\{[^{}]*\}\}','',x); x=re.sub(r'[{}]','',x)
    return re.sub(r'\s+',' ',x).strip()
def animals(s): return [a for a in (x.strip() for x in re.findall(r'\{\{ImageLink\|([^}|]*)',s or '',re.I)) if a]
special=[];passive=[]
for b in blocks(raw['Special Abilities'],'Special Ability'):
    f=fields(b); special.append({'name':clean(f.get('name')),'used':animals(f.get('used')),'activate':clean(f.get('activate')),'description':clean(f.get('description'))})
for b in blocks(raw['Passive Abilities'],'Passive Ability'):
    f=fields(b); passive.append({'name':clean(f.get('name')),'used':animals(f.get('used')),'description':clean(f.get('description'))})
if __name__=='__main__':
    print(len(special),len(passive))
    print([s['name'] for s in special]); print([p['name'] for p in passive])
    json.dump({'special':special,'passive':passive},open('abilities_parsed.json','w'),indent=1)
