// Water ribbons, splash fans and croak waves share the existing short audio clock.
function frogBorder(c,t,d){
 const p=Math.max(0,Math.min(1,t/d)),power=Math.sin(Math.PI*p)**.7;
 const {line,curve,ring,disc}=cueInk(c,t,d,{});
 const mint='#97efc7',ice='#c1faff',rose='#f3b0d2',gold='#ffe4aa';
 // Broad translucent water currents have narrow silver crests rather than frames.
 for(const bottom of [false,true]){
  const y=bottom?956:123,sign=bottom?-1:1;
  for(let layer=0;layer<3;layer++){
   const wave=u=>[335+u*1247,y+sign*(Math.sin(u*TAU*3-p*TAU*1.7+layer*.7)*9+layer*11)];
   curve(wave,layer%2?mint:ice,12,power*.10);
   curve(wave,layer%2?ice:mint,2.4,power*(.72-layer*.13));
   for(let j=0;j<15;j++){
    const u=(j/15+p*.3)%1,[x,yy]=wave(u);
    disc(x,yy-4,2,1.5,gold,power*.8);
   }
  }
 }
 for(const right of [false,true]){
  const x=right?1884:36,sign=right?-1:1;
  for(let layer=0;layer<3;layer++){
   const stream=u=>[x+sign*(layer*12+Math.sin(u*TAU*3-p*11+layer)*10),194+u*663];
   curve(stream,mint,10,power*.09);curve(stream,layer%2?rose:ice,2.2,power*.6);
  }
 }
 // Four fountain fans fling tiny droplets along the edge and settle back down.
 for(const[x,y,sx,sy]of [[104,167,1,1],[1817,159,-1,1],[117,902,1,-1],[1802,908,-1,-1]]){
  for(let j=0;j<7;j++){
   const age=(p*1.35+j*.093)%1,vx=sx*(15+j*8),vy=sy*(24+j*6);
   const arc=u=>[x+vx*u,y+vy*u-sy*Math.sin(u*Math.PI)*43];
   curve(arc,j%2?mint:ice,1.6,power*(1-age)*.5);
   const[xx,yy]=arc(age);disc(xx,yy,2.2,3.8,ice,power*(1-age)*.8);
  }
 }
 // Outgoing croak rings answer each performer; bubbles catch the light.
 for(const[x,y]of [[101,350],[1813,453],[668,1006],[1288,74]])for(let j=0;j<4;j++){
  const age=(p*1.3+j*.22)%1,r=22+age*94;
  ring(x,y,r,r*.39,j%2?mint:rose,2.1,power*(1-age)*.55,-.08);
 }
 for(let j=0;j<36;j++){
  const age=(p*.9+j*.137)%1,x=340+j*35,y=j%2?1000-age*100:145-age*83;
  ring(x,y,3+age*5,3+age*5,ice,1.4,power*(1-age)*.6);
  if(j%4===0){line([[x-4,y],[x+4,y]],gold,1.6,power*.8);line([[x,y-4],[x,y+4]],gold,1.6,power*.8);}
 }
}
