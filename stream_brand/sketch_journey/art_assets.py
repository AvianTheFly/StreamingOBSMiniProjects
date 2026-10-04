"""Explicit local bitmap loading for cinematic art v1; no import-time I/O."""
from pathlib import Path
import math
import hashlib
import numpy as np
from PIL import Image

ART_ROOT=Path('C:/StreamingMedia/ChannelPresentation/2026-10-03/spirit-cinematic-art-v1/art')
FILES=('world-panorama.png','material-atlas.png','spirit-atlas.png','hero-atlas.png','gateway.png')


class ArtAssets:
    def __init__(self,root=ART_ROOT):
        self.root=Path(root);self.manifest={};images={}
        for name in FILES:
            path=self.root/name
            with Image.open(path) as source:
                images[name]=source.copy()
                self.manifest[name]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                                     'size':list(source.size),'mode':source.mode}
        self.panorama=np.asarray(images['world-panorama.png'].convert('RGB'))
        def patch(name,rect,size=512):
            image=images[name];w,h=image.size
            # Atlas UV regions are sampled from the original, unmodified PNGs.
            region=image.crop(tuple(round(v*(w if j%2==0 else h)) for j,v in enumerate(rect)))
            return np.asarray(region.convert('RGBA').resize((size,size),Image.Resampling.LANCZOS))
        self.materials={name:patch('material-atlas.png',(col/2,row/3,(col+1)/2,(row+1)/3),256)
                        for name,col,row in (('stone',0,0),('floor',1,0),('fur',0,1),('leather',1,1),('skin',0,2),('bronze',1,2))}
        self.spirits={name:patch('spirit-atlas.png',(col/2,0 if row==0 else .485,(col+1)/2,.485 if row==0 else 1))
                      for name,col,row in (('bear',0,0),('turtle',1,0),('ram',0,1),('phoenix',1,1))}
        self.hero={name:patch('hero-atlas.png',(col/2,0 if row==0 else .42,(col+1)/2,.415 if row==0 else 1))
                   for name,col,row in (('face',0,0),('hair',1,0),('chest',0,1),('back',1,1))}
        self.gateway=np.asarray(images['gateway.png'].convert('RGBA').resize((512,768),Image.Resampling.LANCZOS))


def panorama(assets,view):
    # Ray projection keeps the painted landscape fixed in the world as the
    # camera descends, circles, falls, and returns. It is not a screen overlay.
    w,h=view.image.size;yy,xx=np.mgrid[0:h:2,0:w:2]
    rays=np.asarray(view.forward)[None,None,:]+((xx-view.cx)/view.focal)[...,None]*np.asarray(view.right)+((view.cy-yy)/view.focal)[...,None]*np.asarray(view.up)
    yaw=np.arctan2(rays[...,0],rays[...,2]);elevation=np.arctan2(rays[...,1],np.linalg.norm(rays[...,[0,2]],axis=-1))
    source=assets.panorama;sh,sw=source.shape[:2]
    sx=((yaw/math.tau+.5)%1*(sw-1)).astype(int)
    sy=(np.clip(.48-elevation/2.2,0,1)*(sh-1)).astype(int)
    return Image.fromarray(source[sy,sx]).resize((w,h),Image.Resampling.BILINEAR)
