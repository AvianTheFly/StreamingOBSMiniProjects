// Local material vocabulary; performances own subjects/routes and the clock.
function partyInk(c,t,duration){
 const p=t/Math.max(.1,duration),o=new Optics(c),w=new WorldPaint(c);
 const line=(pts,color,width=1,alpha=.7)=>o.line(pts,color,width,alpha);
 const curve=(fn,color,width=1,alpha=.5)=>o.curve(fn,color,width,alpha);
 const disc=(x,y,rx,ry,color,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();c.restore();};
 const poly=(pts,color,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.fillStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.restore();};
 const path=(draw,color,alpha=1,outline='#dbf9ff')=>{c.save();c.globalAlpha*=alpha;c.beginPath();draw(c);c.fillStyle=color;c.fill();if(outline){c.strokeStyle=outline;c.lineWidth=.8;c.stroke();}c.restore();};
 const metal=(axis,colors=['#edfbff','#698b9d','#102635','#89bfcd'])=>{const g=c.createLinearGradient(...axis);colors.forEach((col,i)=>g.addColorStop(i/(colors.length-1),col));return g;};
 const local=(x,y,size,turn,draw)=>{c.save();c.translate(x,y);c.rotate(turn);c.scale(size/100,size/100);draw();c.restore();};
 const sweep=(fn,color,offset=0,width=2)=>o.light(fn,p*1.35-offset,color,width,.22,.95);
 const ribbon=(fn,color,second,width=16,phase=t)=>o.ribbon(fn,{color,secondary:second,width,phase,glass:true,alpha:.7});
 const ring=(x,y,rx,ry,color,alpha=.5,turn=0)=>o.arc(x,y,rx,ry,0,TAU,color,1,alpha,turn);
 const foil=(x,y,size,color,turn=0)=>o.shard(x,y,size,color,p,turn,true);
 // Absolute serial births develop through the cue, with no independent loop.
 const births=(count,first,gap,life,draw)=>{for(let j=0;j<count;j++){const age=t-first-j*gap;if(age<0||age>=life)continue;const u=age/life;c.save();c.globalAlpha*=smooth(u/.12)*smooth((1-u)/.24);draw(u,j,age);c.restore();}};
 return {c,t,p,o,w,line,curve,disc,poly,path,metal,local,sweep,ribbon,ring,foil,births};
}
