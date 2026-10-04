"""Original pencil animatic: persistent obstacles and spirits worn by Udyr."""
import math
from PIL import Image, ImageDraw, ImageFont
from .paint import PAPER, INK, FAINT, line, spirit
from .choreography import WIDTH, HEIGHT, COLORS, ease, BEAT, PHASE
from .escape_choreography import SCENES, HITS, beat, pose


def mix(a,b,u):
    return tuple(round(x+(y-x)*u) for x,y in zip(a,b))


class EscapeSketch:
    def __init__(self):
        self.font=ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf',21)
        self.small=ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf',16)

    def render(self,t):
        p=pose(t)
        im=Image.new('RGB',(WIDTH,HEIGHT),PAPER);d=ImageDraw.Draw(im)
        cx,cy=p['camera'],p['camera_y']
        def pt(x,y):return x-cx,y-cy
        def ln(points,c=INK,w=3):line(d,[pt(*v) for v in points],c,w)
        def oval(x,y,r,c=INK,w=2):
            sx,sy=pt(x,y);d.ellipse((sx-r,sy-r,sx+r,sy+r),outline=c,width=w)
        def stone(x,y,r=26,c=INK):
            ln([(x-r,y-r*.45),(x-r*.3,y-r),(x+r*.7,y-r*.7),
                (x+r,y+r*.3),(x+r*.2,y+r*.8),(x-r,y-r*.45)],c,3)
            ln([(x-r*.3,y-r),(x+4,y+1),(x+r*.2,y+r*.8)],c,1)

        # Sky is already there behind the outer wall; the breach exposes it.
        for j in range(5):
            ln([(1450+i,210+j*65+15*math.sin(i/150+j)) for i in range(0,1800,35)],'#ced7db',1)
        for x,y in ((1710,230),(1960,330),(2600,200),(2950,420)):
            ln([(x-110,y),(x,y+28),(x+120,y),(x+65,y+105),(x,y+130),(x-45,y+76),(x-110,y)],FAINT,2)

        # Ancient celestial destination: carved terraces, crystal spires, armillary rings.
        destination=Image.new('RGBA',(WIDTH,HEIGHT));dd=ImageDraw.Draw(destination)
        def dl(points,c='#718c9b',w=3):line(dd,[pt(*v) for v in points],c,w)
        dl([(2180,535),(2700,535),(2600,625),(2400,668),(2240,597),(2180,535)],w=4)
        for x in (2250,2390,2530):
            dl([(x,535),(x,300),(x+50,252),(x+100,300),(x+100,535)])
            dl([(x-25,300),(x+50,235),(x+125,300),(x-25,300)])
            for j in range(3):dl([(x+18+j*28,520),(x+18+j*28,335)],w=1)
        for off in (0,40,80):dl([(2240+off,535+off/4),(2660-off,535+off/4)],w=2)
        for r in (85,120):
            xx,yy=pt(2505,206)
            dd.ellipse((xx-r,yy-r/2,xx+r,yy+r/2),outline='#b59457',width=3)
            dd.ellipse((xx-r/2,yy-r,xx+r/2,yy+r),outline='#b59457',width=3)
        for x in (2210,2650):dl([(x,505),(x-17,440),(x,400),(x+17,440),(x,505)],'#478fae',3)
        destination.putalpha(destination.getchannel('A').point(lambda a:round(a*p['visibility'])))
        im=Image.alpha_composite(im.convert('RGBA'),destination).convert('RGB');d=ImageDraw.Draw(im)

        # Stone sanctuary remains spatially consistent as the camera tracks the escape.
        ln([(-100,535),(1600,535),(1560,600),(1510,840)],INK,4)
        ln([(-100,115),(1500,115),(1500,535)],FAINT,4)
        for x in range(0,1600,250):
            ln([(x,535),(x,202),(x-30,202),(x+12,159),(x+50,202),(x+25,202),(x+25,535)],FAINT,3)
            ln([(x+25,202),(x+120,135),(x+250,202)],FAINT,2)
            for j in range(3):
                ln([(x+55+j*50,300),(x+55+j*50,225),(x+85+j*50,204)],'#cbd0c9',2)
        glow=ease(beat(6),beat(10),t)
        if glow:
            c=mix((203,208,201),(77,154,163),glow)
            for x in range(120,1500,210):
                ln([(x,445),(x,380),(x+45,355),(x+45,250),(x+82,228)],c,3)
                oval(x+82,228,5,c)

        # Stalking lights turn toward their respective statues, then flow into Udyr.
        kinds=list(COLORS)
        for j,kind in enumerate(kinds):
            sx=660+j*170;col=COLORS[kind]
            ln([(sx-65,425),(sx-65,293),(sx,236),(sx+65,293),(sx+65,425)],FAINT,2)
            ln([(sx-65,435),(sx+65,435),(sx+75,461),(sx-75,461),(sx-65,435)],FAINT,3)
            awakening=ease(beat(10+j*.5),beat(12+j*.5),t)
            spirit(d,kind,*pt(sx,350),.48,0,col if awakening else '#969e9a')
            if awakening:
                oval(sx+22,329,5,col,3);oval(sx,350,53,col,1)
            if t<beat(14):
                q=ease(beat(10),beat(14),t)
                ox=p['x']-70-j*23;oy=390+math.sin(t*3+j)*32
                ox+=(sx-ox)*q;oy+=(340-oy)*q
                oval(ox,oy,6,col,3)
                for k in range(4):oval(ox-k*8,oy+k*2,2,col,1)
            energy=ease(beat(14+j*.6),beat(15.1+j*.6),t)
            if beat(14)<=t<beat(18):
                if energy:
                    ln([(sx,350),(sx-30,315),(p['x']+70,340),(p['x'],430)],col,2)
                for k in range(4):
                    q=min(1,max(0,energy-.08*k))
                    oval(sx+(p['x']-sx)*q,350+80*q,4,col,3)

        # Cracks appear only after the absorption, and persist throughout the escape.
        if p['collapse']:
            for x in (320,620,1040,1290):
                amount=p['collapse']
                ln([(x,116),(x+23,116+65*amount),(x-8,116+116*amount),
                    (x+32,116+175*amount)],'#79828b',3)
                ln([(x+23,181),(x+70*amount,166)],FAINT,2)
            for j in range(9):
                q=(t-beat(18)+j*.17)%2
                stone(330+j*120,150+q*q*90,7,FAINT)

        # A closed carved gate must be clawed open before Udyr passes it.
        broken=p['seal_broken']
        if broken<1:
            ln([(866,205),(926,205),(926,535),(866,535),(866,205)],INK,4)
            for j in range(6):ln([(866,230+j*46),(926,251+j*46)],'#828f7c',3)
            if broken:
                for j in range(3):ln([(852+j*18,300),(922+j*7,420)],COLORS['bear'],4)
        if broken:
            for j in range(6):
                q=ease(beat(24),beat(26),t)
                stone(891+(j-2.5)*35*q,380+150*q,12,FAINT)

        # These exact three roof stones hit the shell, bounce and form the ram's obstacle.
        for j,hit in enumerate(HITS):
            landed=hit+1
            if hit-.72<=t<hit:
                q=(t-hit+.72)/.72;stone(1030+(j-1)*40,95+250*q*q,30)
            elif hit<=t<landed:
                q=(t-hit)/(landed-hit)
                stone(1030+(140+(j-1)*36)*q,345+165*q-95*math.sin(math.pi*q),30)
                if q<.24:
                    oval(1030+(j-1)*40,345,35+90*q,COLORS['turtle'],3)
            elif t>=landed:
                q=p['rubble_cleared']
                stone(1170+(j-1)*36+q*(130+j*40),510+q*(-90+j*24),30,FAINT if q else INK)

        # The ram breaks the pile first, then a separate outer wall. The hole exposes sky.
        breach=p['wall_breached']
        if breach<1:
            x,y=pt(1470,135);xx,yy=pt(1535,535)
            d.rectangle((x,y,xx,yy),fill=PAPER,outline=INK,width=4)
            for j in range(9):ln([(1470,160+j*42),(1535,160+j*42)],FAINT,2)
            if breach:ln([(1490,220),(1510,310),(1480,405),(1525,460)],COLORS['ram'],5)
        for moment,xx in ((beat(44),1170),(beat(50),1500)):
            q=(t-moment)/.55
            if 0<=q<=1:
                oval(xx,440,20+115*q,COLORS['ram'],3)
                for j in range(8):
                    a=j*math.tau/8
                    ln([(xx+40*math.cos(a),440+40*math.sin(a)),
                        (xx+(60+80*q)*math.cos(a),440+(60+80*q)*math.sin(a))],COLORS['ram'],2)
        if breach:
            for j in range(7):stone(1500+(j-3)*40*breach,280+j*40,14,FAINT)

        # Before the catch the phoenix visibly circles toward the falling actor.
        if beat(54)<=t<beat(57)+.4:
            q=ease(beat(54),beat(57)+.4,t)
            ox=p['x']+190*(1-q)*math.cos(t*4);oy=p['y']-180-100*(1-q)
            spirit(d,'phoenix',*pt(ox,oy),.7*(1-q),t,COLORS['phoenix'])

        # Airborne breach debris gets frozen by expanding icy flames, then scatters away.
        if beat(54)<=t<beat(74):
            ice=p['ice']
            for j in range(20):
                ox=1750+j*40+35*math.sin(t*.8+j)+ice*((j%3)-1)*220
                oy=200+(j*83)%600+18*math.sin(t*1.8+j)-ice*150
                if j/20>ice*.95 or t<beat(62):
                    stone(ox,oy,18+j%4*5,'#72a8bf' if ice>j/22 else '#6f7982')
                    if ice>j/22:
                        for k in range(3):
                            a=k*math.pi/3
                            ln([(ox-13*math.cos(a),oy-13*math.sin(a)),
                                (ox+13*math.cos(a),oy+13*math.sin(a))],'#72a8bf',2)
            if beat(60)<=t<beat(72):
                col='#559fbe'
                for side in (-1,1):
                    for j in range(5):
                        r=50+ice*350+j*12
                        ln([(p['x']+side*r*(i/12),p['y']-100+side*40*math.sin(i*.8+t*5)+j*13)
                            for i in range(13)],col,2)
                        ln([(p['x']+side*r,p['y']-100+j*13),
                            (p['x']+side*(r+30),p['y']-120+j*13),
                            (p['x']+side*(r+15),p['y']-91+j*13)],col,2)
                for j in range(8):
                    a=j*math.tau/8
                    oval(p['x']+math.cos(a)*(90+ice*260),p['y']-100+math.sin(a)*(90+ice*200),4,col)

        self.actor(d,p,t)
        # Subtle pullback after a genuine landing; never replace the actor with a title card.
        if p['pullback']:
            q=1-.17*p['pullback'];small=im.resize((round(WIDTH*q),round(HEIGHT*q)))
            im=Image.new('RGB',(WIDTH,HEIGHT),PAPER);im.paste(small,((WIDTH-small.width)//2,(HEIGHT-small.height)//2));d=ImageDraw.Draw(im)
        d.rectangle((0,0,1280,76),fill=PAPER)
        d.text((32,19),'SANCTUARY ESCAPE / MOVEMENT SKETCH 02',font=self.font,fill=INK)
        d.text((1070,22),f'{t:04.1f} / 40.0 s',font=self.small,fill=INK)
        pulse=1-((t-PHASE)%BEAT)/BEAT
        d.ellipse((1015-pulse*4,26-pulse*4,1025+pulse*4,36+pulse*4),fill='#718c9b')
        d.rectangle((0,650,1280,720),fill=PAPER)
        scene=next(s for s in SCENES if s[0]==p['scene'])
        d.text((32,657),scene[3],font=self.font,fill=INK)
        d.text((32,688),p['action'],font=self.small,fill='#67717a')
        d.line((32,644,32+1216*t/40,644),fill='#718c9b',width=3)
        return im

    def actor(self,d,p,t):
        x,y=p['x']-p['camera'],p['y']-p['camera_y']
        ang=math.radians(p['lean'])
        def pt(a,b):
            b*=1-.22*p['compression']
            return x+a*math.cos(ang)-b*math.sin(ang),y+a*math.sin(ang)+b*math.cos(ang)
        def ln(v,c=INK,w=4):line(d,[pt(*q) for q in v],c,w)
        def oval(a,b,rx,ry,c,w=3,fill=None):
            xx,yy=pt(a,b);d.ellipse((xx-rx,yy-ry,xx+rx,yy+ry),outline=c,width=w,fill=fill)
        mode=p['gesture'];power=p['power']
        stride=math.sin(t*(13 if mode=='run' else 8))*22 if mode in ('walk','run') else 0
        legs=[[(0,-57),(-19-stride,-28),(-29-stride,0)],[(0,-57),(19+stride,-28),(29+stride,0)]]
        arms=[[(0,-93),(-28,-77),(-38,-55)],[(0,-93),(28,-77),(38,-55)]]
        if mode in ('open','fly','fall'):
            arms=[[(0,-93),(-42,-102),(-78,-124)],[(0,-93),(42,-102),(78,-124)]]
        elif mode=='slash':
            swing=math.sin((t-beat(22))*math.pi/BEAT)
            arms=[[(0,-93),(-32,-60),(-46,-79)],[(0,-93),(55,-90+25*swing),(125,-91+50*swing)]]
        elif mode=='guard':
            arms=[[(0,-93),(-34,-91),(24,-117)],[(0,-93),(35,-91),(-24,-117)]]
        elif mode=='charge':
            arms=[[(0,-93),(-25,-67),(-41,-64)],[(0,-93),(42,-92),(66,-98)]]
            legs=[[(0,-57),(-35,-27),(-66,0)],[(0,-57),(33,-35),(16,0)]]
        if power:
            col=COLORS[power]
            beginnings={'bear':beat(20),'turtle':beat(30),'ram':beat(42),'phoenix':beat(57)}
            endings={'bear':beat(30),'turtle':beat(42),'ram':beat(54),'phoenix':beat(80)+.6}
            opacity=ease(beginnings[power],beginnings[power]+.25,t)*(1-ease(endings[power]-.25,endings[power],t))
            from PIL import ImageColor
            col=mix(ImageColor.getrgb(PAPER),ImageColor.getrgb(col),opacity)
            if power=='turtle':
                oval(0,-106,148,107,col,4)
                for ox in (-82,-28,28,82):
                    ln([(ox-23,-119),(ox,-145),(ox+23,-119),(ox+23,-84),(ox,-60),(ox-23,-84),(ox-23,-119)],col,2)
                ln([(132,-101),(167,-101),(180,-80),(156,-63),(133,-79)],col,4)
                for side in (-1,1):ln([(side*96,-52),(side*132,-17),(side*87,-9)],col,3)
            elif power in ('bear','ram'):
                oval(0,-137,52,47,col,4)
                oval(-31,-177,17,18,col);oval(31,-177,17,18,col)
                ln([(-50,-112),(-84,-103),(-103,-68),(-76,-23),(-46,-40),(-31,-88)],col,4)
                ln([(50,-112),(84,-103),(103,-68),(76,-23),(46,-40),(31,-88)],col,4)
                ln([(-22,-133),(-8,-126),(8,-126),(24,-133)],col,3)
                ln([(-18,-158),(-5,-153),(5,-153),(18,-158)],col,4)
                if power=='ram':
                    for side in (-1,1):
                        pts=[]
                        for i in range(50):
                            a=i/49*math.tau*1.5;r=36*(1-i/65)
                            pts.append((side*(39+math.cos(a)*r),-155+math.sin(a)*r))
                        ln(pts,col,4)
                else:
                    ln([(-70,-161),(-91,-185),(-83,-141),(-108,-156)],col,3)
                    hand=arms[1][-1]
                    for j in range(3):ln([(hand[0]-8,hand[1]-12+j*11),(hand[0]+29,hand[1]-9+j*11)],col,3)
                    if mode=='slash':
                        ln([(80,-160),(155,-115),(154,-65),(128,-35)],col,4)
            elif power=='phoenix':
                spread=ease(beat(57),beat(58),t)
                for side in (-1,1):
                    ln([(0,-99),(side*70,-138),(side*220*spread,-195-15*math.sin(t*5)),
                        (side*180*spread,-99),(side*75,-74),(0,-99)],col,4)
                    for j in range(6):ln([(side*(60+j*24)*spread,-135-j*9),
                                        (side*(55+j*24)*spread,-75-j*6)],col,2)
                ln([(-18,-151),(0,-181),(32,-163),(8,-154),(0,-127)],col,4)
                ln([(-25,-61),(-55,33),(0,3),(55,33),(25,-61)],col,3)
        # The black human stays readable within every coloured animal envelope.
        oval(0,-126,16,18,INK,4,PAPER)
        ln([(-12,-140),(-25,-127),(-19,-105),(-10,-110)],INK,3)
        ln([(7,-113),(15,-110),(5,-97),(-6,-109)],INK,3)
        ln([(0,-108),(0,-57)])
        ln([(-24,-95),(-17,-104),(0,-97),(17,-104),(24,-95)],INK,3)
        for limb in legs+arms:ln(limb)
        if p['absorbed'] and not power:
            for j,c in enumerate(COLORS.values()):
                a=t*2+j*math.tau/4
                oval(48*math.cos(a),-94+48*math.sin(a),4,4,c,3)
