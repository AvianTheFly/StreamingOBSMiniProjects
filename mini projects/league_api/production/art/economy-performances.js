// Four different economy/vision subjects. Actual event titles retain their values.
function economyPerformance(c,e){
 if(!['inventory_added','inventory_removed','cs_milestone','vision_activity'].includes(e.key))return false;
 const ink=eventInk(c,e),{w,o,t,p,line,poly,metal,place,arc,wake,shard,ring,motes}=ink,{coin}=eventProps(ink);
 const ice='#b4e2ed',gold='#e6c98c',mint='#a8ddba',violet='#c6b1e4';
 c.save();
 if(e.key==='inventory_added'){
  // A jewelled satchel opens to receive a gem; little inventory tags hang beside it.
  const q=smooth((p-.06)/.69);
  place(77,445,1,0,()=>{poly([[-41,-40],[38,-40],[43,43],[26,58],[-29,58],[-43,38]],metal([-43,-40,43,58],['#c4c0b4','#556f87','#b6a3ac','#385b7a']),.91);line([[-39,-34],[-33,36],[32,36],[37,-34]],gold,1.3,.72);poly([[-40,-40],[37,-40],[25,-73-q*15],[-28,-73-q*15]],ice,.19);line([[-28,-73-q*15],[25,-73-q*15]],gold,1.3,.76);ring(0,40,9,8,ice,1.3,.75);shard(0,-109+q*95,20,violet,q*.2);});
  for(let j=0;j<8;j++){const y=239+j*64;place(1871,y,1,Math.sin(t*.6+j)*.055,()=>{line([[0,-24],[0,-12]],gold,.8,.65);poly([[-13,-9],[0,-17],[13,-9],[13,15],[-13,15]],ice,.21);ring(0,-6,3,3,gold,1,.7);shard(0,6,6,violet,.1);},j*.02);}
  for(let j=0;j<12;j++){const x=370+j*96;coin(x,1057,.48,Math.sin(t*.6+j)*.1,j*.017);}
  for(let j=0;j<3;j++)wake(u=>[330+u*1250,34+j*12+Math.sin(u*8+j)*7],j%2?violet:gold,j*.15,1.7,.25);
 }else if(e.key==='inventory_removed'){
  // An empty drawer retracts; a departing jewel turns into a few quiet coins.
  const q=smooth((p-.05)/.72);
  place(1845,441,1,0,()=>{poly([[-44,-44],[44,-44],[44,45],[-44,45]],metal([-44,-44,44,45],['#d5cdb5','#6e8b9d','#b1b2c6','#49677d']),.85);poly([[-33,-30],[33,-30],[33,31],[-33,31]],'#1c3e5833',.9);line([[-33,-30],[33,-30],[33,31],[-33,31],[-33,-30]],ice,1,.62);const dy=28*(1-q);poly([[-34,dy],[34,dy],[29,dy+22],[-29,dy+22]],ice,.22);line([[-29,dy+21],[29,dy+21]],gold,1.4,.7);ring(0,dy+11,7,3,gold,1,.7);shard(-q*37,-71-q*52,20,violet,-q*.4);});
  for(let j=0;j<9;j++){const y=247+j*61;coin(43,y,.56,Math.sin(t*.7+j)*.1,j*.022);}
  for(let j=0;j<3;j++)wake(u=>[1590-u*1270,1057-j*9+Math.sin(u*8+j)*6],j%2?ice:gold,j*.15,1.7,.2);
  motes(25,4,.09,(u,j,r,a)=>w.star(1868+Math.sin(j)*26,254+u*440,2+r*2,violet,a*.6));
 }else if(e.key==='cs_milestone'){
  // A gilded harvest sickle, grain sheaves and little earned coin charms.
  place(1842,420,1.05,-.22+Math.sin(t*.6)*.035,()=>{line([[0,-27],[0,84]],gold,5,.85);const path=arc(9,-24,43,67,3.1,6.05);o.ribbon(path,{width:15,color:ice,secondary:gold,phase:t*.2,alpha:.8});line([[0,61],[-11,61],[11,61]],ice,1.2,.6);ring(0,91,8,7,gold,1.5,.8);});
  for(let j=0;j<9;j++){const y=231+j*57;place(46,y,.72,Math.sin(t*.45+j)*.065,()=>{line([[0,29],[0,-34]],gold,1.2,.72);for(let n=0;n<4;n++){w.petal(-8,-26+n*12,10,gold,-.65,.75);w.petal(8,-26+n*12,10,mint,.65,.68);}},j*.02);}
  for(let j=0;j<16;j++){const x=350+j*78;coin(x,1056,.41,Math.sin(t*.5+j)*.1,j*.014);}
  for(let j=0;j<3;j++)wake(u=>[325+u*1260,37+j*13+Math.sin(u*11-t*.4+j)*7],j%2?mint:gold,j*.15,1.7,.23);
 }else{
  // A real ward-like lookout lens pivots while a scan reveals tiny sentinel lights.
  place(74,432,1.04,Math.sin(t*.5)*.03,()=>{poly([[-17,75],[-13,21],[13,21],[17,75]],metal([-17,21,17,75],['#c9ccb9','#567e96','#a2b8c0']),.92);poly([[-34,8],[-27,-46],[0,-69],[28,-46],[34,8],[16,27],[-16,27]],metal([-34,-69,34,27],['#d5d9cc','#526c8b','#9eabc6','#365c7b']),.87);poly([[-26,-24],[0,-43],[26,-24],[0,-7]],'#325475',.7);o.orb(Math.sin(t*.8)*5,-25,12,mint,t*.4,{glass:true,flat:.79});line([[-27,-46],[0,-69],[28,-46]],gold,1.2,.75);ring(0,78,31,9,ice,1.4,.7);});
  for(let j=0;j<4;j++)wake(arc(74,412,39+j*15,91+j*32,.6,5.2),j%2?ice:mint,j*.14,1.6,.18);
  for(let j=0;j<9;j++){const y=225+j*62;place(1871,y,1,0,()=>{poly([[-14,0],[0,-10],[14,0],[0,10]],mint,.17);o.orb(0,0,4,ice,t*.5);line([[-14,0],[0,-10],[14,0]],gold,1,.63);},j*.025);}
  for(let j=0;j<14;j++){const x=350+j*88;ring(x,46,9,5,mint,1,.56);wake(arc(x,46,9,5),ice,j*.021,1.3,.24);}
  for(let j=0;j<3;j++)wake(u=>[330+u*1250,1060-j*7+Math.sin(u*9+j)*5],mint,j*.17,1.4,.2);
 }
 c.restore();return true;
}
