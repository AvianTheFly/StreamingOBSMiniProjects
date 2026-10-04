// Staging uses the user's existing gritty spirit paintings without altering them.
import {SpriteMesh} from '/transitions/mesh.js';
import {Parts} from '/transitions/rig.js';
import {atlases} from '/transitions/rigs/atlases.js';
import {shadow, smooth, TAU} from './paint.js';

async function loadParts(name) {
  const image=new Image();image.src=name==='ram'?'/transitions/assets/ram-charge.png':`/transitions/assets/${name}-rig-${name==='turtle'?'v8':'v5'}.png`;await image.decode();
  const parts=new Parts();
  const regions=name==='ram'?[[[0,0],[627,0],[627,627],[0,627]]]:atlases[name].regions;
  parts.cells=regions.map(region=>{
    const full=document.createElement('canvas');full.width=image.width;full.height=image.height;
    const c=full.getContext('2d',{willReadFrequently:true}),scale=image.width/atlases[name].width;
    c.save();c.beginPath();region.forEach(([x,y],i)=>i?c.lineTo(x*scale,y*scale):c.moveTo(x*scale,y*scale));c.closePath();c.clip();c.drawImage(image,0,0);c.restore();
    const data=c.getImageData(0,0,full.width,full.height).data;let x0=full.width,y0=full.height,x1=-1,y1=-1;
    for(let y=0;y<full.height;y++)for(let x=0;x<full.width;x++)if(data[(y*full.width+x)*4+3]>20){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    if(x1<x0)throw new Error(`Missing ${name} painted part`);
    const cut=document.createElement('canvas');cut.width=x1-x0+1;cut.height=y1-y0+1;
    cut.getContext('2d').drawImage(full,x0,y0,cut.width,cut.height,0,0,cut.width,cut.height);
    return {image:cut,w:cut.width,h:cut.height,mesh:new SpriteMesh().fromImage(cut,6,8)};
  });return parts;
}
export class Cast {
  async load(){[this.turtle,this.ram,this.phoenix]=await Promise.all(['turtle','ram','phoenix'].map(loadParts));return this;}
  drawTurtle(c,t,energy,waveAt=-100) {
    const phase=t%13,hello=(1-smooth(4.8,6.2,phase))*smooth(.3,1.2,phase);
    const extra=(1-smooth(4,5,t-waveAt))*smooth(0,.3,t-waveAt),wave=Math.max(hello,extra);
    shadow(c,302,951,144,25);
    const p=this.turtle,breath=Math.sin(t*2.1),settle=breath*.007;
    c.save();c.translate(302,943);c.rotate(Math.sin(t*.8)*.012);c.scale(330,330);
    p.flow(c,0,0,-.345+settle,.83,.69,{angle:breath*.018,bend:breath*.014});
    p.flow(c,1,-.035+breath*.008,-.65+settle,.255,.305,{angle:-.04+Math.sin(t*1.8)*.035,bend:breath*.01});
    p.flow(c,2,.21,-.47+settle,.45,.69,{angle:-.20+breath*.02,ax:.17,ay:.37,bend:breath*.015});
    p.flow(c,3,-.23,-.45+settle,.30,.46,{angle:-.12-wave*.2+Math.sin(t*2.4)*(.035+wave*.08),ax:.76,ay:.18,bend:Math.sin(t*2.4)*.03,ripple:.004,phase:t*4});
    c.restore();return wave;
  }
  drawRam(c,t,energy) {
    const p=this.ram,b=Math.sin(t*TAU*.36);
    shadow(c,1618,951,147,25);
    c.save();c.translate(1620,950);
    p.cells[0].mesh.draw(c,(u,v)=>[(u-.5)*287+Math.sin(v*Math.PI)*b*3*energy,(v-1)*368+Math.sin(t*2.2)*2*(1-v)]);c.restore();
  }

  drawPhoenix(c,t,energy,flyAt=-100) {
    const p=this.phoenix,loop=t%37,extra=t-flyAt;
    const flight=loop>20&&loop<30?(loop-20)/10:extra>=0&&extra<10?extra/10:-1;
    let x=1508,y=227,s=.72;
    if(flight>=0){x-=1100*Math.sin(flight*Math.PI);y-=110*Math.sin(flight*TAU);s+=.25*Math.sin(flight*Math.PI);}
    const flap=Math.sin(t*(flight>=0?6:2.1))*(flight>=0?.42:.10);
    c.save();c.translate(x,y+Math.sin(t*1.3)*4);c.scale(s,s);
    p.flow(c,2,0,25,112,235,{ax:.5,ay:0,bend:Math.sin(t*2)*9,ripple:4,phase:t*2});
    p.draw(c,1,-20,-8,210,151,-.1-flap,.91,.30);
    p.draw(c,1,20,-8,210,151,.1+flap,.91,.30,true);
    p.flow(c,0,0,10,117,170,{angle:Math.sin(t)*.018,ay:.48,bend:Math.sin(t)*2});c.restore();
    return {x,y,flight};
  }
}
