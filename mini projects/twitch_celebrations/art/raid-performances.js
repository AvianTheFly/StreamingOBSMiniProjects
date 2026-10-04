// Each raid is an eight-second ensemble, timed by the existing server deadline.
function raidPerformance(c,theme,t,duration,seed){
 const i=partyInk(c,t,duration),s=partyProps(i),{p,o,w,line,curve,disc,poly,path,metal,local,sweep,ribbon,ring,foil,births}=i;
 const landing=smooth((t-.4)/1.1),parade=smooth((t-1)/5.7),finale=smooth((t-5)/1.4);
 if(theme==='crab'){
  const a='#a1e9ea',b='#f0c1a0',pearl='#f6ead1';
  // A fleet assembles along the bottom shore. Each captain has its own bob.
  for(let j=0;j<9;j++){const x=260+j*177+parade*(j%2?25:-25),y=1022+Math.sin(t*2+j*.9)*7;s.boat(x,y,83+j%3*14,j%2?a:b,Math.sin(t*1.6+j)*.025);s.crab(x,y-43-landing*9,39+j%3*8,b,j);s.bell(x,y-78,18,pearl,Math.sin(t*4+j)*.2);}
  local(81,504,140,0,()=>{o.sheet([[-29,-80],[29,-80],[38,89],[-37,89]],a,p,{glass:true});for(let j=0;j<4;j++)line([[-28-j*2,-45+j*34],[29+j*2,-45+j*34]],pearl,5,.7);o.sheet([[-47,-82],[48,-82],[40,-113],[-40,-113]],b,p);o.orb(0,-96,16,pearl,t,{glass:true});line([[-46,91],[46,91]],a,1);});
  for(let j=0;j<5;j++){const x=j%2?1844:102,y=250+j%3*179;s.crab(x,y+Math.sin(t*3+j)*8,74+j%2*12,b,j);o.orb(x-37,y+41,8+j%3*2,pearl,t+j,{glass:true});}
  for(let j=0;j<4;j++){const fn=u=>[180+u*1610,1067+Math.sin(u*16-t*.8+j*.6)*(6+j*2)];curve(fn,a,1,.45);sweep(fn,j%2?a:pearl,j*.1,1.8);}
  births(56,.6,.105,2.2,(u,j)=>{const x=j%2?1830+Math.sin(j+u*5)*43:79+Math.sin(j+u*6)*39,y=1010-u*790;o.orb(x,y,3+j%3*1.5,j%3?a:pearl,t+j,{glass:true});});
  for(let j=0;j<13;j++){const x=320+j*97;s.bow(x,12+Math.sin(t*2+j)*5,24,j%2?a:b);}
  // Pearl signal grows near one corner instead of sweeping across gameplay.
  ring(1830,390,45+finale*17,81+finale*30,a,.6);sweep(u=>[1830+Math.cos(u*TAU)*55,390+Math.sin(u*TAU)*96],pearl,0,2.5);
 }else if(theme==='dragon'){
  const a='#c6b1ff',b='#ffe0a2',mint='#99e9d1';
  // A procession of glass lanterns carried by dragons ascending the two sides.
  for(let j=0;j<7;j++){const q=smooth((t-.35-j*.2)/5.5),side=j%2,x=side?1820+Math.sin(q*5+j)*45:93+Math.sin(q*5+j)*33,y=990-q*(350+j%4*164);s.dragon(x,y,91+j%3*13,j%2?a:mint,j);s.lantern(x-26,y+61,44,b,Math.sin(t*2+j)*.08);}
  for(let j=0;j<9;j++){const x=268+j*172,y=22+Math.sin(t*.8+j)*5;s.lantern(x,y,34+j%3*7,j%2?b:a,Math.sin(t*1.5+j)*.09);line([[x,0],[x,y-19]],b,.7,.6);}
  for(let side=0;side<2;side++)for(let j=0;j<3;j++){const fn=u=>[side?1902-j*18+Math.sin(u*9+t*.4)*18:24+j*17+Math.sin(u*10+t*.4)*17,1050-u*872];ribbon(fn,j%2?a:mint,b,7+j*3,t*.8+j);sweep(fn,b,j*.14,1.6);}
  for(let j=0;j<6;j++){const x=330+j*254;s.gem(x,1028+Math.sin(t*1.4+j)*10,37+j%2*13,a,j*.3+p);s.bell(x+46,1052,27,b,Math.sin(t*3+j)*.14);}
  births(62,.2,.093,2,(u,j)=>{const x=j%2?1839+Math.sin(u*6+j)*53:77+Math.sin(u*8+j)*47,y=1010-u*851;w.star(x,y,1+j%3,mint,.8);});
  s.dragon(1584,84+(1-landing)*55,140,a,5);s.lantern(1530,121,46,b,.08);
 }else if(theme==='cat'){
  const a='#9de8ed',b='#e3baff',gold='#ffe0a2';
  // The cosmic express has five differently occupied carriages, articulated wheels.
  const travel=170+parade*1170;
  for(let j=0;j<5;j++){const x=travel+j*129,y=1012+Math.sin(t*2+j)*3;local(x,y,104,0,()=>{o.sheet([[-48,-25],[48,-25],[49,30],[-49,30]],j%2?a:b,p,{glass:true});o.sheet([[-43,-30],[42,-30],[32,-42],[-31,-42]],gold,p,{glass:true});for(const side of [-1,1]){ring(side*26,36,12,12,a,.9);line([[side*26-10*Math.cos(t*3),36-10*Math.sin(t*3)],[side*26+10*Math.cos(t*3),36+10*Math.sin(t*3)]],gold,1);}line([[-56,22],[-48,22],[48,22],[57,22]],gold,1.5);s.cat(0,-9,45,j%2?gold:a,j);});}
  for(let side=0;side<2;side++)for(let j=0;j<3;j++){const x=side?1875-j*10:44+j*10,y=309+j*187;ring(x,y,39+j*6,78,a,.55,-.3);sweep(u=>[x+Math.cos(u*TAU)*43,y+Math.sin(u*TAU)*81],j%2?b:gold,j*.16,1.8);if(j!==1)s.cat(x,y,64,j%2?a:b,j);}
  for(let j=0;j<38;j++){const x=290+j*39,y=12+Math.sin(j+t*.6)*9;w.star(x,y,1+j%4,j%2?a:gold,.55);}
  for(let j=0;j<2;j++){const fn=u=>[160+u*1650,1063+j*6];curve(fn,a,1,.6);sweep(fn,b,j*.08,2);}
  births(45,.4,.14,1.5,(u,j)=>{const side=j%2,x=side?1886-29*Math.sin(u*Math.PI):40+30*Math.sin(u*Math.PI),y=210+u*640;foil(x,y,6+j%4,j%2?b:a,u+j);});
  // A tiny station canopy unfurls late, with an actual swinging departure bell.
  local(1837,398,114,0,()=>{path(q=>{q.moveTo(-55,0);q.lineTo(-40,-23*landing);q.lineTo(39,-23*landing);q.lineTo(56,0);q.closePath();},b,.35);line([[-39,0],[-39,82],[39,82],[39,0]],a,1.5,.7);s.bell(0,17,40,gold,Math.sin(t*3)*.1);});
 }else{
  const a='#b9eca2',b='#ecb7db',mint='#8eede0';
  // A lily-pad carnival: jumping frogs, petal fans and little glass drum kits.
  for(let j=0;j<8;j++){const x=271+j*206,y=1046+Math.sin(j)*5,hop=Math.max(0,Math.sin((t-j*.13)*3))*13;s.leaf(x,y,91,a,-1.4);s.frog(x,y-41-hop,57+j%3*9,j%2?a:mint,j);s.bow(x,y-75-hop,24,b);ring(x,y+5,67,11,mint,.55);}
  for(let j=0;j<6;j++){const side=j%2,x=side?1839:81,y=249+j%3*196;local(x,y,92,Math.sin(t*2+j)*.04,()=>{for(let n=0;n<5;n++){const angle=n*TAU/5+t*.1;s.leaf(Math.cos(angle)*24,Math.sin(angle)*24,48,n%2?a:b,angle+.9);}s.frog(0,4,61,mint,j);});}
  local(1840,655,137,0,()=>{disc(0,9,37,20,metal([-37,-9,39,29],['#eaffe9',mint,'#24564c',b]));ring(0,-4,38,15,b,.8);line([[-25,12],[-25,38],[25,38],[25,12]],a,2,.7);const q=Math.sin(t*6)*7;line([[-45,-24],[-11,-7-q]],b,2.3);line([[47,-22],[15,-7+q]],a,2.3);s.frog(0,-48,67,a,4);});
  for(let j=0;j<4;j++){const fn=u=>[180+u*1560,1064-j*4+Math.sin(u*16-t*.6+j*.5)*(7+j*2)];curve(fn,mint,1,.5);sweep(fn,j%2?b:mint,j*.14,1.5);}
  births(55,.3,.105,2,(u,j)=>{const x=j%2?1842+Math.sin(u*6+j)*43:79+Math.sin(u*6+j)*43,y=1010-u*847;s.leaf(x,y,13+j%3*6,j%2?a:b,u+j);});
  for(let j=0;j<15;j++){const x=300+j*96;s.leaf(x,14+Math.sin(t+j)*6,22,j%2?a:b,j*.4);}
 }
}
