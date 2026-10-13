// Flat storybook geometry. Event owners supply subjects, blocking and choreography.
// All motion reconstructs from the director's elapsed time; no mutable simulation.
export function leagueStoryProgress(elapsed,duration){
 // Finish the scored act in 74% of the personal duration; reserve a readable hold.
 return Number.isFinite(duration)?Math.min(1,Math.max(0,elapsed)/Math.max(.001,duration*.74)):0;
}
function storyInk(c,e){
 const elapsed=Math.max(0,e.elapsed||0),finite=Number.isFinite(e.duration),p=leagueStoryProgress(elapsed,e.duration),t=storySettledTime(elapsed,e.duration);
 const at=(x,y,s,a,fn)=>{c.save();c.translate(x,y);c.rotate(a);c.scale(s,s);fn();c.restore();};
 const line=(pts,col,w=2,a=1)=>{c.save();c.globalAlpha*=a;c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();};
 const poly=(pts,col,outline='#344459',w=2)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=col;c.fill();if(outline){c.strokeStyle=outline;c.lineWidth=w;c.lineJoin='round';c.stroke();}};
 const oval=(x,y,rx,ry,col,outline=null)=>{c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);c.fillStyle=col;c.fill();if(outline){c.strokeStyle=outline;c.lineWidth=2;c.stroke();}};
 const ring=(x,y,rx,ry,col,w=2,a=1)=>{c.save();c.globalAlpha*=a;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.strokeStyle=col;c.lineWidth=w;c.stroke();c.restore();};
 const box=(x,y,w,h,col,r=6)=>{c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=col;c.fill();c.strokeStyle='#344459';c.lineWidth=2;c.stroke();};
 const curve=(fn,col,w=2,a=1)=>line(Array.from({length:33},(_,j)=>fn(j/32)),col,w,a);
 const star=(x,y,r,col,angle=0)=>at(x,y,1,angle,()=>poly(Array.from({length:10},(_,j)=>{const a=-Math.PI/2+j*TAU/10,rr=j%2?r*.46:r;return[Math.cos(a)*rr,Math.sin(a)*rr];}),col));
 const heart=(x,y,s,col)=>at(x,y,s,0,()=>{c.beginPath();c.moveTo(0,14);c.bezierCurveTo(-32,-5,-12,-29,0,-13);c.bezierCurveTo(12,-29,32,-5,0,14);c.fillStyle=col;c.fill();c.strokeStyle='#344459';c.lineWidth=2;c.stroke();});
 const face=(x,y,mood='happy',size=1)=>at(x,y,size,0,()=>{for(const s of [-1,1]){if(mood==='sleep')line([[s*5-2,-2],[s*5+2,-2]],'#344459',2);else oval(s*5,-2,1.7,2.4,'#344459');}curve(u=>[-5+u*10,5+(mood==='sad'?-1:1)*Math.sin(u*Math.PI)*3],'#344459',1.7);});
 const puff=(x,y,s,col)=>at(x,y,s,0,()=>{oval(-18,1,18,13,col);oval(0,-8,21,19,col);oval(22,3,19,12,col);});
 const burst=(x,y,q,col,r=42)=>{if(q<=0||q>=1)return;c.save();c.globalAlpha*=(1-q)**2;for(let j=0;j<7;j++){const a=j*TAU/7;line([[x+Math.cos(a)*(12+q*r),y+Math.sin(a)*(12+q*r)],[x+Math.cos(a)*(22+q*r),y+Math.sin(a)*(22+q*r)]],col,3);}c.restore();};
 const sprout=(x,y,q,col)=>{curve(u=>[x+Math.sin(u*3+t*.6)*8*q,y-u*66*q],col,3);for(const s of [-1,1])at(x+s*12*q,y-32*q,q,s*.55,()=>oval(0,0,16,6,col));};
 const coin=(x,y,s=1)=>at(x,y,s,Math.sin(t*2)*.12,()=>{oval(0,0,12,12,'#e9c981','#766453');ring(0,0,8,8,'#af895f',1);line([[-2,-5],[2,-5],[-2,5],[2,5]],'#766453',2);});
 const bean=(x,y,s,col,step=0)=>at(x,y,s,0,()=>{for(const side of [-1,1])line([[side*8,15],[side*(11+step*4),24-side*step*5]],'#52697c',4);oval(0,4,15,18,col,'#344459');poly([[-16,-7],[-11,-20],[11,-20],[16,-7]],col);face(0,1);});
 // Two open edge phrases: paper contours, with actual alpha, no glare or plates.
 const trim=(col,kind='leaf',amount=1)=>{
  c.save();c.globalAlpha*=.52*amount;
  for(const bottom of [0,1]){const y=bottom?1050:49;curve(u=>[330+u*1260,y+Math.sin(u*TAU*2+t*.6)*8],col,2);for(let j=0;j<13;j++){const x=357+j*98;at(x,y+Math.sin(j*.4+t*.6)*8,.55,Math.sin(t*.5+j)*.14,()=>{if(kind==='star')star(0,0,8,col);else if(kind==='stone')poly([[-9,0],[-3,-9],[9,-4],[6,7],[-4,9]],col);else oval(0,0,12,4,col);});}}
  for(const x of [24,1896])curve(u=>[x+Math.sin(u*13+t*.5)*7,190+u*630],col,3,.55);
  c.restore();
 };
 return {c,e,t,p,finite,at,line,poly,oval,ring,box,curve,star,heart,face,puff,burst,sprout,coin,bean,trim};
}
export function structureChoreography(p,restore=false){
 const grow=smooth(p/.28),crush=smooth((p-.39)/.21),settle=smooth((p-.65)/.19),join=smooth((p-.12)/.52);
 return {grow,crush,settle,join,spread:restore?(1-join)*57:crush*46,height:restore?.3+.7*join:(.12+.88*grow)*(1-.85*crush)};
}
export function storySettledTime(elapsed,duration){return Number.isFinite(duration)?Math.min(Math.max(0,elapsed),duration*.86):Math.max(0,elapsed);}
export function spiritChoreography(p,index){
 const wake=smooth((p-.05-index*.055)/.24),rise=smooth((p-.26-index*.04)/.28);
 return {wake,rise,scale:.68+.32*wake,lift:rise*28,closed:1-wake};
}
