"""Continuously animated, restrained colour animatic; no still-picture shot substitutions."""
import math
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from .cinematic_paint import CinematicSketch
from .illustrated_timeline import state,camera,STATUES,HIT,beat,lerp,SAFE_SEAT
from .illustrated_materials import ArtView,MAGIC,STONE,EDGE,tone
from .choreography import ease
from .sketch_space import add,mul,sub,dot


class IllustratedSketch(CinematicSketch):
    generated_image_count=5
    delivery_metadata={'reference_art_count':5,'still_image_substitutions':0,
                       'animation':'continuous perspective geometry, character, camera and effects',
                       'return_island':'original','escape_route':'original entrance rubble'}
    def __init__(self):
        super().__init__()
        self.sky=Image.new('RGB',(1280,720));d=ImageDraw.Draw(self.sky)
        for y in range(720):
            q=y/720;c=tuple(round(a+(b-a)*q) for a,b in zip((10,20,39),(49,81,97)))
            d.line((0,y,1280,y),fill=c)

    def render(self,t):
        p=state(t);im=self.sky.copy();eye,target,fov=camera(p)
        if p['shot'] in ('overload','impact','breach'):
            amp=.04 if p['shot']=='overload' else .075
            eye=add(eye,(amp*math.sin(t*71),amp*.5*math.sin(t*89),0))
        v=ArtView(im,eye,target,fov)
        self.landscape(v,p);self.sanctuary(v,p);self.lights(v,p);self.obstacles(v,p)
        self.air_geometry(v,p)
        if not p['pov']:self.actor(v,p)
        v.flush()
        if p['pov']:self.subjective(im,p)
        self.bloom(im)
        self.atmosphere(im,p)
        # Quiet framing preserves the full moving scene, with only a small review caption.
        d=ImageDraw.Draw(im);d.rectangle((0,0,1280,30),fill='#09121d');d.rectangle((0,684,1280,720),fill='#09121d')
        d.text((22,8),'SANCTUARY / COLOUR MOTION MVP 04',font=self.small,fill='#a7c9d0')
        d.text((1120,8),f'{t:04.1f} / 40s',font=self.small,fill='#a7c9d0')
        d.text((22,693),p['title'],font=self.small,fill='#c3d9da')
        return im

    def landscape(self,v,p):
        # Simple silhouette masses leave motion readable while giving the world depth.
        for j in range(12):
            x=-38-j*14;z=-24-(j%4)*20;h=13+j%5*5
            v.polygon([(x-15,-9,z),(x-3,h,z),(x+3,h*.6,z-3),(x+14,-9,z)],
                      tone('#395b72',.55+j%4*.13),'#4a6b7d',1)
            v.line([(x-3,h,z),(x,h*.45,z),(x+3,h*.6,z-3)],'#77919d',1)
        for j in range(8):
            x=-25-j*14;z=-10-(j%3)*14;y=-9-j%4*2
            v.polygon([(x-4,y,z),(x,y+2,z-3),(x+5,y,z),(x+1,y-8,z)],'#223e50','#3f6475')
            v.line([(x+1,y,z),(x+1,y-17,z)],'#74a9bb',2)
            if j%2==0:
                v.box((x,y+3,z),(.9,1.4,.9),'#365769')
                v.polygon([(x-1.6,y+4.4,z),(x,y+6,z),(x+1.6,y+4.4,z)],'#506776','#91a2a0')
        v.orb((-90,27,-80),6,'#aacbd4',2,'#a2bbc8')

    def sanctuary(self,v,p):
        t=p['t'];missing=p['floor_missing']
        rim=[]
        for j in range(48):
            a=j*math.tau/48;x,z=13*math.sin(a),13*math.cos(a)
            if z>11.3:z=lerp((0,0,z),(0,0,11.3),missing)[2]
            rim.append((x,0,z))
        # Triangles and rock facets are persistent volume, not a changing background plate.
        for j,b in enumerate(rim):
            c=rim[(j+1)%len(rim)]
            v.polygon([(0,0,0),b,c],tone('#385563',.76+j%5*.06),'#385563',1)
            low=(b[0]*.72,-5-j%3,b[2]*.72)
            v.polygon([b,c,low],tone('#223843',.75+j%4*.14),'#2f4e5c')
            v.polygon([low,c,(0,-9,0)],tone('#192e3b',.6+j%5*.15),'#263d4b')
        if missing<1:
            z=13+5*(1-missing)
            v.polygon([(-2,0,11.3),(2,0,11.3),(2,-missing*3,z),(-2,-missing*3,z)],'#4e6570','#829095')
        v.ring((0,.04,0),8.3,'#527980');v.ring((0,.05,0),3.8,'#65a29c',width=3)
        for j in range(12):
            if j in (0,9):continue  # Clear gate axis and the upper terrace's seated edge.
            a=j*math.tau/12;x,z=10*math.sin(a),10*math.cos(a)
            damage=p['cavein'] if z>7.5 else 0
            height=7.5-damage*(1+j%3)
            v.box((x,height/2,z),(.35,height/2,.35),'#496273')
            v.box((x,height,z),(.6,.24,.6),'#7e8076')
            v.line([(x-.15,.6,z),(x-.15,height-.4,z)],'#7ca6aa',1)
            v.line([(2.8*math.sin(a),.07,2.8*math.cos(a)),
                    (3.6*math.sin(a+.05),.07,3.6*math.cos(a+.05)),
                    (3.2*math.sin(a+.14),.07,3.2*math.cos(a+.14))],'#88ada5',2)
            if j%2==0:v.orb((x*.9,4,z*.9),.13,'#e2c28a',2,'#dab36b')
        # Roof slabs over the gate move with the cave-in instead of a single falling cube.
        for j in range(8):
            if j in (5,6):continue  # Open sky above the surviving western terrace.
            a=j*math.tau/8;b=(j+1)*math.tau/8
            fall=p['cavein'] if math.cos(a)>.4 else 0
            corners=[(r*math.sin(theta),7.7-fall*3,r*math.cos(theta)) for r,theta in ((4,a),(10,a),(10,b),(4,b))]
            v.polygon(corners,tone('#2b4655',.7+j%4*.1),'#5b6a70')
        for x in (-2.1,2.1):
            h=5.2-3.5*p['cavein']
            v.box((x,h/2,12),(.4,h/2,.45),'#587181')
            v.line([(x,0,12),(x-.2,h*.42,12),(x+.2,h*.94,12)],'#8fa5a0',2)
        # Same island's surviving upper terrace; never a second destination.
        v.polygon([(-12,5.5,-3),(-6,5.5,-3),(-6,5.5,3),(-12,5.5,3)],'#536c76','#91a3a3',3)
        v.box((-8.7,3.5,0),(2.7,2,2.5),'#2e4a59')
        v.polygon([(-12,5.5,-3),(-6,5.5,-3),(-9,7.4,-3)],'#314d61','#688897',2)
        for j,(x,_,z) in enumerate(STATUES):
            c=list(MAGIC.values())[j];awake=ease(beat(16+j*.45),beat(18+j*.35),t)
            v.box((x,.45,z),(1,.45,.9),'#596d74')
            kind=list(MAGIC)[j]
            self.statue(v,(x,1.4,z),kind,self.statue_colour(p,j,c,awake))
        if p['collapse']:
            for j in range(10):
                a=j*math.tau/10;x,z=9*math.sin(a),9*math.cos(a)
                v.line([(x,7,z),(x-.35,5.8,z+.15),(x+.16,4.9,z)],'#172b39',4)
                v.line([(x,0,z),(x*.7,.08,z*.7),(x*.6+.3,.08,z*.6)],'#0d2634',3)

    def statue_colour(self,p,j,c,awake):return c if awake else '#829497'

    def statue(self,v,center,kind,c):
        # Faceted totems remain simple enough for every changing perspective to agree.
        x,y,z=center
        v.box((x,y,z),(.65,.7,.5),'#547179')
        v.orb((x,y+.65,z),.57,c,2,'#5a7380')
        for side in (-1,1):
            v.orb((x+side*.2,y+.76,z+.46),.055,c,2,c)
            if kind=='bear':v.orb((x+side*.42,y+1.06,z),.17,c,2,'#5b7883')
            if kind=='ram':v.ring((x+side*.48,y+.8,z+.15),.43,c,'xy',3)
            if kind=='phoenix':v.polygon([(x,y+.7,z),(x+side*1.6,y+1.6,z),(x+side*.8,y-.1,z)],'#698492',c,2)
        if kind=='turtle':
            v.orb((x,y+.35,z),.85,c,3,'#3f6669')
            v.ring((x,y+.35,z+.3),.5,c,'xy',2)

    def obstacles(self,v,p):
        t=p['t']
        if t>=beat(22) and p['seal']<1:
            for j in range(10):
                x=-1.9+j*.42
                q=p['seal'];col=tone('#57858a',1-q*.65)
                v.line([(x,0,12),(x+.25,1.4,12),(x-.2,2.8,12),(x+.3,4.2,12),(x,5.3,12)],col,5)
                v.line([(x-.2,2.8,12),(x+.6,3.4,12),(x+.8,4.4,12)],col,3)
        if beat(27)<=t<beat(30):
            q=p['seal'];c=MAGIC['bear']
            for j in range(3):v.line([(-1.6+j*.35,3.8,11.9),(1.5+j*.22,.7,11.9)],c,6)
            for j in range(20):
                a=j*2.4;v.orb((math.sin(a)*(1+q*2.2),2+math.cos(a)*q*2,11.8),.045,c,1,c)
        if beat(30)<=t<HIT:
            q=p['cavein']
            # Ceiling, both walls and gate crown converge around the protective shell.
            pieces=[(0,7.1,10.8,2,.65,.8),(-2.7,5.7,10.7,.55,1.5,.65),(2.7,5.5,11,.6,1.5,.65),
                    (-1.6,6.8,12,.9,.5,.8),(1.6,6.8,12,.9,.5,.8)]
            for j,(x,y,z,sx,sy,sz) in enumerate(pieces):
                dest_y=3.45 if j==0 else 3.4
                v.box((x*(1-q*.55),y+(dest_y-y)*q,z), (sx,sy,sz),'#627785')
            for j in range(9):
                v.box(((j%3-1)*1.6,6.5-q*(3+j%3*.4),9.5+j%4*.8),(.22,.25,.3),'#627781')
        if t>=HIT:
            settle=ease(HIT,HIT+.7,t);smash=p['rubble_smashed']
            for j in range(21):
                x=(j%5-2)*.9;level=j//5;y=.6+level*.8+(1-settle)*1.8;z=12.8+j%3*.2
                if smash:
                    x+=math.sin(j*2.4)*smash*7;y-=smash*(2+j%4);z+=smash*(3+j%3)
                v.box((x,y,z),(.52,.42,.46),'#576c79')
            if smash<1:
                for side in (-1,1):v.line([(side*2,0,12.5),(-side*1.5,4.6,12.5)],'#69808b',8)
        if beat(34)<=t<HIT:
            q=ease(beat(34),HIT-.04,t);end=lerp((-6,3,7),add(p['root'],(0,1.2,0)),q)
            v.line([(-6,3,7),end],MAGIC['turtle'],4)
            for j in range(6):v.orb(add(end,(-j*.2,j*.1,0)),.07,MAGIC['turtle'],2,MAGIC['turtle'])

    def air_geometry(self,v,p):
        if p['t']<beat(54):return
        clear=p['debris_clear']
        for j in range(25):
            a=j*2.399;r=3+j%4+clear*14
            if clear<.98:v.box((1+math.cos(a)*r,-3-j%6*1.2,16+math.sin(a)*r),(.28,.3,.35),tone('#597783',1-clear*.7))
        if p['shot']=='storm':
            center=add(p['root'],(0,1,0));q=p['storm']
            for axis in ('xy','xz','yz'):v.ring(center,1+q*10,'#77cfe4',axis,4)
            for j in range(24):
                a=j*math.tau/24+p['t']*3;r=2+q*11;c=('#7edafa','#edba75','#6f91a0')[j%3]
                v.line([add(center,(math.cos(a+u*.3)*(r+u),j%4*.5+u*.2,math.sin(a+u*.3)*(r+u))) for u in range(4)],c,3)

    def actor(self,v,p):
        root=p['root'];yaw=p['yaw'];t=p['t'];mode=p['pose']
        if p['shot']=='storm':yaw+=(t-beat(62))*7
        right=(math.cos(yaw),0,-math.sin(yaw));forward=(math.sin(yaw),0,math.cos(yaw))
        def pt(a,b,c=0):return add(root,add(mul(right,a),add((0,b,0),mul(forward,c))))
        def limb(points,r=.11,c='#8c7463'):
            for a,b in zip(points,points[1:]):
                aa,bb=pt(*a),pt(*b)
                offset=mul(right,r)
                v.polygon([add(aa,offset),add(bb,offset),sub(bb,offset),sub(aa,offset)],c,'#2b343a',2)
                v.orb(bb,r,'#39434a',1,c)
        stride=.26*math.sin(t*10) if mode=='walk' else 0;hip=.85;head=1.8
        arms=[[(0,1.4,0),(-.42,1.1,stride),(-.61,.75,stride)],[(0,1.4,0),(.42,1.1,-stride),(.61,.75,-stride)]]
        legs=[[(0,hip,0),(-.25,.42,stride),(-.3,0,stride)],[(0,hip,0),(.25,.42,-stride),(.3,0,-stride)]]
        if mode=='slash':arms[1]=[(0,1.4,0),(.42,1.25,.75),(.7,1.6+.42*math.sin(t*12),1.4)]
        if mode in ('open','fly','fall'):arms=[[(0,1.4,0),(-.7,1.6,0),(-1.15,1.9,0)],[(0,1.4,0),(.7,1.6,0),(1.15,1.9,0)]]
        if mode=='guard':arms=[[(0,1.4,0),(-.45,1.25,.2),(.2,1.63,.3)],[(0,1.4,0),(.45,1.25,.2),(-.2,1.63,.3)]]
        if mode=='sit':
            hip=.2;head=1.2
            legs=[[(0,.2,0),(-.25,.15,.65),(-.25,-.9,.8)],[(0,.2,0),(.25,.15,.65),(.25,-.9,.8)]]
            arms=[[(0,.9,0),(-.4,.5,.3),(-.25,.25,.65)],[(0,.9,0),(.4,.5,.3),(.25,.25,.65)]]
        if p['form']:
            opacity=p['shield'] if p['form']=='turtle' else 1-ease(beat(78),beat(78)+.4,t) if p['form']=='phoenix' else 1
            self.aura(v,p,pt,p['form'],opacity)
        if p['shot'] in ('absorb','overload'):
            for kind in MAGIC:self.aura(v,p,pt,kind,.45)
        shoulder=head-.37
        v.polygon([pt(-.48,shoulder),pt(.48,shoulder),pt(.24,hip),pt(-.24,hip)],'#695d53','#a2917a',2)
        v.polygon([pt(-.27,hip+.08),pt(.27,hip+.08),pt(.39,hip-.6),pt(-.38,hip-.62)],'#332f2b','#655e51',2)
        for leg in legs:limb(leg,.13,'#474842')
        for arm in arms:limb(arm,.13)
        # Simple animated fur and hair silhouette adds identity without costly fine detail.
        for side in (-1,1):
            for j in range(5):
                a=side*(.1+j*.095)
                v.polygon([pt(a,shoulder+.2),pt(a+side*.13,shoulder+.06),pt(a+side*.04,shoulder-.23)],tone('#8b8171',.65+j*.08),'#373b3a')
        v.orb(pt(0,head),.2,'#35444b',2,'#b4997e')
        for j in range(7):
            a=(j-3)*.055
            v.line([pt(a,head+.18,-.06),pt(a+.03,head-.18,-.22),pt(a+.06*math.sin(t*3+j),head-.7,-.3)],'#20272d',5)
        # Fear/relief/resolve retain a restrained face cue at the small MVP scale.
        if dot(forward,sub(v.eye,pt(0,head)))>0 or p['expression']=='fear':
            for side in (-1,1):v.orb(pt(side*.075,head+.03,.16),.026,MAGIC.get(p['form'],'#c4d6d9'),1,'#c4d6d9')
            for side in (-1,1):v.line([pt(side*.13,head+.09,.22),pt(side*.035,head+.065,.23)],'#252b2d',5)
            v.polygon([pt(-.15,head-.05,.23),pt(.15,head-.05,.23),pt(.10,head-.23,.22),pt(0,head-.36,.21),pt(-.1,head-.23,.22)],'#252b2d','#252b2d',2)
        if p['expression']=='relief':v.line([pt(-.06,head-.05,.2),pt(.06,head-.05,.2)],'#675345',2)

    def aura(self,v,p,pt,kind,opacity):
        if opacity<.02:return
        c=tone(MAGIC[kind],.3+.7*opacity);t=p['t']
        def ln(points,w=3):v.line([pt(*q) for q in points],c,w)
        if kind=='turtle':
            for a in range(0,180,30):
                phi=math.radians(a)
                ln([(1.6*math.cos(i/28*math.tau)*math.cos(phi),1.25+1.55*math.sin(i/28*math.tau),1.6*math.cos(i/28*math.tau)*math.sin(phi)) for i in range(29)],3)
            for side in (-1,1):ln([(side*1.1,1.4,.4),(side*1.7,1.3,.6),(side*1.85,1,.6),(side*1.4,.8,.4)],4)
            return
        if kind=='phoenix':
            flap=math.sin(t*7)*.7 if p['shot'] in ('storm','flight') else .12
            for side in (-1,1):
                for j in range(7):
                    a=side*(1.0+j*.43)
                    verts=[pt(side*.4,1.5),pt(a,2.2+j*.12+flap*j/7),pt(a*.9,1.05+j*.08)]
                    v.polygon(verts,tone('#3d728b',.8+j*.055),c,2)
            ln([(-.25,2.3),(0,2.75),(.4,2.5),(.1,2.3),(0,1.8)],4)
            ln([(-.35,.8),(-.8,-.45),(0,.05),(.8,-.45),(.35,.8)],3)
            return
        h=2.1
        ln([(-.55,h),(-.4,h+.5),(.4,h+.5),(.58,h),(.25,h-.35),(-.25,h-.35),(-.55,h)],4)
        for side in (-1,1):
            ln([(side*.4,h-.3),(side*1.0,1.3,.3),(side*1.15,.5,.5),(side*.5,.4,.4)],4)
            if kind=='ram':ln([(side*(.5+.46*(1-i/60)*math.cos(i/45*math.tau*1.5)),h+.2+.46*(1-i/60)*math.sin(i/45*math.tau*1.5),.2) for i in range(46)],4)
            else:
                v.orb(pt(side*.4,h+.5),.17,c,3)
                ln([(side*1,1.3,.4),(side*1.5,1.6,.8),(side*1.2,1.8,1),(side*1.8,2.1,1.1)],4)

    def subjective(self,im,p):
        d=ImageDraw.Draw(im);name=p['shot'];t=p['t'];ram=name in ('lower','charge','breach')
        bob=math.sin(t*22)*25 if name=='charge' else 0
        for side in (-1,1):
            yy=565+side*bob
            d.polygon([(640+side*440,720),(640+side*295,yy+8),(640+side*260,yy-45),(640+side*230,yy-25),(640+side*350,720)],fill='#796756',outline='#aaa087')
            if ram:
                c=MAGIC['ram'];q=p['crouch'];horn=[]
                for j in range(55):
                    a=j/54*math.tau*1.4;r=(108-j)*q
                    horn.append((640+side*365+side*math.cos(a)*r,180+math.sin(a)*r))
                d.line(horn,fill=c,width=5)
                d.line([(640+side*440,720),(640+side*295,yy+8),(640+side*250,yy-52)],fill=c,width=3)
                d.polygon([(640+side*270,yy-49),(640+side*227,yy-39),(640+side*228,yy-20),(640+side*285,yy-20)],outline=c,width=3)
        if ram:d.line([(540,285),(640,318),(740,285)],fill='#b09469',width=3)
        if name=='tease':
            for side in (-1,1):
                for j in range(8):d.line([(640+side*(360+j*20),610-j*26),(640+side*(290+j*23),470-j*30)],fill=tone('#98d8f0',p['q']),width=3)

    def atmosphere(self,im,p):
        t=p['t'];layer=Image.new('RGBA',im.size);d=ImageDraw.Draw(layer)
        if p['collapse'] and t<beat(54):
            for j in range(30):
                x=(j*179+t*15)%1280;y=(j*137+t*35)%700
                d.ellipse((x,y,x+2,y+3),fill=(183,193,177,80))
        if p['shot']=='impact':
            q=ease(HIT,HIT+.08,t)*(1-ease(p['end']-.1,p['end'],t))
            d.rectangle((0,0,1280,720),fill=(67,88,99,round(255*q)))
            for j in range(28):
                x=(j*179)%1360-40;y=(j*137)%790;r=30+j%5*15
                d.polygon([(x-r,y),(x,y-r),(x+r,y-8),(x+r*.3,y+r)],fill=(37,55,65,round(255*q)),outline=(96,123,132,round(255*q)))
        if p['shot'] in ('fall','lookback','tease','storm'):
            strength=1-p['debris_clear']
            for j in range(5):
                x=150+j*270;y=260+math.sin(t*.8+j)*130
                d.ellipse((x-150,y-70,x+150,y+70),fill=(81,119,132,round(22*strength)))
        im.paste(Image.alpha_composite(im.convert('RGBA'),layer).convert('RGB'))

    def bloom(self,im):
        import numpy as np
        from PIL import ImageChops
        pixels=np.array(im);r,g,b=[pixels[:,:,j].astype('int16') for j in range(3)]
        mask=((b>165)&(b>r*1.25))|((g>165)&(g>r*1.25))|((r>175)&(g>110)&(b<150))
        pixels[~mask]=0
        glow=Image.fromarray(pixels).filter(ImageFilter.GaussianBlur(7))
        glow=Image.blend(Image.new('RGB',im.size),glow,.38)
        im.paste(ImageChops.add(im,glow))
