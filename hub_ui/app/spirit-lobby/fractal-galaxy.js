// An unbounded journey through nested, seeded galaxies. No timeline reset.
import {hash,TAU,ellipse,glow,smooth} from './paint.js';
export class FractalGalaxy {
  constructor(){this.cache=new Map();}
  texture(level,colors){
    const key=level+'|'+colors.join();if(this.cache.has(key))return this.cache.get(key);
    const image=document.createElement('canvas');image.width=600;image.height=600;const p=image.getContext('2d');p.translate(300,300);
    const seed=level*137+4000,arms=2+Math.floor(hash(seed)*4),tint=colors[((level%4)+4)%4];
    glow(p,0,0,238,210,tint+'38');glow(p,0,0,62,62,'#c7efff77');
    for(let i=0;i<1700;i++){
      const r=Math.pow(hash(seed+i*2+5),.72)*272,a=(i%arms)*TAU/arms+r*.028+(hash(seed+i*3+7)-.5)*(.2+r*.004);
      const x=Math.cos(a)*r,y=Math.sin(a)*r;
      p.globalAlpha=.15+hash(seed+i+99)*.7;ellipse(p,x,y,.35+hash(seed+i+21)*1.1,.35+hash(seed+i+21)*1.1,i%7===0?colors[i%4]:'#daf3ff');
    }p.globalAlpha=1;
    for(let i=0;i<4;i++){const a=hash(seed+i+140)*TAU,r=65+hash(seed+i+300)*150;glow(p,Math.cos(a)*r,Math.sin(a)*r,24,18,colors[i]+'77');}
    this.cache.set(key,image);while(this.cache.size>8)this.cache.delete(this.cache.keys().next().value);return image;
  }
  draw(c,t,colors){
    const depth=t/18,base=Math.floor(depth),rotation=t*.018;
    // Older systems expand offscreen while newly revealed systems grow from their cores.
    for(let level=base-1;level<=base+4;level++){
      const scale=Math.pow(4,depth-level),opacity=smooth(.008,.13,scale)*(1-smooth(3,6,scale));if(!opacity)continue;
      const seed=level*137+4000;c.save();c.globalAlpha=opacity;c.rotate(rotation+hash(seed+19)*TAU);c.scale(scale,scale*.72);
      c.drawImage(this.texture(level,colors),-300,-300);
      const planets=3+Math.floor(hash(seed+30)*4);
      for(let i=0;i<planets;i++){
        const r=66+i*27,a=t*(.035+i*.006)+hash(seed+i+55)*TAU,x=Math.cos(a)*r,y=Math.sin(a)*r;
        c.strokeStyle=colors[(i+1)%4]+'2a';c.lineWidth=.7;c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();
        const size=3+hash(seed+i+700)*7,g=c.createRadialGradient(x-size*.4,y-size*.4,0,x,y,size);
        g.addColorStop(0,'#f3f9ff');g.addColorStop(.35,colors[i%4]);g.addColorStop(1,'#080d27');ellipse(c,x,y,size,size,g);
        if(i%3===1){c.strokeStyle=colors[i%4]+'b0';c.lineWidth=.8;c.beginPath();c.ellipse(x,y,size*1.9,size*.5,.4,0,TAU);c.stroke();}
      }c.restore();
    }
    // Fine foreground stars drift continuously rather than popping on a modulo boundary.
    for(let i=0;i<55;i++){const a=hash(i+800)*TAU+t*.005,r=50+hash(i+900)*500;ellipse(c,Math.cos(a)*r,Math.sin(a)*r*.55,.6,.6,'#c7eaff88');}
  }
}
