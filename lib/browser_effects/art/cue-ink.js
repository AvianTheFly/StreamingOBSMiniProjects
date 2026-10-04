// Local paint mechanics. Subject geometry and composition belong to each cue.
function cueInk(c,t,d,e){
 const p=t/Math.max(.1,d),beat=t*(e.bpm||110)/60;
 const line=(pts,col,width=1,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.strokeStyle=col;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();};
 const poly=(pts,col,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.fillStyle=col;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.restore();};
 const disc=(x,y,rx,ry,col,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();c.restore();};
 const curve=(fn,col,width=1,alpha=1)=>line(Array.from({length:44},(_,i)=>fn(i/43)),col,width,alpha);
 const halo=(x,y,r,col,alpha=.3)=>{c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col+'90');g.addColorStop(.38,col+'28');g.addColorStop(1,col+'00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();};
 const light=(fn,col,phase=0,speed=.23,width=2)=>{const u=(t*speed+phase)%1.4;for(let i=0;i<24;i++){const a=u-.23+i*.23/24,b=a+.23/24;if(a>=0&&b<=1)line([fn(a),fn(b)],col,width,(i/24)**2*.8);}if(u>0&&u<1){const[x,y]=fn(u);halo(x,y,16,col,.4*Math.sin(u*Math.PI));disc(x,y,1.6,1.6,'#edffff',Math.sin(u*Math.PI));}};
 const metal=(axis,colors=['#e7f5f6','#7c9baa','#d7e8e9','#3e596b'])=>{const g=c.createLinearGradient(...axis);colors.forEach((color,i)=>g.addColorStop(i/(colors.length-1),color));return g;};
 const ring=(x,y,rx,ry,col,width=1,alpha=1,turn=0)=>curve(u=>{const a=u*TAU;return[x+Math.cos(a)*rx*Math.cos(turn)-Math.sin(a)*ry*Math.sin(turn),y+Math.cos(a)*rx*Math.sin(turn)+Math.sin(a)*ry*Math.cos(turn)];},col,width,alpha);
 const text=(s,x,y,color,size=25)=>{c.save();c.translate(x,y);c.transform(1,0,-.12,1,0,0);c.font=`${size}px Impact,sans-serif`;c.textAlign='center';c.fillStyle=color;c.fillText(s,0,0);c.restore();};
 return{c,t,p,beat,line,poly,disc,curve,halo,light,metal,ring,text};
}
