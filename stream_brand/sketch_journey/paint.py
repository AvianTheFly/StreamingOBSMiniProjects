"""Original line drawings and moving joints; no generated raster assets."""
import math
import random
from PIL import Image, ImageDraw, ImageFont
from .choreography import WIDTH as W, HEIGHT as H, SCENES, COLORS, BEAT, PHASE, pose, ease

PAPER = '#f3f0e8'
INK = '#29313a'
FAINT = '#b2b7b8'


def line(d, points, color=INK, width=3):
    d.line(points, fill=color, width=width, joint='curve')


def spirit(d, kind, x, y, size, t, color=None):
    color = color or COLORS[kind]
    def pt(a, b):
        return x + a * size, y + b * size
    def ln(points, width=3):
        line(d, [pt(a, b) for a, b in points], color, width)
    def oval(box, width=3):
        d.ellipse((*pt(box[0], box[1]), *pt(box[2], box[3])), outline=color, width=width)
    if kind == 'phoenix':
        flap = math.sin(t * 4) * 20
        ln([(-130, -45 - flap), (-55, -25), (0, 0), (55, -25), (130, -45 - flap)], 5)
        ln([(0, -18), (16, -32), (34, -25), (15, -19), (0, 25), (-15, -19)])
        for side in (-1, 1):
            for i in range(6):
                ln([(side * (35 + 16 * i), -20 - i * 4 - flap * i / 6),
                    (side * (28 + 16 * i), 24 - i * 4)])
        ln([(0, 20), (-18, 63), (0, 49), (18, 63)])
        return
    if kind == 'turtle':
        oval((-92, -37, 90, 34), 4)
        oval((84, -8, 119, 21))
        for side in (-1, 1):
            ln([(side * 56, 14), (side * 81, 45), (side * 25, 31)])
        for ox in (-48, 0, 48):
            ln([(ox - 19, -16), (ox, -28), (ox + 21, -15), (ox + 17, 9),
                (ox - 15, 12), (ox - 19, -16)], 2)
        ln([(-91, 7), (-118, 18), (-99, 23)])
        return
    oval((-90, -40, 47, 24), 4)
    oval((25, -65, 85, -5), 4)
    ln([(66, -43), (105, -31), (97, -15), (74, -11)])
    for i, ox in enumerate((-65, -45, 20, 40)):
        gait = math.sin(t * 9 + i * math.pi) * 18
        ln([(ox, 12), (ox + gait, 41), (ox + gait + 15, 50)], 4)
    if kind == 'bear':
        oval((29, -77, 48, -56))
        ln([(-95, -25), (-108, -8), (-90, 4)])
        ln([(-16, -39), (-30, -56), (-48, -37), (-64, -50), (-76, -33)], 2)
        for i in range(3):
            ln([(92 + i * 5, -8), (88 + i * 5, 2)], 2)
        ln([(-112, -77), (-87, -102), (-99, -62), (-66, -82)], 3)
    else:
        points=[]
        for i in range(49):
            a=i/48 * math.tau * 1.5
            r=31*(1-i/60)
            points.append((44+math.cos(a)*r, -57+math.sin(a)*r))
        ln(points, 4)


def hero(d, p):
    x, y = p['x'], p['y']
    angle = math.radians(p['lean'])
    def point(a, b):
        b *= 1-.13*p['compression']
        return (x + a * math.cos(angle) - b * math.sin(angle),
                y + a * math.sin(angle) + b * math.cos(angle))
    def ln(points, width=5, color=INK):
        line(d, [point(a, b) for a, b in points], color, width)
    c, m = math.sin(p['cycle']), p['motion']
    speed = 25 if p['mode']=='run' else 15 if p['mode']=='walk' else 0
    stride = speed * c * m
    if p['mode']=='run' and p['y']<480:
        stride = 22 * m
    spread = 58 * m if p['mode']=='fly' else 0
    head = point(0, -112)
    d.ellipse((head[0]-17, head[1]-18, head[0]+17, head[1]+18), fill=PAPER, outline=INK, width=4)
    ln([(-14,-126),(-24,-115),(-21,-94),(-11,-99)], 3)
    ln([(6,-101),(15,-97),(7,-86),(-5,-93)], 3)
    ln([(0,-93),(0,-55)])
    ln([(-24,-82),(-15,-91),(0,-85),(16,-91),(26,-82)], 3)
    ln([(0,-55),(-18-stride,-27),(-23-stride,0)])
    ln([(0,-55),(18+stride,-29),(28+stride,0)])
    if p['mode']=='reach':
        ln([(0,-83),(31,-98),(62,-110)])
        ln([(0,-83),(-23,-66),(-21,-47)])
    else:
        ln([(0,-83),(-22-spread/2,-68-stride/2),(-31-spread,-52-stride)])
        ln([(0,-83),(23+spread/2,-65+stride/2),(31+spread,-51+stride)])
    ln([(-19,-78),(-53,-91),(-68,-81),(-44,-74)], 2)
    if p['power']:
        color=COLORS[p['power']]
        ln([(-25,-90),(-38,-78),(-27,-65)], 3, color)
        ln([(23,-90),(39,-78),(28,-65)], 3, color)


def background(name):
    im=Image.new('RGB',(2400,H),PAPER)
    d=ImageDraw.Draw(im)
    rng=random.Random(42)
    for i in range(42):
        x=rng.randrange(2400); y=rng.randrange(95,540)
        line(d,[(x,y),(x+18,y-8)],'#dee0dd',1)
    for ox in range(-100,2500,380):
        line(d,[(ox,415),(ox+105,230),(ox+183,352),(ox+265,190),(ox+390,420)],FAINT,2)
    if name=='sanctuary':
        d.ellipse((1100,115,1180,195),outline=FAINT,width=2)
        for x in range(0,2400,340):
            line(d,[(x,535),(x+5,220),(x-32,260),(x+2,193),(x+41,249),(x+7,220)],'#86968a',3)
            line(d,[(x+140,310),(x+240,265),(x+335,310),(x+150,310),(x+150,392),(x+320,392),(x+320,310)],FAINT,2)
        line(d,[(0,544),(2400,544)],INK,3)
        for x in range(0,2400,140):
            d.ellipse((x,568,x+55,580),outline=FAINT,width=2)
    elif name=='coast':
        for j in range(7):
            y=420+j*23
            line(d,[(x,y+7*math.sin(x/43+j)) for x in range(0,2400,12)],'#8eabb6',2)
        for x in range(200,2400,620):
            line(d,[(x,465),(x+16,375),(x+67,354),(x+96,463)],FAINT,3)
        line(d,[(0,535),(900,535),(885,700)],INK,4)
        line(d,[(1045,700),(1030,535),(2400,535)],INK,4)
        line(d,[(1450,105),(1410,167),(1453,151),(1420,224)],COLORS['bear'],3)
    elif name=='reef':
        for x in range(0,2400,300):
            line(d,[(x,620),(x,348),(x+70,273),(x+140,348),(x+140,620)],'#89a2a3',3)
            for j in range(3):
                line(d,[(x+20+j*35,580),(x+25+j*35,385)],FAINT,1)
        for x in range(50,2400,180):
            line(d,[(x,650),(x+12,597),(x-8,576),(x+12,597),(x+35,563)],'#7faaa0',2)
        line(d,[(0,655),(2400,655)],FAINT,2)
    elif name=='forge':
        for x in range(0,2400,450):
            line(d,[(x,320),(x+45,280),(x+200,280),(x+240,320)],FAINT,3)
            line(d,[(x+90,90),(x+90,266),(x+133,320),(x+165,266),(x+165,90)],FAINT,3)
            d.ellipse((x+270,320,x+392,442),outline=FAINT,width=3)
            for k in range(8):
                a=k*math.pi/4
                line(d,[(x+331,381),(x+331+60*math.cos(a),381+60*math.sin(a))],FAINT,2)
        line(d,[(x,615+8*math.sin(x/100)) for x in range(0,2400,15)],COLORS['ram'],3)
        line(d,[(0,535),(1000,535),(977,590)],INK,4)
        line(d,[(1140,590),(1120,535),(2400,535)],INK,4)
    elif name=='sky':
        for x in range(0,2400,550):
            line(d,[(x,420),(x+240,420),(x+146,570),(x+79,525),(x,420)],FAINT,3)
            for k in range(4):
                h=60+k%2*50
                line(d,[(x+35+k*42,420),(x+35+k*42,420-h),(x+56+k*42,395-h),(x+77+k*42,420-h),(x+77+k*42,420)],FAINT,2)
            d.ellipse((x+300,170,x+475,230),outline=FAINT,width=2)
            line(d,[(x+327,225),(x+345,252),(x+430,252),(x+454,224)],FAINT,2)
        for x in range(0,2400,320):
            d.arc((x,590,x+260,690),180,345,fill='#c8c5cb',width=2)
    else:
        line(d,[(0,545),(2400,545)],INK,3)
        for x in (90,430,1370,1750,2160):
            line(d,[(x,544),(x,110),(x+70,110),(x+70,544)],FAINT,3)
        for _ in range(35):
            x=rng.randrange(2400); y=rng.randrange(110,400)
            d.ellipse((x,y,x+3,y+3),fill=FAINT)
    return im


class Sketch:
    def __init__(self):
        self.worlds={s[0]:background(s[0]) for s in SCENES}
        self.font=ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf',22)
        self.small=ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf',17)

    def render(self,t):
        p=pose(t); i=next(i for i,s in enumerate(SCENES) if s[0]==p['scene'])
        offset=round(90+p['u']*(16 if i in (0,5) else 95))
        im=self.worlds[p['scene']].crop((offset,0,offset+W,H))
        # Transition the environment around the same moving actor, not the actor.
        if i>0 and p['u']<.45:
            prev=SCENES[i-1]
            oldoffset=round(90+(prev[2]-prev[1])*(16 if i-1==0 else 95))
            prior=self.worlds[prev[0]].crop((oldoffset,0,oldoffset+W,H))
            im=Image.blend(prior,im,ease(0,.45,p['u']))
        d=ImageDraw.Draw(im)
        x,y=p['x'],p['y']
        if p['power']:
            kind=p['power']
            if kind=='turtle':
                spirit(d,kind,x-10,y+44,.9,t)
                d.arc((x-125,y-192,x+124,y+59),175,365,fill=COLORS[kind],width=3)
                for j in range(12):
                    bx=x+155+j*23; by=560-((t*65+j*43)%380)
                    d.ellipse((bx,by,bx+8,by+8),outline=COLORS[kind],width=1)
            elif kind=='phoenix':
                spirit(d,kind,x,y-115,1.5,t)
            else:
                spirit(d,kind,x-205,y-40,1.15,t)
                for j in range(5):
                    line(d,[(x-140-j*26,y-40+j*16),(x-195-j*26,y-42+j*16)],COLORS[kind],2)
        if i==0:
            for j,kind in enumerate(COLORS):
                bx=x-100+j*62; by=340+8*math.sin(t*2+j)
                d.ellipse((bx-8,by-8,bx+8,by+8),outline=COLORS[kind],width=2)
                line(d,[(bx,by+13),(bx-7,by+26)],COLORS[kind],1)
        if i==5:
            q=ease(.8,2.6,p['u'])
            center=(920,320)
            for j in range(3):
                r=60+j*24+q*35
                d.ellipse((center[0]-r,center[1]-r*.62,center[0]+r,center[1]+r*.62),outline=FAINT,width=3)
                a=t*(.4+j*.12)
                line(d,[(center[0]-r*math.cos(a),center[1]-r*.62*math.sin(a)),
                        (center[0]+r*math.cos(a),center[1]+r*.62*math.sin(a))],FAINT,2)
            line(d,[(920,385),(920,540),(865,540),(975,540)],INK,3)
            if q>0:
                for j,kind in enumerate(COLORS):
                    a=j*math.pi/2+t*.25
                    bx=920+q*85*math.cos(a); by=320+q*58*math.sin(a)
                    d.ellipse((bx-8,by-8,bx+8,by+8),outline=COLORS[kind],width=3)
                    if p['u']<3.8:
                        line(d,[(x+60,y-110),(760,335),(bx,by)],COLORS[kind],1)
            if p['u']>3.8:
                for j,kind in enumerate(COLORS):
                    spirit(d,kind,270+j*220,510 if kind=='turtle' else 500 if kind!='phoenix' else 315,.55,t)
        hero(d,p)
        if i==5 and p['u']>3.8:
            scale=1-.16*ease(3.8,6.25,p['u'])
            small=im.resize((round(W*scale),round(H*scale)),Image.Resampling.BILINEAR)
            im=Image.new('RGB',(W,H),PAPER); im.paste(small,((W-small.width)//2,(H-small.height)//2))
            d=ImageDraw.Draw(im)
        # Review annotations are deliberately separate from the story drawing.
        d.rectangle((0,0,W,75),fill=PAPER)
        d.rectangle((0,635,W,H),fill=PAPER)
        d.text((28,24),'SPIRIT JOURNEY / MOVEMENT SKETCH 01',font=self.font,fill=INK)
        d.text((1140,27),f'{t:05.2f}s',font=self.small,fill=INK)
        title=SCENES[i][3]
        d.text((28,645),title.upper(),font=self.font,fill=INK)
        d.text((28,680),p['action'],font=self.small,fill=INK)
        beat=max(0,(t-PHASE)/BEAT)
        pulse=math.exp(-(beat%1)*8)
        d.ellipse((1098,26,1110,38),fill=INK if pulse>.4 else FAINT)
        line(d,[(28,625),(1252,625)],'#d3d4cf',2)
        line(d,[(28,625),(28+1224*t/40,625)],INK,2)
        return im
