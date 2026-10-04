"""Local filled-material projection for the illustrated MVP; no runtime renderer."""
import numpy as np
from PIL import ImageDraw,ImageColor
from .sketch_space import View,sub,dot

SKY='#12283c'
STONE='#425666'
EDGE='#81949a'
MAGIC={'bear':'#57bffe','turtle':'#47d6a0','ram':'#e8ae62','phoenix':'#b3e3ff'}


def rgb(c):return ImageColor.getrgb(c) if isinstance(c,str) else c[:3]


def tone(c,s):return tuple(max(0,min(255,round(x*s))) for x in rgb(c))


class ArtView(View):
    """Filled facets use a depth buffer; the old wireframe owner is left intact."""
    def __init__(self,*args):
        super().__init__(*args);self.items=[];self.serial=0

    def queue(self,depth,op,args):
        self.items.append((depth,self.serial,op,args));self.serial+=1

    def project(self,p):
        # Wireframe coordinate caps distort near-clipped filled triangles and
        # can put a floor in front of the actor. Raster bounds already clip to
        # the image, so preserve the actual perspective here.
        d=sub(p,self.eye);z=dot(d,self.forward)
        if z<.12:return None
        return self.cx+dot(d,self.right)*self.focal/z,self.cy-dot(d,self.up)*self.focal/z

    def line(self,points,color=EDGE,width=2):
        if color in ('#f3f0e8','#29313a'):color='#7f9da8' if color=='#f3f0e8' else '#0b1822'
        if color in ('#b2b7b8','#a5b3b8','#b5c0c0','#c5d1d3'):color='#5b7887'
        for a,b in zip(points,points[1:]):
            za,zb=self.depth(a),self.depth(b)
            if za<.13 and zb<.13:continue
            if za<.13:
                q=(.13-za)/(zb-za);a=tuple(x+(y-x)*q for x,y in zip(a,b))
            if zb<.13:
                q=(.13-zb)/(self.depth(a)-zb);b=tuple(x+(y-x)*q for x,y in zip(b,a))
            pa,pb=self.project(a),self.project(b)
            if pa and pb:self.queue((self.depth(a)+self.depth(b))/2-.008,'line',((pa,pb),(self.depth(a),self.depth(b)),color,width))

    def polygon(self,points,fill,outline=EDGE,width=1):
        out=[]
        for a,b in zip(points,points[1:]+points[:1]):
            za,zb=self.depth(a),self.depth(b)
            if za>=.13:out.append(a)
            if (za>=.13)!=(zb>=.13):
                q=(.13-za)/(zb-za);out.append(tuple(x+(y-x)*q for x,y in zip(a,b)))
        if len(out)<3:return
        pts=[self.project(v) for v in out]
        self.queue(sum(self.depth(v) for v in out)/len(out),'polygon',(pts,[self.depth(v) for v in out],fill,outline,width))

    def orb(self,p,r,color,width=2,fill=None):
        xy=self.project(p)
        if xy:
            rr=max(1,min(700,r*self.scale(p)));box=(xy[0]-rr,xy[1]-rr,xy[0]+rr,xy[1]+rr)
            self.queue(self.depth(p)-r*.25,'ellipse',(box,self.depth(p)-r*.25,color,width,fill))

    def box(self,center,extent,color=STONE,fill=None):
        x,y,z=center;a,b,c=extent
        verts=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in
               ((-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1))]
        faces=((0,1,2,3),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7))
        for i,face in enumerate(faces):self.polygon([verts[j] for j in face],tone(fill or color,(.6,1.2,.87,.7,.8,.68)[i]),tone(color,1.1),1)

    def flush(self):
        # A small real depth buffer prevents large floor/roof facets from painting
        # over Udyr or rubble. Half-size rasterization keeps the finite export cheap.
        from PIL import Image
        resolution=getattr(self,'raster_divisor',2)
        w,h=self.image.width//resolution,self.image.height//resolution
        pixels=np.array(self.image.resize((w,h)),copy=True)
        depth=np.full((h,w),np.inf,dtype=np.float32)
        lines=[]
        def triangle(pts,zs,c,indices):
            a,b,cpt=np.asarray(pts,dtype=np.float32)/resolution
            x0=max(0,int(min(a[0],b[0],cpt[0])));x1=min(w-1,int(max(a[0],b[0],cpt[0]))+1)
            y0=max(0,int(min(a[1],b[1],cpt[1])));y1=min(h-1,int(max(a[1],b[1],cpt[1]))+1)
            den=(b[1]-cpt[1])*(a[0]-cpt[0])+(cpt[0]-b[0])*(a[1]-cpt[1])
            if x1<x0 or y1<y0 or abs(den)<1e-7:return
            yy,xx=np.mgrid[y0:y1+1,x0:x1+1]
            aa=((b[1]-cpt[1])*(xx-cpt[0])+(cpt[0]-b[0])*(yy-cpt[1]))/den
            bb=((cpt[1]-a[1])*(xx-cpt[0])+(a[0]-cpt[0])*(yy-cpt[1]))/den
            cc=1-aa-bb
            valid=(aa>=-.001)&(bb>=-.001)&(cc>=-.001)
            inverse=aa/zs[0]+bb/zs[1]+cc/zs[2]
            zz=1/np.maximum(inverse,1e-8)
            region=depth[y0:y1+1,x0:x1+1];mask=valid&(zz<region)
            if not np.any(mask):return
            colors=self.triangle_pixels(aa,bb,cc,zs,c,indices,mask)
            if isinstance(colors,np.ndarray) and colors.shape[-1]==4:
                samples=colors if colors.ndim==2 else colors[mask]
                alpha=samples[:,3:4]/255.
                target=pixels[y0:y1+1,x0:x1+1]
                target[mask]=(target[mask]*(1-alpha)+samples[:,:3]*alpha).astype(np.uint8)
                region[mask]=np.where(samples[:,3]>60,zz[mask],region[mask])
            else:
                region[mask]=zz[mask]
                pixels[y0:y1+1,x0:x1+1][mask]=colors if not isinstance(colors,np.ndarray) else colors[mask]
        for _,_,op,args in self.items:
            if op=='polygon':
                pts,zs,c,outline,width=args
                for j in range(1,len(pts)-1):triangle([pts[0],pts[j],pts[j+1]],[zs[0],zs[j],zs[j+1]],c,(0,j,j+1))
                if outline:
                    for j in range(len(pts)):lines.append(((pts[j],pts[(j+1)%len(pts)]),(zs[j],zs[(j+1)%len(zs)]),outline,width))
            elif op=='line':lines.append(args)
            else:
                box,z,c,width,fill=args
                x0,y0,x1,y1=np.asarray(box)/resolution;cx,cy=(x0+x1)/2,(y0+y1)/2;rx,ry=max(.5,(x1-x0)/2),max(.5,(y1-y0)/2)
                xa,xb=max(0,int(x0)),min(w-1,int(x1)+1);ya,yb=max(0,int(y0)),min(h-1,int(y1)+1)
                if xb<xa or yb<ya:continue
                yy,xx=np.mgrid[ya:yb+1,xa:xb+1];rad=((xx-cx)/rx)**2+((yy-cy)/ry)**2
                region=depth[ya:yb+1,xa:xb+1];mask=(rad<=1)&(z<region)
                border=rad>=max(0,1-width/max(rx,ry))**2
                if fill:
                    pixels[ya:yb+1,xa:xb+1][mask]=rgb(fill);region[mask]=z
                pixels[ya:yb+1,xa:xb+1][mask&border]=rgb(c)
                if not fill:region[mask&border]=z
        for pts,zs,c,width in lines:
            a,b=np.asarray(pts)/resolution;count=min(20000,max(2,round(float(np.max(np.abs(b-a))))+1))
            q=np.linspace(0,1,count);xx=np.rint(a[0]+(b[0]-a[0])*q).astype(int);yy=np.rint(a[1]+(b[1]-a[1])*q).astype(int)
            zz=1/((1-q)/zs[0]+q/zs[1]);radius=max(0,round(width/(2*resolution)))
            for dy in range(-radius,radius+1):
                for dx in range(-radius,radius+1):
                    xs,ys=xx+dx,yy+dy;valid=(xs>=0)&(xs<w)&(ys>=0)&(ys<h)
                    xs,ys,zv=xs[valid],ys[valid],zz[valid];mask=zv<=depth[ys,xs]+.045
                    pixels[ys[mask],xs[mask]]=rgb(c)
        self.image.paste(Image.fromarray(pixels).resize(self.image.size,Image.Resampling.BILINEAR))
        self.items.clear();self.draw=ImageDraw.Draw(self.image)

    def triangle_pixels(self,aa,bb,cc,zs,color,indices,mask=None):
        """Default solid material; art v1 supplies perspective-correct samples."""
        return rgb(color)
