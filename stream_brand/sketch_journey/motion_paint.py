"""Textured concept animation using a continuous articulated human and spirit rig."""
import math
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,ImageChops
from .illustrated_paint import IllustratedSketch
from .illustrated_materials import ArtView,MAGIC,tone
from .motion_timeline import state,camera,beat,HIT,RAM_HIT
from .motion_rig import skeleton,subjective_skeleton
from .motion_effects import lights,obstacles,reveal
from .sketch_space import add,sub,mul,unit,cross,dot
from .choreography import ease


def segment(v,a,b,r0,r1,c):
    axis=unit(sub(b,a));right=unit(cross(axis,(0,0,1)))
    if dot(right,right)<.1:right=unit(cross(axis,(1,0,0)))
    up=cross(axis,right);rings=[]
    for center,r in ((a,r0),(b,r1)):
        rings.append([add(center,add(mul(right,r*math.cos(j*math.tau/6)),mul(up,r*math.sin(j*math.tau/6)))) for j in range(6)])
    for j in range(6):
        k=(j+1)%6;normal=add(mul(right,math.cos((j+.5)*math.tau/6)),mul(up,math.sin((j+.5)*math.tau/6)))
        shade=.76+.25*dot(normal,unit((-.4,.8,.5)))
        v.polygon([rings[0][j],rings[1][j],rings[1][k],rings[0][k]],tone(c,shade),'#283540',1)
    v.polygon(rings[1],tone(c,.85),'#31414a',1)


class MotionSketch(IllustratedSketch):
    generated_image_count=0
    delivery_metadata={'reference_art_count':5,'still_image_substitutions':0,
        'animation':'continuous fixed-length human rig, planted gait, spirit build and contact-driven debris',
        'return_island':'original','escape_route':'original entrance rubble','revision':'motion-mvp-v5'}

    def __init__(self):
        super().__init__()
        noise=np.random.default_rng(5103).integers(238,256,(180,320),dtype=np.uint8)
        self.grain=Image.fromarray(noise).convert('RGB').resize((1280,720),Image.Resampling.BILINEAR)

    def render(self,t):
        p=state(t);im=self.sky.copy();eye,target,fov=camera(p)
        if p['shot'] in ('overload','impact'):
            amp=.025 if p['shot']=='overload' else .075
            eye=add(eye,(amp*math.sin(t*71),amp*.5*math.sin(t*89),0))
        v=ArtView(im,eye,target,fov);r=skeleton(p)
        self.landscape(v,p);self.sanctuary(v,p);self.engravings(v,p)
        lights(v,p);obstacles(v,p);self.air_geometry(v,p)
        self.actor(v,p,r,subjective=p['pov'])
        v.flush();self.bloom(im);self.atmosphere(im,p)
        im=Image.blend(im,ImageChops.multiply(im,self.grain),.65)
        d=ImageDraw.Draw(im);d.rectangle((0,0,1280,30),fill='#09121d');d.rectangle((0,684,1280,720),fill='#09121d')
        d.text((22,8),'SANCTUARY / MOTION & CONTINUITY MVP 05',font=self.small,fill='#a7c9d0')
        d.text((1120,8),f'{t:04.1f} / 40s',font=self.small,fill='#a7c9d0')
        d.text((22,693),p['title'],font=self.small,fill='#c3d9da')
        return im

    def engravings(self,v,p):
        # Persistent chiselled marks attach to the stone rather than the screen.
        for j in range(12):
            if j in (0,9):continue
            a=j*math.tau/12;x,z=10*math.sin(a),10*math.cos(a)
            for k in range(4):
                y=.8+k*1.1
                v.line([(x-.22,y,z+.36),(x+.13,y+.28,z+.36),(x-.10,y+.52,z+.36),(x+.22,y+.76,z+.36)],'#7a928e',1)
        for j in range(30):
            a=j*math.tau/30;b=a+.11;r=5.0+j%3*1.05
            v.line([(r*math.sin(a),.045,r*math.cos(a)),(r*math.sin(b),.045,r*math.cos(b))],'#243f4c',2)
        for x in (-1.7,1.7):
            for j in range(4):v.line([(x,.2+j*.30,11.31),(x+.12,.32+j*.30,11.31),(x-.08,.4+j*.30,11.31)],'#819e9a',1)

    def statue_colour(self,p,j,c,awake):
        from .illustrated_materials import rgb
        return tuple(round(a+(b-a)*awake) for a,b in zip(rgb('#6d858b'),rgb(c)))

    def actor(self,v,p,r,subjective=False):
        j=r['joints'];vec=r['vector'];scale=p['body_scale']
        offset=lambda center,q:add(center,vec(mul(q,scale)))
        if not subjective:
            top=[offset(j['chest'],q) for q in ((-.39,.06,-.18),(.39,.06,-.18),(.39,.06,.18),(-.39,.06,.18))]
            bottom=[offset(j['pelvis'],q) for q in ((-.25,0,-.16),(.25,0,-.16),(.25,0,.16),(-.25,0,.16))]
            for k in range(4):v.polygon([top[k],top[(k+1)%4],bottom[(k+1)%4],bottom[k]],tone('#90775e',(.66,.8,1.02,.82)[k]),'#37444c',1)
            # A short fur mantle follows the chest, and its tails follow the pelvis.
            for side in (-1,1):
                for k in range(5):
                    a=side*(.11+k*.07)
                    v.polygon([offset(j['chest'],(a,.18,-.12)),offset(j['chest'],(a+side*.10,.04,.02)),
                               offset(j['chest'],(a+side*.04,-.20,-.18))],tone('#7c7a68',.72+k*.09),'#303c40',1)
                v.polygon([offset(j['chest'],(side*.30,.02,-.22)),offset(j['pelvis'],(side*.32,-.35,-.26)),
                           offset(j['pelvis'],(side*.08,-.18,-.28))],'#383e37','#657260',1)
            segment(v,offset(j['pelvis'],(0,-.20,0)),offset(j['pelvis'],(0,.07,0)),.33,.26,'#3e443d')
            segment(v,offset(j['chest'],(0,.09,0)),offset(j['head'],(0,-.19,0)),.115,.105,'#967e65')
            self.head(v,p,r)
        for label in ('left','right'):
            if not subjective:
                a,b,c=[j[label+s] for s in ('_hip','_knee','_ankle')]
                segment(v,a,b,.125,.10,'#484f48');segment(v,b,c,.09,.075,'#665f4d')
                v.orb(b,.095,'#485149',1,'#485149')
                segment(v,c,offset(c,(0,0,.17)),.10,.11,'#403e35')
            if subjective:continue
            a,b,c=[j[label+s] for s in ('_shoulder','_elbow','_wrist')]
            segment(v,a,b,.13,.105,'#a38a6d');segment(v,b,c,.105,.074,'#9c856a')
            v.orb(b,.09,'#887359',1,'#887359')
            segment(v,lerp_point(b,c,.50),lerp_point(b,c,.86),.111,.095,'#494e44')
            for u in (.55,.69,.83):
                center=lerp_point(b,c,u);v.orb(center,.095,'#a6a185',1)
            # Hands remain attached to wrists in first-person and external shots.
            tip=offset(c,(0,.02,.14));segment(v,c,tip,.081,.088,'#987e61')
            for finger in range(3):
                start=offset(tip,((finger-1)*.04,0,0));end=offset(start,(0,-.03,.09))
                v.line([start,end],'#b09978',2)
        if subjective:
            for a,b,c in subjective_skeleton(p,v):
                segment(v,a,b,.13,.105,'#a38a6d');segment(v,b,c,.105,.073,'#9c856a')
                segment(v,lerp_point(b,c,.44),lerp_point(b,c,.84),.109,.090,'#4f5b4d')
                palm=add(c,mul(v.forward,.13));segment(v,c,palm,.080,.085,'#a18b70')
                for finger in range(3):
                    start=add(palm,mul(v.right,(finger-1)*.04))
                    v.line([start,add(start,add(mul(v.forward,.09),mul(v.up,-.025)))],'#cab18b',2)
                if p['ram_growth']:
                    reveal(v,[b,c,palm,add(palm,mul(v.forward,.12))],p['ram_growth'],MAGIC['ram'],3)
        for kind,q in zip(MAGIC,p['spirit_growth']):
            if q*p['empower_hold']>.001:self.aura(v,p,r,kind,q*p['empower_hold']*.60)
        for kind,q in (('bear',p['bear_growth']),('turtle',p['shield']),('ram',p['ram_growth']),('phoenix',p['phoenix_growth'])):
            if q>.001:self.aura(v,p,r,kind,q)
        if p['bear_growth']:
            for label,delay in (('right',0),('left',.22)):
                age=p['slash_clock']-delay
                if 0<age<.20:
                    wrist=j[label+'_wrist'];tip=add(wrist,vec((0,.05,.37)))
                    end=(.2 if label=='right' else -.2,2.2,11.91)
                    mid=add(lerp_point(tip,end,.55),(.12,.08,0))
                    reveal(v,[tip,mid,end],ease(0,.055,age),MAGIC['bear'],4)

    def head(self,v,p,r):
        center=r['joints']['head'];vec=r['vector'];scale=p['body_scale'];pitch=p['head_pitch']
        def pt(x,y,z):
            y,z=y*math.cos(pitch)-z*math.sin(pitch),y*math.sin(pitch)+z*math.cos(pitch)
            return add(center,vec((x*scale,y*scale,z*scale)))
        vertices=[pt(x,y,z) for x,y,z in ((-.17,-.17,-.14),(.17,-.17,-.14),(.18,-.10,.16),(-.18,-.10,.16),(-.18,.20,-.12),(.18,.20,-.12),(.16,.18,.15),(-.16,.18,.15))]
        for face,c in (((0,1,5,4),'#474438'),((1,2,6,5),'#92785c'),((2,3,7,6),'#b39a78'),((3,0,4,7),'#8a735a'),((4,5,6,7),'#30383b')):
            v.polygon([vertices[k] for k in face],c,'#293a42',1)
        # Angular brow, nose and long beard, with small eyes rather than round discs.
        for side in (-1,1):
            v.line([pt(side*.13,.07,.177),pt(side*.03,.05,.18)],'#283334',4)
            color='#83d4b2' if p['shield'] else '#adcfcc'
            y=.014 if p['expression']=='relief' else .026
            v.line([pt(side*.105,y,.182),pt(side*.045,y+.007,.185)],color,2)
        v.polygon([pt(-.025,.025,.18),pt(.025,.025,.18),pt(.03,-.08,.23),pt(-.015,-.08,.23)],'#957b5d','#806c55',1)
        v.polygon([pt(-.16,-.07,.181),pt(.16,-.07,.181),pt(.11,-.25,.20),pt(0,-.36,.17),pt(-.11,-.25,.20)],'#273233','#415048',1)
        for k in range(7):
            x=(k-3)*.049
            v.line([pt(x,.20,-.04),pt(x,.05,-.19),pt(x+.025*math.sin(p['t']*3+k),-.32,-.22),pt(x,-.60,-.23)],'#242e32',5)

    def aura(self,v,p,r,kind,q):
        c=tone(MAGIC[kind],.45+.55*q);j=r['joints'];vec=r['vector'];head=j['head']
        def hp(a,b,c0=0):return add(head,vec((a,b,c0)))
        def path(points,w=3):return reveal(v,points,q,c,w)
        if kind=='turtle':
            radius=.28+.72*q;center=add(p['root'],(0,1.25,0))
            for phi in range(0,180,30):
                a=math.radians(phi)
                path([add(center,(1.6*radius*math.cos(k/36*math.tau)*math.cos(a),1.55*radius*math.sin(k/36*math.tau),1.6*radius*math.cos(k/36*math.tau)*math.sin(a))) for k in range(37)],3)
            for lat in (-.6,0,.6):v.ring(add(center,(0,lat*radius,0)),1.6*radius*math.sqrt(1-(lat/1.55)**2),c,width=2)
            return
        if kind=='phoenix':
            flap=math.sin(p['t']*7)*.7*p['flying'];grow=q
            for side in (-1,1):
                for k in range(7):
                    wing=[add(j['chest'],vec((side*.3,0,-.06))),add(j['chest'],vec((side*(1+k*.38)*grow,(.7+k*.12+flap*k/7)*grow,-.2))),add(j['chest'],vec((side*(.8+k*.35)*grow,(-.22+k*.07)*grow,-.4)))]
                    v.polygon(wing,tone('#386e84',.55+q*.35+k*.03),c,2)
            path([hp(-.2,.17),hp(0,.54),hp(.3,.28),hp(0,.14)],3)
            path([add(j['pelvis'],vec((-.2,0,-.15))),add(j['pelvis'],vec((-.6,-.8,-.4))),add(j['pelvis'],vec((.4,-.55,-.35)))],3)
            return
        if not p['pov']:path([hp(-.44,.08,.16),hp(-.32,.52,.16),hp(.32,.52,.16),hp(.45,.12,.19),hp(.21,-.15,.30),hp(-.21,-.15,.30),hp(-.44,.08,.16)],4)
        if kind=='ram':
            for side in (-1,1):path([hp(side*(.44+.28*(1-k/64)*math.cos(k/48*math.tau*1.6)),.22+.28*(1-k/64)*math.sin(k/48*math.tau*1.6),.22) for k in range(49)],4)
        else:
            for side in (-1,1):
                path([hp(side*(.34+.16*math.cos(a/10*math.pi)),.35+.18*math.sin(a/10*math.pi),.10) for a in range(11)],4)
                if q>.7:v.orb(hp(side*.18,.17,.22),.040,c,2,c)
                wrist=j[('left' if side<0 else 'right')+'_wrist']
                for k in range(3):path([add(wrist,vec(((k-1)*.10,.06,.06))),add(wrist,vec(((k-1)*.10,.08,.40)))],4)
                path([j['left_shoulder'],add(j['chest'],vec((0,.32,-.08))),j['right_shoulder']],3)
            path([hp(-.24,.03,.39),hp(-.22,-.18,.53),hp(.22,-.18,.53),hp(.24,.03,.39),hp(-.24,.03,.39)],4)
            for side in (-1,1):
                path([add(j['pelvis'],vec((side*.46,.14,-.12))),add(j['chest'],vec((side*.55,.20,.0))),add(j['chest'],vec((side*.58,-.22,.16)))],3)

    def air_geometry(self,v,p):
        t=p['t']
        if t<RAM_HIT:return
        age=t-RAM_HIT;clear=p['debris_clear']
        for j in range(25):
            a=j*2.399
            x=math.sin(a)*(age*(.8+j%3*.3)+clear*16)
            y=1.8+(j%5-2)*.8*age-.7*age*age+clear*math.sin(a)*6
            z=12+math.cos(a)*(age*1.1+clear*16)
            if clear<.98:v.box((x,y,z),(.15,.18,.16),tone('#7c929b',1-clear*.7))
        if p['shot']=='storm':
            center=add(p['root'],(0,1,0));q=p['storm']
            for axis in ('xy','xz','yz'):v.ring(center,.3+q*10,'#77cfe4',axis,4)
            for j in range(24):
                a=j*math.tau/24+p['spin_angle'];radius=.5+q*11;c=('#7edafa','#edba75','#6f91a0')[j%3]
                v.line([add(center,(math.cos(a+u*.3)*(radius+u),j%4*.5+u*.2,math.sin(a+u*.3)*(radius+u))) for u in range(4)],c,3)


def lerp_point(a,b,q):return tuple(x+(y-x)*q for x,y in zip(a,b))
