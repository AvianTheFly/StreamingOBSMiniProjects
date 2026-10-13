// Element-specific anatomy and habitats; finite cues never recycle particle births.
function paintElementDragon(I,theme,q){
 const {at,line,poly,oval,ring,face,curve}=I,col={earth:'#b8bf9b',fire:'#dda07b',water:'#a0ced0',air:'#bdd5d9',chemtech:'#bacd94',elder:'#c5c2dc',dragon:'#b1c7aa'}[theme];
 for(const s of [-1,1]){
  if(theme==='water'){oval(s*39,23,19,9,col);poly([[s*29,11],[s*61,-7],[s*55,23]],'#bcdad1');}
  else if(theme==='air'){at(s*19,8,1,s*q*.16,()=>{for(let j=0;j<3;j++)poly([[0,13],[s*(40+j*11),-40+j*11],[s*(43+j*6),-5+j*9]],col);});}
  else if(theme==='earth')poly([[s*11,12],[s*40,-19],[s*55,-3],[s*49,31],[s*19,38]],col);
  else if(theme==='elder'){curve(u=>[s*(18+u*39),12-u*29+Math.sin(u*Math.PI)*17],'#adaacb',5);for(let j=0;j<3;j++)oval(s*(23+j*12),-5-j*7,6,13,col);}
  else if(theme==='chemtech')poly([[s*12,17],[s*38,-17],[s*56,-2],[s*34,36]],col);
  else poly([[s*12,17],[s*49,-34-q*14],[s*61,10],[s*31,33]],col);
 }
 if(theme==='earth'){
  poly([[-35,54],[-40,4],[-23,-23],[21,-23],[40,4],[35,54],[0,67]],col);
  for(let j=0;j<3;j++)poly([[-22+j*18,20],[-10+j*18,6],[2+j*18,20],[-10+j*18,33]],'#92ab92','#d2d3af');
  poly([[-31,-14],[-22,-56],[0,-45],[23,-57],[31,-14]],'#bdc49f');face(0,-22);oval(0,-5,16,8,'#d3cfb2');
 }else{
  oval(0,28,29,39,col,'#435269');oval(0,-11,theme==='air'?24:31,27,col,'#435269');
  for(const s of [-1,1]){oval(s*21,62,12,6,col);if(theme==='water'){poly([[s*23,-20],[s*42,-27],[s*32,-8]],'#bcdcd2');line([[s*25,6],[s*33,8]],'#719faa',2);}
   else if(theme==='elder'){curve(u=>[s*(15+u*30),-12+u*12-Math.sin(u*Math.PI)*19],'#dcd9c4',2);oval(s*19,-38,8,8,'#d9d6b7');}
   else if(theme==='air'){curve(u=>[s*(14+Math.sin(u*Math.PI)*18),-31-u*32],'#d4d9be',4);}
   else poly([[s*14,-32],[s*23,-55],[s*26,-22]],'#ded0a8');}
  face(0,-13);oval(0,4,16,10,theme==='chemtech'?'#d3d8a9':'#dfd9b9');
  if(theme==='fire')for(let j=0;j<3;j++)poly([[-10+j*10,39],[-8+j*10,83-j%2*11],[j*10,43]],'#eac28c');
  if(theme==='fire'&&I.finite){const roast=smooth((I.p-.51)/.27);line([[-24,21],[-39,34],[-10,65]],'#c8ae8c',3);I.box(-16,58,14,15,roast>.65?'#d3b38c':'#eee1c3',3);face(-9,65,'happy',.45);}
  if(theme==='chemtech'){ring(-12,-15,8,8,'#dbe0b2',2);ring(12,-15,8,8,'#dbe0b2',2);line([[-4,-15],[4,-15]],'#dbe0b2',2);}
  if(theme==='elder'){curve(u=>[-18+u*36,10+Math.sin(u*Math.PI)*32],'#dddac7',3);oval(0,43,6,6,'#e1d4b1');}
 }
}
export function objectiveStarRoute(u){
 const q=Math.max(0,Math.min(1,u)),points=[[96,591],[96,956],[173,1033],[1748,1033],[1825,956],[1825,493],[1740,427]];
 const lengths=[365,121,1575,121,463,108],total=2753;let d=q*total;
 for(let j=0;j<lengths.length;j++){if(d<=lengths[j]||j===lengths.length-1){const v=d/lengths[j],[a,b]=[points[j],points[j+1]];
   if(j===1)return {x:96+77*(1-Math.cos(v*Math.PI/2)),y:956+77*Math.sin(v*Math.PI/2)};
   if(j===3)return {x:1748+77*Math.sin(v*Math.PI/2),y:1033-77*(1-Math.cos(v*Math.PI/2))};
   return {x:a[0]+(b[0]-a[0])*v,y:a[1]+(b[1]-a[1])*v};}d-=lengths[j];}
}
// Each dragon's habitat is an action: sprouting stone, campfire, rain or wind.
function storyObjectives(c,e){
 const key=e.key;
 if(key==='dragon_hextech')return false;
 if(!['dragon','baron','herald','void_grub','objective_steal','atakhan_legacy'].includes(key)&&!key.startsWith('dragon_'))return false;
 const I=storyInk(c,e),{p,t,finite,at,line,poly,oval,ring,box,star,face,puff,burst,sprout,trim}=I;
 const theme=key.startsWith('dragon_')?key.slice(7):key,cols={earth:'#c4bd98',fire:'#e5a17c',water:'#8bc8c9',air:'#a9ccd8',chemtech:'#b6ce8c',elder:'#c3bfd9',dragon:'#b1cdb1'};
 const col=cols[theme]||'#b2a1d2',q=finite?smooth((p-.1)/.48):.6+.15*Math.sin(t*.7);trim(col,theme==='earth'?'stone':'leaf',finite?1:.55);
 if(theme in cols){
  // A small friendly dragon belongs to the element; the two edges answer each other.
  at(1825,527,finite?1.08:.72,Math.sin(t*.8)*.025,()=>paintElementDragon(I,theme,q));
  at(95,403,finite?1:.8,0,()=>{
   if(theme==='earth'){
    for(let j=0;j<5;j++)at((j-2)*20,62,1,0,()=>poly([[-21,0],[-13,-q*(42+j%2*40)],[4,-q*(58+j%2*35)],[23,0]],j%2?'#aabfa2':'#cfc49f'));
    for(let j=0;j<3;j++)sprout(-29+j*29,52,q,'#9fc3a9');
   }else if(theme==='fire'){
    line([[-37,63],[33,43]],'#bfa27e',10);line([[-32,45],[34,65]],'#bfa27e',10);
    for(let j=0;j<3;j++)poly([[-26+j*18,53],[-25+j*18+Math.sin(t*2+j)*6,-q*(48+j%2*28)],[-2+j*18,53]],j%2?'#edd0a0':col);
    for(let j=0;j<5;j++){const m=storyParticleProgress(p,j,.19,.035,.57),a=finite?m.phase:(t*.23+j*.21)%1;c.save();c.globalAlpha*=finite?(m.visible?Math.sin(a*Math.PI):0):Math.sin(a*Math.PI);star(-38+j*19,20-a*95,4,'#e9c794',a);c.restore();}
   }else if(theme==='water'){
    puff(0,-30,1.2,'#b5cfd3');for(let j=0;j<5;j++){const m=storyParticleProgress(p,j,.2,.043,.43),a=finite?m.phase:(t*.3+j*.19)%1;line([[-44+j*22,-7+a*73],[-47+j*22,6+a*73]],'#a4d3d1',3,(finite?(m.visible?Math.sin(a*Math.PI):0):Math.sin(a*Math.PI))*.65);}
    for(let j=0;j<3;j++)ring(0,72,24+q*30+j*9,7+j*4,'#8fc3c8',2,.8);
    at(18,55-Math.sin(t*1.3)*4,1,0,()=>{if(finite){const umbrella=smooth((p-.46)/.2);line([[-4,0],[-4,-43*umbrella]],'#aac5ad',2);at(-4,-43*umbrella,umbrella,0,()=>{poly([[-33,0],[-17,-17],[0,-22],[17,-17],[33,0],[0,-3]],'#b5cfa8');line([[-27,-1],[0,-21],[26,-1]],'#91b7a4',1.5);});}oval(0,0,19,12,'#e2d094');oval(10,-13,11,11,'#e2d094');poly([[18,-14],[31,-9],[18,-5]],'#d9a276');oval(12,-16,2,2,'#4c5968');});
   }else if(theme==='air'){
    for(let j=0;j<3;j++){const a=finite?smooth((p-.11-j*.04)/.61):(t*.12+j/3)%1;puff(-22+a*45,25-j*36,.65,'#c5dce188');}
    const x=-40+q*80;at(x,-24-Math.sin(q*Math.PI)*40,1,Math.sin(t)*.08,()=>poly([[-23,-9],[27,0],[-21,14],[-10,0]],'#e2d9b4'));
    I.curve(u=>[-56+u*112,62+Math.sin(u*TAU+t)*12],col,2,.6);
   }else if(theme==='chemtech'){
    box(-23,-35,46,16,'#cad49f');poly([[-16,-18],[-16,0],[-42,55],[42,55],[16,0],[16,-18]],'#9bc9ae44');poly([[-30,26],[30,26],[40,54],[-40,54]],'#b5ca82');
    for(let j=0;j<4;j++){const m=storyParticleProgress(p,j,.17,.048,.52),a=finite?m.phase:(t*.2+j*.23)%1;ring(Math.sin(j*3+t)*24,-20-a*78,4+a*10,4+a*10,'#b9cf98',2,(finite&&!m.visible?0:Math.sin(a*Math.PI)));}
    face(0,39);poly([[-29,56],[0,81],[29,56]],'#b9ce94');
    if(finite){const bloom=smooth((p-.59)/.23);sprout(0,-35,bloom,'#b3ce9d');c.save();c.globalAlpha*=bloom;for(let n=0;n<5;n++){const a=n*TAU/5;oval(Math.cos(a)*10,-35-bloom*66+Math.sin(a)*10,7,6,'#dbd2a4');}oval(0,-35-bloom*66,5,5,'#c9b785');c.restore();}
   }else if(theme==='elder'){
    ring(0,-8,38,44,'#c4c7df',3,.8);for(let j=0;j<3;j++)at(-35+j*35,53-q*25,1,Math.sin(t*.7+j)*.08,()=>{oval(0,0,12,18,'#d2d8d7');poly([[-12,6],[-12,19],[-4,14],[0,20],[5,14],[12,19],[12,5]],'#d2d8d7');face(0,-1,'sleep',.8);});
   }else{
    for(let j=0;j<4;j++)poly([[-40+j*25,62],[-31+j*25,14-q*26],[-10+j*25,62]],'#adc4a5');star(0,-40,18,'#dfc998',t*.1);
   }
  });
  // Ambient habitats continue breathing gently rather than replaying a burst.
  for(let j=0;j<9;j++)at(433+j*131,1048,1,Math.sin(t*.6+j)*.09,()=>{
   if(theme==='earth')poly([[-12,8],[-5,-9],[9,-5],[14,8]],col);
   else if(theme==='fire')poly([[-7,8],[0,-12-Math.sin(t+j)*4],[8,8]],col);
   else if(theme==='water')I.curve(u=>[-17+u*34,Math.sin(u*TAU+t)*5],col,2);
   else if(theme==='air')puff(0,0,.4,col+'88');
   else if(theme==='chemtech')ring(0,0,7+Math.sin(t+j),7,col,2,.7);
   else star(0,0,6,col,t*.12+j);
  });
 }else if(key==='baron'){
  at(93,427,1,Math.sin(t)*.05,()=>{for(const s of [-1,1])poly([[s*13,5],[s*54,-38],[s*49,18],[s*28,39]],'#a394c1');oval(0,11,43,58,'#ab95c7','#4f4d68');for(let j=0;j<3;j++)poly([[-17+j*17,-39],[-16+j*17,-75-j%2*14],[-5+j*17,-36]],'#c1b3d5');face(0,-7);oval(0,24,25,12,'#6c668c');for(let j=0;j<4;j++)poly([[-18+j*12,17],[-13+j*12,29],[-7+j*12,17]],'#e0dbbd');});
  at(1827,631,1.16,0,()=>{for(let j=0;j<3;j++){const a=q*TAU*.8+j*TAU/3;I.bean(Math.cos(a)*36,Math.sin(a)*41,.7,'#baacd4',Math.sin(t*3+j));}star(0,0,18,'#d9c695',t*.15);});
 }else if(key==='herald'){
  line([[1777,579],[1877,579]],'#a4bbce',2,.6);
  at(1825,501-Math.sin(q*Math.PI)*28,1.16,Math.sin(q*TAU)*.18,()=>{oval(0,0,48,58,'#b6a4d0','#51516d');for(const s of [-1,1])poly([[s*26,-24],[s*52,-52],[s*45,17],[s*28,36]],'#a4b9c7');oval(0,-5,24,17,'#dac8a0');oval(Math.sin(t)*5,-5,7,13,'#56667c');for(const s of [-1,1])line([[s*22,46],[s*43,67]],'#8c8cab',9);if(finite){const monocle=smooth((p-.63)/.19);c.save();c.globalAlpha*=monocle;ring(0,-5-(1-monocle)*39,27,21,'#e0d0ac',3);I.curve(u=>[27+Math.sin(u*Math.PI)*8,-5+u*51],'#d5c4a6',1.5);c.restore();}});
  for(let j=0;j<7;j++){const x=464+j*162;ring(x,1043,16,8,'#b5a1cb',2,.65);star(x-q*22,1043-Math.sin(q*Math.PI)*28,5,'#d6c9a4');}
  at(95,429,1.16,0,()=>{ring(0,0,49,60,'#a4bbce',2);I.bean(0,q*25,.95,'#b6a4d0',Math.sin(t*3));});
 }else if(key==='void_grub'){
  for(let j=0;j<3;j++)at(j%2?1826:94,314+j*174,1,Math.sin(t*2+j)*.13,()=>{const m=finite?grubHopMotion(p,j):{y:Math.sin(q*Math.PI)*(-23-j*6),sleep:false},hop=m.y;oval(0,hop,35,24,'#b5a3cd','#4c4c68');face(0,hop-2,m.sleep?'sleep':'happy');poly([[-25,hop-9],[-19,hop-37],[-7,hop-18]],'#c9bfda');poly([[25,hop-9],[19,hop-37],[7,hop-18]],'#c9bfda');line([[-38,33],[-23,23],[-10,34],[4,22],[19,33],[38,23]],'#9dafc2',2);});
  for(let j=0;j<6;j++)I.bean(563+j*149,1041,.55,'#b6a5cb',Math.sin(t*4+j));
 }else if(key==='objective_steal'){
  const reach=smooth((p-.16)/.22),travel=smooth((p-.23)/.4),escape=smooth((p-.7)/.16);
  at(1825-reach*25+escape*30,427+escape*63,1,-escape*.25,()=>{oval(0,1,27,31,'#98c3cf','#435269');poly([[-29,-11],[29,-11],[23,8],[-23,8]],'#566981');face(0,-1);line([[-21,19],[-43,19],[-60,0]],'#98c3cf',10);if(travel>=1)star(-60,0,19,'#e3c68e',.2);});
  at(96,611,1.16,0,()=>{box(-43,3,86,44,'#b9a3cc');const iou=smooth((p-.66)/.17);at(0,3-iou*54,iou,0,()=>{box(-28,-18,56,36,'#e5d9b8',2);c.fillStyle='#344459';c.font='600 17px Georgia';c.textAlign='center';c.fillText('IOU',0,6);});line([[-50,-13],[50,-13]],'#b9a3cc',4);face(0,21,travel>0?'sad':'happy');});
  if(travel<1){const m=objectiveStarRoute(travel);star(m.x,m.y,19,'#e3c68e',travel*.4);for(let j=0;j<12;j++){const a=Math.max(0,travel-j*.007),b=Math.max(0,travel-(j+1)*.007),A=objectiveStarRoute(a),B=objectiveStarRoute(b);line([[A.x,A.y],[B.x,B.y]],'#a2c7d3',2,(1-j/12)*.6);}}
 }else{
  at(96,438,1.16,0,()=>{for(let j=0;j<7;j++){const a=j*TAU/7+t*.15;poly([[Math.cos(a)*22,Math.sin(a)*22],[Math.cos(a)*(47+q*17),Math.sin(a)*(47+q*17)],[Math.cos(a+.18)*28,Math.sin(a+.18)*28]],'#c5a1b2');}oval(0,0,22,23,'#a187a3');face(0,0);});
  for(let j=0;j<6;j++)sprout(1825,258+j*97,q,'#b6a0b9');
 }
 return true;
}
