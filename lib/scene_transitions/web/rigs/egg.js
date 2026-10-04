// Phoenix anticipation prop: intact shell, then deterministic irregular fragments.
import {SpriteMesh} from '../mesh.js';
import {rng,clamp,smooth} from '../math.js';
export class Egg {
 async load(image=null){
  this.art=image?new SpriteMesh().fromImage(image,12,16):await new SpriteMesh().load('phoenix-egg');
  const random=rng(473),cols=5,rows=6;
  const points=Array.from({length:rows+1},(_,y)=>Array.from({length:cols+1},(_,x)=>[
   x/cols+(x&&x<cols?(random()-.5)*.10:0)-.5,
   y/rows+(y&&y<rows?(random()-.5)*.08:0)-1]));
  this.shards=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)for(const p of [
   [points[y][x],points[y][x+1],points[y+1][x]],
   [points[y+1][x+1],points[y+1][x],points[y][x+1]]]){
   this.shards.push({p,x:p.reduce((n,v)=>n+v[0],0)/3,y:p.reduce((n,v)=>n+v[1],0)/3,spin:(random()-.5)*3,weight:.6+random(),delay:random()*.10});
  }return this;
 }
 draw(c,x,y,size,t,alpha){
  const age=Math.max(0,t-1.12),rattle=Math.sin(t*39)*Math.max(0,t-.65)*.016;
  c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(rattle);c.scale(size,size);
  if(!age)this.art.draw(c,(u,v)=>[(u-.5)*(1+Math.sin(t*10)*.012),v-1]);
  else {
   // Two large jagged shell halves remain readable beneath the hatchling.
   // Separation eases into a landed pose before the fragments fade to ash.
   const split=smooth(0,.30,age),settle=smooth(.16,.65,age);
   for(const side of [-1,1]){c.save();c.translate(side*split*.30,settle*.15);c.rotate(side*split*.32);
    c.beginPath();const seam=[[-.04,-1],[.08,-.88],[-.06,-.72],[.06,-.58],[-.08,-.42],[.035,-.25],[-.035,-.10],[.01,0]];
    c.moveTo(side<0?-.6:.6,-1.08);for(const p of seam)c.lineTo(...p);c.lineTo(side<0?-.6:.6,.10);c.closePath();c.clip();
    c.drawImage(this.art.image,-.5,-1,1,1);c.restore();
   }
   // A few flecks fly free; the bulk of the shell stays in its two halves.
   for(const s of this.shards.filter((_,i)=>i%9===0)){
    const d=Math.max(0,age-s.delay),dx=s.x*d*2.6*s.weight,dy=-d*.7+d*d*1.15;
    c.save();c.globalAlpha*=clamp(1-d/.75)*.7;c.translate(s.x+dx,s.y+dy);c.rotate(s.spin*d);c.translate(-s.x,-s.y);
    c.beginPath();s.p.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.clip();c.drawImage(this.art.image,-.5,-1,1,1);c.restore();
   }
  }c.restore();
 }
}
