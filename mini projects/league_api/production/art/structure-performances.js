// Architectural events have separate destruction, reward and reassembly acts.
function structurePerformance(c,e){
 if(!['turret_destroyed','first_turret','inhibitor_destroyed','inhibitor_respawning_soon','inhibitor_respawned'].includes(e.key))return false;
 const {w,o,t,p,line,poly,metal,place,arc,wake,shard,ring,motes}=eventInk(c,e);
 const ice='#a8deef',gold='#e4c78a',pink='#cbade8';
 c.save();
 if(e.key==='turret_destroyed'){
  // A broken watchtower dismantles into measured masonry, not an impact flash.
  const q=smooth((p-.09)/.68);
  place(1850,400,1,0,()=>{
   poly([[-44,82],[-38,62],[38,62],[44,82]],metal([-44,62,44,82],['#b2c2c3','#52677e','#9baab4','#354e66']));
   for(let j=0;j<6;j++){const dy=q*q*(28+j*4),dx=Math.sin(j*2.4)*q*(15+j*4),angle=(j%2?1:-1)*q*.25;place(dx,42-j*22+dy,1,angle,()=>{poly([[-29,-14],[29,-14],[31,8],[-31,8]],metal([-31,-14,31,8],['#c9c9b5','#6c8490','#a0b3c1','#435e79']));line([[-24,-8],[24,-8]],ice,1,.55);});}
   place(q*18,-93+q*q*69,1,q*.22,()=>{poly([[-38,0],[-38,-24],[-23,-24],[-23,-9],[-8,-9],[-8,-29],[8,-29],[8,-9],[23,-9],[23,-24],[38,-24],[38,0]],metal([-38,-29,38,0],['#d8d3af','#738da1','#b4c2c5','#52677f']),.9);});
   shard(0,-102+q*q*92,18,ice,q*1.2);ring(0,80,57,12,gold,1,.67);
  });
  for(let j=0;j<11;j++){const y=233+j*48,x=35+Math.sin(j*2.1)*23;place(x,y+q*q*25,1,q*Math.sin(j)*.2,()=>{poly([[-14,-8],[15,-12],[19,7],[-9,11]],metal([-14,-12,19,11],['#b3c4c2','#566e86','#a8b4ad']),.7);line([[-10,-5],[8,-8]],gold,1,.7);},j*.02);}
  for(let j=0;j<3;j++)wake(pathOf([[14+j*14,930],[14+j*14,555],[49+j*14,520],[49+j*14,177]]),ice,j*.13,1.7,.18);
  for(let j=0;j<14;j++){const x=340+j*87;line([[x,1052],[x+42,1052],[x+42,1074]],gold,1,.52);wake(u=>[x,1052+u*22],ice,j*.023,1.4,.5);}
  motes(28,4,.09,(u,j,r,a)=>shard(j%2?1868+Math.sin(j)*26:49+Math.sin(j)*22,340+u*397,3+r*4,ice,j*.5+u));
 }else if(e.key==='first_turret'){
  // First structure reward: a gold foundation seal opens a small coin treasury.
  place(82,436,1.03,-.05,()=>{
   poly([[-37,68],[-29,25],[-27,-58],[27,-58],[29,25],[37,68]],metal([-37,-58,37,68],['#d7c59a','#637c88','#b7b493','#3e6175']));
   poly([[-41,-56],[-41,-78],[-24,-78],[-24,-67],[-9,-67],[-9,-84],[9,-84],[9,-67],[24,-67],[24,-78],[41,-78],[41,-56]],metal([-41,-84,41,-56],['#ead79f','#677f8d','#cfba84','#405e73']));
   ring(0,4,24,31,gold,2,.9);shard(0,4,17,ice,0);line([[-37,68],[37,68]],gold,2,.88);for(let j=0;j<4;j++)line([[-22,28+j*8],[22,28+j*8]],ice,1,.5);
  });
  for(let j=0;j<12;j++){const x=357+j*103,y=1052-Math.sin(p*3+j)*7;place(x,y,1,Math.sin(t*.8+j)*.13,()=>{o.orb(0,0,11,gold,t*.5+j,{flat:.9});ring(0,0,8,8,ice,1,.7);line([[-2,-4],[2,-4],[-2,4],[2,4]],gold,1.3);},j*.018);}
  for(let j=0;j<7;j++){const y=225+j*73;place(1871,y,1,0,()=>{ring(0,0,23,14,gold,1.5,.72);poly([[-7,-5],[0,-12],[7,-5],[4,8],[-4,8]],ice,.6);},j*.022);wake(u=>[1850-u*31,y-15+u*40],gold,j*.04,1.4,.3);}
  for(let j=0;j<3;j++)wake(u=>[330+u*1240,38+j*12+Math.sin(u*Math.PI)*20],j%2?gold:ice,j*.17,2,.28);motes(28,4,.12,(u,j,r,a)=>w.star(j%2?1881:55,930-u*710,2+r*3,gold,a*.65));
 }else if(e.key==='inhibitor_destroyed'){
  // A magenta crystal loses containment; individually engraved facets drift out.
  const q=smooth((p-.07)/.76);
  place(1838,427,1.1,0,()=>{
   ring(0,85,53,17,ice,2,.7);line([[-45,75],[-45,100],[45,100],[45,75]],gold,1.2,.65);
   for(let j=0;j<8;j++){const a=j*TAU/8,x=Math.cos(a)*(13+q*38),y=-6+Math.sin(a)*(42+q*39);shard(x,y,22+5*(j%3),j%2?pink:ice,a*.3+q*Math.sin(j)*.7);line([[x,y-10],[x+4,y+12]],gold,.8,.5);}
   for(let j=0;j<4;j++)wake(arc(0,0,42+q*24+j*9,73+q*17+j*8),j%2?pink:ice,j*.09,1.5,.19);
  });
  for(let j=0;j<9;j++){const y=224+j*56;shard(50+Math.sin(j)*19+q*Math.cos(j)*18,y+q*14,11+j%3*3,pink,j*.5+q*.4);wake(u=>[20+u*56,y-10+u*34],ice,j*.035,1.5,.34);}
  for(let j=0;j<3;j++)o.ribbon(u=>[330+u*1240,1059+Math.sin(u*15+t*.4+j)*11-j*6],{width:5,color:pink,secondary:ice,phase:t*.5+j,glass:true,alpha:.54});
  motes(36,4,.07,(u,j,r,a)=>w.star(j%2?1854+Math.sin(j+u*5)*34:48+Math.sin(j+u*4)*28,290+u*443,2+r*3,pink,a*.65));
 }else if(e.key==='inhibitor_respawning_soon'){
  // A dormant crystal clock: three offset countdown arcs and sleeping fragments.
  place(76,451,1,0,()=>{
   for(let j=0;j<3;j++){const r=39+j*12;wake(arc(0,0,r,r*1.57,.3+j*.5,5.5+j*.5),j%2?gold:pink,j*.14,1.8,.18);}
   for(let j=0;j<5;j++){const y=-54+j*27;shard(Math.sin(j+t*.3)*7,y,16,pink,.3+Math.sin(t*.4+j)*.06);}
   line([[-23,81],[23,81]],gold,2,.7);ring(0,81,35,8,ice,1,.5);
   for(let j=0;j<12;j++){const a=j*TAU/12;line([[Math.cos(a)*68,Math.sin(a)*104],[Math.cos(a)*74,Math.sin(a)*113]],ice,j%3===0?2:1,.58);}
  });
  for(let j=0;j<9;j++){const y=230+j*52;place(1874,y,1,.15,()=>{poly([[-13,0],[0,-18],[13,0],[0,18]],pink,.17);line([[-13,0],[0,-18],[13,0]],ice,1,.6);ring(0,0,3,3,gold,1,.7);},j*.019);}
  for(let j=0;j<15;j++){const x=348+j*83;line([[x,49],[x,23],[x+17,14],[x+34,23],[x+34,49]],pink,.9,.46);wake(u=>[x+17,47-u*32],gold,j*.025,1.5,.24);}
  for(let j=0;j<3;j++)wake(u=>[1570-u*1250,1060-j*7+Math.sin(u*9+t*.3+j)*6],ice,j*.19,1.4,.21);
 }else{
  // Rebirth: floating fragments snap softly into a restored central crystal.
  const q=smooth((p-.04)/.65);
  place(1842,440,1.12,0,()=>{
   for(let j=0;j<6;j++){const a=j*TAU/6,spread=(1-q)*34;shard(Math.cos(a)*spread,-28+Math.sin(a)*spread,27,j%2?ice:pink,a*.23*(1-q));}
   shard(0,-28,53,pink,.03,true);line([[0,-81],[0,24]],ice,1.4,.8);ring(0,64,51,14,gold,1.7,.8);ring(0,73,45,13,ice,1,.6);line([[-35,70],[-35,90],[35,90],[35,70]],gold,1.3,.7);
   for(let j=0;j<3;j++)wake(arc(0,-28,38+j*12,69+j*14),j%2?gold:ice,j*.13,1.9,.22);
  });
  for(let j=0;j<13;j++){const y=230+j*39;place(44,y,1,0,()=>{shard(0,0,11,pink,0);line([[-17,8],[0,-11],[17,8]],ice,1.4,.71);},j*.015);}
  for(let j=0;j<4;j++)wake(u=>[330+u*1250,29+j*11+Math.sin(u*Math.PI)*25],j%2?pink:gold,j*.11,1.8,.28);
  motes(32,4.7,.085,(u,j,r,a)=>{const x=j%2?1879+Math.sin(j)*23:46+Math.sin(j)*25;shard(x,1000-u*804,3+r*5,ice,j*.3);});
 }
 c.restore();return true;
}
