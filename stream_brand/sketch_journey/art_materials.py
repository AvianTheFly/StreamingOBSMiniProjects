"""Perspective-correct painted materials and alpha cards on persistent geometry."""
from dataclasses import dataclass
import numpy as np
from .illustrated_materials import ArtView,rgb
from .sketch_space import cross,sub,unit,dot


@dataclass
class PaintedMaterial:
    texture:np.ndarray
    uv:list
    tint:tuple=(1.,1.,1.)
    opacity:float=1.
    repeat:bool=False
    mist:bool=False
    stone:bool=False


class PaintedView(ArtView):
    raster_divisor=1
    def __init__(self,image,eye,target,fov,assets):
        super().__init__(image,eye,target,fov);self.assets=assets;self.context='world';self.light_fields=[]

    def polygon(self,points,fill,outline=None,width=1):
        if isinstance(fill,PaintedMaterial):return super().polygon(points,fill,outline,width)
        if len(points)<3:return
        normal=unit(cross(sub(points[1],points[0]),sub(points[2],points[0])))
        color=np.asarray(rgb(fill),dtype=float)
        if self.context=='effects':return super().polygon(points,fill,outline,width)
        if self.context in self.assets.materials:
            kind=self.context;tint=(.90,.93,.97)
        elif self.context=='actor':
            if color[0]>color[1]*1.12 and color[1]>color[2]*1.10:kind='skin'
            elif np.mean(color)>95:kind='fur'
            else:kind='leather'
            shade=.67+.33*abs(dot(normal,unit((-.4,.8,.5))))
            tint=(shade,shade,shade)
        else:
            kind='floor' if abs(normal[1])>.78 and min(p[1] for p in points)>-.1 else 'stone'
            shade=.63+.45*abs(dot(normal,unit((-.4,.8,.5))))
            tint=np.asarray((shade*.82,shade*.98,shade*1.13))
            center=np.mean(points,axis=0)
            for x,z,c,strength in self.light_fields:
                influence=strength*np.exp(-((center[0]-x)**2+(center[2]-z)**2)/15)
                tint+=np.asarray(c)*influence*.35
            tint=tuple(tint)
        axes=(0,2) if abs(normal[1])>.78 else (0,1) if abs(normal[2])>abs(normal[0]) else (2,1)
        uv=[(p[axes[0]]*.25,-p[axes[1]]*.25) for p in points]
        if self.context!='world':
            # Limb UVs belong to their connected surfaces, so tattoos and
            # bindings cannot slide across the actor while he travels.
            if len(points)==4:uv=[(0,1),(0,0),(1,0),(1,1)]
            elif len(points)==3:uv=[(0,1),(1,1),(.5,0)]
            else:
                import math
                uv=[(.5+.48*math.cos(j*math.tau/len(points)),.5+.48*math.sin(j*math.tau/len(points))) for j in range(len(points))]
        material=PaintedMaterial(self.assets.materials[kind],uv,tint,repeat=True,mist=self.context=='world')
        self.textured_polygon(points,material)

    def textured_polygon(self,points,material):
        out=[];uv=[]
        for j,(a,b) in enumerate(zip(points,points[1:]+points[:1])):
            ua,ub=material.uv[j],material.uv[(j+1)%len(points)]
            za,zb=self.depth(a),self.depth(b)
            if za>=.131:out.append(a);uv.append(ua)
            if (za>=.131)!=(zb>=.131):
                q=(.131-za)/(zb-za)
                out.append(tuple(x+(y-x)*q for x,y in zip(a,b)))
                uv.append(tuple(x+(y-x)*q for x,y in zip(ua,ub)))
        if len(out)<3:return
        clipped=PaintedMaterial(material.texture,uv,material.tint,material.opacity,material.repeat,material.mist,material.stone)
        super().polygon(out,clipped,None,1)

    def card(self,points,texture,opacity=1.,uv=None,tint=(1.,1.,1.),stone=False):
        self.textured_polygon(points,PaintedMaterial(texture,uv or [(0,1),(1,1),(1,0),(0,0)],tint,opacity,stone=stone))

    def triangle_pixels(self,aa,bb,cc,zs,color,indices,mask=None):
        if not isinstance(color,PaintedMaterial):return super().triangle_pixels(aa,bb,cc,zs,color,indices,mask)
        if mask is not None:aa,bb,cc=aa[mask],bb[mask],cc[mask]
        inv=aa/zs[0]+bb/zs[1]+cc/zs[2]
        texuv=np.asarray([color.uv[i] for i in indices]);u=(aa*texuv[0,0]/zs[0]+bb*texuv[1,0]/zs[1]+cc*texuv[2,0]/zs[2])/np.maximum(inv,1e-8)
        v=(aa*texuv[0,1]/zs[0]+bb*texuv[1,1]/zs[1]+cc*texuv[2,1]/zs[2])/np.maximum(inv,1e-8)
        if color.repeat:u=u%1;v=v%1
        else:u=np.clip(u,0,1);v=np.clip(v,0,1)
        th,tw=color.texture.shape[:2]
        sampled=color.texture[(v*(th-1)).astype(int),(u*(tw-1)).astype(int)].astype(float)
        if color.stone:
            lum=sampled[...,:3].mean(axis=-1,keepdims=True)
            sampled[...,:3]=sampled[...,:3]*(1-color.stone)+lum*np.asarray((.76,.91,1.02))*color.stone
        sampled[...,:3]*=np.asarray(color.tint)
        if color.mist:
            fog=np.clip((1/np.maximum(inv,1e-8)-25)/125,0,.55)[...,None]
            sampled[...,:3]=sampled[...,:3]*(1-fog)+np.asarray((51,76,98))*fog
        sampled[...,3]*=color.opacity
        return np.clip(sampled,0,255).astype(np.uint8)

    def flush(self):
        # Opaque facets still use the depth buffer. Back-to-front alpha cards
        # additionally blend over the already-painted opaque surface beneath.
        self.items.sort(key=lambda item:item[0],reverse=True)
        super().flush()
