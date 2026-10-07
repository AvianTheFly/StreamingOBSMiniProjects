// Stateless native drawing tools. Cue owners supply every subject and movement.
function cultureInk(c,t,d,e={}){
 const p=Math.max(0,Math.min(1,t/Math.max(.001,d))),tau=Math.PI*2;
 const key=e.scene||e.style||'muffins',data=CULTURE_TIMING[key];
 const sample=(q)=>{if(!data)return .4;const x=Math.max(0,Math.min(data.envelope.length-1,q*(data.envelope.length-1))),i=Math.floor(x),v=x-i;return data.envelope[i]*(1-v)+(data.envelope[Math.min(i+1,data.envelope.length-1)]||0)*v;};
 const sound=sample(p),beat=(t-(data?.offset||0))*(data?.bpm||e.bpm||120)/60;
 const local=(x,y,s,a,fn)=>{c.save();c.translate(x,y);c.rotate(a);c.scale(s,s);fn();c.restore();};
 const line=(pts,col,w=2,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();};
 const shape=(pts,col,stroke='#18253a',w=2)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=col;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.lineJoin='round';c.stroke();}};
 const disc=(x,y,rx,ry,col,stroke=null,w=2)=>{c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,tau);c.fillStyle=col;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}};
 const box=(x,y,w,h,r,col,stroke=null)=>{c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=col;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}};
 const ring=(x,y,rx,ry,col,w=2,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.beginPath();c.ellipse(x,y,rx,ry,0,0,tau);c.lineWidth=w;c.strokeStyle=col;c.stroke();c.restore();};
 const word=(text,x,y,col,size=22,font='"Trebuchet MS"',angle=0)=>local(x,y,1,angle,()=>{c.font=`900 ${size}px ${font},sans-serif`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='#152135';c.strokeText(text,0,0);c.fillStyle=col;c.fillText(text,0,0);});
 const sheen=(x,y,w,h,col)=>{const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,'#fff6e9');g.addColorStop(.28,col);g.addColorStop(.65,col);g.addColorStop(1,'#24314d');return g;};
 const fade=(a,b,w=.055)=>smooth((p-a)/w)*smooth((b-p)/w);
 const event=(a,b,fn)=>{const f=fade(a,b);if(f<=0)return;c.save();c.globalAlpha*=f;fn(smooth((p-a)/Math.max(.001,b-a)));c.restore();};
 const curve=(fn,col,w=2,alpha=1)=>line(Array.from({length:49},(_,i)=>fn(i/48)),col,w,alpha);
 const wake=(fn,head,col,w=3,tail=.2)=>{for(let j=0;j<24;j++){const u=head-tail*(1-j/24),v=head-tail*(1-(j+1)/24);if(u<0||v>1)continue;line([fn(u),fn(v)],col,w,(j/24)**2*.8);}if(head>0&&head<1){const[x,y]=fn(head);disc(x,y,2.4,2.4,'#fffde3');}};
 const sparkle=(x,y,r,col,a=0)=>local(x,y,1,a,()=>{shape([[0,-r],[r*.22,-r*.22],[r,0],[r*.22,r*.22],[0,r],[-r*.22,r*.22],[-r,0],[-r*.22,-r*.22]],col,null);});
 const burst=(x,y,age,col,count=8,r=65)=>{if(age<0||age>1)return;c.save();c.globalAlpha*=(1-age)**2;for(let j=0;j<count;j++){const a=j*tau/count;const rr=12+age*r;line([[x+Math.cos(a)*rr,y+Math.sin(a)*rr],[x+Math.cos(a)*(rr+9),y+Math.sin(a)*(rr+9)]],col,2.5);}c.restore();};
 const roundPath=q=>{const points=[[340,67],[1577,67],[1846,250],[1846,786],[1568,1029],[350,1029],[84,784],[84,256],[340,67]],u=Math.max(0,Math.min(1,q))*8,i=Math.min(7,Math.floor(u)),v=u-i;return {x:points[i][0]+(points[i+1][0]-points[i][0])*v,y:points[i][1]+(points[i+1][1]-points[i][1])*v,a:Math.atan2(points[i+1][1]-points[i][1],points[i+1][0]-points[i][0])};};
 return{c,t,d,e,p,tau,key,sound,beat,local,line,shape,disc,box,ring,word,sheen,fade,event,curve,wake,sparkle,burst,roundPath};
}
