// Tentative signals stay visibly tentative; renderers never confirm game policy.
function storySignals(c,e){
 const key=e.key;if(!key.startsWith('possible_')&&!key.startsWith('custom_'))return false;
 const I=storyInk(c,e),{p,t,at,line,poly,oval,ring,box,star,heart,coin,bean,sprout,trim}=I,q=smooth((p-.19)/.43);
 trim('#b7bccb','leaf',.7);
 const question=(x,y)=>{line([[x-5,y-8],[x-2,y-12],[x+4,y-11],[x+7,y-6],[x+3,y],[x,y+4]],'#ded0a6',2);oval(x,y+11,1.7,1.7,'#ded0a6');};
 at(94,433,1.16,0,()=>{
  if(key==='possible_purchase'){box(-39,-30,78,71,'#c5bea5');coin(-42+q*28,-47+q*21);question(24,-50);}
  else if(key==='possible_item_upgrade'){poly([[-20,0],[0,-37],[20,0],[0,33]],'#b9a8cf');at(0,0,.75+q*.35,0,()=>poly([[-30,3],[0,-54],[30,3],[0,47]],'#b9a8cf33'));question(49,-29);}
  else if(key==='possible_consumable_use'){box(-19,-44,38,18,'#d5c79f');poly([[-14,-25],[-28,36],[28,36],[14,-25]],'#aacdb077');oval(0,10,16,18,'#afcda7');for(let j=0;j<3;j++){const a=smooth((p-.22-j*.07)/.4);ring(-10+j*10,-22-a*36,3+a*4,3+a*4,'#bdcea7',1.2,Math.sin(a*Math.PI));}question(42,-29);}
  else if(key==='possible_base_visit'){poly([[-43,0],[0,-40],[43,0]],'#c1c7b0');box(-32,0,64,53,'#aec6ca');box(-10,19,20*(1-q*.6),34,'#849cae');line([[-42,71],[-24,71],[-24,62]],'#bfc7ad',2);question(0,-64);}
  else if(key==='possible_combat'){for(const s of [-1,1])at(s*(35-q*12),0,1,s*q*.4,()=>{line([[0,35],[0,-27]],'#b9c6b3',5);poly([[0,-47],[11,-23],[0,-14],[-11,-23]],'#b4c8d1');});question(0,-63);}
  else if(key==='possible_low_hp_escape'){line([[-43,32],[-43,-45],[43,-45],[43,32]],'#aec4b2',3);heart(-15+q*28,14-q*24,.95,'#c9aaa9');question(39,-57);}
  else if(key==='possible_teamfight'){for(let j=0;j<4;j++){const a=j*TAU/4+q*.6;bean(Math.cos(a)*39,Math.sin(a)*40,.67,j%2?'#c6acbf':'#9fbbc9',Math.sin(t*3+j));}question(0,0);}
  else if(key==='possible_objective_fight'){star(0,0,24,'#ccbca0');for(const s of [-1,1]){bean(s*(50-q*12),38,.65,s<0?'#a3bbc7':'#b4a4c7',q);question(s*49,-30);}}
  else if(key==='possible_power_spike'){poly([[-23,35],[-10,-5],[0,-50],[14,-4],[25,35]],'#b9afd0');star(0,-11-q*41,11,'#d5c29a');question(45,-43);}
  else if(key==='possible_roam'){I.curve(u=>[-38+u*76,31+Math.sin(u*TAU)*17],'#a6c6cd',2);const x=-31+q*64,u=(x+38)/76;at(x,31+Math.sin(u*TAU)*17,1,Math.atan(17*TAU/76*Math.cos(u*TAU))*.5,()=>poly([[-18,-8],[25,0],[-14,12],[-6,0]],'#d6d0b4'));question(0,-42);}
  else if(key==='possible_jungle_activity'){for(let j=0;j<3;j++)sprout(-28+j*28,49,.7+q*.3,'#b0c7aa');for(const side of [-1,1])oval(side*7,28-q*36-4,6,3,'#bdcea7');oval(0,28-q*36,8,10,'#dbcc9f');question(43,-34);}
  else{ring(0,0,47,52,'#b0bfd0',2);for(let j=0;j<4;j++)star(Math.cos(j*TAU/4+t*.2)*35,Math.sin(j*TAU/4+t*.2)*38,9,'#cbbbd8',j);star(0,0,14,'#dfcca1');}
 });
 at(1826,584,1.16,0,()=>{if(key.startsWith('custom_')){for(let j=0;j<4;j++){const a=j*TAU/4;star(Math.cos(a)*(26+q*19),Math.sin(a)*(26+q*24),7,'#b5bfd0',a);}poly([[0,-26],[-19,0],[0,26],[19,0]],'#c5b7d4');}else{bean(0,23,1.2,'#bdc4b0',q*.4);question(0,-34);ring(0,17,49+q*12,58+q*6,'#b3c4d0',1.5,.4);}});
 for(let j=0;j<7;j++){const x=522+j*146;line([[x-18,1047],[x-9,1047]],'#c5c7be',2,.6);line([[x,1047],[x+8,1047]],'#c5c7be',2,.6);if(key.startsWith('possible_'))question(x+24,1047+Math.sin(t+j)*3);else star(x+24,1047,5,'#c3b7d1');}
 return true;
}
