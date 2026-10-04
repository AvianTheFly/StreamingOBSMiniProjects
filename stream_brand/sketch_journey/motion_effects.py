"""Visible energy travel, progressive claws and contact-driven masonry effects."""
import math
from .motion_timeline import beat,lerp,STATUES,HIT,RAM_HIT,BEAR_CONTACT
from .choreography import ease
from .illustrated_materials import MAGIC,tone
from .sketch_space import add


def reveal(v,points,q,color,width=3):
    if q<=0:return
    f=min(1,q)*(len(points)-1);j=min(len(points)-2,int(f))
    end=lerp(points[j],points[j+1],f-j)
    v.line(points[:j+1]+[end],color,width)
    return end


def lights(v,p):
    t=p['t']
    if beat(8)<=t<beat(22):
        for j,((x,_,z),c) in enumerate(zip(STATUES,MAGIC.values())):
            side=-1 if x<0 else 1
            routes=[[(0,.08,14),(side*3,.08,8),(0,.08,2),(x,.08,z),(x,2,z)],
                    [(0,1.3,14),(side*9,1.3,8),(side*9,6,0),(x,6,z),(x,2,z)],
                    [(0,7.5,14),(side*9,7.5,7),(-x,7.5,-z),(x,7.5,z),(x,2,z)]]
            for k,route in enumerate(routes):
                q=ease(beat(8)+j*.13+k*.2,beat(18)+j*.12,t)
                end=reveal(v,route,q,tone(c,.65),3)
                if end:v.orb(end,.11,c,2,c)
    statue_beams(v,p)


def statue_beams(v,p):
    t=p['t']
    if beat(18.35)<=t<beat(24.7):
        fade=1-ease(beat(23.7),beat(24.7),t)
        for j,((x,_,z),c) in enumerate(zip(STATUES,MAGIC.values())):
            q=p['beam_progress'][j]
            route=[]
            for k in range(33):
                u=k/32;route.append((x*(1-u),2*(1-u)+1.35*u+math.sin(math.pi*u)*1.25,z*(1-u)))
            end=reveal(v,route,q,tone(c,.45+.55*fade),round(2+3*q))
            if end:
                v.orb(end,.12+.09*q,c,2,c)
                for k in range(3):
                    progress=max(0,q-k*.09)
                    point=route[min(32,round(progress*32))]
                    v.orb(point,.055,c,2,c)
            if q>.98:
                strength=p['spirit_growth'][j]*fade
                v.ring((0,.09+j*.015,0),.25+2*strength,c,width=2)


def obstacles(v,p):
    t=p['t']
    if p['seal_grow'] and p['seal']<1:
        grow=p['seal_grow'];burn=p['seal']
        for j in range(10):
            x=-1.9+j*.42;path=[(x,0,12),(x+.25,1.4,12),(x-.2,2.8,12),(x+.3,4.2,12),(x,5.3,12)]
            # The claw burns one side first; the remaining filaments sizzle away.
            remaining=max(0,1-burn*(1.18+j*.035))
            if remaining:
                reveal(v,path,grow*remaining,tone('#5f9b98',.7+remaining*.3),5)
                reveal(v,[(x-.2,2.8,12),(x+.6,3.4,12),(x+.8,4.4,12)],grow*remaining,'#39646d',3)
    if BEAR_CONTACT-.08<=t<beat(30.35):
        for stroke in range(2):
            start=BEAR_CONTACT+stroke*.22;q=ease(start,start+.13,t)
            fade=1-ease(start+.16,start+.52,t)
            if q<=0 or fade<=0:continue
            for j in range(3):
                path=[(-1.2+j*.25,3.5-stroke*.7,11.91),(-.4+j*.25,2.7-stroke*.3,11.90),(1.1+j*.25,1.0+stroke*.2,11.9)]
                end=reveal(v,path,q,tone(MAGIC['bear'],fade),6)
                if end:v.orb(end,.07,MAGIC['bear'],2,MAGIC['bear'])
            age=max(0,t-start)
            for j in range(12):
                a=j*2.399
                v.orb((math.sin(a)*age*4,2.3+math.cos(a)*age*3,11.8-age*.8),.035,tone(MAGIC['bear'],fade),1)
    if p.get('cavein_start',beat(30))<=t<HIT:
        q=p['cavein']
        pieces=[(0,7.1,10.8,2,.65,.8),(-2.7,5.7,10.7,.55,1.5,.65),(2.7,5.5,11,.6,1.5,.65),(-1.6,6.8,12,.9,.5,.8),(1.6,6.8,12,.9,.5,.8)]
        for j,(x,y,z,sx,sy,sz) in enumerate(pieces):
            v.box((x*(1-q*.55),y+((3.45 if j==0 else 3.4)-y)*q,z),(sx,sy,sz),'#627785')
        for j in range(9):v.box(((j%3-1)*1.6,6.5-q*(3+j%3*.4),9.5+j%4*.8),(.22,.25,.3),'#627781')
    if t>=HIT:
        settle=ease(HIT,HIT+.7,t)
        for j in range(21):
            x=(j%5-2)*.9;level=j//5;y=.6+level*.8+(1-settle)*1.8;z=11.9+j%3*.22
            age=max(0,p['ram_debris_age']-(j%5)*.015)
            if age:
                angle=j*2.399;speed=4+j%4
                x+=math.sin(angle)*speed*age
                y+=(2.5+j%3)*age-3.1*age*age
                z+=(4+j%3)*age
            if y>-19:v.box((x,y,z),(.52,.42,.46),'#576c79')
        smash=p['rubble_smashed']
        for side in (-1,1):
            if smash<.98:
                v.line([(side*2,0,12.3),(-side*1.5+side*smash*2,4.6-smash*3,12.3+smash*3)],'#69808b',8)
    if beat(34)<=t<HIT:
        q=ease(beat(34),HIT-.04,t);end=lerp((-6,3,7),add(p['root'],(0,1.2,0)),q)
        v.line([(-6,3,7),end],MAGIC['turtle'],4)
        for j in range(6):v.orb(add(end,(-j*.2,j*.1,0)),.07,MAGIC['turtle'],2,MAGIC['turtle'])
    if RAM_HIT-.02<=t<RAM_HIT+.46:
        age=max(0,t-RAM_HIT);fade=1-ease(RAM_HIT+.18,RAM_HIT+.46,t)
        center=(0,1.0,11.39)
        v.ring(center,.12+age*7,tone(MAGIC['ram'],fade),'xy',4)
        for j in range(20):
            a=j*2.4
            v.line([add(center,(math.cos(a)*age*5,math.sin(a)*age*5,-age)),
                    add(center,(math.cos(a)*age*7,math.sin(a)*age*7,-age*1.3))],tone('#edc784',fade),3)
