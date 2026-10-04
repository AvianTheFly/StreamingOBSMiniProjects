// Eight distinct event environments. Follower art never calls this renderer.
function celebrationFrame(c,theme,t,duration,mode,a,b){
 const w=new WorldPaint(c),p=t/duration,cheer=mode==='cheer',z=smooth(p);
 const line=(fn,col=a,width=1,alpha=.6)=>w.line(fn,col,width,alpha);
 const light=(fn,col=a,j=0,width=2)=>w.light(fn,(t*.09+j)%1.35,col,width,.27,.85);
 const arc=(x,y,rx,ry,a=0,b=TAU)=>u=>[x+Math.cos(a+u*(b-a))*rx,y+Math.sin(a+u*(b-a))*ry];
 const poly=(pts,col,alpha=.8)=>{c.save();c.globalAlpha*=alpha;c.fillStyle=col;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.restore();};
 const wash=(draw,col,axis,alpha=.6)=>{c.save();c.globalAlpha*=alpha;const g=c.createLinearGradient(...axis);g.addColorStop(0,col+'db');g.addColorStop(.4,col+'61');g.addColorStop(1,col+'00');c.fillStyle=g;c.beginPath();draw(c);c.fill();c.restore();};
 c.save();
 if(theme==='crab'){
  // Sea-pearl bubbles and fan-shell caustics; different from Soundboard's reef.
  for(let j=0;j<11;j++){const y=204+j*42,rx=19+j%3*7;for(let n=0;n<3;n++)line(arc(cheer?1909:7,y,rx+n*3,rx*.7+n*3),n===1?b:a,.9,.4);}
  for(let j=0;j<15;j++){const x=351+j*85;w.petal(x,8+Math.sin(j*.7+t*.24)*12,6+j%3,j%2?a:b,j*.5,.75);}
  for(let j=0;j<5;j++)light(u=>[365+u*1160,1064+Math.sin(u*14-t*.2+j*.5)*9],j%2?a:b,j*.17,1.6);
 }else if(theme==='dragon'){
  // Dark silk canopy, hanging lantern cords and drifting amber cinders.
  for(let j=0;j<7;j++){const x=338+j*183;wash(q=>{q.moveTo(x,0);q.quadraticCurveTo(x+80,46+j%2*12,x+167,0);},j%2?a:'#9b677f',[0,0,0,67],.56);line(u=>[x+24+Math.sin(u*3+t*.2)*5,u*(18+j%3*12)],b,.7,.6);}
  for(let j=0;j<8;j++){const fn=u=>[13+j*5+Math.sin(u*7+t*.18+j*.2)*11,187+u*479];line(fn,a,2,.22);light(fn,b,j*.14,1.4);}
  for(let j=0;j<29;j++){const age=(t*.07+j*.618)%1;w.mote(1890+Math.sin(age*5+j)*24,666-age*481,1+j%3*.5,b,Math.sin(age*Math.PI)*.8);}
 }else if(theme==='cat'){
  // Celestial window: a tilted orbital ellipse and scattered moving star lenses.
  for(let j=0;j<4;j++)line(arc(1949,407,58+j*13,107+j*31,1.64,4.62),j%2?a:b,1,.45);
  for(let j=0;j<35;j++){const side=j%3===0,x=side?22+Math.sin(j)*18:356+(j*101)%1190,y=side?192+(j*59)%457:12+Math.sin(j*.4+t*.2)*13;w.star(x,y,1+j%3,j%2?a:b,.25+.5*Math.sin(t*.31+j)**2);}
  for(let j=0;j<3;j++)light(u=>[370+u*1140,1068-Math.sin(u*Math.PI)*(11+j*7)],j%2?a:b,j*.23,1.4);
 }else if(theme==='frog'){
  // Pond reeds, lotus petals and soft translucent ripples grow at unequal edges.
  for(let j=0;j<14;j++){const x=j%4*9,y=674-j*31;line(u=>[x+Math.sin(u*2.3+t*.2+j)*18,683-u*(50+j*24)],a,1.1,.65);w.petal(x+10,y,11+j%3,j%3?a:b,-.4+Math.sin(t*.23+j)*.08,.7);}
  for(let j=0;j<8;j++)line(arc(1930,444,42+j*5,62+j*22,1.67,4.55),a,1.1,.6-j*.05);
  for(let j=0;j<19;j++){const x=372+j*62;w.petal(x,11+Math.sin(j)*6,7,b,j*.3,.7);}
 }else if(theme==='bear'){
  // Arctic light refracts inside slanted ice shelves; quiet snow crosses behind.
  for(let j=0;j<9;j++){const y=187+j*54;wash(q=>{q.moveTo(0,y);q.lineTo(58,y-18);q.lineTo(35,y+36);q.lineTo(0,y+43);},a,[0,0,71,0],.63);w.beam([[0,y],[58,y-18],[35,y+36]],'#eefbfa',.8,.64);}
  for(let j=0;j<23;j++){const age=(t*.055+j*.618)%1;w.star(1893+Math.sin(j+age*3)*24,180+age*485,1+j%3,a,Math.sin(age*Math.PI)*.7);}
  for(let j=0;j<7;j++)line(u=>[354+u*1200,16+Math.sin(u*8+t*.17+j*.2)*10+j*2],j%3?a:b,.7,.4);
 }else if(theme==='turtle'){
  // Moss-green shell tessellation curls into a living grove along one side.
  for(let j=0;j<14;j++){const y=187+j*35,x=6+j%2*17;poly([[x,y],[x+13,y-6],[x+27,y+3],[x+22,y+22],[x+5,y+27],[x-6,y+14]],j%3?'#345445':a,.65);w.beam([[x,y],[x+13,y-6],[x+27,y+3]],b,.8,.8);}
  for(let j=0;j<13;j++){const y=219+j*34;w.petal(1905-j%3*8,y,12,a,2.6,.7);}for(let j=0;j<18;j++)w.petal(365+j*65,11+Math.sin(j)*6,6,b,-.3,.8);
 }else if(theme==='ram'){
  // Warm sculptural horn spiral, fine aged-bronze rings and floating wool wisps.
  const spiral=u=>{const r=4+u*64;return[-9+Math.cos(u*TAU*2.2+t*.06)*r,413+Math.sin(u*TAU*2.2+t*.06)*r*1.8];};line(spiral,'#806650',8,.74);line(spiral,b,1,.85);light(spiral,a,0,2);
  for(let j=0;j<13;j++){const y=204+j*35;w.mist(1909,y,31,16,b,.13);w.petal(1899,y,6,b,j*.5,.6);}for(let j=0;j<21;j++)line(arc(365+j*58,0,21,13,0,Math.PI),a,1.2,.6);
 }else if(theme==='phoenix'){
  // Individual ember feathers unfurl diagonally, then dissolve into warm light.
  for(let j=0;j<18;j++){const y=181+j*27;w.petal(15+j%3*11,y,19-j%4,a,-.61+Math.sin(t*.22+j)*.08,.82);}
  for(let j=0;j<7;j++){const fn=u=>[1908-j*8+Math.sin(u*9+t*.18+j)*10,665-u*482];line(fn,j%2?a:b,.8,.28);light(fn,b,j*.14,1.8);}
  for(let j=0;j<29;j++){const age=(t*.1+j*.618)%1;w.mote(371+j*40,6+age*36,1+j%2,b,Math.sin(age*Math.PI)*.7);}
 }
 c.restore();
}
