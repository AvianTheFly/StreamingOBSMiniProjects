// Every combat cue has a distinct little act and its own arrangement of charms.
function combatPerformance(c,e){
 if(!['kill','assist','first_blood','low_hp_kill','low_hp_multikill','double_kill','triple_kill','quadra_kill','pentakill','ace','manpower_advantage'].includes(e.key))return false;
 const ink=eventInk(c,e),{w,o,t,p,line,poly,metal,place,arc,wake,shard,ring,motes}=ink,{blade,shield,heart,helmet,glove,coin}=eventProps(ink);
 const gold='#e8cb91',ice='#bde5ef',rose='#e3a6bd',mint='#a9dfc2';
 c.save();
 if(e.key==='kill'){
  // A single rapier cools into etched metal while spent shards settle opposite it.
  blade(1856,450,1.07,-.32+smooth(p)*.16,ice);
  for(let j=0;j<7;j++){const y=244+j*65;shard(42+Math.sin(j)*18,y+smooth(p)*12,10+j%3*3,j%2?ice:rose,j*.33+p*.3);wake(u=>[18+u*47,y+u*29],ice,j*.04,1.5,.32);}
  for(let j=0;j<3;j++)wake(u=>[1879-j*15+Math.sin(u*Math.PI)*18,884-u*650],j%2?gold:ice,j*.13,1.9,.2);
  for(let j=0;j<13;j++){const x=360+j*88;line([[x,43],[x+19,31],[x+39,43]],ice,1,.55);if(j%3===0)shard(x+19,37,6,rose,.2);}
  motes(25,3,.07,(u,j,r,a)=>w.star(1866+Math.sin(j+u*4)*31,841-u*601,2+r*2,ice,a*.6));
 }else if(e.key==='double_kill'){
  // A two-blade duet: one unsheathes upward while the second turns downward.
  const q=smooth((p-.04)/.65);blade(67,452-q*42,1.03,.24+q*.14,ice);blade(1858,377+q*48,1.03,Math.PI-.34-q*.13,rose,.045);
  for(let j=0;j<4;j++){const y=236+j*125;ring(32,y,16,24,j%2?rose:ice,1.2,.6);ring(1889,y+34,16,24,j%2?ice:rose,1.2,.6);}
  wake(u=>[310+u*1300,49+Math.sin(u*Math.PI)*29],ice,0,2,.3);wake(u=>[1610-u*1300,1060-Math.sin(u*Math.PI)*20],rose,.13,2,.3);
  for(let j=0;j<15;j++){const x=350+j*85;shard(x,1059+Math.sin(t*.7+j)*4,7,j%2?ice:rose,j*.4);}
 }else if(e.key==='triple_kill'){
  // Three daggers rotate around an off-center optical clock, with three chain runs.
  for(let j=0;j<3;j++){const a=j*TAU/3+t*.25;blade(1851+Math.cos(a)*22,424+Math.sin(a)*84,.66,a+.75,j%2?gold:ice,j*.04);wake(arc(1851,424,41+j*10,102+j*12),j%2?rose:ice,j*.11,1.7,.21);}
  for(let j=0;j<9;j++){const y=233+j*58;place(40,y,1,Math.sin(t*.6+j)*.08,()=>{poly([[-13,-7],[0,-17],[13,-7],[10,11],[-10,11]],metal([-13,-17,13,11],['#d1dbe4','#647a92','#cbb8aa']),.72);ring(0,1,6,7,rose,1,.7);},j*.017);}
  for(let j=0;j<3;j++)wake(u=>[320+u*1270,31+j*13+Math.sin(u*9+j)*8],j===1?rose:ice,j*.16,1.7,.22);
  motes(28,3.7,.08,(u,j,r,a)=>w.star(38+Math.sin(j+u*6)*28,970-u*760,2+r*3,gold,a*.6));
 }else if(e.key==='quadra_kill'){
  // Four compass blades and four articulated corner petals form a rotating crest.
  for(const[x,y,a,j]of [[66,254,-.48,0],[1855,280,.48,1],[62,674,2.65,2],[1860,629,3.63,3]]){blade(x,y,.76,a+Math.sin(t*.5+j)*.04,j%2?rose:ice,j*.025);for(let n=0;n<3;n++)wake(arc(x,y,36+n*9,65+n*14,.25,5.9),j%2?gold:ice,j*.06+n*.08,1.4,.19);}
  for(let j=0;j<4;j++){const x=480+j*305;place(x,46,1.2,Math.sin(t*.6+j)*.04,()=>{for(let n=0;n<4;n++)w.petal(Math.cos(n*TAU/4)*12,Math.sin(n*TAU/4)*12,16,n%2?rose:ice,n*TAU/4,.63);shard(0,0,8,gold,0);},j*.022);}
  for(let j=0;j<18;j++){const x=360+j*68;line([[x,1066],[x+17,1046],[x+34,1066]],gold,1.1,.57);}
 }else if(e.key==='pentakill'){
  // Five champions' blades rise into a stage crown; small pennants follow the charge.
  for(let j=0;j<5;j++){const x=490+j*236;blade(x,52,.39,-.13+j*.065,gold,j*.035);ring(x,54,30,23,ice,1,.57);wake(u=>[x,80-u*77],rose,j*.07,2.2,.2);}
  for(const side of [0,1])for(let j=0;j<6;j++){const x=side?1878:42,y=230+j*83;place(x,y,1,(side?-1:1)*.12,()=>{poly([[-17,-23],[17,-23],[17,23],[0,14],[-17,23]],metal([-17,-23,17,23],['#e8d09b','#6c638b','#c0a8cb']),.77);line([[-14,-19],[14,-19]],gold,1.4,.85);shard(0,-1,8,ice,.1);},j*.018);wake(u=>[x,y-17+u*33],gold,j*.04,1.7,.3);}
  for(let j=0;j<5;j++)wake(u=>[320+u*1280,1064-j*7+Math.sin(u*13-t*.4+j*.3)*7],j%2?ice:gold,j*.12,1.5,.22);
  motes(38,4,.07,(u,j,r,a)=>w.star(j%2?1867+Math.sin(j)*32:52+Math.sin(j)*27,1000-u*813,2+r*3,gold,a*.7));
 }else if(e.key==='first_blood'){
  // A garnet drop opens into crimson silk and one ceremonial blade.
  place(79,413,1.14,Math.sin(t*.5)*.03,()=>{poly([[0,-71],[39,-10],[30,27],[0,48],[-30,27],[-39,-10]],metal([-39,-71,39,48],['#f1c7ce','#a36586','#e3a6a8','#4c466d']),.91);line([[0,-63],[0,39]],gold,1.4,.72);line([[-27,-3],[-15,-17]],ice,1.3,.8);shard(0,6,20,rose,.05);});blade(1855,455,.89,.3,rose,.035);
  for(let j=0;j<3;j++)o.ribbon(u=>[21+j*15+Math.sin(u*11-t*.35+j)*17,930-u*680],{width:13,color:rose,secondary:gold,phase:t*.4+j,glass:true,alpha:.51});
  for(let j=0;j<12;j++){const x=370+j*96;place(x,1060,1,Math.sin(t*.4+j)*.08,()=>poly([[0,-11],[7,0],[0,8],[-7,0]],rose,.63),j*.015);}
  wake(u=>[330+u*1240,38+Math.sin(u*9)*14],gold,0,1.8,.22);motes(26,4,.1,(u,j,r,a)=>w.petal(1867+Math.sin(j)*26,222+u*540,4+r*6,rose,j*.3+u,a*.65));
 }else if(e.key==='low_hp_kill'){
  // A cracked heart is repaired by a moving gold needle and luminous stitches.
  heart(1842,435,1.15,-.09,rose);const q=smooth((p-.05)/.75);
  line([[1834,403],[1848,420],[1835,435],[1848,451],[1840,466]],'#374464',2,.8);
  for(let j=0;j<5;j++){const y=408+j*12;line([[1830,y],[1852,y+5]],gold,1.4,smooth((q-j*.16)/.2));}
  const ny=395+q*77;line([[1812,ny],[1829,ny+17]],ice,2,.85);ring(1812,ny,3,4,gold,1,.7);
  shield(58,401,.79,.08,mint,.03);for(let j=0;j<7;j++){const y=250+j*65;heart(39,y,.19,Math.sin(t*.7+j)*.08,j%2?rose:gold,j*.017);}
  const pulse=pathOf([[315,1056],[591,1056],[607,1044],[619,1071],[635,1033],[654,1056],[944,1056],[964,1048],[982,1056],[1600,1056]]);wake(pulse,gold,0,2.1,.23);
  motes(25,4,.095,(u,j,r,a)=>w.star(1867+Math.sin(j)*23,930-u*703,2+r*2,gold,a*.6));
 }else if(e.key==='low_hp_multikill'){
  // An ember heart spreads feather wings; three pulse capsules charge in sequence.
  heart(67,438,1.02,.07,rose);
  for(const side of [-1,1])for(let j=0;j<6;j++){const x=69+side*(12+j*3),y=405+j*13;w.petal(x,y,24-j*2,j%2?gold:ice,side*(-.7-j*.04)+Math.sin(t*.6+j)*.04,.7);}
  for(let j=0;j<3;j++){const y=302+j*152;place(1858,y,1,0,()=>{ring(0,0,24,51,rose,1.4,.67);heart(0,0,.44,.06,gold);wake(u=>[0,-39+u*78],ice,j*.15,1.8,.23);},j*.04);}
  for(let j=0;j<4;j++)wake(u=>[320+u*1280,32+j*12+Math.sin(u*11-t*.4+j)*9],j%2?gold:rose,j*.1,1.8,.2);
  motes(30,4,.08,(u,j,r,a)=>w.petal(j%2?1869:37,962-u*717,5+r*8,gold,j*.3+u,a*.65));
 }else if(e.key==='assist'){
  // Two armored hands meet and braided light passes between little support shields.
  const q=smooth((p-.04)/.5);glove(67+q*8,419,.75,-.27,mint);glove(92-q*8,434,.75,2.78,ice,.045);shield(1849,429,1,.08,mint,.02);
  for(let j=0;j<3;j++)wake(u=>[330+u*1260,1055+Math.sin(u*13+t*.3+j*TAU/3)*11],j%2?ice:mint,j*.14,1.8,.24);
  for(let j=0;j<8;j++){const y=238+j*62;ring(1879,y,14,21,mint,1.3,.65);if(j%2===0)shield(1879,y,.18,.03,gold);}
  for(let j=0;j<12;j++){const x=370+j*94;ring(x,43,13,8,j%2?mint:ice,1,.6);wake(arc(x,43,13,8),gold,j*.025,1.3,.25);}
 }else if(e.key==='ace'){
  // Five fallen helmet charms settle beneath fluttering banners and team laurels.
  for(let j=0;j<5;j++){const x=483+j*238;helmet(x,57,.55,-.12+j*.055,gold,j*.034);line([[x-35,17],[x+35,17]],ice,1,.61);}
  for(const side of [0,1])for(let j=0;j<4;j++){const x=side?1877:42,y=240+j*111;place(x,y,.9,Math.sin(t*.7+j)*.055,()=>{line([[-18,-31],[-18,35]],gold,1.4,.75);poly([[-18,-27],[21,-27+Math.sin(t*1.1+j)*3],[16,12],[0,4],[-18,12]],ice,.24);line([[-18,-27],[21,-27+Math.sin(t*1.1+j)*3],[16,12]],gold,1,.7);},j*.025);}
  for(let j=0;j<18;j++){const x=340+j*72;w.petal(x,1058+Math.sin(t*.4+j)*5,11,gold,-.3+j*.04,.74);}
  for(let j=0;j<3;j++)wake(u=>[310+u*1290,1048-j*6-Math.sin(u*Math.PI)*11],j%2?mint:gold,j*.15,1.7,.23);
 }else{
  // Allied advantage is a balancing instrument, without invented player counts.
  place(1848,435,1,Math.sin(t*.55)*.035,()=>{line([[0,-82],[0,73]],gold,4,.85);line([[-44,-39],[43,-53]],ice,3,.8);for(const[x,y]of [[-37,-37],[36,-52]]){line([[x,y],[x-18,y+57],[x+18,y+57],[x,y]],gold,.8,.7);ring(x,y+57,23,8,ice,1.3,.7);}poly([[-30,76],[0,66],[30,76],[30,84],[-30,84]],metal([-30,66,30,84],['#d4cbad','#67859b','#a7b4c3']),.83);shard(-37,15,14,mint,.05);shard(36,-5,21,ice,.05);});
  for(let j=0;j<7;j++){const y=241+j*66;shield(47,y,.32,Math.sin(t*.6+j)*.05,j%2?gold:mint,j*.02);}
  for(let j=0;j<3;j++)wake(u=>[340+u*1230,35+j*13+Math.sin(u*10+j)*7],j%2?ice:mint,j*.15,1.6,.22);
  for(let j=0;j<12;j++){const x=365+j*99;ring(x,1059,10,10,gold,1,.65);shard(x,1059,5,mint,.1);}
 }
 c.restore();return true;
}
