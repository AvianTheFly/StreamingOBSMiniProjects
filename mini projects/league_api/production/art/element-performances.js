// Six separate elemental worlds. Hextech retains its approved renderer.
function elementalPerformance(c,e){
 if(!['dragon_earth','dragon_fire','dragon_water','dragon_air','dragon_chemtech','dragon_elder'].includes(e.key))return false;
 const {w,o,t,p,finite,line,poly,metal,place,arc,wake,shard,ring,motes}=eventInk(c,e);
 const gold='#e9c788',ice='#c8f7ff';
 c.save();
 if(e.key==='dragon_earth'){
  // A mineral dragon rises from layered stone; geological seams grow light.
  const a='#dec18a',teal='#91d9c1';
  for(const side of [0,1])for(let j=0;j<(side?6:10);j++){const y=205+j*52,x=side?1912:8,sgn=side?-1:1;
   place(x,y,1,Math.sin(t*.22+j)*.018,()=>{poly([[0,-25],[sgn*36,-33],[sgn*72,-13],[sgn*58,18],[sgn*26,29],[0,19]],metal([0,-33,sgn*72,29],['#7b8177','#b4ae8b','#364b4b','#82796a']),.88);line([[sgn*8,-8],[sgn*33,-18],[sgn*53,-10]],a,1.1,.75);line([[sgn*33,-18],[sgn*30,10],[sgn*16,22]],teal,1,.55);},j*.013);
   wake(u=>[x+sgn*(9+u*52),y-6-Math.sin(u*4)*8],j%2?a:teal,j*.035,1.7,.38);
  }
  place(91,469,1.05,-.11,()=>{
   poly([[-52,19],[-42,-51],[-16,-92],[-3,-57],[29,-73],[20,-29],[48,-7],[31,15],[1,28],[-9,52]],metal([-50,-85,45,48],['#c9c8b0','#616b63','#a4a983','#2d484d']));
   poly([[-36,-35],[-19,-51],[6,-36],[-6,-18]],'#8b9b80',.72);line([[-49,15],[-22,-8],[4,-20],[20,-9],[36,-7]],gold,1.6);line([[1,28],[17,22],[31,15]],teal,1.2);o.orb(11,-13,5,teal,t*.5);shard(-31,-53,17,teal,.2);line([[-14,8],[18,9]],'#1a3438',3);
  },.04);
  for(let j=0;j<17;j++){const x=340+j*76;shard(x,1058-Math.sin(t*.4+j)*5,9+j%3*3,j%3?teal:gold,j*.31);}
  for(let j=0;j<3;j++)wake(pathOf([[310,32+j*9],[540,32+j*9],[605,67+j*9],[1090,67+j*9],[1160,29+j*9],[1590,29+j*9]]),j%2?teal:a,j*.13,1.8,.24);
  w.mist(54,462,90,177,teal,.35);motes(30,5,.1,(u,j,r,a)=>w.mote(j%2?1885+Math.sin(j)*21:51+Math.sin(j)*31,800-u*580,1+r*2,teal,a*.7));
 }else if(e.key==='dragon_fire'){
  // Obsidian claws and an ember dragon; molten filaments unfurl in the margins.
  const amber='#ffb67c',red='#e77e88';
  for(const [x,y,s,a]of [[1840,359,1.2,.1],[56,634,.8,-.3],[1430,47,.53,1.3]])place(x,y,s,a,()=>{
   poly([[-51,31],[-39,-14],[-29,-70],[-9,-41],[8,-80],[21,-37],[46,-15],[35,5],[59,22],[23,40]],metal([-51,-70,51,40],['#b98e83','#372e42','#926471','#212b3c']),.94);
   line([[-29,-70],[-22,-21],[-39,7]],amber,1.8);line([[8,-80],[9,-34],[24,-19],[35,5]],red,1.4);poly([[14,1],[29,0],[22,8]],amber);line([[23,40],[32,21],[59,22]],gold,1.2);shard(-17,4,20,red,-.18);
  });
  for(let j=0;j<6;j++){const side=j%2,x=side?1894-j*5:25+j*6,sgn=side?-1:1;
   o.ribbon(u=>[x+sgn*Math.sin(u*8-t*.8+j)*23,998-u*810],{width:11+j%3*3,color:amber,secondary:red,phase:t*.65+j,glass:true,alpha:.48});
   wake(u=>[x+sgn*Math.sin(u*8-t*.8+j)*23,998-u*810],j%2?red:amber,j*.08,2,.27);
  }
  for(let j=0;j<18;j++){const x=340+j*71;poly([[x,1080],[x+21,1048],[x+44,1080]],metal([x,1048,x+43,1080],['#775970','#ba8e76','#3c3546']),.62);wake(u=>[x+4+u*20,1079-u*22],amber,j*.027,1.5,.55);}
  for(let j=0;j<3;j++)wake(u=>[300+u*1290,28+j*14+Math.sin(u*14-t*.4+j)*7],j===1?red:amber,j*.17,2,.17);
  motes(44,4.8,.065,(u,j,r,a)=>{const x=j%2?1883+Math.sin(j+u*3)*32:47+Math.sin(j+u*4)*35,y=970-u*810;w.star(x,y,2+r*3,amber,a*.72);});w.mist(1867,394,90,184,red,.38);
 }else if(e.key==='dragon_water'){
  // Ocean glass: a coiled sea-dragon, suspended droplets and tidal lenses.
  const aqua='#92e9cf',blue='#86bee6';
  place(72,461,1,0,()=>{
   o.ribbon(u=>[Math.sin(u*8+t*.25)*40,96-u*179],{width:34,color:aqua,secondary:blue,phase:t*.3,glass:true,alpha:.77});
   poly([[-26,-72],[-23,-98],[0,-111],[15,-143],[17,-104],[39,-83],[27,-65],[0,-69]],metal([-26,-143,39,-65],['#c2f1e3','#438b9a','#96cecd','#2e4d68']),.85);poly([[7,-91],[20,-87],[10,-84]],ice,.9);line([[17,-104],[28,-94],[39,-83]],gold,1);for(let j=0;j<6;j++)ring(Math.sin(j*.8+t*.25)*31,72-j*27,7,3,ice,1,.5);
  });
  for(let j=0;j<7;j++){const y=196+j*73;place(1870+Math.sin(j+t*.35)*8,y,1,Math.sin(t*.3+j)*.04,()=>{o.orb(0,0,21+j%3*5,aqua,t*.4+j,{glass:true,flat:1.15});ring(0,0,34,13,blue,1,.6);line([[-13,-10],[-8,-17],[2,-18]],ice,1.1,.75);},j*.019);}
  for(let j=0;j<6;j++)o.ribbon(u=>[320+u*1240,1054+Math.sin(u*12-t*.7+j*.5)*8-j*3],{width:7,color:j%2?blue:aqua,secondary:ice,phase:t*.5+j,glass:true,alpha:.42});
  for(let j=0;j<4;j++)wake(u=>[310+u*1320,30+j*13+Math.sin(u*8-t*.6+j*.24)*10],j%2?aqua:blue,j*.16,1.8,.24);
  motes(34,5.5,.11,(u,j,r,a)=>{const x=j%2?1850+Math.sin(j)*30:61+Math.sin(j)*29;ring(x,900-u*711,3+r*7,4+r*9,aqua,1,a*.7);});w.mist(40,495,94,220,blue,.25);
 }else if(e.key==='dragon_air'){
  // A wind dragon made of vanes and feathers; silk streamers lift independently.
  const pearl='#d0e6e0',lavender='#b6b2e3';
  place(1831,391,1.2,.12+Math.sin(t*.5)*.04,()=>{
   for(let j=0;j<8;j++){const x=-17+j*5,y=48-j*14;o.ribbon(u=>[x-u*(27+j*5),y+u*32+Math.sin(u*4+t*.5)*4],{width:12,color:pearl,secondary:lavender,phase:t*.3+j,glass:true,alpha:.7});}
   poly([[-8,10],[-20,-27],[-8,-72],[2,-105],[9,-68],[32,-56],[42,-32],[22,-14]],metal([-20,-105,42,10],['#e0e8db','#748798','#bec6dc','#4e6981']),.84);line([[2,-105],[7,-67],[32,-56]],gold,1);poly([[16,-43],[26,-39],[19,-36]],ice);line([[42,-32],[30,-24],[22,-14]],lavender,1.4);
  });
  for(let j=0;j<5;j++){const y=207+j*110;o.ribbon(u=>[28+Math.sin(u*6-t*.7+j)*24,y+u*102],{width:13+j*2,color:pearl,secondary:lavender,phase:t*.5+j,glass:true,alpha:.46});wake(u=>[28+Math.sin(u*6-t*.7+j)*24,y+u*102],pearl,j*.11,1.5,.27);}
  for(let j=0;j<22;j++){const x=342+j*55,y=29+Math.sin(j*.5+t*.5)*14;w.petal(x,y,9+j%4,pearl,-.3+Math.sin(t*.4+j)*.15,.66);if(j%3===0)wake(u=>[x-24+u*48,y+Math.sin(u*Math.PI)*9],lavender,j*.023,1.4,.35);}
  for(let j=0;j<3;j++)wake(u=>[1580-u*1260,1060-j*9+Math.sin(u*9-t*.4+j)*6],j%2?lavender:pearl,j*.17,1.8,.36);
  motes(35,4.8,.1,(u,j,r,a)=>w.petal(j%2?1872+Math.sin(j+u*6)*24:58+Math.sin(j+u*5)*27,873-u*690,5+r*8,pearl,j*.31+u*1.4,a*.66));
 }else if(e.key==='dragon_chemtech'){
  // Botanical laboratory: segmented glass dragon, living vines and pressure vials.
  const acid='#d5eb8b',mint='#8bdfb8';
  place(84,436,1.1,-.12,()=>{
   for(let j=0;j<7;j++){const y=64-j*20,x=Math.sin(j*.7+t*.25)*17;shard(x,y,18,j%2?acid:mint,.1+j*.04);ring(x,y,23,6,gold,1,.62);}
   poly([[-22,-67],[-9,-93],[-10,-127],[6,-105],[24,-83],[42,-72],[24,-57],[2,-60]],metal([-22,-127,42,-57],['#d4e5a3','#5c897c','#adcfa2','#375f68']),.8);poly([[12,-80],[25,-77],[16,-72]],acid);line([[-10,-127],[6,-105],[24,-83]],gold,1.3);
  });
  for(let j=0;j<5;j++){const y=208+j*101;place(1858,y,.86,Math.sin(t*.35+j)*.045,()=>{
   poly([[-19,-35],[-10,-41],[-10,-59],[10,-59],[10,-41],[19,-35],[24,32],[-24,32]],'#75afa925',.85);line([[-19,-35],[-24,32],[24,32],[19,-35],[10,-41],[10,-59],[-10,-59],[-10,-41],[-19,-35]],mint,1.2,.8);poly([[-21,16+Math.sin(t*1.7+j)*4],[21,13+Math.sin(t*1.7+j)*4],[23,30],[-23,30]],acid,.37);line([[-16,-28],[-16,20]],ice,1,.64);line([[-14,-57],[14,-57]],gold,4,.75);for(let b=0;b<3;b++)ring(-9+b*9,12-(t*12+b*17)%41,2+b,2+b,acid,1,.6);
  },j*.019);}
  for(const side of [0,1]){const x=side?1904:18,sgn=side?-1:1;const stem=u=>[x+sgn*Math.sin(u*12-t*.3)*17,820-u*650];wake(stem,mint,side*.18,2,.24);for(let j=0;j<12;j++){const [xx,y]=stem(j/12);w.petal(xx+sgn*12,y,12,acid,sgn*-.8+Math.sin(t*.6+j)*.08,.55);}}
  for(let j=0;j<12;j++){const x=380+j*102;ring(x,48,17,9,mint,1,.5);shard(x,48,8,acid,j*.3);if(j<11)wake(u=>[x+17+u*68,48+Math.sin(u*Math.PI)*10],acid,j*.03,1.5,.35);}
  motes(28,4.5,.12,(u,j,r,a)=>ring(j%2?1878:46,1000-u*815,3+r*5,3+r*5,acid,1,a*.55));w.mist(64,426,92,184,mint,.25);
 }else{
  // Elder: silver skeletal dragon wing with ancient rings and soul wisps.
  const silver='#d3d8f2',blue='#92cde6';
  place(75,455,1,-.08,()=>{
   for(let j=0;j<7;j++){const path=u=>[-24+u*(92-j*7),-89+j*25+Math.sin(u*Math.PI)*(27+j*2)];o.ribbon(path,{width:8,color:silver,secondary:gold,phase:t*.15+j,glass:false,alpha:.79});wake(path,blue,j*.07,1.7,.23);}
   poly([[-37,5],[-30,-79],[-12,-105],[1,-151],[6,-94],[21,-77],[39,-52],[29,-38],[4,-43],[-5,12]],metal([-37,-145,39,12],['#e7e2cf','#647b94','#c3d0d6','#334a68']),.9);line([[1,-151],[6,-94],[21,-77],[39,-52]],gold,1.1);poly([[8,-70],[23,-62],[12,-58]],blue);for(let j=0;j<4;j++)line([[0,-36+j*11],[23-j*3,-30+j*11]],silver,1,.75);
  });
  for(let j=0;j<6;j++){const y=211+j*83;place(1876,y,1,-.2+Math.sin(t*.3+j)*.05,()=>{w.petal(0,0,31,silver,-.8,.8);line([[-23,16],[23,-16]],gold,1,.6);for(let n=0;n<5;n++)line([[-9+n*6,9-n*4],[-3+n*6,19-n*4]],blue,.7,.6);},j*.02);}
  for(let j=0;j<15;j++){const x=360+j*84;ring(x,42,15,23,silver,1,.56);wake(arc(x,42,15,23),gold,j*.025,1.6,.24);shard(x,42,7,blue,.3);}
  for(let j=0;j<4;j++)o.ribbon(u=>[300+u*1290,1066-j*6+Math.sin(u*7-t*.3+j)*8],{width:6,color:silver,secondary:blue,phase:t*.2+j,glass:true,alpha:.43});
  motes(36,6,.11,(u,j,r,a)=>{const x=j%2?1865+Math.sin(j+u*8)*24:49+Math.sin(j+u*6)*28,y=1000-u*816;w.mist(x,y,9+r*6,18+r*8,blue,a*.4);w.star(x,y,2+r*2,gold,a*.7);});
 }
 c.restore();return true;
}
