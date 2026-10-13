// Victory tricks, teamwork and survival: props visibly cause their consequences.
function storyCombat(c,e){
 const keys=['kill','assist','first_blood','low_hp_kill','low_hp_multikill','manpower_advantage'];
 if(!keys.includes(e.key))return false;
 const I=storyInk(c,e),{p,t,at,line,poly,oval,ring,box,star,heart,face,burst,bean,trim}=I;
 const rank={double_kill:2,triple_kill:3,quadra_kill:4,pentakill:5,low_hp_multikill:3,ace:5}[e.key]||1;
 const hit=smooth((p-.19)/.24),cheer=smooth((p-.54)/.2);trim(e.key==='assist'?'#9fceb9':'#d5a0b7','star');
 if(e.key==='assist'){
  // Two hands meet, then their shared vine unfolds on both margins.
  for(const s of [-1,1])at(94+s*(43-hit*29),404,1,s*(.2-hit*.2),()=>{line([[0,60],[0,8]],s<0?'#9bbacc':'#b6c9a3',16);oval(0,0,14,18,'#e9c9a3','#344459');for(let j=0;j<3;j++)line([[-8+j*7,-7],[-8+j*7,-24]],'#e9c9a3',5);});
  burst(94,390,(p-.43)/.26,'#e9ce99',42);I.sprout(1826,648,cheer,'#9fceb9');heart(1826,557,cheer*.75,'#e3a5b8');
  for(let j=0;j<8;j++)at(506+j*133,1048,1,0,()=>{line([[-17,-3],[0,cheer*8],[17,-3]],j%2?'#b7d7b4':'#a3c9d4',3);});
 }else if(e.key==='first_blood'){
  at(95,440,1.16,0,()=>{box(-39,-33,78,91,'#d596a4');oval(0,-34,40,12,'#e6b2b7','#344459');for(let j=0;j<5;j++){const q=smooth((p-.28-j*.025)/.28);c.save();c.globalAlpha*=Math.sin(q*Math.PI);oval(-32+j*16,-45-q*104+q*q*50,5+j%2*2,7,'#e6c28d');c.restore();}star(0,8,24,'#edce94',-.08);face(0,40);});
  at(1828,604,1.16,-.12+cheer*.2,()=>{poly([[-45,14],[-35,-30],[-13,-7],[0,-47],[16,-7],[36,-30],[45,14]],'#dec38f');box(-45,14,90,17,'#b9cca7');});
 }else if(e.key==='low_hp_kill'||e.key==='low_hp_multikill'){
  const wobble=(1-cheer)*Math.sin(t*9)*.12;
  at(95,425,1.16,wobble,()=>{const cape=smooth((p-.61)/.2);c.save();c.globalAlpha*=cape;poly([[-14,8],[-51*cape,62],[-8,48],[21,59],[19,8]],'#b6aad2');c.restore();heart(0,0,1.4,'#d99aaa');face(0,-3,cheer>.5?'happy':'sad');line([[-56,65],[56,65]],'#a6c5bd',3);for(let j=0;j<rank;j++)star(-34+j*31,65-hit*110-j%2*13,12,'#e8ce93',t*.25+j);});
  at(1825,555,1.16,0,()=>{box(-46,-24,92,57,'#a9cbb8');box(-35,-13,8,31,'#dbadb3');line([[-37,47],[-22,47],[-16,38],[-8,56],[0,47],[36,47]],'#d6b6b9',2);heart(0,4,.65,'#dda8b6');});
 }else if(e.key==='manpower_advantage'){
  for(let j=0;j<4;j++)bean(510+j*188,1038,.85,'#aacbd1',Math.sin(t*4+j));
  bean(1470-smooth((p-.16)/.4)*204,1038,.85,'#d7c897',Math.sin(t*4));
  at(94,432,1.16,0,()=>{for(let j=0;j<3;j++)bean((j-1)*35,j%2*16,.9,'#a8c8bb',cheer);star(0,-55,15,'#dfc897');});
  for(let j=0;j<3;j++)star(1827,353+j*84,8+cheer*5,'#a4cbd5',t*.2+j);
 }else if(e.key==='kill'){
  at(95,409,1.16,-.15+hit*.4,()=>{line([[0,66],[0,-43]],'#b9c8ae',7);poly([[0,-77],[17,-41],[0,-29],[-17,-41]],'#a8c6d4');line([[-27,0],[27,0]],'#dfc893',6);});
  // Target/blade contact and the surrender flag are drawn together by theaterTarget.
 }
 return true;
}
function storyVital(c,e){
 if(e.key==='respawn')return storySpirits(c,e);
 if(e.key==='death')return storySpirits(c,e,true);
 if(!['low_health','heavy_health_loss','large_heal'].includes(e.key))return false;
 const I=storyInk(c,e),{p,t,at,line,poly,oval,ring,box,heart,face,puff,burst,trim}=I;
 const heal=e.key==='large_heal',impact=e.key==='heavy_health_loss',q=smooth((p-.24)/.38);trim(heal?'#9ecdb5':'#d0a1b2','leaf');
 at(94,451,1.16,Math.sin(t*(impact?7:2))*.05*(1-q),()=>{
  if(heal){box(-30,24,60,54,'#a9c9b5');poly([[-30,27],[-26,-25],[26,-25],[30,27]],'#c8d7b444');line([[-8,48],[8,48]],'#e7dcc0',6);line([[0,40],[0,56]],'#e7dcc0',6);for(let j=0;j<4;j++){const age=smooth((p-.2-j*.065)/.36);c.save();c.globalAlpha*=Math.sin(age*Math.PI);heart((j-1.5)*20,0-age*92,.4,'#b2d7b9');c.restore();}}
  else{heart(0,4,1.65,'#d4a0b0');face(0,0,impact&&q>.5?'happy':'sad');if(impact){const band=smooth((p-.58)/.16);at(0,2,band,-.17,()=>{box(-31,-9,62,18,'#e4d0a5');box(-9,-8,18,16,'#eee0be');});burst(0,0,(p-.22)/.28,'#e0bd98',55);}else{line([[-53,66],[-18,66],[-10,54],[0,79],[11,63],[51,63]],'#d2b6ba',3);}}
 });
 at(1828,593,1.16,0,()=>{if(heal){puff(0,45,1.8,'#a6cbd14d');I.sprout(0,54,q,'#9fc8af');heart(0,1-q*51,.9,'#d5b5c6');}else{box(-45,-29,90,56,'#a4b7c4');box(-37,-20,impact?Math.max(5,73*(1-q*.82)):8,36,'#d7a3ad');face(0,6,'sad');}});
 if(heal)for(let j=0;j<10;j++){const x=420+j*122;I.sprout(x,1058,smooth((p-.16-j*.025)/.42),'#a7cbb5');}
 else for(let j=0;j<8;j++)at(476+j*141,1049,1,0,()=>{line([[-20,0],[-6,0],[0,-7],[6,7],[12,0],[21,0]],'#c6abb7',2,.65);});
 return true;
}
