// Local compositing/material vocabulary; each cue owns its cast and choreography.
function spamInk(c,t,d,e){
 const ink=cueInk(c,t,d,e),p=Math.max(0,Math.min(1,t/Math.max(.001,d)));
 const local=(x,y,scale,angle,draw)=>{c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);draw();c.restore();};
 const sprite=(key,index,x,y,size,{angle=0,flip=false,alpha=1,stretch=1}={})=>{
  c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(angle);c.scale(flip?-1:1,stretch);
  spamSprites.draw(c,key,[{source:[index/3,0,1/3,1],target:[-size/2,-size/2,size,size]}],0);c.restore();
 };
 const bubble=(x,y,r,color,alpha=.6)=>{
  ink.disc(x,y,r,r,color+'12',alpha);ink.ring(x,y,r,r,color,1,alpha);
  ink.curve(u=>[x-r*.68+u*r*.72,y-r*.36-Math.sin(u*Math.PI)*r*.41],'#f2ffff',1.2,alpha);
 };
 const burst=(x,y,p,color,n=9,size=42)=>{
  if(p<0||p>1)return;
  for(let j=0;j<n;j++){const a=j*TAU/n+.22,rr=10+p*size;
   ink.line([[x+Math.cos(a)*rr,y+Math.sin(a)*rr],[x+Math.cos(a)*(rr+8),y+Math.sin(a)*(rr+8)]],color,2,(1-p)*.8);
  }
 };
 return {...ink,p,local,sprite,bubble,burst};
}
