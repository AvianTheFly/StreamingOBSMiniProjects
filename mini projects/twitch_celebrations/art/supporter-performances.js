// Four den/grove/forge/flock stories, with separately staged gifting acts.
function supporterPerformance(c,theme,t,duration,gift,seed){
 const i=partyInk(c,t,duration),s=partyProps(i),{p,o,w,line,curve,disc,poly,path,metal,local,sweep,ribbon,ring,foil,births}=i;
 const arrive=smooth((t-.15)/.55),spread=smooth((t-.65)/1.35);
 if(theme==='bear'){
  const a='#92ddff',b='#c4b7ff',gold='#f5d39d';
  // Thunder is a series of little branching deliveries, never a screen flash.
  for(let side=0;side<2;side++)for(let j=0;j<3;j++){
   const x=side?1894-j*15:26+j*19,sign=side?-1:1;
   const route=pathOf([[x,210],[x+sign*35,321],[x-sign*9,386],[x+sign*42,519],[x+sign*14,666],[x+sign*37,861],[x,1009]]);
   curve(route,a,.8,.25);sweep(route,j%2?a:b,j*.1,1.8);
  }
  if(!gift){
   s.bear(665,84+(1-arrive)*56,137,a);ring(663,131,74,13,a,.6);
   for(let j=0;j<3;j++){const y=300+j*156;s.bear(j%2?1829:91,y+Math.sin(t*3+j)*6,75+j*8,j%2?b:a,j);s.bell(j%2?1890:24,y+33,32,gold,Math.sin(t*4+j)*.12);}
   // A glass umbrella, tiny den steps and pawprints catch the storm.
   local(1819,323,145,Math.sin(t)*.02,()=>{path(q=>{q.moveTo(-49,0);q.quadraticCurveTo(-33,-53,0,-46);q.quadraticCurveTo(34,-53,49,0);q.quadraticCurveTo(25,-9,0,0);q.quadraticCurveTo(-25,-9,-49,0);},metal([-50,-48,50,4],['#dcefff66',b+'72','#19394718',a+'6b']),.8);line([[0,-46],[0,54],[13,61],[19,52]],gold,1.4);for(let z of [-1,1])curve(u=>[z*Math.sin(u*Math.PI/2)*49,-46+u*46],a,1,.5);});
   for(let j=0;j<7;j++){const x=425+j*153,y=1017+Math.sin(t*2+j)*7;poly([[x-29,y],[x+24,y-7],[x+32,y+18],[x-22,y+21]],'#193648',.4);line([[x-29,y],[x+24,y-7]],a,.9,.8);}
   births(22,.5,.095,1.2,(u,j)=>{const x=j%2?1880-32*Math.sin(u*Math.PI):48+37*Math.sin(u*Math.PI),y=740-u*490-j%3*15;disc(x,y,5,4,gold,.7);for(let n=0;n<3;n++)disc(x-7+n*7,y-9,2.3,3,a,.9);});
  }else{
   s.bear(634,82,118,a);s.bear(724,94,70,b,2);s.bow(649,37,42,gold);
   // Silk gift boxes ride a perimeter rail, then open into cubs and paw charms.
   ribbon(u=>[300+u*1320,1024-27*Math.sin(u*Math.PI)],a,b,14,t*1.5);
   for(let j=0;j<5;j++){const q=smooth((t-.2-j*.12)/1.8),x=280+q*(310+j*275),y=1032-30*Math.sin(q*Math.PI);local(x,y,63,Math.sin(t*3+j)*.025,()=>{o.sheet([[-30,-23],[30,-23],[30,24],[-30,24]],j%2?a:b,p,{glass:true});line([[0,-23],[0,24]],gold,2);s.bow(0,-25,65,gold);});if(t>1.15+j*.12)s.bear(x,y-62*spread,52,a,j);}
   for(let j=0;j<6;j++){const side=j%2,x=side?1848:79,y=245+j%3*180;s.bell(x,y+Math.sin(t*4+j)*10,40,gold,Math.sin(t*3+j)*.14);ring(x,y,34,57,j%2?b:a,.4);}
   births(32,.45,.065,1.65,(u,j)=>{const x=j%2?1900-u*62:18+u*69,y=1010-u*870;s.gem(x,y,14+j%3*6,j%2?a:gold,u+j);});
  }
  for(let j=0;j<14;j++){const x=335+j*96,y=12+Math.sin(t*1.4+j)*7;w.star(x,y,1+j%3,j%2?a:gold,.6);}
 }else if(theme==='turtle'){
  const a='#b7efb0',b='#70e0cb',rose='#f5bdcf';
  if(!gift){
   s.turtle(663,91+(1-arrive)*70,137,b);s.leaf(590,85,74,a,-.5-spread*.4);s.leaf(741,78,67,a,.8+spread*.3);
   // A terrarium opens leaf by leaf; little keepers tend each sprout.
   for(let j=0;j<5;j++){const x=j%2?1861:58,y=227+j*111;ring(x,y,38,55,b,.55);s.leaf(x+Math.sin(t*2+j)*6,y,51,a,j*.7+t*.04);if(j%2===0)s.turtle(x,y+43,52,b,j);}
   for(let j=0;j<8;j++){const x=340+j*176,y=1043;curve(u=>[x+Math.sin(u*3+t*.3+j)*13,y-u*(22+j%3*16)*spread],b,1.1,.65);s.leaf(x+15,y-18*spread,27+j%3*6,j%2?a:rose,-.8);}
   for(let j=0;j<4;j++){const x=j%2?1798:110,y=360+j%2*240;local(x,y,70,Math.sin(t*3+j)*.08,()=>{for(let side of [-1,1]){s.leaf(side*17,0,47,rose,side*.9);s.leaf(side*12,24,33,a,side*.5);}line([[0,-8],[0,32]],'#f1ffe5',2,.8);});}
  }else{
   s.turtle(638,92,117,b);s.turtle(728,101,73,a,3);s.bow(643,43,53,rose);
   // Seed packets become a tiny living flotilla, with new leaves appearing late.
   for(let j=0;j<6;j++){const u=smooth((t-.25-j*.13)/2.15),x=310+j*235+Math.sin(u*Math.PI)*32,y=1060-u*(28+j%3*12);s.boat(x,y,72,j%2?a:b,-.04+Math.sin(t*2+j)*.03);s.leaf(x,y-32,34+u*17,rose,.3);if(u>.65)s.turtle(x+13,y-59,35,a,j);}
   for(let j=0;j<8;j++){const y=210+j%4*185,x=j%2?1855:62;s.leaf(x,y+Math.sin(t*2+j)*9,41+j%3*10,j%3?a:rose,j*.6);s.gem(x+28,y-38,22,b,p+j);}
   births(24,.25,.09,1.75,(u,j)=>{const x=j%2?1825+Math.sin(u*8+j)*28:84+Math.sin(u*8+j)*28,y=970-u*820;s.leaf(x,y,24+j%3*6,a,-u+j);});
  }
  for(let side=0;side<2;side++)for(let j=0;j<3;j++){const fn=u=>[side?1899-j*13+Math.sin(u*9+t*.2)*15:19+j*17+Math.sin(u*8+t*.2)*15,1030-u*890];curve(fn,b,1,.27);sweep(fn,j%2?a:rose,j*.16,1.5);}
  births(28,.4,.08,1.1,(u,j)=>{const x=330+j*47,y=1059-u*23-Math.sin(u*Math.PI)*19;w.star(x,y,1.5,a,.7);});
 }else if(theme==='ram'){
  const a='#ffd48b',b='#aee7ed',hot='#ffad9c';
  s.ram(gift?630:662,83+(1-arrive)*48,gift?129:143,a);
  if(!gift){
   // Golden horn workshop: geared arches, prism blanks and a jeweled anvil.
   for(let side=0;side<2;side++){const x=side?1879:41;const spiral=u=>{const r=8+u*64;return[x+Math.cos(u*TAU*1.65+t*.15)*r,420+Math.sin(u*TAU*1.65+t*.15)*r*1.6];};curve(spiral,a,7,.16);curve(spiral,a,1.2,.8);sweep(spiral,b,side*.19,2);for(let j=0;j<3;j++){const y=226+j*215;ring(x,y,24,24,a,.6);for(let n=0;n<10;n++){const q=n*TAU/10+t*.25;line([[x+Math.cos(q)*24,y+Math.sin(q)*24],[x+Math.cos(q)*29,y+Math.sin(q)*29]],a,2,.6);}s.gem(x,y,34,b,t+j);}}
   local(1819,617,147,0,()=>{o.sheet([[-45,-16],[46,-16],[28,1],[17,11],[17,29],[-17,29],[-19,9],[-45,4]],a,p);s.gem(0,-43,39,hot,t*.3);line([[-26,-67],[-7,-47]],b,4,.8);});
   for(let j=0;j<9;j++){const x=326+j*148;s.gem(x,1037+Math.sin(t*2+j)*8,30+j%3*10,j%2?a:b,j*.3+p);}
  }else{
   s.ram(726,91,74,a,3);s.bow(639,32,60,hot);
   // A golden carriage hands out crowns. Recipients salute in sequence.
   const carriage=310+smooth(t/2.7)*1260;
   local(carriage,1022,115,0,()=>{o.sheet([[-52,-32],[51,-32],[55,18],[-47,18]],a,p,{glass:true});for(let side of [-1,1]){ring(side*30,26,14,14,b,.8);line([[side*30-13,26],[side*30+13,26]],a,1);}s.bow(0,-35,70,hot);});
   for(let j=0;j<5;j++){const x=360+j*287,y=979;s.ram(x,y+Math.sin(t*3+j)*5,56,a,j);const crownY=934-20*smooth((t-.6-j*.16)/.6);poly([[x-22,crownY+12],[x-25,crownY-7],[x-9,crownY+1],[x,crownY-14],[x+11,crownY+1],[x+25,crownY-7],[x+21,crownY+12]],a,.75);line([[x-21,crownY+12],[x+21,crownY+12]],'#fff8d5',1);}
   for(let j=0;j<8;j++){const x=j%2?1861:55,y=227+j%4*183;s.gem(x,y+Math.sin(t*2+j)*10,37+j%2*9,j%2?hot:b,j*.4+p);}
   births(33,.35,.066,1.45,(u,j)=>{const x=j%2?1855+u*43:64-u*43,y=180+u*760;foil(x,y,8+j%4,a,j+u);});
  }
  for(let j=0;j<3;j++){const fn=u=>[320+u*1290,1059+Math.sin(u*13+t*.3+j)*9];sweep(fn,j%2?a:b,j*.15,1.7);}
  for(let j=0;j<14;j++){const x=330+j*96;line([[x,9],[x+9,21],[x+19,9]],j%2?a:b,1,.65);}
 }else{
  const a='#ffb479',b='#f7d19f',violet='#e0b2ee';
  if(!gift){
   // Egg opens, a small phoenix rises and its loose feathers charge the edges.
   const hatch=smooth((t-.45)/.5);local(663,101,115,Math.sin(t*5)*(1-hatch)*.035,()=>{path(q=>{q.moveTo(0,-48);q.bezierCurveTo(-42,-36,-43,39,0,43);q.bezierCurveTo(45,39,41,-35,0,-48);},metal([-40,-40,40,42],['#fff0d5',a,'#60364b',b]),1-hatch);});
   c.save();c.globalAlpha*=hatch;s.bird(661,97-hatch*18,145,a);c.restore();
   for(let j=0;j<6;j++){const x=j%2?1866:63,y=229+j%3*202;s.feather(x,y+Math.sin(t*2+j)*8,78+j%2*15,j%3?a:violet,j%2?.55:-.55);if(j%3===0)s.bird(x+21,y+48,54,b,j);}
   for(let j=0;j<12;j++){const x=322+j*111;const y=1041+Math.sin(t*2+j)*9;s.feather(x,y,37+j%3*9,j%2?a:violet,-1.1+j*.18+p*.25);}
  }else{
   s.bird(618,88,119,a);s.bird(720,88,81,b,1);s.bow(668,33,44,violet);
   // Little ember envelopes open into different fledglings, never a fire wall.
   for(let j=0;j<7;j++){const x=332+j*191,y=1038-12*Math.sin(t*2+j);const opened=smooth((t-.45-j*.14)/.55);local(x,y,61,-.08+j*.025,()=>{o.sheet([[-35,-20],[35,-20],[35,21],[-35,21]],j%2?a:violet,p,{glass:true});line([[-35,-20],[0,9-opened*33],[35,-20]],b,1.3,.8);});s.bird(x,y-52*opened,47*opened,a,j);}
   for(let j=0;j<6;j++){const x=j%2?1856:77,y=232+j%3*214;s.lantern(x,y+Math.sin(t*2+j)*7,65,j%2?b:violet,Math.sin(t*2+j)*.07);s.feather(x+21,y+57,34,a,.4);}
  }
  for(let side=0;side<2;side++)for(let j=0;j<3;j++){const route=u=>[side?1903-j*18+Math.sin(u*8+t*.25)*17:20+j*17+Math.sin(u*9+t*.2)*19,1058-u*899];ribbon(route,j%2?a:violet,b,5+j*2,t+j);sweep(route,b,j*.16,1.4);}
  births(37,.3,.065,1.5,(u,j)=>{const x=j%2?1841+Math.sin(u*7+j)*45:70+Math.sin(u*8+j)*45,y=1020-u*830;s.feather(x,y,13+j%3*8,j%3?a:violet,u+j);});
 }
}
