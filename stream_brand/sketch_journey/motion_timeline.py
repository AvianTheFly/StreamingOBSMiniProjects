"""Continuous action clocks, contact deadlines and cameras for the final motion MVP."""
import math
from . import illustrated_timeline as previous
from .choreography import ease
from .sketch_space import add

beat=previous.beat
lerp=previous.lerp
STATUES=previous.STATUES
HIT=previous.HIT
FLOOR_EDGE_Z=previous.FLOOR_EDGE_Z
SAFE_SEAT=previous.SAFE_SEAT
RAM_HIT=beat(51.7)
RAM_LAUNCH=beat(48.4)
RAM_RELEASE=RAM_HIT+.16
BEAR_CONTACT=beat(29)
BEAM_LAUNCH=[beat(18.35+j*.25) for j in range(4)]
BEAM_ARRIVAL=[beat(20.15+j*.25) for j in range(4)]
SCENES=previous.SCENES
REFERENCES=previous.REFERENCES
REVIEW_TIMES=previous.REVIEW_TIMES


def hermite(a,b,va,vb,q):
    return (2*q**3-3*q*q+1)*a+(q**3-2*q*q+q)*va+(-2*q**3+3*q*q)*b+(q**3-q*q)*vb


def window(a,b,c,d,t):return ease(a,b,t)*(1-ease(c,d,t))


def state(t):
    p=previous.state(t);root=p['root']
    if beat(24)<=t<beat(26):root=(0,0,3.2*ease(beat(24),beat(26),t))
    elif beat(26)<=t<beat(40):root=(0,0,3.2+7.3*ease(beat(26),beat(28.5),t))
    elif beat(46)<=t<RAM_LAUNCH:root=(0,0,7.5)
    elif RAM_LAUNCH<=t<RAM_HIT:root=(0,0,7.5+3.1*((t-RAM_LAUNCH)/(RAM_HIT-RAM_LAUNCH))**1.65)
    elif RAM_HIT<=t<RAM_RELEASE:root=(0,0,10.6-.12*ease(RAM_HIT,RAM_HIT+.08,t))
    elif RAM_RELEASE<=t<beat(54):
        span=beat(54)-RAM_RELEASE;q=(t-RAM_RELEASE)/span
        z=hermite(10.48,15,0,2*span,q)
        root=(0,-.8*max(0,(z-FLOOR_EDGE_Z)/(15-FLOOR_EDGE_Z))**1.4,z)
    elif beat(54)<=t<beat(62):
        q=(t-beat(54))/(beat(62)-beat(54));span=beat(62)-beat(54)
        start_v=-.8*1.4/(15-FLOOR_EDGE_Z)*2
        root=(ease(beat(54),beat(62),t),hermite(-.8,-14,start_v*span,-3*span,q),hermite(15,18.5,2*span,0,q))
    elif beat(62)<=t<beat(64):
        q=(t-beat(62))/(beat(64)-beat(62));span=beat(64)-beat(62)
        root=(1+ease(beat(62),beat(64),t),hermite(-14,-15,-3*span,0,q),18.5-.5*ease(beat(62),beat(64),t))
    elif beat(64)<=t<beat(68):root=lerp((2,-15,18),(3,-4,17),ease(beat(64),beat(68),t))
    p['root']=root
    p['beam_progress']=[ease(a,b,t) for a,b in zip(BEAM_LAUNCH,BEAM_ARRIVAL)]
    p['spirit_growth']=[ease(b,b+.72,t) for b in BEAM_ARRIVAL]
    p['energy']=sum(p['spirit_growth'])/4
    p['empower_hold']=1-ease(beat(24.7),beat(26),t)
    p['bear_growth']=ease(beat(25),beat(26.3),t)*(1-ease(beat(30),beat(30.8),t))
    p['bear_crouch']=window(beat(25.2),beat(26),beat(28.5),beat(29),t)
    p['bear_running']=window(beat(25.8),beat(26.15),beat(28.2),beat(28.5),t)
    p['slash']=window(beat(28.6),beat(29),beat(29.8),beat(30.35),t)
    p['slash_clock']=t-BEAR_CONTACT
    p['seal_grow']=ease(beat(22.2),beat(24.8),t)
    p['seal']=ease(BEAR_CONTACT,beat(29.8),t)
    p['ram_growth']=ease(beat(42),beat(45.6),t)*(1-ease(beat(54),beat(55),t))
    p['ram_contact']=window(RAM_HIT-.09,RAM_HIT,RAM_HIT+.035,RAM_HIT+.20,t)
    p['rubble_smashed']=ease(RAM_HIT+.055,RAM_HIT+.51,t)
    p['ram_debris_age']=max(0,t-(RAM_HIT+.055))
    p['crouch']=ease(beat(44),beat(46),t)*(1-ease(beat(54),beat(55),t))
    p['quadruped']=max(p['bear_crouch'],p['crouch'])
    p['guard']=window(beat(33.8),beat(35),beat(38.7),beat(40.2),t)
    p['open']=p['energy']*p['empower_hold']
    p['air']=window(beat(53.7),beat(55),beat(75.8),beat(78),t)
    p['flying']=ease(beat(62),beat(64),t)*(1-ease(beat(76),beat(78),t))
    p['sit']=ease(beat(80.2),beat(81.7),t)
    p['walk']=max(window(beat(3.8),beat(4.3),beat(17.7),beat(18),t),
                  window(beat(23.8),beat(24.3),beat(25.5),beat(26.2),t),
                  window(beat(40),beat(40.2),beat(41.8),beat(42),t),
                  window(beat(77.8),beat(78.2),beat(79.8),beat(80.2),t))
    p['ram_running']=window(RAM_LAUNCH,RAM_LAUNCH+.12,RAM_HIT-.12,RAM_HIT,t)
    p['spin_angle']=math.tau*3*ease(beat(62),beat(68),t)
    p['phoenix_growth']=ease(beat(60),beat(64),t)*(1-ease(beat(78),beat(79),t))
    p['body_scale']=1+.055*p['energy']
    p['body_pitch']=.06*math.sin(t*4)*p['air']*(1-p['flying'])+.10*p['flying']
    p['body_roll']=.13*math.sin((t-beat(54))*4)*p['air']*(1-p['flying'])+.05*math.sin(t*2)*p['flying']
    p['head_pitch']=-.42*window(beat(30),beat(32),HIT,HIT+.3,t)
    p['yaw']=math.pi*(1-ease(beat(18),beat(20),t))
    if t>=beat(57.5):p['yaw']=-math.pi*ease(beat(57.5),beat(59.5),t)
    if t>=beat(61.5):p['yaw']=-math.pi+(-2.5+math.pi)*ease(beat(61.5),beat(63),t)
    if t>=beat(78):p['yaw']=-2.5+(-math.pi/2+2.5)*ease(beat(78),beat(79),t)
    p['form']=('bear' if p['bear_growth']>.001 else 'turtle' if p['shield']>.001 else
               'ram' if p['ram_growth']>.001 else 'phoenix' if p['phoenix_growth']>.001 else None)
    p['scene_label']='MOTION MVP 05'
    return p


def camera(p):
    name,t,root=p['shot'],p['t'],p['root'];x,y,z=root
    if name=='rear':return (x-.7,2.6,z+5.2),(x,1.0,z-1.3),70
    if name=='statues':
        q=ease(beat(18),beat(20),t)
        return lerp((7.27,3.3,-3.33),(-3,3.3,-5.7),q),(0,1.55,0),78-4*q
    if name in ('absorb','overload'):
        q=ease(beat(20),beat(24),t)
        return lerp((-3,3.3,-5.7),(-2.5,2.9,-4.6),q),(0,1.55,0),74
    if name=='escape':
        pan=ease(beat(24),beat(25.2),t);lower=ease(beat(25.2),beat(26),t)
        eye=lerp((-2.5,2.9,-4.6),(-2.6,2.5,-4.3),pan)
        target=lerp((0,1.55,0),(0,2,12),pan)
        return lerp(eye,(-3.8,1.6,z-5.2),lower),lerp(target,(0,.8,z+.6),lower),74
    if name=='bear':
        rise=ease(beat(28.5),beat(29),t)
        eye=(-3.8,1.6+.8*rise,z-5.2+1.2*rise)
        target=(0,.8+rise*1.15,z+.6+rise*1.4)
        return eye,target,74
    if name=='roof':return (-3.2,2.4,6.5),lerp((0,1.95,12.5),(0,6.4,11.5),p['q']),74+4*p['q']
    if name=='relief':return (.25,1.80,11.24),(0,1.74,10.5),85
    if name in ('wall','lower','charge','breach','fall','lookback','tease'):
        h=1.8-.78*p['quadruped'];forward=.20*p['quadruped']
        bob=0
        if name=='charge':bob=.04*math.sin((z-7.5)*math.tau/(2.15*p['body_scale']))*p['ram_running']
        eye=(x,y+h+bob,z+forward)
        target=(x,y+h-.08,z+8)
        if t>=beat(54):
            eye=(x,y+1.02+.78*ease(beat(54),beat(55),t),z+.20*(1-ease(beat(54),beat(55),t)))
            down=lerp((x,y+.94,z+8),(x,y-7,z+4),ease(beat(54),beat(57.5),t))
            target=lerp(down,(0,2,6),ease(beat(57.5),beat(59.5),t))
        if RAM_HIT<=t<RAM_HIT+.3:
            recoil=.065*math.sin((t-RAM_HIT)*65)*math.exp(-(t-RAM_HIT)*9)
            eye=add(eye,(recoil*.25,recoil,-p['ram_contact']*.07))
        return eye,target,82+4*ease(beat(54),beat(55),t)
    if name=='storm':return (24,5,33),(1,-8,14),78
    return previous.camera(p)
