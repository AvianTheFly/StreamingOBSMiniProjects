"""Shot grammar and persistent story state for the cinematic pencil revision."""
import math
from .choreography import COLORS, REFERENCES as LOBBIES, ease
from .escape_choreography import beat, blend


SCRIPT=[
 ('vista',0,4,'Sanctuary / scenic descent','Start above the floating ruins; tilt down toward Udyr'),
 ('descend',4,8,'Entrance / descend','Descend behind Udyr and move toward the entrance'),
 ('rear',8,12,'Behind Udyr / dolly','Follow him inside; lights wake behind him'),
 ('orbit',12,16,'Wall lights / orbit','Move around him; four colours branch through every surface'),
 ('circle',16,18,'Runic chamber / overhead','The four statues encircle the centre of the room'),
 ('statues',18,20,'Statues / arc','Follow each branch to its matching statue; Udyr looks around'),
 ('absorb',20,22,'Empowerment / push in','The four statues send energy into Udyr'),
 ('overload',22,24,'Overload / orbit','Spirit forms engulf him; cracks spread through the room'),
 ('escape',24,26,'Escape / reverse pan','He looks back to the sealed original entrance'),
 ('bear',26,30,'Bear / claw tracking','Lightning claws sizzle through the runic roots'),
 ('roof',30,32,'Consequence / tilt up','The burned seal destabilizes the overhead lintel'),
 ('danger',32,34,'Danger / low angle','Udyr looks up; heavy masonry is breaking loose'),
 ('race',34,35.5,'Turtle / last second','Green energy races to him as the block falls'),
 ('impact',35.5,37,'Impact / rubble wipe','The shell arrives just in time; dust and rubble cover the lens'),
 ('relief',37,40,'Inside the shield / close-up','He exhales in relief; the protective shell fades'),
 ('wall',40,42,'Only escape / pan','The entrance is buried; pan to the cracked side wall'),
 ('resolve',42,44,'Ram / eyes close-up','Ram energy takes shape as he commits to the charge'),
 ('lower',44,46,'Udyr POV / crouch','Lower from standing eyes to an all-fours ram stance'),
 ('charge',46,52,'Udyr POV / charge','Spirit horns frame the view; human forearms pound the floor'),
 ('breach',52,54,'Udyr POV / breach','Ram impact breaks the wall; daylight opens beneath him'),
 ('fall',54,58,'Udyr POV / fall','Keep moving beyond the wall, then drop through the sky'),
 ('lookback',58,60,'Udyr POV / look up','Look back at the floating sanctuary through falling rubble'),
 ('tease',60,62,'Udyr POV / unknown energy','Icy light and feather-like shapes gather at the edges'),
 ('storm',62,68,'Phoenix / wide storm','Spin inside the phoenix; an icy, fiery, ashy storm scatters the ruins'),
 ('flight',68,74,'Phoenix / wing flight','Flap out of the cloud, then open into a glide'),
 ('approach',74,78,'Destination / glide','Approach the crystal sanctuary and land on its terrace'),
 ('edge',78,80,'Arrival / follow','Walk to the cliff edge as the spirit fades'),
 ('seated',80,None,'Edge / scenic pullback','Sit with feet over the ledge, looking across the floating world'),
]
SCENES=[(name,0 if a==0 else beat(a),40 if b is None else beat(b),title,action)
        for name,a,b,title,action in SCRIPT]
POV={'lower','charge','breach','fall','lookback','tease'}
STATUES=[(-7,0,-5),(7,0,-5),(7,0,5),(-7,0,5)]
HIT=beat(35.5)
REVIEW_TIMES=[(a+b)/2 for _,a,b,_,_ in SCENES]
REFERENCES={name:LOBBIES['sanctuary'] if i<20 else LOBBIES['sky'] if i<24 else LOBBIES['observatory']
            for i,(name,*_) in enumerate(SCENES)}


def lerp(a,b,q):
    return tuple(x+(y-x)*q for x,y in zip(a,b))


def state(t):
    if not 0<=t<=40:raise ValueError('Time outside the 40-second sketch')
    shot=next((s for s in SCENES if s[1]<=t<s[2]),SCENES[-1])
    name,start,end,title,action=shot;q=ease(start,end,t)
    # Root positions persist through edits and through subjective/objective views.
    if t<beat(18):root=lerp((0,0,15),(0,0,0),ease(beat(4),beat(18),t))
    elif t<beat(26):root=(0,0,0)
    elif t<beat(30):root=lerp((0,0,0),(0,0,10.5),ease(beat(26),beat(27),t))
    elif t<beat(44):root=(0,0,10.5)
    elif t<beat(46):root=(0,0,10.5)
    elif t<beat(52):root=lerp((0,0,10.5),(9.4,0,5.5),ease(beat(46),beat(52),t))
    elif t<beat(54):root=lerp((9.4,0,5.5),(13.5,-.6,5.5),ease(beat(52),beat(54),t))
    elif t<beat(62):root=lerp((13.5,-.6,5.5),(18,-9,7),ease(beat(54),beat(62),t))
    elif t<beat(68):root=lerp((18,-9,7),(20,-5,7),ease(beat(64),beat(68),t))
    elif t<beat(74):root=lerp((20,-5,7),(40,3,-15),ease(beat(68),beat(74),t))
    elif t<beat(78):root=lerp((40,3,-15),(48,2,-29),ease(beat(74),beat(78),t))
    elif t<beat(80):root=lerp((48,2,-29),(50,2,-31),ease(beat(78),beat(80),t))
    else:root=(50,2,-31)
    yaw=math.pi if t<beat(24) else blend(math.pi,0,beat(24),beat(26),t)
    if beat(16)<t<beat(20):
        yaw+=math.sin(t*3)*.8*ease(beat(16),beat(16)+.2,t)*(1-ease(beat(20)-.2,beat(20),t))
    if t>=beat(40):yaw=blend(0,math.atan2(9.4,-5),beat(40),beat(44),t)
    if t>=beat(54):yaw=math.atan2(2,-3)
    if t>=beat(78):yaw=math.pi
    form=None
    if beat(26)<=t<beat(30):form='bear'
    if beat(34)<=t<beat(40):form='turtle'
    if beat(42)<=t<beat(54):form='ram'
    if beat(62)<=t<beat(78)+.4:form='phoenix'
    expression='fear' if name in ('danger','race','impact') else 'relief' if name=='relief' else 'resolve' if name=='resolve' else 'neutral'
    pose='walk' if name in ('descend','rear','orbit','circle','statues','edge') else 'slash' if name=='bear' else 'guard' if name in ('race','impact','relief') else 'four' if name in ('lower','charge','breach') else 'fly' if name in ('storm','flight','approach') else 'fall' if name in ('fall','lookback','tease') else 'sit' if name=='seated' else 'open' if name in ('absorb','overload') else 'stand'
    return dict(t=t,shot=name,start=start,end=end,q=q,title=title,action=action,root=root,yaw=yaw,
        form=form,pose=pose,expression=expression,pov=name in POV,
        energy=ease(beat(20),beat(22),t),collapse=ease(beat(22),beat(24),t),
        seal=ease(beat(27),beat(29),t),roof=ease(beat(30),beat(34),t),
        block_y=7.1-(7.1-3.45)*ease(beat(32),HIT,t),
        entrance_blocked=ease(HIT,HIT+.75,t),
        shield=ease(HIT-.32,HIT-.025,t)*(1-ease(beat(39),beat(40),t)),
        wall=ease(beat(52),beat(53),t),storm=ease(beat(64),beat(66),t),
        crouch=ease(beat(44),beat(46),t),debris_clear=ease(beat(64),beat(68),t))


def camera(p):
    name,q,root=p['shot'],p['q'],p['root'];x,y,z=root
    eye=(x,y+1.8,z);target=(x,y+1.1,z+2);fov=58
    if name=='vista':
        eye=lerp((24,20,32),(16,14,27),q);target=lerp((0,5,0),(0,2,8),q);fov=66
    elif name=='descend':eye=lerp((16,14,27),(0,3.7,z+7),q);target=(x,1.3,z-2)
    elif name=='rear':eye=(x-.4,3.2,z+5);target=(x,1.1,z-5)
    elif name=='orbit':
        a=blend(0,2.0,p['start'],p['end'],p['t']);eye=(8*math.sin(a),3.3,z+8*math.cos(a));target=(x,1.8,z-2)
    elif name=='circle':eye=lerp((3,32,2),(2,30,1),q);target=(0,0,0);fov=80
    elif name=='statues':
        a=2+q*1.2;eye=(8*math.sin(a),4,8*math.cos(a));target=(0,1.8,0);fov=78
    elif name in ('absorb','overload'):
        a=3.2+(.7*q if name=='absorb' else .7+1.4*q)
        radius=7 if name=='absorb' else 5
        eye=(radius*math.sin(a),2.8,radius*math.cos(a));target=(0,1.3,0);fov=70
    elif name=='escape':eye=lerp((5,3,-1),(4,3,5),q);target=lerp((0,1.5,0),(0,2,12),q)
    elif name=='bear':eye=(-5,2.7,z+3);target=(0,1.7,11.7);fov=72
    elif name=='roof':eye=(4,2.6,8);target=lerp((0,2.5,12),(0,7,12),q);fov=60
    elif name in ('danger','race'):eye=(2,.65,19);target=(0,3.7,11);fov=84
    elif name=='impact':eye=(1,1.7,14.5);target=(0,1.1,10.5);fov=64
    elif name=='relief':eye=(.2,1.7,11.85);target=(0,1.7,10.5);fov=65
    elif name=='wall':eye=(3,3,14.8);target=lerp((0,2,12),(9.7,2,5.5),q);fov=68
    elif name=='resolve':eye=(2.2,1.9,9.1);target=(0,1.65,10.5);fov=32
    elif name in ('lower','charge','breach'):
        h=1.8-.97*p['crouch'];eye=(x,y+h,z)
        target=(x+9.4,y+h-.08,z-5);fov=82
        if name=='charge':
            bob=.055*math.sin(p['t']*27)*ease(p['start'],p['start']+.1,p['t'])*(1-ease(p['end']-.1,p['end'],p['t']))
            eye=(x,y+h+bob,z)
    elif name=='fall':
        eye=(x,y+blend(.83,1.2,p['start'],p['start']+.15,p['t']),z)
        target=lerp((x+10,y+.5,z-3),(x+5,y-12,z-3),q);fov=84
    elif name in ('lookback','tease'):
        eye=(x,y+1.2,z);target=(0,2,0);fov=84
    elif name=='storm':eye=(35,7,35);target=(13,-2,4);fov=74
    elif name=='flight':eye=(x+9,y+5,z+12);target=(x+6,y+1,z-7);fov=76
    elif name=='approach':eye=(x+11,y+6,z+11);target=(48,3,-23);fov=76
    elif name=='edge':eye=(56,5,-16);target=(50,2,-29);fov=70
    elif name=='seated':eye=lerp((55,6,-17),(65,14,-3),q);target=lerp((52,2,-36),(62,4,-65),q);fov=76
    return eye,target,fov
