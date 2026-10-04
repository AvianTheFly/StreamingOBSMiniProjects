"""Sanctuary awakening and escape: each spirit resolves the previous obstacle."""
import math
from .choreography import BEAT, PHASE, ease, REFERENCES as LOBBY_REFERENCES


def beat(n):
    return PHASE+n*BEAT


SCENES=[
    ('enter',0,beat(6),'Sanctuary entrance','Udyr enters; something follows him'),
    ('walls',beat(6),beat(10),'Ancient circuits','Light travels through the carved walls and stalks Udyr'),
    ('statues',beat(10),beat(14),'Four spirit statues','Camera pans across the bear, turtle, ram and phoenix'),
    ('absorb',beat(14),beat(18),'Awakening','Each statue sends its own energy into Udyr'),
    ('collapse',beat(18),beat(20),'The price of awakening','The absorbed power destabilizes the sanctuary'),
    ('bear',beat(20),beat(30),'Bear / slash','Udyr wears the storm bear and claws through the sealed passage'),
    ('turtle',beat(30),beat(42),'Turtle / protect','Falling masonry hits the shell; deflected stones pile ahead'),
    ('ram',beat(42),beat(54),'Ram / break through','Ram charge clears the fallen rubble and breaches the outer wall'),
    ('fall',beat(54),beat(57),'Beyond the wall','The sanctuary hangs in the sky; Udyr falls from its broken ledge'),
    ('catch',beat(57),beat(60),'Phoenix / catch','The circling phoenix wraps Udyr and arrests his fall'),
    ('clear',beat(60),beat(72),'Phoenix / icy flames','Icy fire freezes and scatters the airborne debris'),
    ('reveal',beat(72),beat(80),'The hidden destination','The cleared air reveals an ancient celestial sanctuary'),
    ('arrival',beat(80),40,'Arrival','Udyr lands; camera pulls back on the mystical city'),
]
REFERENCES={s[0]:LOBBY_REFERENCES['sanctuary'] for s in SCENES[:8]}
REFERENCES.update({s[0]:LOBBY_REFERENCES['sky'] for s in SCENES[8:11]})
REFERENCES.update({s[0]:LOBBY_REFERENCES['observatory'] for s in SCENES[11:]})
HITS=[beat(32),beat(35),beat(38)]
REVIEW_TIMES=[1.5,3.7,5.8,7.65,8.9,10.7,12.7,15.25,17.95,20.85,23.75,25.9,27.45,29.6,32.6,35.6,39]


def blend(a,b,start,end,t):
    return a+(b-a)*ease(start,end,t)


def pose(t):
    if not 0<=t<=40:
        raise ValueError('Time outside the forty-second concept')
    scene=next((s for s in SCENES if s[1]<=t<s[2]),SCENES[-1])
    name,start,end,_,action=scene
    x,y,camera,lean,gesture,power=500.,535.,80.,0.,'stand',None
    compression=0.
    if name=='enter':
        x=blend(150,430,0,end,t);camera=0;gesture='walk'
    elif name=='walls':
        x=blend(430,500,start,end,t);camera=0;gesture='walk'
    elif name=='statues':
        camera=blend(0,200,start,end,t)
    elif name=='absorb':
        camera=blend(200,80,start,end,t);gesture='open'
    elif name=='bear':
        if t<beat(22):x=blend(500,760,start,beat(22),t)
        elif t<beat(24):x=760
        else:x=blend(760,1030,beat(24),end,t)
        power='bear';gesture='slash' if beat(22)<=t<beat(25) else 'run'
        lean=16*math.sin(math.pi*(t-start)/(end-start))
    elif name=='turtle':
        x=1030;power='turtle';gesture='guard';compression=ease(start,start+.35,t)
    elif name=='ram':
        power='ram';gesture='charge';lean=blend(0,25,start,start+.4,t)
        if t<beat(44):x=blend(1030,1085,start,beat(44),t)
        elif t<beat(50):x=blend(1085,1365,beat(44),beat(50),t)
        else:x=blend(1365,1630,beat(50),end,t)
        compression=1-ease(start,start+.5,t)
    elif name=='fall':
        q=(t-start)/(end-start)
        x=1630+90*q;y=535+400*q*q;lean=blend(25,45,start,end,t);gesture='fall'
    elif name=='catch':
        x=blend(1720,1900,start,end,t);gesture='fly';power='phoenix'
        q=(t-start)/(end-start)
        # Continue the fall briefly before wing lift reverses it; no position reset.
        y=935+85*math.sin(math.pi*q)-245*ease(start,end,t)
        lean=blend(45,-10,start,end,t)
    elif name=='clear':
        x=blend(1900,2250,start,end,t);y=blend(690,390,start,end,t)
        lean=-10;power='phoenix';gesture='fly'
    elif name=='reveal':
        x=blend(2250,2330,start,end,t);y=blend(390,535,start,end,t)
        lean=blend(-10,0,start,end,t);power='phoenix';gesture='fly'
    elif name=='arrival':
        x=2330;gesture='stand';power='phoenix' if t<beat(80)+.6 else None
    if name in ('bear','turtle','ram','fall','catch','clear','reveal','arrival'):
        camera=x-480
        if name=='bear':
            camera=blend(80,camera,start,start+.4,t)
    cy=max(0,y-535)*.8
    return dict(scene=name,start=start,end=end,u=t-start,x=x,y=y,camera=camera,
                camera_y=cy,lean=lean,gesture=gesture,power=power,compression=compression,
                action=action,absorbed=ease(beat(14),beat(18),t),
                collapse=ease(beat(18),beat(20),t),
                seal_broken=.45*ease(beat(22),beat(23),t)+.55*ease(beat(24),beat(25),t),
                rubble_cleared=ease(beat(44),beat(45),t),
                wall_breached=ease(beat(50),beat(51),t),
                ice=ease(beat(60),beat(70),t),
                visibility=ease(beat(68),beat(74),t),
                pullback=ease(beat(80),40,t))
