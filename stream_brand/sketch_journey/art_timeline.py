"""Camera, center-born illumination and immediate collapse for cinematic art v1."""
import math
from . import motion_timeline as motion
from .choreography import ease

beat=motion.beat
lerp=motion.lerp
HIT=motion.HIT
BEAR_CONTACT=motion.BEAR_CONTACT
RAM_HIT=motion.RAM_HIT
STATUES=motion.STATUES
REFERENCES=motion.REFERENCES
SCENES=[(n,a,b,
         'Runic chamber / spinning portrait' if n=='circle' else title,
         'Face Udyr through a quick turn; reveal the room behind him' if n=='circle' else
         'Continuous descent and follow through the original entrance' if n in ('vista','descend','rear') else
         'Center-born light branches outward through floor, walls and ceiling' if n=='orbit' else action)
        for n,a,b,title,action in motion.SCENES]
REVIEW_TIMES=[(a+b)/2 for _,a,b,_,_ in SCENES]


def state(t):
    p=motion.state(t)
    if t<beat(18):
        p['root']=(0,0,15*(1-ease(beat(4),beat(16),t)))
        p['walk']*=1-ease(beat(15.6),beat(16),t)
    if beat(14)<=t<beat(16):p['yaw']=math.pi+(2-math.pi)*ease(beat(14),beat(16),t)
    elif beat(16)<=t<beat(18):p['yaw']=2+math.tau*ease(beat(16),beat(18),t)
    elif beat(18)<=t<beat(20):p['yaw']=math.tau+2*(1-ease(beat(18),beat(20),t))
    p['branch_progress']=[ease(beat(8)+j*.12,beat(17)+j*.08,t) for j in range(4)]
    p['cavein_start']=BEAR_CONTACT
    p['cavein']=ease(BEAR_CONTACT,HIT,t)
    p['roof']=p['cavein']
    p['title']=next(s[3] for s in SCENES if s[0]==p['shot'])
    return p


def opening_camera(p):
    # One global clock across all three former shots, with a stationary offset
    # after the descent finishes. No camera or look target restarts at an edit.
    q=ease(0,beat(8),p['t']);u=1-q;x,y,z=p['root']
    controls=((24,20,17),(15,12,15),(-.7,2.6,5.2),(-.7,2.6,5.2))
    weights=(u**3,3*u*u*q,3*u*q*q,q**3)
    offset=tuple(sum(w*c[k] for w,c in zip(weights,controls)) for k in range(3))
    eye=(x+offset[0],y+offset[1],z+offset[2])
    target=lerp((0,3.8,0),(x,1.0,z-1.3),q)
    return eye,target,66+4*q


def camera(p):
    t=p['t'];x,y,z=p['root'];name=p['shot']
    if t<beat(12):return opening_camera(p)
    if name=='orbit':
        q=ease(beat(12),beat(16),t);a0=math.atan2(-.7,5.2)
        theta=a0+(2-a0)*q;radius=math.hypot(.7,5.2)+(5.8-math.hypot(.7,5.2))*q
        eye=(x+radius*math.sin(theta),2.6+.1*q,z+radius*math.cos(theta))
        return eye,(x,1.0+.55*q,z-1.3*(1-q)),70+4*q
    if name=='circle':
        theta=2+math.tau*ease(beat(16),beat(18),t)
        return (5.8*math.sin(theta),2.7,5.8*math.cos(theta)),(0,1.55,0),74
    if name=='statues':
        return lerp((5.8*math.sin(2),2.7,5.8*math.cos(2)),(-3,3.3,-5.7),ease(beat(18),beat(20),t)),(0,1.55,0),74
    if name in ('bear','roof') and t>=BEAR_CONTACT+.14:
        q=ease(BEAR_CONTACT+.14,beat(32),t)
        return lerp((-3.8,2.4,6.5),(-3.2,2.4,6.5),q),lerp((0,1.95,12.5),(0,6.4,11.5),q),74+4*q
    if name=='relief':return (.25,2.03,11.38),(0,1.9,10.5),96
    return motion.camera(p)
