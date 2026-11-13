import json,sys,urllib.request,urllib.parse,time
B="https://mope-io.fandom.com/api.php"
def api(**p):
    p['format']='json'; u=B+'?'+urllib.parse.urlencode(p)
    for i in range(4):
        try:
            r=urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}); return json.load(urllib.request.urlopen(r,timeout=40))
        except Exception as e: time.sleep(2*(i+1))
    raise SystemExit('fail '+u)
def members(cat,ns=None):
    out=[];c={}
    while True:
        p=dict(action='query',list='categorymembers',cmtitle='Category:'+cat,cmlimit=500,**c)
        if ns is not None: p['cmnamespace']=ns
        d=api(**p); out+= [m['title'] for m in d['query']['categorymembers']]
        if 'continue' in d: c={'cmcontinue':d['continue']['cmcontinue']}
        else: return out
