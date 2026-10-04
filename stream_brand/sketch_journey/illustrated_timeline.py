"""One entrance, one collapse, one island: revised story and safe interior cameras."""
import math
from . import cinematic_timeline as previous
from .choreography import REFERENCES as LOBBIES, ease
from .escape_choreography import beat, blend

lerp=previous.lerp
STATUES=previous.STATUES
HIT=previous.HIT
GATE_Z=12.
FLOOR_EDGE_Z=11.3
SAFE_SEAT=(-12.,5.5,0.)
_labels={
 'overload':('Overload / behind Udyr','Stay behind him as the chamber fractures'),
 'escape':('Blocked entrance / interior pan','Pan across the crumbling room and stop at the sealed entrance'),
 'bear':('Bear / over the shoulder','Lightning claws burn the runic roots across the original entrance'),
 'roof':('Cave-in / ceiling and gate','The roof, gate supports and nearby walls give way together'),
 'danger':('Cave-in / danger','The entrance structure collapses toward Udyr'),
 'race':('Turtle / rescue','Green spirit energy races to him as the whole entrance caves in'),
 'wall':('Udyr POV / back away','Step backward and see the original entrance buried in rubble'),
 'resolve':('Ram / resolve','Ram energy forms; this same rubble is the escape route'),
 'charge':('Udyr POV / ram charge','Charge straight at the rubble covering the original entrance'),
 'breach':('Udyr POV / break through','Break the same pile; discover the entrance floor has vanished'),
 'fall':('Udyr POV / unexpected fall','The destroyed floor drops away beneath him'),
 'lookback':('Udyr POV / look back','Look up at the broken entrance of the island he just left'),
 'flight':('Phoenix / return','Fly back up toward a surviving upper terrace on the same island'),
 'approach':('Original island / safe landing','Land above the damaged entrance on the intact western terrace'),
 'edge':('Safe terrace / edge','Walk to a safe spot on the original island'),
 'seated':('Original island / horizon','Sit above the ruins and look across the mystical world'),
}
SCENES=[(n,a,b,*_labels.get(n,(title,action))) for n,a,b,title,action in previous.SCENES]
REVIEW_TIMES=[(s[1]+s[2])/2 for s in SCENES]
REFERENCES={s[0]:LOBBIES['sanctuary'] for s in SCENES}


def state(t):
    p=previous.state(t);name=p['shot'];a,b=p['start'],p['end']
    if name in _labels:p['title'],p['action']=_labels[name]
    if t<beat(40):root=p['root']
    elif t<beat(42):root=lerp((0,0,10.5),(0,0,7.5),ease(beat(40),beat(42),t))
    elif t<beat(46):root=(0,0,7.5)
    elif t<beat(52):root=lerp((0,0,7.5),(0,0,10.6),ease(beat(46),beat(52),t))
    elif t<beat(54):
        q=ease(beat(52),beat(54),t)
        z=10.6+4.4*q
        root=(0,-.8*max(0,(z-FLOOR_EDGE_Z)/(15-FLOOR_EDGE_Z))**1.4,z)
    elif t<beat(62):root=lerp((0,-.8,15),(1,-9,18.5),ease(beat(54),beat(62),t))
    elif t<beat(68):root=lerp((1,-9,18.5),(3,-4,17),ease(beat(64),beat(68),t))
    elif t<beat(74):root=lerp((3,-4,17),(-6,6,4),ease(beat(68),beat(74),t))
    elif t<beat(78):root=lerp((-6,6,4),(-9,5.5,1),ease(beat(74),beat(78),t))
    elif t<beat(80):root=lerp((-9,5.5,1),SAFE_SEAT,ease(beat(78),beat(80),t))
    else:root=SAFE_SEAT
    p['root']=root
    if t>=beat(18):p['yaw']=math.pi*(1-ease(beat(18),beat(20),t))
    if t>=beat(62):p['yaw']=-2.5
    if t>=beat(78):p['yaw']=-math.pi/2
    p['pov']=p['pov'] or name=='wall'
    p['cavein']=ease(beat(30),HIT,t)
    p['rubble_smashed']=ease(beat(52),beat(53),t)
    p['floor_missing']=ease(beat(32),HIT,t)
    p['destination_island']='original'
    return p


def camera(p):
    name=p['shot'];t=p['t'];q=p['q'];x,y,z=p['root']
    if name in ('absorb','overload'):
        eye=(-3+q*.35,3.3,-5.7);target=(0,1.6,1.8);return eye,target,74
    if name=='escape':
        # Entire pan remains inside the room and behind Udyr's newly turned back.
        return (-3,3,-5.4),lerp((5,3,2),(0,2.6,12),q),76
    if name=='bear':return (-3.4,2.8,z-4.7),(0,2.0,12),75
    if name=='roof':return (-3.5,2.4,7.2),lerp((0,2.8,12),(0,6.4,11.5),q),78
    if name in ('danger','race'):
        return (5.5,.9,6.0),(0,3.7,11.0),90
    if name=='impact':return (2.2,1.8,7.6),(0,1.4,10.5),72
    if name=='wall':return (x,y+1.8,z),(0,1.8,14),78
    if name=='resolve':return (-1.6,1.9,9.25),(0,1.65,7.5),47
    if name in ('lower','charge','breach'):
        h=1.8-.97*p['crouch'];bob=0
        if name=='charge':bob=.055*math.sin(t*27)*ease(p['start'],p['start']+.1,t)*(1-ease(p['end']-.1,p['end'],t))
        return (x,y+h+bob,z),(0,y+h-.06,z+8),82
    if name=='fall':
        h=blend(.83,1.2,p['start'],p['start']+.15,t)
        return (x,y+h,z),lerp((x,y+.5,z+10),(x,y-11,z+4),q),86
    if name in ('lookback','tease'):return (x,y+1.2,z),(0,2,5),84
    if name=='storm':return (24,8,33),(1,-3,11),78
    if name=='flight':return (x+9,y+5,z+11),(-5,5,4),78
    if name=='approach':return (x+9,y+5,z+9),(-9,5.7,1),75
    if name=='edge':return (-3,9,8),(-11,6,0),72
    if name=='seated':return lerp((-3,10,8),(12,18,17),q),lerp((-14,6,0),(-38,7,-10),q),78
    return previous.camera(p)
