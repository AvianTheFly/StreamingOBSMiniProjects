// Public mechanics for painted environments. Feature owners supply all art,
// landmarks, deformation fields, casts and rhythm weights. No timers/workers.
export const TAU=Math.PI*2;
export const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
export function ellipse(c,x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();}
export function glow(c,x,y,r,color,alpha=1){c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color+'00');ellipse(c,x,y,r,r,g);c.restore();}
export class AmbientClock {
  constructor(catalog,seed=1){this.catalog=catalog;this.seed=seed;this.cache=new Map();}
  plan(window){
    if(this.cache.has(window))return this.cache.get(window);
    const events=[],recent=[];let at=0,i=0;
    while(at<60&&i<60){
      const seed=this.seed+window*97.61+i*173.3,pressure=events.reduce((n,e)=>n+(at-e.offset<e.life?e.impact:0),0);
      at+=(1.5+hash(seed)*4.5)*(1+Math.max(0,pressure-1.3)*.65);if(at>=60)break;
      const pool=this.catalog.map(e=>({e,w:e.weight*(recent.includes(e.id)?.12:1)*Math.exp(-Math.max(0,pressure-.7)*e.impact)}));let pick=hash(seed+17)*pool.reduce((n,x)=>n+x.w,0),spec=pool.at(-1).e;
      for(const x of pool){pick-=x.w;if(pick<=0){spec=x.e;break;}}
      events.push({...spec,kind:spec.id,seed,id:`ambient:${this.seed}:${window}:${i}`,offset:at,started:window*60+at});recent.push(spec.id);if(recent.length>4)recent.shift();i++;
    }
    this.cache.set(window,events);if(this.cache.size>4)this.cache.delete(this.cache.keys().next().value);return events;
  }
  active(t){const w=Math.floor(t/60);return [...this.plan(w-1),...this.plan(w)].filter(e=>t>=e.started&&t<e.started+e.life);}
  dispose(){this.cache.clear();}
}
function triangle(c,image,source,target){
  const [s0,s1,s2]=source,[d0,d1,d2]=target,ux=s1[0]-s0[0],uy=s1[1]-s0[1],vx=s2[0]-s0[0],vy=s2[1]-s0[1],det=ux*vy-uy*vx;
  const ax=((d1[0]-d0[0])*vy-(d2[0]-d0[0])*uy)/det,cx=((d2[0]-d0[0])*ux-(d1[0]-d0[0])*vx)/det;
  const ay=((d1[1]-d0[1])*vy-(d2[1]-d0[1])*uy)/det,cy=((d2[1]-d0[1])*ux-(d1[1]-d0[1])*vx)/det;
  c.save();const mx=(d0[0]+d1[0]+d2[0])/3,my=(d0[1]+d1[1]+d2[1])/3;c.beginPath();
  for(const [x,y] of target){const distance=Math.hypot(x-mx,y-my)||1;c.lineTo(x+(x-mx)/distance*.6,y+(y-my)/distance*.6);}c.closePath();c.clip();
  c.transform(ax,ay,cx,cy,d0[0]-ax*s0[0]-cx*s0[1],d0[1]-ay*s0[0]-cy*s0[1]);c.drawImage(image,0,0);c.restore();
}
export class PaintedPatch {
  constructor(image,rect,cols=8,rows=6){
    this.rect=rect;this.cols=cols;this.rows=rows;const [x,y,w,h]=rect;
    this.image=document.createElement('canvas');this.image.width=w;this.image.height=h;this.image.getContext('2d').drawImage(image,x,y,w,h,0,0,w,h);
    this.vertices=[];for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++)this.vertices.push([col*w/cols,row*h/rows]);
  }
  draw(c,deform){
    const [x,y,w,h]=this.rect,projected=this.vertices.map(([px,py])=>{const [dx,dy]=deform(px/w,py/h);return [px+dx,py+dy];});c.save();c.translate(x,y);
    for(let row=0;row<this.rows;row++)for(let col=0;col<this.cols;col++){const p=row*(this.cols+1)+col,q=p+1,r=p+this.cols+1,s=r+1;for(const ids of [[p,q,s],[p,s,r]])triangle(c,this.image,ids.map(i=>this.vertices[i]),ids.map(i=>projected[i]));}c.restore();
  }
  dispose(){this.image.width=this.image.height=1;this.vertices=[];}
}
