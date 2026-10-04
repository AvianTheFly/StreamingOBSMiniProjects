// Generosity scenes: treasure, alchemy, observatory and botanical sound garden.
function cheerPerformance(c,theme,t,duration,seed){
 const i=partyInk(c,t,duration),s=partyProps(i),{p,o,w,line,curve,disc,poly,path,metal,local,sweep,ribbon,ring,foil,births}=i;
 const open=smooth((t-.4)/1.2),rise=smooth((t-1.9)/2.3);
 if(theme==='crab'){
  const a='#b0eded',b='#ffc8a5',gold='#f7e3b9';
  // Hinged glass treasure chest. Pearls are collected by three small crabs.
  local(110,532,166,0,()=>{o.sheet([[-40,-15],[40,-15],[38,31],[-38,31]],a,p,{glass:true});o.sheet([[-41,-17-open*32],[41,-17-open*32],[38,-44-open*20],[-38,-44-open*20]],b,p,{glass:true});line([[-42,-15],[42,-15]],gold,2);s.gem(0,9,19,gold);for(let j=0;j<4;j++)o.orb(-23+j*14,-12,7,gold,t+j,{glass:true});});
  for(let j=0;j<4;j++){const x=j%2?1828:107,y=268+j%2*369;s.crab(x,y+Math.sin(t*3+j)*6,81,b,j);s.gem(x+43,y-27,31,a,t+j);}
  births(48,.8,.115,2.5,(u,j)=>{const side=j%2,x=side?1815+Math.sin(u*Math.PI)*65:108-Math.sin(u*Math.PI)*50,y=720-u*515;o.orb(x,y,4+j%4*2,gold,t+j,{glass:true});});
  for(let j=0;j<10;j++){const x=288+j*157,y=1046+Math.sin(t*2+j)*7;s.bow(x,y,35,j%2?a:b);ring(x,y,28,12,gold,.5);}
  for(let j=0;j<3;j++){const fn=u=>[1835+Math.sin(u*8+t*.3+j)*41,1020-u*846];ribbon(fn,a,b,9+j*3,t+j);sweep(fn,gold,j*.18,1.6);}
  for(let j=0;j<14;j++)o.orb(290+j*96,18+Math.sin(t*2+j)*5,3+j%3,gold,t+j,{glass:true});
 }else if(theme==='dragon'){
  const a='#c8abff',b='#ffd99c',mint='#95ece0';
  // A retort distils one gem into a constellation of hanging amethyst droplets.
  local(1817,445,171,0,()=>{path(q=>{q.moveTo(-12,-64);q.lineTo(-12,-23);q.bezierCurveTo(-55,4,-37,48,0,49);q.bezierCurveTo(37,49,58,2,12,-23);q.lineTo(12,-64);q.closePath();},metal([-40,-66,39,52],['#e7fcff52',a+'4c','#1d315426',mint+'54']),.9);ring(0,-65,15,5,b,.9);curve(u=>[-28+u*56,20+Math.sin(u*8+t*2)*3],a,2,.7);s.gem(0,15,37,a,t*.2);line([[12,-54],[40,-65],[56,-32],[46,-9]],b,2,.8);disc(46,4+rise*25,5,8,mint,.7);});
  for(let j=0;j<7;j++){const x=j%2?1878:56,y=239+j%4*169;s.gem(x,y+Math.sin(t*2+j)*10,45+j%3*13,j%3?a:mint,j*.3+p);ring(x,y,31,57,b,.35,.2);line([[x,Math.max(175,y-100)],[x,y-36]],b,.8,.65);}
  for(let j=0;j<5;j++){const x=377+j*283,y=1038;s.lantern(x,y,44+j%2*12,j%2?a:b,Math.sin(t*2+j)*.1);s.gem(x+37,y+12,29,mint,j+p);}
  births(52,.6,.105,2.1,(u,j)=>{const x=j%2?1850+Math.sin(u*7+j)*32:71+Math.sin(u*7+j)*42,y=1000-u*801;foil(x,y,5+j%5,j%2?a:b,u+j);});
  for(let side=0;side<2;side++)for(let j=0;j<2;j++){const fn=u=>[side?1895-j*17+Math.sin(u*12+t*.25)*14:20+j*20+Math.sin(u*12+t*.25)*14,1037-u*860];curve(fn,a,1,.25);sweep(fn,mint,j*.16,2);}
  for(let j=0;j<12;j++){const x=310+j*109;s.gem(x,15,19,j%2?a:b,t+j);}
 }else if(theme==='cat'){
  const a='#a3eaf1',b='#f3bedb',gold='#ffe3ac';
  // Telescope, changing star mobiles and a cat in a tiny orbital capsule.
  local(105,399,145,-.23,()=>{o.sheet([[-40,-17],[25,-17],[49,-26],[49,25],[25,15],[-40,15]],a,p,{glass:true});ring(48,0,8,25,b,.8);line([[-9,15],[-32,68],[-9,45],[29,68]],gold,2);o.orb(48,0,13,gold,t,{glass:true,flat:.65});});
  for(let j=0;j<4;j++){const x=j%2?1848:80,y=233+j%2*390;ring(x,y,46,67,a,.6,-.35);sweep(u=>[x+Math.cos(u*TAU)*46,y+Math.sin(u*TAU)*67],b,j*.15,2);s.cat(x,y,67,j%2?a:b,j);for(let n=0;n<3;n++){const q=t*.4+n*TAU/3;w.star(x+Math.cos(q)*48,y+Math.sin(q)*71,3,gold,.8);}}
  for(let j=0;j<8;j++){const x=277+j*209,y=1046+Math.sin(t+j)*8;ring(x,y,28,9,b,.45);w.star(x,y-12,9+j%3*3,j%2?a:gold,.9);line([[x,y-3],[x,y+17]],a,.8,.5);}
  for(let j=0;j<3;j++){const fn=u=>[290+u*1300,1063-Math.sin(u*Math.PI)*(13+j*13)];curve(fn,a,.8,.35);sweep(fn,j%2?b:gold,j*.16,1.8);}
  births(61,.35,.09,1.4,(u,j)=>{const x=j%2?1844+Math.sin(u*7+j)*55:61+Math.sin(u*9+j)*44,y=199+u*625;w.star(x,y,1+j%3,j%3?a:b,.8);});
  for(let j=0;j<22;j++){const x=290+j*66;w.star(x,15+Math.sin(t*.7+j)*5,1+j%3,gold,.7);if(j%3===0)line([[x,14],[x+66,18]],a,.7,.4);}
 }else{
  const a='#bbeba6',b='#f3bdd7',mint='#97ede0';
  // A botanical wind instrument: bubble keys open and frog musicians answer.
  for(let side=0;side<2;side++)for(let j=0;j<5;j++){const x=side?1875-j%2*19:36+j%2*18,y=230+j*154;const stem=u=>[x+Math.sin(u*2+t*.3+j)*14,1050-u*(1060-y)*open];curve(stem,a,2,.7);sweep(stem,mint,j*.08,1.3);s.leaf(x+13,y+22,47,a,-.9);o.orb(x,y,13+j%3*4,mint,t+j,{glass:true});line([[x,y+21],[x,y+37],[x+12,y+34]],b,1.3,.8);}
  for(let j=0;j<4;j++){const x=j%2?1817:117,y=340+j%2*327;s.frog(x,y+Math.sin(t*3+j)*6,85,j%2?a:mint,j);s.bell(x+41,y-11,32,b,Math.sin(t*3+j)*.12);}
  for(let j=0;j<8;j++){const x=283+j*208,y=1044;s.leaf(x,y,73,j%2?a:b,-1.3);o.orb(x,y-13-Math.sin(t*3+j)*4,8,mint,t+j,{glass:true});}
  births(53,.5,.11,1.8,(u,j)=>{const x=j%2?1830+Math.sin(u*7+j)*36:99+Math.sin(u*7+j)*31,y=970-u*740;s.leaf(x,y,17+j%3*8,j%3?a:b,j*.6+u);});
  for(let j=0;j<3;j++){const fn=u=>[220+u*1490,1065-j*5+Math.sin(u*15-t*.5+j)*9];curve(fn,mint,1,.4);sweep(fn,b,j*.17,1.7);}
  for(let j=0;j<15;j++)s.leaf(291+j*96,15+Math.sin(t+j)*4,19,j%2?a:b,j*.3);
 }
}
