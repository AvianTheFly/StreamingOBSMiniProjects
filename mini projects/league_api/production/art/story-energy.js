// Bounded, clock-sampled edge choreography. No particle pool or secondary timer.
const ENERGY_VOID=new Set(['void','eye','grubs','thorn','heist']);
const ENERGY_STONE=new Set(['rubble','shatter','waiting','restore']);
export function leagueEdgePoint(side,u,depth=21){
 return side===0?[210+1500*u,depth]:side===1?[1920-depth,145+790*u]:side===2?[1710-1500*u,1080-depth]:[depth,935-790*u];
}
function storyEnergy(c,e){
 const score=leagueScore(e.key);if(!score)return;
 const I=storyInk(c,e),{t,finite,at,line,poly,oval,ring,curve,star}=I,p=Math.min(.86,I.p);
 const [kind,col,accent,beat,,power]=score,m=leagueBeat(p,beat);
 const quiet=!finite,life=quiet?.22:smooth(p/.13);
 const charge=quiet?.32:.25+m.anticipation*.55+m.impact*.7;
 const swell=quiet?0:m.impact;
 c.save();c.globalAlpha*=life;
 // Transparent color wells sit at the corners; the center has no fill or flash.
 for(const [x,y] of [[48,56],[1872,56],[48,1024],[1872,1024]]){
  const r=110+power*32+swell*44,g=c.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,col+'88');g.addColorStop(.42,col+'38');g.addColorStop(1,col+'00');
  c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  at(x,y,1+swell*.16,t*(quiet?.07:.16),()=>{
   for(let j=0;j<4;j++)at(0,0,1,j*Math.PI/2,()=>{
    line([[17,-27],[29,-27],[29,-15]],col,3.3,.9);
    if(ENERGY_VOID.has(kind))poly([[33,-9],[43,0],[33,9],[36,0]],accent+'99',null);
    else if(kind==='concert'||kind==='combo'||kind==='trophy')star(36,0,4+swell*3,accent);
    else oval(34,0,2.5,2.5,accent);
   });
  });
  // The event's semantic crest is set into an open compass, with sweeping fins.
  at(x,y,quiet?.6:1.2,0,()=>{
   ring(0,0,27+swell*7,27+swell*7,col,1.3,.65);
   storyMotif(I,e.key,0,m.payoff);
   for(let j=0;j<3;j++){
    const a=(x>960?Math.PI:0)+(y>540?-1:1)*(.18+j*.22),length=45+j*13+swell*18;
    line([[Math.cos(a)*34,Math.sin(a)*34],[Math.cos(a)*length,Math.sin(a)*length]],j%2?col:accent,2.3,.7);
   }
  });
 }
 for(let side=0;side<4;side++){
  const hue=side%2?accent:col;
  const path=u=>{
   let d=21;
   if(kind==='hextech')d+=Math.round(Math.sin(u*TAU*5))*5;
   else if(kind==='fire')d+=Math.sin(u*39-t*4)*5+Math.sin(u*61+t*2)*3;
   else if(kind==='water'||kind==='air')d+=Math.sin(u*19-t*2+side)*6;
   else if(ENERGY_VOID.has(kind))d+=Math.sin(u*TAU*3-t*1.7)*9;
   else if(kind==='pulse'||kind==='clutch'||kind==='bandage')d+=Math.sin(u*TAU*6)*Math.exp(-(((u*6)%1-.5)**2)*40)*9;
   else d+=Math.sin(u*TAU*2+t*.8+side)*3;
   return leagueEdgePoint(side,u,d);
  };
  curve(path,hue,25+power*5,.08+charge*.055);
  curve(path,hue,7,.25+charge*.25);
  curve(path,'#ecfff9',1.5,.55);
  // A second counter-moving strand gives the frame depth and an authored contour.
  const strand=u=>{const [x,y]=path(u),offset=17+Math.sin(u*TAU*4-t*2+side)*(6+charge*7);return side%2?[x+(side===1?-offset:offset),y]:[x,y+(side===0?offset:-offset)];};
  curve(strand,side%2?col:accent,2.4,.48);
  // Two opposing runners close on the scored contact, then discharge outward.
  for(const dir of [-1,1]){
   const progress=quiet?(t*.07+side*.19)%1:(m.contact?.5+dir*smooth((p-beat)/.35)*.5:.5-dir*(1-smooth((p-.07)/(beat-.07)))*.5);
   for(let j=0;j<15;j++){
    const u=progress-dir*j*.013,v=u-dir*.016;if(u<0||u>1||v<0||v>1)continue;
    line([path(v),path(u)],j<2?'#fff4d3':hue,j<2?4:7,(1-j/15)*.9);
   }
  }
  // Different edge anatomy: crystals, jets, roots, wavelets, riffs or comet quills.
  for(let j=0;j<12;j++){
   const u=.06+j*.08,[x,y]=leagueEdgePoint(side,u,31),phase=p-beat-j*.007;
   const impact=quiet?.18:Math.max(0,1-Math.abs(phase-.04)/.18),reveal=quiet?1:smooth((p-.04-j*.009)/.16);
   at(x,y,reveal,side*Math.PI/2,()=>{
    if(ENERGY_STONE.has(kind)){
     const explode=kind==='rubble'||kind==='shatter',travel=explode?smooth((p-beat)/.22):1-smooth((p-.17)/.47);
     at((j%2?1:-1)*travel*9,travel*17,1,travel*(j%2?.8:-.8),()=>poly([[-7,0],[0,-8-impact*16],[7,0],[0,5]],hue+'80',hue,1));
    }else if(kind==='fire'){
     const flame=7+impact*25+Math.sin(t*3+j)*3;
     poly([[-5,2],[-6,-flame*.4],[0,-flame],[5,-flame*.3],[5,2]],j%2?accent+'c0':col+'a0',null);
    }else if(kind==='water')ring(0,0,9+impact*16,3+impact*4,hue,1.6,.7);
    else if(kind==='earth'||kind==='thorn')poly([[-9,0],[-4,-7],[2,-15-impact*19],[8,-4],[12,0]],hue+'90',hue,1);
    else if(kind==='chemtech'){
     ring(0,-impact*16,3+j%3+impact*5,3+j%3+impact*5,hue,1.5,.8);
     if(j%3===0)line([[-7,4],[0,-3],[7,4]],accent,2,.7);
    }else if(kind==='hextech'){
     poly(Array.from({length:6},(_,n)=>{const a=n*TAU/6;return[Math.cos(a)*(7+impact*6),Math.sin(a)*(7+impact*6)];}),hue+'20',hue,1.5);
    }else if(kind==='concert'){
     line([[-4,4],[-4,-7-impact*25]],hue,4,.85);line([[3,4],[3,-5-impact*16]],accent,3,.8);
    }else if(kind==='air'||kind==='elder'||kind==='spirits'){
     curve(v=>[-12+24*v,Math.sin(v*Math.PI)*(5+impact*12)],hue,1.8,.8);
     if(j%3===0)star(0,-8-impact*10,4,accent,t*.2);
    }else if(ENERGY_VOID.has(kind)){
     curve(v=>[-9+18*v,-Math.sin(v*Math.PI)*(12+impact*17)],hue,2,.8);
     oval(0,-4-impact*8,2,3,accent);
    }else{
     if(j%3===0)at(0,-9-impact*8,.5+impact*.18,0,()=>storyMotif(I,e.key,j,reveal));
     else line([[-5,0],[0,-5-impact*14],[5,0]],hue,1.7,.75);
    }
   });
  }
 }
 // Readable event naming has a small ink edge, not an opaque notification card.
 if(finite&&e.title){
  const appear=smooth((p-.08)/.13),kick=m.recoil*3;
  c.save();c.globalAlpha*=appear;
  c.font=`900 ${power>=1.6?34:28}px "Segoe UI",sans-serif`;c.textAlign='center';c.textBaseline='middle';
  c.lineJoin='round';c.strokeStyle='#101b30bb';c.lineWidth=5;
  c.strokeText(e.title,960,132-kick,690);c.fillStyle='#fff3d5';c.fillText(e.title,960,132-kick,690);
  const w=Math.min(338,c.measureText(e.title).width/2+25);
  for(const dir of [-1,1]){
   line([[960+dir*(w+12),132],[960+dir*(w+69),132],[960+dir*(w+86),115],[960+dir*(w+119+charge*20),115]],dir<0?col:accent,3,.9);
   star(960+dir*(w+102),132,5+m.impact*4,dir<0?col:accent);
  }
  c.restore();
 }
 c.restore();
}
