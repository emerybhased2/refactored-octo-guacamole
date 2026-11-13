#!/usr/bin/env python3
"""Merges the Mope.io Wiki ability list (data/research/wiki-abilities.json) with game-effect archetypes into data/abilities/abilities.json,
and maps animals to abilities/passives (animals.json: abilities, passives) for the wiki-sourced version. Numbers (cooldowns, radii, durations) are INFERRED."""
import json,re
norm=lambda n: re.sub(r'[^a-z]','',n.lower())
W=json.load(open('data/research/wiki-abilities.json'))
ABIL=json.load(open('data/abilities/abilities.json')); by={a['id']:a for a in ABIL}
ANI=json.load(open('data/progression/animals.json')); aid={norm(a['id']):a['id'] for a in ANI}
ALIAS={'crocodile':'croc','blackwidowspider':'blackwidow','komododragon':'komodo','giantscorpion':'scorpion'}
def A(n): n=norm(n); n=ALIAS.get(n,n); return aid.get(n)
E=lambda **k: k
# wiki name (first alias) -> (id, glyph, activation, cooldown ms, key, needs, effects)
T={
 'Claw Slash':('claw_slash','claw_slash','press',6000,'W',None,[E(k='area',r=110,front=1,stunPrey=1500,stunPred=2500,dmg=10)]),
 'Dig Hole':('hide_hole_dig','hide_hole_dig','press',9000,'W',None,[E(k='hide',ms=6000,speed=0.5)]),
 'Pull from Hole':('pull_from_hole','pull_from_hole','press',7000,'W',None,[E(k='area',r=100,stunPrey=1500,maxTier=9)]),
 'Hide in Shell':('shell','shell','press',9000,'W',None,[E(k='shield',ms=4000,speed=0.2)]),
 'Squirt Ink':('ink','ink','press',9000,'W',None,[E(k='zone',zk='ink',r=170,ms=5000,slow=0.8,blind=1),E(k='speed',mul=1.3,ms=1000)]),
 'Dig':('burrow_hole','burrow_hole','hold',8000,'W',None,[E(k='hide',ms=3500,speed=0.8)]),
 'Glide':('glide','fly_with_prey','press',8000,'W',None,[E(k='fly',ms=3000,speed=1.15)]),
 'Electric Shock':('shock','shock','press',9000,'W',None,[E(k='area',r=140,stunPrey=1500,stunPred=2500,dmg=12)]),
 'Bite Drag':('bite_drag','bite_drag','press',9000,'W',None,[E(k='grab',r=90,ms=2500,dps=4)]),
 'Roll Snow':('roll_snow','roll_snow','press',8000,'W',None,[E(k='speed',mul=1.7,ms=2500)]),
 'Fire':('fire','fire','hold',3000,'W',None,[E(k='zone',zk='fire',r=130,ms=2500,dps=14,front=1,follow=1)]),
 'Kick':('back_kick','back_kick','press',7000,'W',None,[E(k='area',r=120,back=1,knock=350,stunPrey=1200,stunPred=1800)]),
 'Inflate':('inflate','inflate','press',9000,'W',None,[E(k='shield',ms=3500,speed=0.5,grow=1.5)]),
 'Charge':('charge','charge','press',5000,'W',None,[E(k='speed',mul=2.0,ms=700)]),
 'Knock in Air':('knock_in_air','trunk_hit','press',8000,'W',None,[E(k='area',r=110,knock=500,stunPrey=1200)]),
 'Trunk Hit':('trunk_hit','trunk_hit','press',8000,'W',None,[E(k='area',r=130,front=1,knock=500,stunPrey=1500,stunPred=3000,dmg=8)]),
 'Whirlpool':('whirlpool','whirlpool','press',10000,'W',None,[E(k='zone',zk='whirl',r=160,ms=3500,pull=260,slow=0.6)]),
 'Disguise':('disguise','disguise','hold',8000,'W',None,[E(k='invis',ms=8000,speed=0.8)]),
 'Tail Slap':('tail_slap','tail_slap','press',7000,'S',None,[E(k='area',r=170,back=1,knock=600,stunPrey=1500,stunPred=2500,dmg=10)]),
 'Slide on Ice':('slide_on_ice','slide_on_ice','press',500,'W',None,[E(k='speed',mul=1.35,ms=6000)]),
 'Snow Roar':('snow_roar','howl','press',9000,'W',None,[E(k='area',r=200,stunPrey=1000),E(k='zone',zk='frost',r=190,ms=3000,slow=0.5)]),
 'Roar':('growl','growl','press',8000,'W',None,[E(k='area',r=180,stunPrey=1200,knock=120)]),
 'Howl':('howl','howl','press',9000,'W',None,[E(k='area',r=220,stunPrey=1000)]),
 'Extra Boost':('extra_boost','extra_boost','press',8000,'W',None,[E(k='speed',mul=1.8,ms=1500)]),
 'Throw Fruit':('throw_banana','throw_banana','press',6000,'W',None,[E(k='proj',pk='fruit',speed=700,range=600,r=22,stun=1500)]),
 'Dig Food':('dig_for_food','dig_for_food','hold',7000,'W',None,[E(k='food',count=3,r=120)]),
 'Cause Wave':('cause_wave','cause_wave','press',9000,'W',None,[E(k='area',r=260,front=1,knock=450),E(k='zone',zk='wave',r=200,ms=2000,slow=0.6,front=1)]),
 'Spin Web':('spin_web','spin_web','press',10000,'W',None,[E(k='zone',zk='web',r=140,ms=8000,slow=0.35)]),
 'Venom Spit':('venom_spit','venom_spit','press',7000,'W',None,[E(k='proj',pk='venom',speed=800,range=650,r=18,stun=800,dot=6,dotMs=4000)]),
 'Suffocate Prey':('suffocate_prey','suffocate_prey','press',10000,'W',None,[E(k='grab',r=80,ms=3000,dps=12)]),
 'Ambush Attack':('ambush_attack','ambush_attack','press',9000,'W',None,[E(k='hide',ms=5000,speed=0.5,burst=1)]),
 'Stomp':('stomp','stomp','press',7000,'W',None,[E(k='area',r=150,knock=300,stunPrey=1000,stunPred=800,dmg=6)]),
 'Jaw Bite':('jaws_bite','jaws_bite','press',7000,'W',None,[E(k='area',r=100,front=1,dmg=25,stunPrey=1500)]),
 'Stink Cloud':('stink','stink','press',9000,'W',None,[E(k='zone',zk='stink',r=170,ms=5000,dps=5,slow=0.7)]),
 'Fly':('fly','fly_with_prey','hold',6000,'W','climbing',[E(k='fly',ms=5000,speed=1.1)]),
 'Fly with Prey':('fly_with_prey','fly_with_prey','press',9000,'W',None,[E(k='grab',r=90,ms=3500,fly=1)]),
 'Fly With Water':('fly_with_water','fly_with_prey','press',9000,'W',None,[E(k='fly',ms=4000,speed=1.1),E(k='water',amount=25)]),
 'Sky Dive':('sky_dive','fly_with_prey','press',9000,'W',None,[E(k='fly',ms=2500,speed=1.2,landArea=1)]),
 'Target Attack':('target_attack','charge','press',8000,'W',None,[E(k='speed',mul=1.9,ms=1200,homing=1)]),
 'Fly/Pickup Bones':('pickup_bones','fly_with_prey','press',9000,'W',None,[E(k='fly',ms=4000,speed=1.1)]),
 'Spikes':('spikes','spikes','press',9000,'W',None,[E(k='shield',ms=5000,speed=0.7,reflect=8)]),
 'Peck':('peck','jaws_bite','press',6000,'W',None,[E(k='area',r=80,front=1,dmg=10,stunPrey=1500)]),
 'Sinkhole':('sinkhole','whirlpool','press',10000,'W',None,[E(k='zone',zk='sink',r=150,ms=4000,pull=180,slow=0.4)]),
 'Command Babies':('command_babies','ambush_attack','press',20000,'W',None,[E(k='summon',count=3,ms=25000)]),
 'Fire Tornado':('fire_tornado','fire','press',12000,'W',None,[E(k='zone',zk='firetornado',r=150,ms=5000,dps=18,pull=100,follow=1)]),
 'Arm Smash':('arm_smash','arm_smash','press',8000,'W',None,[E(k='area',r=140,knock=350,stunPrey=1800,stunPred=3000,dmg=12)]),
 'Freeze Prey':('freeze','freeze','press',9000,'W',None,[E(k='area',r=140,stunPrey=3000)]),
 'Hypnotize':('hypnotize','disguise','hold',9000,'W',None,[E(k='area',r=200,stunPrey=2500)]),
 'Spits Food':('spits_food','dig_for_food','press',7000,'W',None,[E(k='food',count=2,r=60,front=1)]),
 'Run':('run','charge','press',7000,'W',None,[E(k='speed',mul=1.6,ms=2500)]),
 'Roll':('roll','roll_snow','press',7000,'W',None,[E(k='speed',mul=1.5,ms=2000),E(k='shield',ms=2000,speed=1.5)]),
 'Jump High':('jump_high','back_kick','press',6000,'W',None,[E(k='fly',ms=900,speed=1.2)]),
 'Whine':('whine','howl','press',7000,'W',None,[E(k='area',r=160,stunPrey=600)]),
 'Spit':('spit','venom_spit','press',5000,'W',None,[E(k='proj',pk='spit',speed=750,range=500,r=16,stun=700)]),
 'Rattle':('rattle','growl','press',7000,'W',None,[E(k='area',r=150,stunPrey=1000)]),
 'Laugh':('laugh','growl','press',7000,'W',None,[E(k='area',r=170,stunPrey=1200)]),
 'Gores':('gores','claw_slash','press',7000,'W',None,[E(k='area',r=110,front=1,dmg=20,stunPrey=1500,knock=200)]),
 'Poison Bite':('poison_bite','venom_spit','press',8000,'W',None,[E(k='area',r=90,front=1,stunPrey=600,dot=5,dotMs=5000)]),
 'Grab and Sting':('grab_sting','shock','press',9000,'W',None,[E(k='grab',r=80,ms=2500,dps=6)]),
 'Headbutt':('headbutt','arm_smash','press',7000,'W',None,[E(k='area',r=100,front=1,knock=400,stunPrey=1500,dmg=10)]),
 'Throw Spear':('throw_spear','throw_spear','press',6000,'W',None,[E(k='proj',pk='spear',speed=900,range=800,r=16,dmg=22,stun=800)]),
 'Campfire':('campfire','fire','press',14000,'W',None,[E(k='zone',zk='camp',r=130,ms=10000,dps=4,heal=6)]),
 'Loud Caw':('loud_noise','loud_noise','press',8000,'W','!climbing',[E(k='area',r=200,stunPrey=1000)]),
 'Hop':('hop','extra_boost','press',5000,'W',None,[E(k='speed',mul=1.3,ms=700),E(k='fly',ms=600,speed=1.0)]),
}
# inferred extras that exist in earlier archive data but not on the wiki list
EXTRA={'throw_snow':('throw_snow','throw_snow','press',6000,'W',None,[E(k='proj',pk='snow',speed=700,range=550,r=20,stun=800)]),
       'drop_snow':('drop_snow','drop_snow','press',8000,'W',None,[E(k='zone',zk='frost',r=110,ms=4000,slow=0.6)]),
       'dive':('dive','dive','press',8000,'W',None,[E(k='hide',ms=3000,speed=0.8)])}
PASS={ # wiki name -> (id, simulated?, flag)
 'Climbing on hills':('climb_hills',False),'Climbing on rocks':('climb_rocks',False),'Climbing on trees':('climb_trees',True),'Faster movement in water':('fast_water',True),'Faster movement in mud':('fast_mud',False),
 'Diving in mud':('dive_mud',False),'Faster movement in quicksand':('fast_quicksand',False),'Grip on ice':('ice_grip',False),'Increased movement speed':('speed_up',True),'Reduced Boost Interval':('reduced_boost',True),
 'Sprint when hurt':('sprint_hurt',True),'Poison Bite':('poison_immunity',True),'Lava Immunity':('lava_immunity',False),'Ink immunity':('ink_immunity',False),'Bee Sting Immunity':('bee_immunity',False),
 "Immunity to the River's Current":('river_immunity',False),'Immunity to debuff in other biomes':('biome_immunity',False),'Surviving for longer on dry land':('dry_land',True),'Frostbite':('frostbite',False),
 'Fiery Bite':('fiery_bite',False),'Fly over everything':('fly_over',True),'Consume Carcasses':('carcasses',False),'Exhale food':('exhale_food',True),'Shoot Fire':('shoot_fire',False),
 'Invisibility':('invisible_still',True),'Tentacle Sting':('tentacle_sting',False),'See animals inside Hiding Holes':('see_holes',False),'Mad Donkey':('mad_donkey',False)}
def first(n): return re.split(r'[;,]',n)[0].strip()
used_by={}   # animal -> [ability ids in wiki order]
needs_of={}
recs={}
for s in W['special']:
    nm=first(s['name']); t=T.get(nm)
    if not t: print('NO MAPPING',nm); continue
    i,glyph,act,cd,key,needs,eff=t
    users=[A(u) for u in s['used'] if A(u)]
    recs[i]=dict(id=i,name=nm,aliases=[x.strip() for x in re.split(r'[;,]',s['name'])[1:] if x.strip()],type='special',activation=act,cooldownMs=cd,durationMs=max([e.get('ms',0) for e in eff] or [0]),keyboard=key,needs=needs,effects=eff,glyph=glyph,usedBy=users,wikiActivation=s['activate'],wikiText=s['description'][:600],implemented=True,verified=True,releaseDate=None,confidence='name/users/activation/description VERIFIED (Mope.io Wiki); cooldown, radii, durations, damage are INFERRED')
    for u in users: used_by.setdefault(u,[]).append(i)
for i,t in EXTRA.items():
    _,glyph,act,cd,key,needs,eff=t; recs[i]=dict(id=i,name=by.get(i,{}).get('name',i),type='special',activation=act,cooldownMs=cd,durationMs=max([e.get('ms',0) for e in eff] or [0]),keyboard='W',needs=None,effects=eff,glyph=glyph,usedBy=[],implemented=True,verified=False,releaseDate=None,confidence='present in the archived data; not on the wiki list; effect INFERRED')
# passives
prec={}; pused={}
for p in W['passive']:
    nm=first(p['name']); t=PASS.get(nm) or PASS.get(nm.title()) or PASS.get(nm.capitalize())
    if not t:
        for k,v in PASS.items():
            if k.lower()==nm.lower(): t=v
    if not t: print('NO PASSIVE MAPPING',nm); continue
    i,sim=t; users=[A(u) for u in p['used'] if A(u)]
    prec[i]=dict(id=i,name=nm,type='passive',keyboard='(passive)',simulated=sim,usedBy=users,wikiText=p['description'][:500],implemented=sim,verified=True,confidence='name/users/description VERIFIED (Mope.io Wiki); '+('simulated (numbers inferred)' if sim else 'NOT simulated (needs terrain effects the game does not have)'))
    for u in users: pused.setdefault(u,[]).append(i)
# merge into abilities.json (keep archive fields: clientId, icon, releaseDate)
out=[]
animal_date={a['id']:a['releaseDate'] for a in ANI}
for a in ABIL:
    i=a['id']
    if i in recs: a.update({k:v for k,v in recs[i].items() if k not in ('releaseDate',)}); a['iconStatus']='recreated'; del recs[i]
    elif i in prec: a.update({k:v for k,v in prec[i].items()}); del prec[i]
    out.append(a)
for i,r in {**recs,**prec}.items():
    users=r.get('usedBy') or []; r['releaseDate']=min([animal_date[u] for u in users] or ['2017-02-13']); r['releaseDate']=min(r['releaseDate'],'2026-11-13'); r['icon']=f'assets/icons/abilities/{i}.png'; r['iconStatus']='recreated'; out.append(r)
# existing passive 'camouflage' -> invisible_still alias: keep record, mark simulated in the engine as invisible_still
json.dump(out,open('data/abilities/abilities.json','w'),indent=2)
# animals: abilities (W/S in wiki order), passives
for a in ANI:
    if a['id'] in used_by:
        ids=used_by[a['id']]; a['abilities']=ids
    if a['id'] in pused: a['passives']=pused[a['id']]
json.dump(ANI,open('data/progression/animals.json','w'),indent=2)
print(len(out),'abilities;',sum(1 for a in ANI if a.get('abilities')),'animals with abilities;',sum(1 for a in ANI if a.get('passives')),'with passives')
