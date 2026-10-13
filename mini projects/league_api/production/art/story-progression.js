// Earned upgrades have physical arrivals, slots, staircases and growing gardens.
export function energyGaugeMotion(p){const q=smooth((p-.14)/.45);return {top:-37+q*88,height:88*(1-q)};}
export function levelStepMotion(p){const q=smooth((p-.14)/.45),step=q*3,i=Math.min(2,Math.floor(step)),f=step-i;return {x:-43+i*26+f*26,y:36-i*27-f*27-Math.sin(f*Math.PI)*17,landed:q===1,platform:-27};}
function storyProgression(c,e){
 const keys=['resource_spent','level_up','ultimate_learned','ability_rank_up','inventory_added','inventory_removed','cs_milestone','vision_activity'];
 if(!keys.includes(e.key))return false;
 const I=storyInk(c,e),{p,t,at,line,poly,oval,ring,box,star,face,puff,burst,sprout,coin,bean,trim}=I;
 const q=smooth((p-.14)/.45),final=smooth((p-.64)/.2),col=e.key.includes('inventory')?'#d7c295':'#a8c7bd';trim(col,e.key.includes('level')?'star':'leaf');
 if(e.key==='level_up'){
  at(94,486,1.16,0,()=>{for(let j=0;j<4;j++)box(-53+j*26,54-j*27,27,13,'#b5cabb');const m=levelStepMotion(p);bean(m.x,m.y,.75,'#a7c7d0',Math.sin(q*TAU*2)*(1-final));star(47,-58,19,'#e1c995');});
  for(let j=0;j<6;j++)at(1826,295+j*76,1.16,0,()=>poly([[-22,10],[0,-10-q*9],[22,10],[0,0]],j%2?'#b8cda8':'#d8c694'));
 }else if(e.key==='ultimate_learned'){
  at(94,426,1.16,0,()=>{box(-36,-24,72,64,'#aeb7cb');line([[0,2],[0,18]],'#e5d4a9',7);at(26,-25,1,q*.58,()=>{I.curve(u=>[-52+u*52,-Math.sin(u*Math.PI)*34],'#b8a3cb',7);});star(0,-26-q*65,23,'#e3c898',q*.4);face(0,26);});
  for(let j=0;j<4;j++)at(1826,295+j*125,.58+.3*smooth((p-.25-j*.045)/.3),0,()=>paintUdyrSpirit(I,j,final));
  for(let j=0;j<4;j++)star(684+j*181,1041,12+final*4,['#a6c9ad','#dfaa7e','#b5a1cf','#9fc6d2'][j],t*.1+j);
 }else if(e.key==='ability_rank_up'){
  at(1826,467,1.16,0,()=>{for(let j=0;j<3;j++){box(-40,45-j*37,80,25,j/3<q?'#b4c9aa':'#829dad');if(j/3<q)star(0,57-j*37,8,'#e1cea1');}poly([[-24,-63],[0,-87],[24,-63],[0,-71]],'#abcad3');});
  at(95,610,1.16,0,()=>{bean(0,-final*20,1,'#b6c8b2',Math.sin(t*2));burst(0,-25,(p-.55)/.3,'#dec994');});
 }else if(e.key==='resource_spent'){
  const last=emptyDropMotion(p);at(96,435,1.16,last.shake,()=>{box(-29,-54,58,115,'#a3c2cd');const gauge=energyGaugeMotion(p);box(-20,gauge.top,40,gauge.height,'#688baf',0);for(let j=0;j<4;j++)line([[-20,-30+j*23],[-10,-30+j*23]],'#d3e0ca',2);face(0,35);});
  if(last.visible){c.save();c.globalAlpha*=Math.sin(last.age*Math.PI);at(96+last.x*1.16,435+last.y*1.16,.5,0,()=>poly([[0,-12],[7,0],[0,9],[-7,0]],'#9bbdce'));c.restore();}
  for(let j=0;j<5;j++){const age=smooth((p-.12-j*.045)/.5);at(1827+Math.sin(j)*21,680-age*299,1,age*.4,()=>poly([[0,-16],[10,0],[0,11],[-10,0]],'#9bbdce'));}
 }else if(e.key==='inventory_added'||e.key==='inventory_removed'){
  const add=e.key==='inventory_added',travel=add?1-q:q;
  at(96,458,1.16,0,()=>{box(-45,-15,90,70,'#b6bea1');poly([[-45,-15],[-47,-34-q*21],[46,-34-q*21],[45,-15]],'#d7c5a0');face(0,25,add?'happy':'sleep');const wave=Math.sin(final*Math.PI);line([[44,26],[57,12],[63,6-wave*20]],'#b6bea1',6);oval(63,6-wave*20,6,7,'#cbd0ac');});
  at(1826,545,1.16,0,()=>{box(-42,-30,84,78,'#b5c2c7');box(-30,-18,60,45,'#829fae');poly([[-20+travel*38,5-travel*94],[travel*38,-16-travel*94],[20+travel*38,5-travel*94],[travel*38,26-travel*94]],'#e0cda2');if(add)burst(0,0,(p-.55)/.28,'#d9c49e');});
  for(let j=0;j<6;j++)coin(599+j*147,1044-Math.sin(q*Math.PI)*14,.6);
 }else if(e.key==='cs_milestone'){
  for(let j=0;j<4;j++)at(j%2?1826:94,288+Math.floor(j/2)*327,1,0,()=>{
   const cut=smooth((p-.45-j*.025)/.22);sprout(0,74,1-cut,'#abc8a1');c.save();c.globalAlpha*=1-cut;for(let n=0;n<3;n++)oval(-10+n*10,27-n%2*13+cut*17,5,12,'#ddc792');c.restore();c.save();c.globalAlpha*=cut;coin(-20+cut*20,48-cut*51,.8);c.restore();box(-32,66,64,21,'#c1b99a');
  });
  for(let j=0;j<9;j++){const x=437+j*131;const a=smooth((p-.18-j*.027)/.35);sprout(x,1056,a,'#b3c7a3');}
 }else{
  at(94,431,1.16,0,()=>{line([[0,34],[0,81]],'#b4c6a7',8);poly([[-39,0],[0,-27],[39,0],[0,27]],'#a6c7bc');oval(0,0,13,17,'#dbc99e');oval(Math.sin(t)*4,0,5,10,'#456070');for(let j=0;j<3;j++)ring(0,0,44+q*16+j*9,34+q*17+j*8,'#b7d2c1',1.5,.4);});
  at(1826,605,1.16,0,()=>{bean(0,25-q*17,.9,'#c0cda9',q);poly([[-24,3-q*17],[-13,-16-q*17],[0,-10-q*17],[13,-16-q*17],[24,3-q*17],[0,-1-q*17]],'#a4c49e');line([[14,24-q*17],[28,19-q*17],[34,8-q*17-Math.sin(final*Math.PI)*14]],'#b5c8a4',5);c.save();c.globalAlpha*=1-q;puff(0,8,1.7,'#a9b9c56b');c.restore();star(0,-33,9,'#d8ca9f');});
  for(let j=0;j<7;j++)ring(529+j*146,1044,7+q*5,7+q*5,'#a2c6bd',2,.7);
 }
 return true;
}
function storyLifecycle(c,e){
 if(!['game_start','minions_spawning','victory','defeat','game_end'].includes(e.key))return false;
 const I=storyInk(c,e),{p,t,at,line,poly,oval,ring,box,star,face,puff,burst,bean,trim}=I,q=smooth((p-.16)/.49);
 trim(e.key==='defeat'?'#aebacd':'#cdbd9a',e.key==='victory'?'star':'leaf');
 if(e.key==='game_start'){
  for(const side of [0,1])at(side?1826:94,422,1,0,()=>{box(-51,-77,102,159,'#b5c5b3');box(-38,-64,76,143,'#809da2');for(const s of [-1,1])at(s*q*32,0,1,0,()=>box(s<0?-36:0,-64,36,143,'#bccbaa'));bean(0,57-q*23,.85,'#d4c69e',Math.sin(t*3));star(0,-107,14,'#e2cc9b');});
  for(let j=0;j<7;j++)bean(507+j*154,1040,.54,'#a9c9cb',Math.sin(t*4+j));
 }else if(e.key==='minions_spawning'){
  for(const top of [0,1])for(let j=0;j<9;j++)bean(427+j*122+q*49,top?1027:95,.57,top?'#c0b2d1':'#a5c6d0',Math.sin(t*5+j));
  for(const side of [0,1])at(side?1826:94,side?638:387,1,0,()=>{line([[0,-56],[0,67]],'#b8c8ad',5);poly([[0,-56],[50,-44],[0,-22]],side?'#b9a8ca':'#a1c2cd');bean(0,44,1,side?'#bdaed0':'#a8cad0',Math.sin(t*5));});
 }else if(e.key==='victory'){
  at(94,407,1.16,-.06+q*.1,()=>{poly([[-49,-43],[49,-43],[34,16],[0,34],[-34,16]],'#ddc394');for(const s of [-1,1])I.curve(u=>[s*(40+Math.sin(u*Math.PI)*29),-34+u*49],'#d6b985',6);line([[0,32],[0,65]],'#d4bc90',9);box(-34,62,68,17,'#c0c9a5');face(0,-10);star(0,-78-q*20,18,'#e9d2a4');});
  at(1826,585,1.16,Math.sin(t)*.06,()=>{bean(0,0,1.5,'#b5c9b3',Math.sin(t*3));poly([[-22,-37],[-29,-64],[-9,-52],[0,-75],[11,-52],[29,-64],[22,-37]],'#e0c595');});
  for(let j=0;j<16;j++){const qj=smooth((p-.23-j*.014)/.46);at(362+j*80,1034-Math.sin(qj*Math.PI)*28,.7,qj+j,()=>poly([[-4,-8],[6,-6],[4,8],[-5,5]],['#d9bf92','#a6c9c8','#cbb1cf'][j%3]));}
 }else if(e.key==='defeat'){
  at(94,452,1.16,0,()=>{puff(0,-67,1.4,'#a8b7cc');face(0,-64,p>.73?'happy':'sad');for(let j=0;j<4;j++){const m=storyParticleProgress(p,j,.18,.048,.4),rain=m.phase;line([[-34+j*22,-39+rain*82],[-37+j*22,-29+rain*82]],'#bccbda',2,m.visible?Math.sin(rain*Math.PI)*.5:0);}I.sprout(0,71,q,'#acc5b0');const thanks=smooth((p-.62)/.19);for(const s of [-1,1])at(s*16,39,thanks,s*(-.6-Math.sin(thanks*Math.PI)*.22),()=>oval(0,0,20,6,'#b8d0b0'));star(0,6,9*q,'#ddcb9f');});
  at(1826,625,1.16,0,()=>{box(-40,-7,80,35,'#c2b9ce');poly([[-48,-11],[-8,-21],[0,-10],[8,-21],[48,-11],[41,35],[0,22],[-41,35]],'#d8d4bc');line([[0,-10],[0,22]],'#9e99b3',2);poly([[3,21],[3+q*42,-13-q*24],[46,35]],'#c7d0c4');});
  for(let j=0;j<7;j++)I.sprout(528+j*145,1062,smooth((p-.39-j*.03)/.35),'#adc6b2');
 }else{
  at(94,441,1.16,0,()=>{const close=smooth((p-.31)/.43),width=40*(1-close);box(-46,-59,52+width,130,'#b9c7c1');poly([[-40,-50],[0,-40],[width,-50],[width*.875,58],[0,48],[-35,58]],'#d9d6bd');line([[0,-40],[0,48]],'#9baaa6',2);for(let j=0;j<4;j++)line([[-30,-28+j*16],[-8,-25+j*16]],'#a6b8bb',2);at(width*.5,-13,Math.max(.01,1-close),0,()=>star(0,0,12,'#ccbb94'));const mark=smooth((p-.14)/.16);poly([[-18,-79+mark*29],[-6,-79+mark*29],[-6,58+mark*29],[-12,51+mark*29],[-18,58+mark*29]],'#d4b5c7');poly([[0,-40],[-close*35,-50],[-close*40,58],[0,48]],'#a8beb6');});
  at(1826,569,1.16,0,()=>{line([[0,66],[0,-56]],'#aac3bc',5);poly([[0,-56],[49,-44],[0,-22]],'#b1cbd0');bean(0,43,1,'#c5c7aa',q);});
  for(let j=0;j<9;j++)star(448+j*129,1045,5+(1-q)*6,'#c8c8aa',q+j*.3);
 }
 return true;
}
