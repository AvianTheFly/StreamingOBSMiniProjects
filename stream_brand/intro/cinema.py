"""Camera, approximate depth, typography, and atmosphere for animated art plates."""
from pathlib import Path
import math

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def smooth(a, b, t):
    x=np.clip((t-a)/(b-a),0,1)
    return x*x*(3-2*x)


PALETTES={
    '01-rift': (180,210,225), '02-awakening': (120,220,255),
    '03-bear': (100,210,255), '04-turtle': (110,235,175),
    '05-ram': (255,155,60), '06-phoenix': (140,205,255),
    '07-convergence': (120,220,235),
}

DEPTH_LOCATIONS={
    '01-rift':[(.16,.42,.15,.45,.48)],
    '02-awakening':[(.70,.49,.27,.50,.72),(.34,.69,.25,.30,.55)],
    '03-bear':[(.55,.45,.30,.39,.80),(.25,.67,.22,.26,.55)],
    '04-turtle':[(.49,.51,.37,.33,.84)],
    '05-ram':[(.39,.44,.30,.40,.85)],
    '06-phoenix':[(.51,.31,.44,.36,.66)],
    '07-convergence':[(.50,.61,.13,.30,.75)],
}


class Cinema:
    def __init__(self, output, plan, size=(1920,1080)):
        cv2.setNumThreads(2)
        self.w,self.h=size
        self.plan=plan
        self.fps=plan['fps']
        self.output=Path(output)
        self.plates={}
        self.asset_specs=plan.get('assets',{})
        self.styles={asset:self.asset_specs.get(asset,{}).get('style',asset)
                     for asset in dict.fromkeys(s['asset'] for s in plan['shots'])}
        w,h=self.w,self.h
        gx,gy=np.meshgrid(np.arange(w,dtype=np.float32)-w/2,
                         np.arange(h,dtype=np.float32)-h/2)
        self.nx,self.ny=gx/w+.5,gy/h+.5
        self.gx=cv2.resize(gx,(480,270))
        self.gy=cv2.resize(gy,(480,270))
        self.small_nx=self.gx/w+.5
        self.vignette=np.repeat((1-.22*np.clip((gx/(w*.69))**2+(gy/(h*.75))**2,0,1))[:,:,None],3,axis=2).astype(np.float32)
        rng=np.random.default_rng(4451)
        self.particles=rng.random((150,7)).astype(np.float32)
        self.mist=cv2.GaussianBlur(rng.random((160,284)).astype(np.float32),(0,0),9)
        self.mist=(self.mist-self.mist.min())/(self.mist.max()-self.mist.min())
        self.mist_mask=smooth(.36,.84,np.linspace(0,1,160,dtype=np.float32))[:,None,None]
        self.hero=np.asarray(Image.open(self.output/'art'/'08-hero-layer.png').convert('RGBA'))
        self.hero=self.hero.astype(np.float32)/255
        if self.hero[:,:,3].min() > .01 or self.hero[:,:,3].max() < .90:
            raise ValueError('Foreground hero requires usable alpha transparency')
        self.title=self._title()
        self.grain=np.clip(rng.normal(128,.65,(h,w,3)),0,255).astype(np.uint8)
        for asset in dict.fromkeys(s['asset'] for s in plan['shots']):
            style=self.styles[asset]
            rgb=np.asarray(Image.open(self.output/'art'/(asset+'.png')).convert('RGB'))
            image=cv2.resize(rgb,(w,h),interpolation=cv2.INTER_CUBIC)
            x,y=self.nx,self.ny
            floor=smooth(.50,.99,y)*.65
            depth=np.maximum(floor,.12)
            for cx,cy,rx,ry,gain in self.asset_specs.get(asset,{}).get('depth',DEPTH_LOCATIONS[style]):
                depth=np.maximum(depth, gain*np.exp(-(((x-cx)/rx)**2+((y-cy)/ry)**2)*1.2))
            depth=depth.astype(np.float32)
            # Selective light masks breathe with the soundtrack, without whole-frame flashes.
            floats=image.astype(np.float32)
            if style=='05-ram':
                energy=np.clip((floats[:,:,0]-floats[:,:,2]*1.1-25)/100,0,1)
            elif style=='04-turtle':
                energy=np.clip((floats[:,:,1]-floats[:,:,0]*.9-22)/85,0,1)
            else:
                energy=np.clip((floats[:,:,2]-floats[:,:,0]*.95-18)/90,0,1)
            bloom=cv2.GaussianBlur(floats*energy[:,:,None],(0,0),w/150)
            self.plates[asset]=(image,cv2.resize(depth,(480,270)),bloom.astype(np.uint8))

    def _title(self):
        w,h=self.w,self.h
        im=Image.new('RGBA',(w,h))
        draw=ImageDraw.Draw(im)
        font_path=Path('C:/Windows/Fonts/impact.ttf')
        secondary=Path('C:/Windows/Fonts/bahnschrift.ttf')
        def text(text,y,size,spacing,color,font):
            face=ImageFont.truetype(str(font),round(size*w/1920))
            step=spacing*w/1920
            widths=[draw.textlength(c,font=face) for c in text]
            x=(w-sum(widths)-step*(len(text)-1))/2
            for c, width in zip(text,widths):
                draw.text((x,y*h/1080),c,font=face,fill=color,
                          stroke_width=max(1,round(w/1920)),stroke_fill=(5,12,17,200))
                x+=width+step
        text('FOUR SPIRITS.',715,112,4,(234,235,218,255),font_path)
        text('ONE LANE.',835,112,5,(136,225,225,255),font_path)
        text(self.plan.get('channel','UdyrIsABotLaner').upper(),973,28,5,(225,229,229,255),secondary)
        return np.asarray(im).astype(np.float32)

    def _camera(self, shot, t, kick):
        w,h=self.w,self.h
        start=shot['start_frame']/self.fps
        length=(shot['end_frame']-shot['start_frame'])/self.fps
        u=t-start
        motion_u=max(0,u-shot.get('hit_stop_frames',0)/self.fps)
        p=float(smooth(0,max(1/self.fps,length-shot.get('hit_stop_frames',0)/self.fps),motion_u))
        image,depth,bloom=self.plates[shot['asset']]
        zoom=shot['zoom'][0]*(1-p)+shot['zoom'][1]*p
        impact=shot['transition'] in ('impact','finale','snap')
        if impact:
            zoom+=.055*math.exp(-u/ .115)
        drift=shot['orbit']*(p-.5)*1.7
        roll=shot['orbit']*.47*math.sin(p*math.pi)
        cs,sn=math.cos(roll),math.sin(roll)
        quake=(2.2*math.exp(-u/.19) if impact else 0)
        shake_x=math.sin(u*73)*quake
        shake_y=math.cos(u*91)*quake*.58
        mx=(self.gx*cs-self.gy*sn)/zoom + w*shot['focus'][0]
        my=(self.gx*sn+self.gy*cs)/zoom + h*shot['focus'][1]
        mx=mx+depth*(w*drift+shake_x)
        my=my+depth*(h*shot['orbit']*.24*math.sin(p*math.pi)+shake_y)
        travel=shot.get('travel',[0,0])
        mx-=depth*w*travel[0]*(p-.5)
        my-=depth*h*travel[1]*(p-.5)
        # Tiny local displacement gives fur/energy air movement, without claiming a rigged character.
        if self.styles[shot['asset']] in ('03-bear','05-ram','06-phoenix'):
            my+=depth*np.sin(self.small_nx*9+t*2.6)*(1.2+kick*.4)
        mx=cv2.resize(mx.astype(np.float32),(w,h),interpolation=cv2.INTER_LINEAR)
        my=cv2.resize(my.astype(np.float32),(w,h),interpolation=cv2.INTER_LINEAR)
        frame=cv2.remap(image,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
        light=cv2.remap(bloom,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
        frame=cv2.addWeighted(frame,1,light,.11+.14*kick+.04*math.sin(t*2.5),0)
        if shot.get('smear',False) and u<.12:
            radius=max(1,round((1-u/.12)*w/90)//2*2+1)
            frame=cv2.filter2D(frame,-1,np.ones((1,radius),np.float32)/radius)
        if shot['hero']:
            height=round(h*(.39+.085*p))
            width=round(height*self.hero.shape[1]/self.hero.shape[0])
            hero=cv2.resize(self.hero,(width,height),interpolation=cv2.INTER_LINEAR)
            x=round(w*(.505+drift*2)-width/2)
            y=round(h*.92-height)
            a=hero[:,:,3:4]
            part=frame[y:y+height,x:x+width]
            if part.shape[:2] == hero.shape[:2]:
                part[:]=np.clip(part*(1-a)+hero[:,:,:3]*255*(.52+.045*kick)*a,0,255).astype(np.uint8)
        if (shot.get('ending_smear', True) and length > 1 and u > length-.13
                and shot['transition']!='finale'):
            # Fast passing lens smear links the authored shot changes.
            amount=smooth(length-.13,length,u)
            radius=int(amount*w/125)//2*2+1
            if radius>1:
                kernel=np.ones((1,radius),np.float32)/radius
                frame=cv2.filter2D(frame,-1,kernel)
        return frame, u, p

    def _atmosphere(self, frame, shot, t, u, kick, impact):
        w,h=self.w,self.h
        scale=w/1920
        asset=self.styles[shot['asset']]
        color=PALETTES[asset]
        cx,cy=shot.get('impact_point',[.5,.58])
        # Advected low-resolution fog is an independent moving layer.
        matrix=np.array([[1,0,(t*8)%284],[0,1,math.sin(t*.35)*8]],np.float32)
        mist=cv2.warpAffine(self.mist,matrix,(284,160),borderMode=cv2.BORDER_WRAP)
        fog=mist[:,:,None]*self.mist_mask*np.array(color,np.float32)
        fog=cv2.resize(fog.astype(np.uint8),(w,h),interpolation=cv2.INTER_LINEAR)
        frame=cv2.addWeighted(frame,.985,fog,.025 if asset=='02-awakening' else .07,0)
        overlay=np.zeros((h,w,3),np.uint8)
        # Particles at different distances pass with different velocities and sizes.
        warm=asset in ('05-ram','07-convergence')
        frost=asset=='06-phoenix'
        for j,v in enumerate(self.particles[:100 if frost or warm else 72]):
            near=.3+v[2]*1.6
            if warm or frost:
                px=((v[0]+t*(.010+v[3]*.018)*near+math.sin(t*.6+j)*.012)%1)*w
                py=((v[1]-t*(.012+v[4]*.025)*near)%1)*h
                r=max(1,round(scale*(1+v[5]*2.1)*near))
                rgb=(255,145+round(v[6]*70),55) if warm else (167,217,252)
                cv2.circle(overlay,(round(px),round(py)),r,rgb,-1,cv2.LINE_AA)
                if warm and r>2:
                    cv2.line(overlay,(round(px),round(py)),(round(px-3*near),round(py+8*near)),rgb,1,cv2.LINE_AA)
            else:
                px=((v[0]+t*.08*near)%1)*w
                py=((v[1]+t*.35*near)%1)*h
                length=round(8*scale*near)
                cv2.line(overlay,(round(px),round(py)),(round(px+length*.38),round(py+length)),
                         (92,119,141),1,cv2.LINE_AA)
        frame=cv2.addWeighted(frame,1,overlay,.28 if not warm and not frost else .65,0)
        burst=impact and u<.72
        if burst:
            debris=np.zeros((h,w,3),np.uint8)
            for j,v in enumerate(self.particles[:24]):
                theta=v[0]*math.tau
                speed=(130+v[1]*390)*scale
                x=w*cx+math.cos(theta)*speed*u
                y=h*cy+math.sin(theta)*speed*u+h*.18*u*u
                radius=scale*(2+v[3]*5)
                pts=np.array([[x-radius,y],[x,y-radius*.65],[x+radius,y],[x,y+radius]],np.int32)
                cv2.fillConvexPoly(debris,pts,color,cv2.LINE_AA)
            frame=cv2.addWeighted(frame,1,debris,.50*(1-u/.72),0)
        if asset in ('01-rift','02-awakening','03-bear','07-convergence') and self.asset_specs.get(shot['asset'],{}).get('lightning',True):
            phase=(t+.17)%1.875
            power=math.exp(-phase/ .07)*(.35+.35*kick)
            if power>.05:
                electric=np.zeros((h,w,3),np.uint8)
                cx=.39 if asset=='01-rift' else .58
                cy=.30 if asset=='01-rift' else .58
                pts=[]
                seed=int(t/1.875)
                for k in range(16):
                    p=k/15
                    x=w*(cx+.08*math.sin(k*1.91+seed)*math.sin(p*math.pi))
                    y=h*(-.02+(cy+.02)*p)
                    pts.append((round(x),round(y)))
                cv2.polylines(electric,[np.array(pts,np.int32)],False,(148,213,255),max(1,round(scale*2)),cv2.LINE_AA)
                haze=cv2.GaussianBlur(electric,(0,0),3*scale)
                frame=cv2.addWeighted(frame,1,haze,power*1.9,0)
                frame=cv2.addWeighted(frame,1,electric,power,0)
        if asset=='04-turtle' and self.asset_specs.get(shot['asset'],{}).get('ward',True):
            cycle=(u%1.875)/1.875
            ward=np.zeros((h,w,3),np.uint8)
            radius=int(w*(.19+.38*cycle))
            cv2.ellipse(ward,(round(w*.5),round(h*.57)),(radius,round(radius*.44)),
                        -5,190,352,(88,226,165),max(1,round(scale*2)),cv2.LINE_AA)
            frame=cv2.addWeighted(frame,1,cv2.GaussianBlur(ward,(0,0),3*scale),.65*(1-cycle),0)
        return frame

    def _contact_accent(self, frame, shot, u):
        """Brief inked contact frames followed by an expanding local shock ring."""
        w,h=self.w,self.h
        color=PALETTES[self.styles[shot['asset']]]
        if u*self.fps < shot.get('impact_frames',0):
            gray=cv2.cvtColor(frame,cv2.COLOR_RGB2GRAY)
            _,ink=cv2.threshold(gray,105,255,cv2.THRESH_BINARY)
            ink=cv2.cvtColor(ink,cv2.COLOR_GRAY2RGB)
            toned=cv2.multiply(ink,tuple(float(c)/255 for c in color)+(0,))
            frame=cv2.addWeighted(frame,.72,toned,.28,0)
        if shot.get('shockwave',False) and u<.44:
            ring=np.zeros_like(frame)
            cx,cy=shot.get('impact_point',[.5,.58])
            radius=round(w*(.035+.38*u/.44))
            cv2.ellipse(ring,(round(w*cx),round(h*cy)),(radius,max(1,round(radius*.56))),
                        0,0,360,color,max(1,round(w/960)),cv2.LINE_AA)
            frame=cv2.addWeighted(frame,1,cv2.GaussianBlur(ring,(0,0),max(1,w/960)),.55*(1-u/.44),0)
        return frame

    def render(self, fi):
        t=fi/self.fps
        shot=next(s for s in self.plan['shots'] if s['start_frame']<=fi<s['end_frame'])
        phase=(t-self.plan['beat_phase'])%(60/self.plan['bpm'])
        kick=math.exp(-phase/.075)
        frame,u,p=self._camera(shot,t,kick)
        impact=shot['transition'] in ('impact','finale')
        frame=self._atmosphere(frame,shot,t,u,kick,impact)
        if shot.get('impact_frames',0) or shot.get('shockwave',False):
            frame=self._contact_accent(frame,shot,u)
        if shot['transition']=='finale':
            frame=frame.astype(np.float32)
            reveal=smooth(.08,.38,u)
            gradient=smooth(.55,.87,self.ny)[:,:,None]*.77*reveal
            frame*=1-gradient
            alpha=self.title[:,:,3:4]/255*reveal
            # Settle the closing typography over 0.3 seconds.
            dy=round((1-reveal)*self.h*.02)
            title=np.roll(self.title,dy,axis=0)
            alpha=title[:,:,3:4]/255*reveal
            frame=frame*(1-alpha)+title[:,:,:3]*alpha
            frame=np.clip(frame,0,255).astype(np.uint8)
        frame=cv2.multiply(frame,self.vignette,dtype=cv2.CV_8U)
        if impact:
            strength=.11*math.exp(-u/.075)
            frame=cv2.add(frame,tuple(float(c)*strength for c in PALETTES[self.styles[shot['asset']]])+(0,))
            if u<.14:
                channel_shift=max(1,round((1-u/.14)*self.w/640))
                frame[:,:,0]=np.roll(frame[:,:,0],channel_shift,axis=1)
                frame[:,:,2]=np.roll(frame[:,:,2],-channel_shift,axis=1)
        frame=cv2.addWeighted(frame,1,np.roll(self.grain,fi%17,axis=1),.4,-51.2)
        fade=float(smooth(0,.20,t)*(1-smooth(self.plan['duration_seconds']-.14,self.plan['duration_seconds'],t)))
        if fade < 1:
            frame=cv2.convertScaleAbs(frame,alpha=fade)
        bar=round(self.h*.049)
        frame[:bar]=0
        frame[-bar:]=0
        return frame
