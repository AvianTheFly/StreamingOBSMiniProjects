"""Fixed-length two-bone limbs and planted gait, independent of camera cuts."""
import math
from .sketch_space import add,sub,mul,dot,unit


def mix(a,b,q):return tuple(x+(y-x)*q for x,y in zip(a,b))


def ik(start,target,hint,upper,lower):
    delta=sub(target,start);distance=math.sqrt(dot(delta,delta))
    length=max(abs(upper-lower)+.0001,min(upper+lower-.0001,distance))
    direction=unit(delta);end=add(start,mul(direction,length))
    bend=sub(hint,start);bend=sub(bend,mul(direction,dot(bend,direction)))
    if dot(bend,bend)<1e-10:bend=sub((0,0,1),mul(direction,direction[2]))
    bend=unit(bend)
    along=(upper*upper-lower*lower+length*length)/(2*length)
    height=math.sqrt(max(0,upper*upper-along*along))
    joint=add(start,add(mul(direction,along),mul(bend,height)))
    return start,joint,end


def foot(distance,offset,nominal,stride,stance=.62):
    phase=(distance/stride+offset)%1
    if phase<stance:return .035,nominal+stride*(stance/2-phase),True
    u=(phase-stance)/(1-stance)
    # Endpoint slope matches the planted part, avoiding a snapping ankle.
    a,b=nominal-stance/2*stride,nominal+stance/2*stride
    slope=-stride*(1-stance)
    z=(2*u**3-3*u*u+1)*a+(u**3-2*u*u+u)*slope+(-2*u**3+3*u*u)*b+(u**3-u*u)*slope
    return .035+.18*math.sin(math.pi*u)**2,z,False


def skeleton(p):
    t=p['t'];root=p['root'];q=p['quadruped'];sit=p['sit'];air=p['air'];guard=p['guard'];spread=p['open']
    distance=15-root[2] if p['yaw']>2 else root[2]
    if p['shot'] in ('edge','seated'):distance=-root[0]-8
    distance/=p['body_scale']  # Body-local stride must cancel world translation after empowerment.
    motion=max(p['walk'],p['bear_running'],p['ram_running'])
    bounce=.025*math.sin(distance*math.tau/1.1)*motion*(1-p['ram_contact'])
    pelvis=mix((0,.92+bounce,0),(0,.78+bounce,-.30),q)
    chest=mix((0,1.42+bounce,0),(0,.70+bounce,.40),q)
    head=mix((0,1.80+bounce,.015),(0,.99+bounce,.66),q)
    breath=.012*math.sin(t*2.1)*(1-q)*(1-air)
    chest=add(chest,(0,breath,0));head=add(head,(0,breath*.45,0))
    pelvis=mix(pelvis,(0,.24,0),sit);chest=mix(chest,(0,.88,.03),sit);head=mix(head,(0,1.26,.08),sit)
    scale=p['body_scale'];yaw=p['yaw'];pitch=p['body_pitch'];roll=p['body_roll']
    yaw+=p['spin_angle']
    def vector(v):
        a,b,c=v;a,b=a*math.cos(roll)-b*math.sin(roll),a*math.sin(roll)+b*math.cos(roll)
        b,c=b*math.cos(pitch)-c*math.sin(pitch),b*math.sin(pitch)+c*math.cos(pitch)
        return (a*math.cos(yaw)+c*math.sin(yaw),b,-a*math.sin(yaw)+c*math.cos(yaw))
    def world(v):return add(root,vector(mul(v,scale)))
    joints={'pelvis':world(pelvis),'chest':world(chest),'head':world(head)};chains=[];contacts={}
    for side,label in ((-1,'left'),(1,'right')):
        shoulder=add(chest,(side*.34,0,0));hip=add(pelvis,(side*.19,0,0))
        fy,fz,planted=foot(distance,0 if side<0 else .5,0,1.4,.38)
        legtarget=mix((side*.25,.035,0),(side*.25,fy,fz),motion)
        qfy,qfz,qplant=foot(distance,.5 if side<0 else 0,-.56,2.15,.30)
        legtarget=mix(legtarget,mix((side*.28,.035,-.56),(side*.28,qfy,qfz),motion),q)
        legtarget=mix(legtarget,(side*.25,-.62,.68),sit)
        legtarget=mix(legtarget,(side*.32,.12+.14*math.sin(t*5+side),-.15),air)
        legs=ik(hip,legtarget,(side*.25,.45,.35-.4*q),.47,.50)
        hand=(side*.50,.72,.08+.12*math.sin(distance*7+side)*motion)
        hy,hz,hplant=foot(distance,0 if side<0 else .5,.65,2.15,.30)
        hand=mix(hand,mix((side*.36,.035,.65),(side*.36,hy,hz),motion),q)
        hand=mix(hand,(side*.75,1.67,.25),max(spread,air))
        hand=mix(hand,(-side*.19,1.54,.35),guard)
        hand=mix(hand,(side*.25,.52,.62),sit)
        if p['slash']:
            from .choreography import ease
            phase=p['slash_clock']-(0 if side>0 else .22)
            target=mix(hand,(side*.62,1.76,.11),ease(-.18,0,phase))
            target=mix(target,(-side*.07,1.00,1.15),ease(0,.13,phase))
            target=mix(target,hand,ease(.18,.40,phase))
            hand=mix(hand,target,p['slash'])
        arms=ik(shoulder,hand,(side*.65,1.10-.4*q-.35*sit,.14+.10*sit),.44,.47)
        for family,points,lengths in (('arm',arms,(.44,.47)),('leg',legs,(.47,.50))):
            names=[label+suffix for suffix in (('_shoulder','_elbow','_wrist') if family=='arm' else ('_hip','_knee','_ankle'))]
            for name,point in zip(names,points):joints[name]=world(point)
            chains.append((names[0],names[1],names[2],lengths[0]*scale,lengths[1]*scale))
        contacts[label+'_hand']=hplant if q>.98 and motion else False
        contacts[label+'_foot']=qplant if q>.98 else planted if motion else True
    return {'joints':joints,'chains':chains,'world':world,'vector':vector,'local_head':head,'contacts':contacts,'yaw':yaw}


def subjective_skeleton(p,view):
    """Authored POV arm rig: fixed bones, same stride/contact and panic clocks.

    The closer arm projection keeps the gesture legible through the wide lens,
    as a cinematic/game POV viewmodel. It never changes the world actor's pose.
    """
    def world(q):return add(view.eye,add(mul(view.right,q[0]),add(mul(view.up,q[1]),mul(view.forward,q[2]))))
    chains=[];distance=p['root'][2];q=p['quadruped'];air=p['air']
    for side in (-1,1):
        stride=math.sin(distance*math.tau/(2.15*p['body_scale'])+(math.pi if side<0 else 0))
        gait=max(p['bear_running'],p['ram_running'])
        shoulder=(side*.42,-.23,.06)
        hand=(side*(.28+.05*q),-.32+stride*.07*gait,.84+stride*.08*gait)
        # Flinch inward at contact, then extend and grasp as the floor gives way.
        hand=mix(hand,(side*.27,-.25,.70),p['ram_contact'])
        panic=(side*(.45+.04*math.sin(p['t']*5)),.02+.06*math.sin(p['t']*6+side),.78)
        hand=mix(hand,panic,air*(1-p['flying']))
        chain=ik(shoulder,hand,(side*.60,-.45,.46),.44,.47)
        chains.append(tuple(world(point) for point in chain))
    return chains
