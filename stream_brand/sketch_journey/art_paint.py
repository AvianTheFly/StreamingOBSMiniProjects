"""First cinematic art pass: painted bitmap materials on the approved moving rig."""
import math
from PIL import Image,ImageDraw,ImageChops
from .motion_paint import MotionSketch
from .motion_rig import skeleton
from .art_assets import ArtAssets,ART_ROOT,panorama
from .art_materials import PaintedView
from .art_timeline import state,camera,beat,BEAR_CONTACT,HIT,STATUES
from .art_effects import lights,obstacles,collapse_accents
from .sketch_space import add,mul
from .choreography import ease
from .illustrated_materials import MAGIC


def billboard(v,center,width,height,texture,opacity,offset=0):
    center=add(center,mul(v.forward,offset))
    right=mul(v.right,width/2);up=mul(v.up,height/2)
    points=[add(center,add(mul(right,-1),mul(up,-1))),add(center,add(right,mul(up,-1))),
            add(center,add(right,up)),add(center,add(mul(right,-1),up))]
    v.card(points,texture,opacity)


class CinematicArtSketch(MotionSketch):
    generated_image_count=5

    def __init__(self,assets_path=ART_ROOT):
        super().__init__();self.assets=ArtAssets(assets_path)
        self.delivery_metadata={'revision':'cinematic-art-v1','art_assets_used':self.assets.manifest,
            'animation':'continuous camera, fixed-length rig, perspective-correct painted surfaces and articulated spirit cards',
            'return_island':'original','escape_route':'original entrance rubble','still_image_shot_substitutions':0,
            'center_born_light':True,'collapse_start':BEAR_CONTACT,
            'limitations':'Art MVP uses painted surfaces and 2.5D character/spirit cards with coarse underlying geometry.'}

    def render(self,t):
        p=state(t);eye,target,fov=camera(p)
        image=Image.new('RGB',(1280,720))
        v=PaintedView(image,eye,target,fov,self.assets)
        v.time=t
        v.light_fields=[(x*1.29,z*1.29,tuple(c/255 for c in color),ease(.5,1,p['branch_progress'][j])*(1-ease(beat(22),beat(24),t)))
                        for j,((x,_,z),color) in enumerate(zip(STATUES,((87,191,254),(71,214,160),(232,174,98),(179,227,255))))]
        image.paste(panorama(self.assets,v))
        r=skeleton(p)
        self.sanctuary(v,p);self.ruined_walls(v,p);self.engravings(v,p);self.gateway(v,p)
        v.context='effects';lights(v,p)
        v.context='world';obstacles(v,p);collapse_accents(v,p);self.air_geometry(v,p)
        v.context='actor';self.actor(v,p,r,subjective=p['pov'])
        v.flush();self.bloom(image)
        # Quiet drifting dust and depth atmosphere remain on the same world clock.
        self.atmosphere(image,p)
        image=Image.blend(image,ImageChops.multiply(image,self.grain),.28)
        d=ImageDraw.Draw(image)
        d.rectangle((0,0,1280,27),fill='#061018');d.rectangle((0,693,1280,720),fill='#061018')
        d.text((22,7),'SANCTUARY / CINEMATIC ART MVP 01',font=self.small,fill='#a1b4ba')
        d.text((1134,7),f'{t:04.1f} / 40s',font=self.small,fill='#a1b4ba')
        return image

    def statue(self,v,center,kind,color):
        x,y,z=center;j=list(MAGIC).index(kind)
        v.box((x,y-.28,z),(.67,.50,.52),'#547179')
        # Carved relief cards face the room center, staying attached to their
        # persistent pedestals as the camera revolves around the chamber.
        theta=math.atan2(-x,-z);right=(math.cos(theta),0,-math.sin(theta));normal=(math.sin(theta),0,math.cos(theta))
        c=add((x,2.25,z),mul(normal,.56));half=mul(right,1.15)
        points=[add(c,add(mul(half,-1),(0,-1.18,0))),add(c,add(half,(0,-1.18,0))),
                add(c,add(half,(0,1.18,0))),add(c,add(mul(half,-1),(0,1.18,0)))]
        # Recover the staged illumination from the authored color; source art
        # remains untouched and the inactive totems read as stone reliefs.
        awake=ease(beat(16+j*.45),beat(18+j*.35),v.time)
        v.card(points,self.assets.spirits[kind],tint=(.68+.30*awake,)*3,stone=1-.7*awake)

    def ruined_walls(self,v,p):
        for x,_,z in STATUES:
            center=(x*1.29,3.45,z*1.29);radius=math.hypot(x,z)
            right=(-z/radius,0,x/radius);half=mul(right,1.8)
            v.polygon([add(center,add(mul(half,-1),(0,-3.45,0))),add(center,add(half,(0,-3.45,0))),
                       add(center,add(half,(0,3.25,0))),add(center,add(mul(half,-1),(0,3.25,0)))],'#496273')
            # A worn bronze rune inset catches the outward surface light.
            inward=mul((x,0,z),-.007);c=add(center,inward);arm=mul(right,.38)
            v.card([add(c,add(mul(arm,-1),(0,-1.1,0))),add(c,add(arm,(0,-1.1,0))),
                    add(c,add(arm,(0,1.1,0))),add(c,add(mul(arm,-1),(0,1.1,0)))],self.assets.materials['bronze'],tint=(.60,.71,.78))

    def gateway(self,v,p):
        if p['t']>=HIT:return
        q=p['cavein'];fade=1-ease(.94,1,q)
        for z in (11.52,12.48):
            for a,b in ((0,.33),(.67,1)):
                side=-1 if a==0 else 1;fall=q*2.8
                x0,x1=-3.0+6*a+side*q*.30,-3.0+6*b+side*q*.30
                points=[(x0,-fall,z+q*.15),(x1,-fall,z+q*.15),(x1,7-fall,z),(x0,7-fall,z)]
                v.card(points,self.assets.gateway,fade,[(a,1),(b,1),(b,0),(a,0)],tint=(.78,.86,.92))
            points=[(-1.02,4.9-q*3.5,z),(1.02,4.9-q*3.5,z),(1.02,7-q*3.5,z),(-1.02,7-q*3.5,z)]
            v.card(points,self.assets.gateway,fade,[(.33,.30),(.67,.30),(.67,0),(.33,0)],tint=(.78,.86,.92))
        # Physical roots accompany the magical seal and burn from the claw's
        # contact; they never replace the actual animated entrance geometry.
        if p['seal_grow'] and p['seal']<1:
            for j in range(7):
                x=-1.5+j*.5;keep=max(0,1-p['seal']*(1+j*.035))
                if keep:
                    points=[(x+.14*math.sin(k*1.8+j),k*.42,11.78) for k in range(13)]
                    from .motion_effects import reveal
                    reveal(v,points,keep*p['seal_grow'],'#394a3a',9)

    def actor(self,v,p,r,subjective=False):
        super().actor(v,p,r,subjective)
        if subjective:return
        j=r['joints'];vec=r['vector'];s=p['body_scale']
        def pt(c,offset):return add(c,vec(mul(offset,s)))
        for face,z,texture in (('front',.235,self.assets.hero['chest']),('back',-.28,self.assets.hero['back'])):
            points=[pt(j['pelvis'],(-.39,-.20,z)),pt(j['pelvis'],(.39,-.20,z)),
                    pt(j['chest'],(.53,.25,z)),pt(j['chest'],(-.53,.25,z))]
            v.card(points,texture,tint=(.81,.85,.90))

    def head(self,v,p,r):
        center=r['joints']['head'];vec=r['vector'];s=p['body_scale'];pitch=p['head_pitch']
        def pt(x,y,z):
            y,z=y*math.cos(pitch)-z*math.sin(pitch),y*math.sin(pitch)+z*math.cos(pitch)
            return add(center,vec((x*s,y*s,z*s)))
        previous=v.context;v.context='fur'
        rings=[[pt(radius*math.cos(k*math.tau/8),y,radius*.70*math.sin(k*math.tau/8)) for k in range(8)]
               for radius,y in ((.09,-.14),(.14,.03),(.04,.18))]
        for a,b in zip(rings,rings[1:]):
            for k in range(8):v.polygon([a[k],a[(k+1)%8],b[(k+1)%8],b[k]],'#3b413b')
        v.context=previous
        for z,texture in ((.26,self.assets.hero['face']),(-.19,self.assets.hero['hair'])):
            v.card([pt(-.26,-.28,z),pt(.26,-.28,z),pt(.26,.32,z),pt(-.26,.32,z)],texture,tint=(.90,.94,.98))

    def aura(self,v,p,r,kind,q):
        previous=v.context;v.context='effects';j=r['joints'];vec=r['vector']
        if kind!='phoenix':super().aura(v,p,r,kind,q)
        if kind=='phoenix' and not p['pov']:
            # Each painted half-wing bends around the chest with the existing
            # flap clock. Feathers are sampled from the transparent atlas.
            flap=math.sin(p['t']*7)*.55*p['flying'];texture=self.assets.spirits['phoenix']
            for side in (-1,1):
                root=add(j['chest'],vec((side*.20,.25,-.12)))
                tip=add(j['chest'],vec((side*(.30+2.4*q),(.60+flap)*q,-.18)))
                bottom=add(j['chest'],vec((side*(.30+2.4*q),(-1.00+flap)*q,-.20)))
                base=add(j['pelvis'],vec((side*.18,-.32,-.18)))
                uv=[(.50,.0),(1 if side>0 else 0,0),(1 if side>0 else 0,1),(.50,1)]
                v.card([root,tip,bottom,base],texture,.92*q,uv)
            billboard(v,add(j['head'],vec((0,.22,.05))),.55*q,.62*q,texture,.30*q,-.16)
        elif kind=='ram' and p['pov']:
            texture=self.assets.spirits['ram']
            for side in (-1,1):
                center=add(v.eye,add(mul(v.forward,1.4),add(mul(v.right,side*.94),mul(v.up,.44))))
                right=mul(v.right,.41*q);up=mul(v.up,.53*q)
                uv=[(.03 if side<0 else .73,.87),(.27 if side<0 else .97,.87),
                    (.27 if side<0 else .97,.03),(.03 if side<0 else .73,.03)]
                v.card([add(center,add(mul(right,-1),mul(up,-1))),add(center,add(right,mul(up,-1))),
                        add(center,add(right,up)),add(center,add(mul(right,-1),up))],texture,.75*q,uv)
        elif not p['pov']:
            sizes={'bear':(1.55,1.30),'turtle':(2.35,1.95),'ram':(1.6,1.38)}
            w,h=sizes[kind];center=add(j['head'],(0,.20 if kind!='turtle' else -.1,0))
            opacity=.58 if kind=='bear' else .43 if kind=='ram' else .20
            billboard(v,center,w*(.3+.7*q),h*(.3+.7*q),self.assets.spirits[kind],q*opacity,.35 if kind=='turtle' else -.32)
        elif kind=='phoenix':
            # Peripheral feather hints build during the fall without placing
            # a whole animal face in the human first-person view.
            texture=self.assets.spirits['phoenix']
            for side in (-1,1):
                center=add(v.eye,add(mul(v.forward,1.6),mul(v.right,side*1.35)))
                billboard(v,center,.55*q,1.15*q,texture,.24*q)
        v.context=previous
