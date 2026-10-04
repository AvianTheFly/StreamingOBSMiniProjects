"""Perspective pencil shots, spirit performances and the scenic seated ending."""
import math
from PIL import Image, ImageDraw, ImageFont, ImageColor
from .paint import PAPER, INK, FAINT, spirit, line
from .choreography import COLORS, ease, BEAT
from .cinematic_timeline import state, camera, STATUES, HIT, beat, lerp
from .sketch_space import View, add, mul, sub, dot, unit


def fade(color,q):
    a=ImageColor.getrgb(PAPER);b=ImageColor.getrgb(color)
    return tuple(round(x+(y-x)*max(0,min(1,q))) for x,y in zip(a,b))


class CinematicSketch:
    def __init__(self):
        self.font=ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf',21)
        self.small=ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf',16)

    def render(self,t):
        p=state(t);im=Image.new('RGB',(1280,720),PAPER)
        eye,target,fov=camera(p)
        if p['shot'] in ('overload','impact','breach'):
            shake=.06*math.sin(t*71)
            eye=add(eye,(shake,shake*.4,0))
        v=View(im,eye,target,fov)
        self.landscape(v,p)
        self.sanctuary(v,p)
        self.destination(v,p)
        self.lights(v,p)
        self.obstacles(v,p)
        self.air(v,p)
        if not p['pov']:self.actor(v,p)
        else:self.subjective(im,p)
        if p['shot']=='impact':
            q=ease(HIT,HIT+.1,t)*(1-ease(p['end']-.12,p['end'],t))
            layer=Image.new('RGBA',im.size,(198,204,200,round(255*q)));d=ImageDraw.Draw(layer)
            for j in range(32):
                x=(j*179)%1380-50;y=(j*137)%800-30;r=40+(j%5)*19
                d.polygon([(x-r,y),(x,y-r),(x+r,y-10),(x+r*.4,y+r)],
                          fill=(150+j%4*10,157+j%4*10,157+j%4*10,round(255*q)),
                          outline=(93,105,108,round(255*q)))
            im=Image.alpha_composite(im.convert('RGBA'),layer).convert('RGB')
        d=ImageDraw.Draw(im)
        d.rectangle((0,0,1280,70),fill=PAPER)
        d.text((28,17),'SANCTUARY JOURNEY / CINEMATIC PENCIL PASS 03',font=self.font,fill=INK)
        d.text((1090,22),f'{t:04.1f} / 40s',font=self.small,fill=INK)
        d.rectangle((0,651,1280,720),fill=PAPER)
        d.text((28,659),p['title'],font=self.font,fill=INK)
        d.text((28,689),p['action'],font=self.small,fill='#68767d')
        d.line((28,645,28+1224*t/40,645),fill='#78939b',width=3)
        return im

    def landscape(self,v,p):
        # Distant Storm Coast / Sky Harbor vocabulary: peaks, sea stacks and floating terraces.
        for j in range(7):
            x=10+j*18;z=-70-j%3*18;h=15+(j*7)%22
            v.line([(x-12,-2,z),(x-3,h,z-3),(x+7,h*.35,z),(x+16,-2,z)],'#a5b3b8',2)
            v.line([(x-3,h,z-3),(x+1,h*.48,z-1),(x+7,h*.35,z)],FAINT,1)
        for j in range(8):
            x=25+j*13;z=-50-j%3*14;y=-5-j%2*3
            v.line([(x-5,y,z),(x,y+3,z-2),(x+7,y,z),(x+2,y-7,z),(x-5,y,z)],'#b5c0c0',2)
            if j%2==0:v.line([(x,y+3,z),(x,y+8,z),(x+2,y+8,z)],FAINT,2)
        for j in range(5):
            v.line([(x,-8+j*.25,-55-j*9+math.sin(x/10)*2) for x in range(-70,160,8)],'#c5d1d3',1)
        v.orb((85,35,-115),7,'#c4beb0',2)
        # Tiny pagodas and a ribbon waterfall provide a final-view landmark.
        for x,z in ((63,-67),(91,-90)):
            v.box((x,1,z),(4,3,3),'#a4b4ae')
            v.line([(x-6,4,z),(x,8,z),(x+6,4,z),(x-6,4,z)],'#a4b4ae',2)
            v.line([(x+3,-2,z),(x+3,-19,z),(x+7,-24,z)],'#8fafbe',2)

    def sanctuary(self,v,p):
        t=p['t']
        # The source sanctuary is one floating island in every angle, including the look back.
        floor=[(13*math.sin(i*math.tau/48),0,13*math.cos(i*math.tau/48)) for i in range(48)]
        v.polygon(floor,PAPER,'#82918e',3)
        v.ring((0,.025,0),8.3,'#adbbb2');v.ring((0,.03,0),3.8,'#91a8a3')
        for j in range(12):
            a=j*math.tau/12;x,z=10*math.sin(a),10*math.cos(a)
            v.line([(x,0,z),(x,7.5,z)],FAINT,3)
            v.line([(x*.85,7.5,z*.85),(x,8.3,z),(x*1.1,7.5,z*1.1)],FAINT,2)
            v.line([(x,0,z),(x*.7,-5-j%3,z*.7),(x*.3,-8,z*.3)],'#a9b2b1',2)
            v.line([(2.8*math.sin(a),.04,2.8*math.cos(a)),
                    (3.6*math.sin(a+.06),.04,3.6*math.cos(a+.06)),
                    (3.3*math.sin(a+.15),.04,3.3*math.cos(a+.15))],'#8fa6a0',2)
        v.ring((0,7.5,0),10,FAINT)
        for x in (-2.1,2.1):v.line([(x,0,12),(x,5,12),(x*.8,6,12)],INK,3)
        v.line([(-1.7,6,12),(1.7,6,12)],INK,3)
        for j,(x,y,z) in enumerate(STATUES):
            v.box((x,.38,z),(.9,.38,.8),'#929e95',PAPER)
            xy=v.project((x,2,z))
            if xy:
                kind=list(COLORS)[j]
                glowing=ease(beat(16+j*.45),beat(18+j*.35),t)
                col=fade(COLORS[kind],.35+.65*glowing) if glowing else '#8c9895'
                spirit(v.draw,kind,*xy,min(2.5,v.scale((x,2,z))*.011),0,col)
                if glowing:v.orb((x,2.4,z),.08,COLORS[kind],3)
        if p['collapse']:
            for j in range(8):
                a=j*math.tau/8;x,z=9*math.sin(a),9*math.cos(a)
                c=p['collapse']
                v.line([(x,7.4,z),(x-.4,7.4-1.2*c,z+.4),(x+.2,7.4-2.4*c,z-.3)],'#647b7f',3)
                v.line([(x,0,z),(x*.8,.03,z*.8),(x*.7+.3,.03,z*.7)],'#738584',2)
        if p['energy'] and t<beat(26):
            for j,c in enumerate(COLORS.values()):
                v.ring((0,1.1,0),.8+j*.25,fade(c,.75),'xy',2)

    def destination(self,v,p):
        # Separate intact sanctuary, visible past the debris on the far sky terrace.
        x,z=48,-21
        v.polygon([(x-10,2,z-10),(x+11,2,z-10),(x+12,2,z+9),(x-9,2,z+10)],PAPER,'#7599a6',3)
        for a,b in ((-10,-10),(11,-10),(12,9),(-9,10)):
            v.line([(x+a,2,z+b),(x+a*.7,-5,z+b*.7),(x,-9,z)],'#9cb6bb',2)
        for off in (-5,0,5):
            v.box((x+off,4,z+2),(1.8,2,2),'#7c9dac')
            v.line([(x+off-2.5,6,z+2),(x+off,8,z+2),(x+off+2.5,6,z+2)],'#7c9dac',3)
        center=(48,10,-19)
        for axis in ('xz','xy','yz'):v.ring(center,3.5,'#b49864',axis,2)
        for off in (-8,8):
            v.line([(x+off,2,z-7),(x+off-.5,4,z-7),(x+off,6,z-7),
                    (x+off+.5,4,z-7),(x+off,2,z-7)],'#5a9dbc',3)
        v.ring((48,2.05,-22),5,'#a7b9b8')

    def lights(self,v,p):
        t=p['t']
        if not beat(8)<=t<beat(22):return
        for j,((x,_,z),c) in enumerate(zip(STATUES,COLORS.values())):
            side=-1 if x<0 else 1
            routes=[[(0,.08,14),(side*3,.08,8),(0,.08,2),(x,.08,z),(x,2,z)],
                    [(0,1.3,14),(side*9,1.3,8),(side*9,6,0),(x,6,z),(x,2,z)],
                    [(0,7.5,14),(side*9,7.5,7),(-x,7.5,-z),(x,7.5,z),(x,2,z)]]
            for k,route in enumerate(routes):
                q=ease(beat(8)+j*.13+k*.2,beat(18)+j*.12,t)
                f=q*(len(route)-1);index=min(len(route)-2,int(f))
                end=lerp(route[index],route[index+1],f-index)
                points=route[:index+1]+[end]
                v.line(points,c,3);v.orb(end,.1,c,3)
                if index>0:
                    branch=route[index];v.line([branch,add(branch,(side*1.2,.5,-.8))],fade(c,.5),2)
            if t>=beat(20):
                q=ease(beat(20)+j*.08,beat(21.8),t)
                head=lerp((x,2,z),(0,1.4,0),q)
                v.line([(x,2,z),(x*.5,3.2,z*.5),(0,1.4,0)],c,3)
                v.orb(head,.17,c,4)

    def obstacles(self,v,p):
        t=p['t']
        # Overload seals the ORIGINAL entrance with branching runic roots.
        if t>=beat(22) and p['seal']<1:
            col=fade('#647f80',1-p['seal']*.5)
            for j in range(9):
                x=-1.8+j*.45
                v.line([(x,0,12),(x+.4,1.3,12),(x-.3,2.7,12),
                        (x+.2,4,12),(x,5.5,12)],col,4)
                v.line([(x-.3,2.7,12),(x+.8,3.1,12),(x+1,4.1,12)],col,3)
        if beat(27)<=t<beat(30):
            q=p['seal'];c=COLORS['bear']
            for j in range(3):
                v.line([(-1.4+j*.25,3.6,11.8),(1.3+j*.2,.9,11.8)],c,5)
            for j in range(12):
                a=j*math.tau/12
                v.line([(math.sin(a)*q*2.5,2+math.cos(a)*q*2.5,12),
                        (math.sin(a)*q*2.5+.12,2+math.cos(a)*q*2.5+.2,12)],c,2)
            v.line([(0,2,11.7),(.7,2.3,12.1),(.3,3,12.1),(1.8,3.6,12.1)],c,4)
        # Same lintel, shown by the upward camera, falls toward the shell.
        if t<beat(37):
            y=p['block_y']
            v.box((0,y,11.4),(2.0,.65,.8),'#526972',PAPER)
            if p['roof']:
                v.line([(-1,7.5,11.4),(-.3,6.8,11.4),(.2,7.3,11.4),(.8,6.5,11.4)],INK,4)
        if t>=HIT:
            q=p['entrance_blocked']
            for j in range(9):
                v.box(((j%3-1)*1.15,.65+(j//3)*1.1+(1-q)*2,12),(.7,.6,.7),'#899a9d',PAPER)
            # Broken arch supports topple across the opening, so this route is genuinely closed.
            v.line([(-2,0,12),(-2+3.5*q,4.7,12)],'#6c858a',7)
            v.line([(2,0,12),(2-3.5*q,4.8,12)],'#6c858a',7)
        if beat(34)<=t<HIT:
            q=ease(beat(34),HIT-.04,t)
            tail=lerp((-6,3,7),p['root'],q)
            for j in range(5):v.orb(add(tail,(-j*.18,.9+j*.1,0)),.1,COLORS['turtle'],3)
            v.line([(-6,3,7),tail],COLORS['turtle'],3)
        # The only remaining escape is an independently located side wall.
        broken=p['wall']
        if broken<1:
            v.polygon([(10,0,3),(10,4.8,3),(10,4.8,8),(10,0,8)],PAPER,'#657d83',4)
            for j in range(7):v.line([(10,j*.7,3),(10,j*.7,8)],FAINT,2)
            v.line([(10.01,4,5),(10.01,3.2,5.8),(10.01,2.5,5.3),(10.01,1.7,6)],'#9c8b69',3)
            if broken:v.ring((10,1.5,5.5),1.4,COLORS['ram'],'yz',4)
        elif t<beat(60):
            for j in range(8):
                v.box((10+broken*(j%3),1+(j%4)*1.1,3+j*.6),(.25,.3,.22),FAINT)

    def air(self,v,p):
        t=p['t']
        if t<beat(54):return
        clear=p['debris_clear']
        if clear<1:
            # Transparent pencil dust is in the same world space as the falling ruins.
            layer=Image.new('RGBA',v.image.size);dust=ImageDraw.Draw(layer)
            for j in range(11):
                a=j*2.399
                root=p['root'] if p['shot']=='storm' else (17,-4,7)
                center=add(root,(math.cos(a)*3,1+(j%3)*.5,math.sin(a)*3))
                xy=v.project(center)
                if xy:
                    r=min(220,max(4,v.scale(center)*(1.1+j%3*.3)))
                    dust.ellipse((xy[0]-r,xy[1]-r*.65,xy[0]+r,xy[1]+r*.65),
                                 fill=(183,198,200,round(48*(1-clear))))
            merged=Image.alpha_composite(v.image.convert('RGBA'),layer).convert('RGB')
            v.image.paste(merged);v.draw=ImageDraw.Draw(v.image)
        for j in range(30):
            a=j*2.399;r=3+(j%5)*.9+clear*17
            center=(17+math.cos(a)*r,-3-j%6*1.3+math.sin(t+j)*.3,7+math.sin(a)*r)
            if clear<.97:
                v.box(center,(.25+j%3*.12,.23,.3),fade('#6b858c',1-clear))
                if clear>.15:v.ring(center,.28,fade('#56a9c1',1-clear),'xy',1)
        if p['shot']=='storm':
            root=p['root'];q=p['storm']
            for axis in ('xy','xz','yz'):
                v.ring(add(root,(0,1,0)),1+q*11,fade('#5cacca',1-q*.6),axis,3)
            for j in range(27):
                a=j*math.tau/27+t*3
                r=2+q*12;h=(j%5-2)*.6
                path=[add(root,(math.cos(a+u*.4)*(r+u),1+h+u*.25,math.sin(a+u*.4)*(r+u))) for u in range(4)]
                col='#66afc4' if j%3==0 else '#bc925e' if j%3==1 else '#819199'
                v.line(path,fade(col,1-clear*.7),3)
                if j%3==0:v.orb(path[-1],.12,col)
            # Storm mist collapses as the phoenix clears it, not a scenery reset.
            for j in range(6):
                v.ring(add(root,((j%3-1)*2,1+j*.3,(j//3-1)*2)),
                       2+(1-clear)*3,fade('#b5c3c7',1-clear),'xy',2)

    def actor(self,v,p):
        root=p['root'];yaw=p['yaw'];t=p['t'];mode=p['pose']
        if p['shot']=='storm':yaw+=(t-beat(62))*7
        right=(math.cos(yaw),0,-math.sin(yaw));forward=(math.sin(yaw),0,math.cos(yaw))
        def pt(a,b,c=0):return add(root,add(mul(right,a),add((0,b,0),mul(forward,c))))
        def ln(points,col=INK,w=4):v.line([pt(*q) for q in points],col,w)
        stride=.28*math.sin(t*10) if mode=='walk' else 0
        hip=.85;head=1.75
        arms=[[(-.05,1.4,0),(-.4,1.12,stride),(-.6,.8,stride)],
              [(.05,1.4,0),(.4,1.12,-stride),(.6,.8,-stride)]]
        legs=[[(0,hip,0),(-.25,.42,stride),(-.3,0,stride)],[(0,hip,0),(.25,.42,-stride),(.3,0,-stride)]]
        if mode=='slash':arms[1]=[(0,1.4,0),(.4,1.2,.8),(.7,1.5+.5*math.sin(t*12),1.4)]
        if mode in ('open','fly','fall'):
            arms=[[(0,1.4,0),(-.65,1.6,0),(-1.1,1.85,0)],[(0,1.4,0),(.65,1.6,0),(1.1,1.85,0)]]
        if mode=='guard':
            arms=[[(0,1.4,0),(-.5,1.25,.2),(.2,1.65,.3)],[(0,1.4,0),(.5,1.25,.2),(-.2,1.65,.3)]]
        if mode=='four':
            head=.9;hip=.65
            arms=[[(0,.8,.2),(-.35,.5,.55),(-.45,0,.9)],[(0,.8,.2),(.35,.5,.55),(.45,0,.9)]]
            legs=[[(0,.65,-.7),(-.35,.3,-.65),(-.4,0,-.35)],[(0,.65,-.7),(.35,.3,-.65),(.4,0,-.35)]]
        if mode=='sit':
            hip=.2;head=1.2
            legs=[[(0,.2,0),(-.25,.15,.65),(-.25,-.9,.8)],[(0,.2,0),(.25,.15,.65),(.25,-.9,.8)]]
            arms=[[(0,.9,0),(-.4,.5,.3),(-.25,.25,.65)],[(0,.9,0),(.4,.5,.3),(.25,.25,.65)]]
        form=p['form']
        if form:
            opacity=p['shield'] if form=='turtle' else 1
            if form=='phoenix':opacity=1-ease(beat(78),beat(78)+.4,t)
            if form=='ram' and p['shot']=='resolve':opacity=p['q']
            self.aura(v,p,pt,form,opacity)
        if p['shot'] in ('absorb','overload'):
            for j,kind in enumerate(COLORS):self.aura(v,p,pt,kind,.22+.35*p['energy'])
        ln([(0,head-.18,.05),(0,hip,0)])
        for limb in legs+arms:ln(limb)
        center=pt(0,head,0);v.orb(center,.18,INK,3,PAPER)
        ln([(-.12,head+.1,0),(-.25,head+.02,0),(-.2,head-.22,0),(-.08,head-.16,0)],INK,2)
        ln([(-.26,head-.35,0),(-.13,head-.27,0),(0,head-.36,0),(.18,head-.28,0),(.3,head-.37,0)],INK,2)
        if dot(forward,sub(v.eye,center))>0:
            xy=v.project(center)
            if xy:
                xx,yy=xy;r=.18*v.scale(center);d=v.draw
                if p['expression']=='relief':
                    for side in (-1,1):d.line((xx+side*r*.55-r*.17,yy-r*.07,xx+side*r*.55+r*.17,yy-r*.14),fill=INK,width=2)
                    d.arc((xx-r*.4,yy,xx+r*.4,yy+r*.45),0,180,fill=INK,width=2)
                else:
                    for side in (-1,1):d.ellipse((xx+side*r*.5-2,yy-2,xx+side*r*.5+2,yy+2),fill=INK)
                    if p['expression']=='fear':d.ellipse((xx-r*.16,yy+r*.2,xx+r*.16,yy+r*.6),outline=INK,width=2)
                    elif p['expression']=='resolve':
                        d.line((xx-r*.75,yy-r*.35,xx-r*.22,yy-r*.12),fill=COLORS['ram'],width=3)
                        d.line((xx+r*.75,yy-r*.35,xx+r*.22,yy-r*.12),fill=COLORS['ram'],width=3)

    def aura(self,v,p,pt,kind,opacity):
        col=fade(COLORS[kind],opacity);t=p['t']
        def ln(q,w=3):v.line([pt(*a) for a in q],col,w)
        if kind=='turtle':
            for a in range(0,180,30):
                phi=math.radians(a)
                ln([(1.6*math.cos(i/32*math.tau)*math.cos(phi),1.25+1.55*math.sin(i/32*math.tau),
                     1.6*math.cos(i/32*math.tau)*math.sin(phi)) for i in range(33)],2)
            ln([(1.3,1.3,.5),(1.9,1.2,.5),(2.1,.9,.5),(1.7,.7,.5)],4)
            return
        if kind=='phoenix':
            flap=math.sin(t*7)*.7 if p['shot'] in ('storm','flight') else .12
            for side in (-1,1):
                pts=[(0,1.5,0),(side*1.3,2,0),(side*4,2.9+flap,.2),(side*3,1.1,.5),(side,1.2,.3),(0,1.5,0)]
                ln(pts,4)
                for j in range(6):ln([(side*(1.2+j*.42),2.05+j*.12+flap*j/6,0),
                                     (side*(1+j*.42),1.2+j*.1,.3)],2)
            ln([(-.2,2.3,0),(0,2.75,0),(.45,2.5,0),(.12,2.35,0),(0,1.8,0)],4)
            ln([(-.35,.8,0),(-1,-.5,0),(0,0,0),(1,-.5,0),(.35,.8,0)],3)
            return
        h=1.25 if kind=='ram' and p['pose']=='four' else 2.1
        ln([(-.55,h,0),(-.4,h+.5,0),(.4,h+.5,0),(.6,h,0),(.3,h-.35,.2),(-.3,h-.35,.2),(-.55,h,0)],4)
        for side in (-1,1):
            ln([(side*.45,h-.35,0),(side*1.1,1.3,.2),(side*1.2,.5,.4),(side*.5,.5,.4)],4)
            if kind=='ram':
                ln([(side*(.55+.48*(1-i/65)*math.cos(i/49*math.tau*1.5)),
                    h+.2+.48*(1-i/65)*math.sin(i/49*math.tau*1.5),.25) for i in range(50)],4)
            else:
                v.orb(pt(side*.4,h+.5,0),.18,col,3)
                ln([(side*1.1,1.3,.5),(side*1.6,1.6,.8),(side*1.3,1.7,1),(side*1.8,2,1.2)],3)

    def subjective(self,im,p):
        # Screen-space anatomy represents Udyr's own limbs and translucent spirit head.
        d=ImageDraw.Draw(im);t=p['t'];name=p['shot']
        if name in ('lower','charge','breach'):
            q=p['crouch'];col=COLORS['ram'];bob=math.sin(t*22)*28 if name=='charge' else 0
            for side in (-1,1):
                xx=640+side*370
                horn=[]
                for i in range(60):
                    a=i/59*math.tau*1.4;r=(110-i)*q
                    horn.append((xx+side*math.cos(a)*r,190+math.sin(a)*r))
                line(d,horn,col,4)
                line(d,[(640+side*70,275),(640+side*215,230),(640+side*310,290)],fade(col,.5),3)
                yy=540+side*bob
                line(d,[(640+side*390,710),(640+side*275,yy+10),(640+side*220,yy-45)],INK,6)
                line(d,[(640+side*405,710),(640+side*300,yy+16),(640+side*235,yy-57)],col,3)
                for j in range(3):line(d,[(640+side*(215+j*12),yy-45),(640+side*(213+j*12),yy-70)],col,2)
            line(d,[(560,300),(640,322),(720,300)],fade(col,.65),3)
            if name=='breach':
                for j in range(14):
                    a=j*math.tau/14;r=30+320*p['q']
                    x=640+math.cos(a)*r;y=345+math.sin(a)*r
                    d.polygon([(x-20,y-15),(x+22,y-10),(x+9,y+20)],fill=PAPER,outline=INK)
        else:
            for side in (-1,1):
                line(d,[(640+side*470,720),(640+side*320,565),(640+side*260,515)],INK,5)
            if name=='tease':
                q=p['q']
                for side in (-1,1):
                    for j in range(7):
                        line(d,[(640+side*(370+j*20),610-j*26),(640+side*(320+j*23),490-j*30)],fade('#63b1c8',q),3)
                    d.arc((640+side*200-100,190,640+side*200+100,570),0,300,fill=fade(COLORS['phoenix'],q),width=4)
