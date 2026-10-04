"""Center-outward surface illumination and claw-triggered collapse accents."""
import math
from .art_timeline import STATUES,beat,BEAR_CONTACT,HIT
from .motion_effects import reveal,statue_beams,obstacles
from .illustrated_materials import MAGIC,tone
from .choreography import ease


def branch_routes(j):
    x,_,z=STATUES[j]
    return [[(0,.08,0),(x*.35,.08,z*.26),(x*.72,.08,z*.52),(x,.08,z),
             (x*1.29,.08,z*1.29),(x*1.29,3.7,z*1.29),(x*1.29,7.55,z*1.29),(x*.54,7.55,z*.54)],
            [(x*.35,.08,z*.26),(x*.38+z*.15,.08,z*.62-x*.15),(x*1.3,.08,z*1.10),
             (x*1.3,4.5,z*1.10),(x*1.08,7.55,z*1.10),(x*.28,7.55,z*.35)],
            [(x*.72,.08,z*.52),(x*.96,.08,z*.24),(x*1.1,.08,z*1.3),
             (x*1.1,5,z*1.3),(x*1.1,7.55,z*1.3),(x*.54,7.55,z*.35)]]


def lights(v,p):
    t=p['t']
    if beat(8)<=t<beat(24):
        fade=1-ease(beat(22),beat(24),t)
        for j,c in enumerate(MAGIC.values()):
            progress=p['branch_progress'][j]
            for k,route in enumerate(branch_routes(j)):
                q=progress if k==0 else max(0,(progress-.20*k)/(1-.20*k))
                end=reveal(v,route,q,tone(c,.55+.30*fade),3)
                if end:v.orb(end,.09,c,2,c)
            if progress>.6:
                x,_,z=STATUES[j];glow=ease(.6,1,progress)*fade
                for h in (1.6,4.0,6.6):
                    v.line([(x*1.29-.35,h-.3,z*1.29),(x*1.29+.35,h,z*1.29),
                            (x*1.29-.10,h+.4,z*1.29)],tone(c,.35+.55*glow),3)
        v.orb((0,.10,0),.12+.18*ease(beat(8),beat(9),t),'#c6e1de',2,'#86bbb9')
    statue_beams(v,p)


def collapse_accents(v,p):
    age=p['t']-BEAR_CONTACT
    if not 0<=age<HIT-BEAR_CONTACT:return
    # The first tearing claw shakes the supports immediately, even while the
    # second claw is finishing and the same camera begins tilting upward.
    for j in range(16):
        start=(j%4)*.065;elapsed=max(0,age-start)
        if not elapsed:continue
        x=(j%5-2)*.7;y=6.8+j%3*.16-.2*elapsed-2.1*elapsed*elapsed
        if y>.2:v.box((x+.18*math.sin(j)*elapsed,y,11.4+j%3*.14),(.04,.065,.05),'#81908e')
    for side in (-1,1):
        reveal(v,[(side*2.1,5.1,11.52),(side*1.7,4.6,11.50),(side*2.1,4.1,11.5)],
               ease(0,.32,age),'#91c9d8',2)
