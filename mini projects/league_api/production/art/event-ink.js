// Local material and path tools. Event owners supply all subjects and staging.
function eventInk(c,e){
 const w=new WorldPaint(c),o=w.o,t=e.elapsed||0,finite=Number.isFinite(e.duration),p=finite?Math.max(0,Math.min(1,t/Math.max(.1,e.duration))):.4;
 const line=(pts,color,width=1,alpha=.7)=>w.beam(pts,color,width,alpha);
 const poly=(pts,fill,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.fillStyle=fill;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.restore();};
 const metal=(axis,colors)=>{const g=c.createLinearGradient(...axis);colors.forEach((color,i)=>g.addColorStop(i/(colors.length-1),color));return g;};
 const place=(x,y,s,angle,draw,delay=0)=>{const arrive=finite?smooth((p-delay)/.15):smooth(t/1.2);c.save();c.globalAlpha*=arrive;c.translate(x,y+(1-arrive)*12);c.rotate(angle);c.scale(s,s);draw();c.restore();};
 const arc=(x,y,rx,ry,a=0,b=TAU)=>u=>[x+Math.cos(a+u*(b-a))*rx,y+Math.sin(a+u*(b-a))*ry];
 const wake=(path,color,delay=0,width=2,tail=.22,rate=.16)=>{w.line(path,color,.7,.27);w.light(path,finite?p*1.3-delay:(t*rate-delay)%1.4,color,width,tail,.95);};
 const shard=(x,y,size,color,angle=0,glass=true)=>o.shard(x,y,size,color,finite?p:t*.08,angle,glass);
 const ring=(x,y,rx,ry,color,width=1,alpha=.7,turn=0)=>o.arc(x,y,rx,ry,0,TAU,color,width,alpha,turn);
 // Absolute particle births make long-lived atmosphere develop without resets.
 const motes=(count,lifetime,spacing,draw)=>{const last=Math.floor(t/spacing);for(let serial=Math.max(0,last-count+1);serial<=last;serial++){const age=t-serial*spacing;if(age<0||age>lifetime)continue;const seed=((serial*2654435761)>>>0)/4294967296;draw(age/lifetime,serial,seed,Math.sin(age/lifetime*Math.PI));}};
 return {c,w,o,t,p,finite,line,poly,metal,place,arc,wake,shard,ring,motes};
}
