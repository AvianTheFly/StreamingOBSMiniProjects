// Shared geometry/materials. Every spirit owns its actual coverage mask.
import {rng,clamp,TAU} from './math.js';
import {polygon} from './fx.js';
export function hexMesh(seed,r=82){
 const random=rng(seed),cells=[],dy=r*Math.sqrt(3);
 for(let col=-1;col<18;col++)for(let row=-1;row<10;row++){
  const x=col*r*1.5,y=row*dy+(col%2)*dy/2;
  const points=Array.from({length:6},(_,i)=>[x+Math.cos(i*TAU/6)*r,y+Math.sin(i*TAU/6)*r]);
  cells.push({x,y,points,delay:random()*.58+Math.hypot(x-960,y-540)/1300*.28,
   vx:(random()-.5)*360,vy:150+random()*240,spin:(random()-.5)*2,shade:random()});
 }return cells;
}
export function panel(spec,seed){
 const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
 const c=canvas.getContext('2d'),g=c.createRadialGradient(960,540,0,960,540,1200);
 g.addColorStop(0,spec.dark);g.addColorStop(.5,spec.dark);g.addColorStop(1,'#030a10');
 c.fillStyle=g;c.fillRect(0,0,1920,1080);const random=rng(seed);c.globalAlpha=.05;
 for(let i=0;i<10000;i++){c.fillStyle=i%2?spec.color:'#000';c.fillRect(random()*1920,random()*1080,random()*6+1,random()*3+1);}
 return canvas;
}
export function drawCells(c,texture,cells,elapsed,{speed=1,shrink=false}={}){
 for(const cell of cells){const d=Math.max(0,elapsed-cell.delay),fade=1-clamp((d-.6)/.5);if(fade<=0)continue;
  c.save();c.globalAlpha=fade;c.translate(cell.x+(cell.vx??(cell.x-960)*2)*d*speed,
   cell.y+(cell.vy??(cell.y-540)*2)*d*speed+d*d*430);c.rotate(cell.spin*d);
  const scale=shrink?Math.max(.05,1-d*.48):1+d*.28;c.scale(scale,scale);c.translate(-cell.x,-cell.y);
  polygon(c,cell.points);c.clip();c.drawImage(texture,0,0);c.strokeStyle='#c9d1b9';c.lineWidth=.8;c.stroke();c.restore();
 }
}
export function diagonalBand(c,center,width,progress=1){
 if(width<=0||progress<=0)return;const y=-160+progress*1420,slope=.74;
 polygon(c,[[center-width/2,-160],[center+width/2,-160],
  [center+slope*(y+160)+width/2,y],[center+slope*(y+160)-width/2,y]]);c.fill();
}
