"""Small perspective drawing mechanics for this offline wireframe animatic."""
import math
from PIL import ImageDraw


def add(a,b):return tuple(x+y for x,y in zip(a,b))
def sub(a,b):return tuple(x-y for x,y in zip(a,b))
def mul(a,s):return tuple(x*s for x in a)
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def unit(a):return mul(a,1/max(1e-9,math.sqrt(dot(a,a))))


class View:
    def __init__(self,image,eye,target,fov):
        self.image=image;self.draw=ImageDraw.Draw(image)
        self.eye=eye;self.forward=unit(sub(target,eye))
        self.right=unit(cross(self.forward,(0,1,0)))
        self.up=cross(self.right,self.forward)
        self.focal=image.width/(2*math.tan(math.radians(fov)/2))
        self.cx=image.width/2;self.cy=345

    def depth(self,p):return dot(sub(p,self.eye),self.forward)

    def project(self,p):
        d=sub(p,self.eye);z=dot(d,self.forward)
        if z<.12:return None
        return (max(-6000,min(6000,self.cx+dot(d,self.right)*self.focal/z)),
                max(-6000,min(6000,self.cy-dot(d,self.up)*self.focal/z)))

    def scale(self,p):return self.focal/max(.12,self.depth(p))

    def line(self,points,color='#29313a',width=2):
        for a,b in zip(points,points[1:]):
            za,zb=self.depth(a),self.depth(b)
            if za<.13 and zb<.13:continue
            if za<.13:a=add(a,mul(sub(b,a),(.13-za)/(zb-za)))
            if zb<.13:b=add(b,mul(sub(a,b),(.13-zb)/(self.depth(a)-zb)))
            pa,pb=self.project(a),self.project(b)
            if pa and pb:self.draw.line((pa,pb),fill=color,width=width)

    def polygon(self,points,fill,outline='#29313a',width=2):
        out=[]
        for a,b in zip(points,points[1:]+points[:1]):
            za,zb=self.depth(a),self.depth(b)
            if za>=.13:out.append(a)
            if (za>=.13)!=(zb>=.13):out.append(add(a,mul(sub(b,a),(.13-za)/(zb-za))))
        projected=[self.project(v) for v in out]
        if len(projected)>=3:self.draw.polygon(projected,fill=fill)
        if outline:self.line(points+points[:1],outline,width)

    def ring(self,center,radius,color,axis='xz',width=2):
        points=[]
        for i in range(49):
            a=i/48*math.tau;co,si=radius*math.cos(a),radius*math.sin(a)
            offset=(co,0,si) if axis=='xz' else (co,si,0) if axis=='xy' else (0,co,si)
            points.append(add(center,offset))
        self.line(points,color,width)

    def orb(self,p,r,color,width=2,fill=None):
        xy=self.project(p)
        if xy:
            rr=max(2,min(600,r*self.scale(p)))
            self.draw.ellipse((xy[0]-rr,xy[1]-rr,xy[0]+rr,xy[1]+rr),outline=color,fill=fill,width=width)

    def box(self,center,extent,color='#929c9e',fill=None):
        x,y,z=center;a,b,c=extent
        verts=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in
               ((-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1))]
        faces=((0,1,2,3),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7))
        for face in sorted(faces,key=lambda f:sum(self.depth(verts[i]) for i in f),reverse=True):
            points=[verts[i] for i in face]
            if fill:self.polygon(points,fill,color)
            else:self.line(points+points[:1],color,2)
