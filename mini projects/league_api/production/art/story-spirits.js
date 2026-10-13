// Four requested Udyr spirits. Turtle, phoenix, ram and bear occupy fixed sections.
function paintUdyrSpirit(I,index,wake){
 const {t,at,line,poly,oval,ring,face,curve}=I,cols=['#8bc4ac','#e7a073','#b9acd9','#98c4d3'],col=cols[index];
 const eyes=wake>.7?'happy':'sleep';
 if(index===0){
  oval(0,14,47,31,col,'#425955');for(const s of [-1,1]){oval(s*30,40,12,7,'#b8d2a9');oval(s*39,4,10,6,'#b8d2a9');}
  poly([[-24,4],[0,-10],[24,4],[24,25],[0,38],[-24,25]],'#679f91','#d0dfa9');line([[0,-10],[0,38]],'#d0dfa9',2);line([[-24,4],[24,25]],'#d0dfa9',2);line([[24,4],[-24,25]],'#d0dfa9',2);
  oval(0,-17-wake*9,20,17,'#c1d8aa','#425955');face(0,-17-wake*9,eyes);
 }else if(index===1){
  for(const side of [-1,1])at(side*13,4,1,side*(-.15-wake*.48+Math.sin(t*2)*.07*wake),()=>{
   for(let j=0;j<4;j++){const end=side*(55+j*5);poly([[side*5,16],[side*22,-1-j*4],[end,-43+j*11],[end-side*11,-7+j*8],[side*20,28]],j%2?'#eab985':col);line([[side*15,14],[end-side*10,-20+j*9]],'#efce99',1.5);}
  });
  for(let j=0;j<3;j++)poly([[-11+j*11,24],[j*12-8,68+Math.sin(t*2+j)*7],[-1+j*11,26]],j%2?'#efcc89':'#e7a073');
  oval(0,0,16,26,'#e9be89','#725b56');oval(0,-26,17,19,'#e9be89','#725b56');poly([[8,-24],[28,-18],[11,-13]],'#e5cc91');face(-3,-28,eyes,.8);for(let j=0;j<3;j++)curve(u=>[-8+j*7+Math.sin(u*Math.PI)*7,-40-u*(17+j%2*8)],col,4);
 }else if(index===2){
  oval(0,20,39,26,'#d2c7df','#545269');for(const s of [-1,1]){line([[s*20,35],[s*23,52]],'#79708e',8);oval(s*23,53,9,4,'#a19ab5');at(s*29,-8,1,0,()=>{ring(0,0,22,23,'#9b82b4',9);curve(u=>{const a=u*TAU*1.4,r=18*(1-u);return[Math.cos(a)*r,Math.sin(a)*r];},'#dacee4',3);});}
  oval(0,-8,23,30,'#d8cfe2','#545269');poly([[-15,-2],[0,18],[15,-2],[0,36]],'#b9acd9');face(0,-9,eyes);
 }else{
  for(const s of [-1,1]){oval(s*25,-29,14,15,'#7bacc0','#3e566c');oval(s*25,-29,7,8,'#bcd7d6');oval(s*26,43,15,10,'#8ab7ca');}
  oval(0,21,40,37,col,'#3e566c');oval(0,-3,34,32,col,'#3e566c');oval(0,11,21,15,'#cadcce');oval(0,7,7,5,'#3e566c');face(0,-7,eyes);for(const s of [-1,1])line([[s*26,14],[s*(43+wake*9),4-wake*22]],'#8ab7ca',13);
  for(const s of [-1,1])at(s*(43+wake*9),4-wake*22,1,0,()=>{oval(0,0,12,13,'#8ab7ca');oval(0,3,6,5,'#c9d9ce');for(let j=0;j<3;j++)oval(-7+j*7,-6,3,4,'#c9d9ce');});
 }
}
function storySpirits(c,e,rest=false){
 const I=storyInk(c,e),{p,t,at,line,curve,oval,star,sprout,trim}=I;
 const centers=[[94,296],[1826,296],[94,744],[1826,744]],cols=['#8bc4ac','#e7a073','#b9acd9','#98c4d3'];
 trim(rest?'#9aaac2':'#b1d2b2','leaf',rest?.5:1);
 centers.forEach(([x,y],j)=>{
  const m=rest?{wake:0,rise:0,scale:.65,lift:0}:spiritChoreography(p,j);
  at(x,y-m.lift,m.scale*1.15,Math.sin(t*.9+j)*.035*m.wake,()=>paintUdyrSpirit(I,j,m.wake));
  oval(x,y+52,57,8,cols[j]+'44');
  if(!rest){
   sprout(x-57,y+48,m.rise,cols[j]);sprout(x+57,y+48,m.rise,cols[j]);
   for(let n=0;n<5;n++){const q=smooth((p-.22-j*.04-n*.045)/.38);c.save();c.globalAlpha*=Math.sin(q*Math.PI)*.8;star(x-55+n*27,y+40-q*135,4+n%2*2,cols[j],q+j);c.restore();}
   if(j===0)for(let n=0;n<3;n++)I.ring(x,y+54,33+n*11,8+n*3,cols[j],1.5,m.rise*.55);
   if(j===1)for(let n=0;n<4;n++)at(x-30+n*20,y+55-p*75,.7,p*.4,()=>I.poly([[0,-12],[7,0],[0,9],[-7,0]],'#edbd80'));
   if(j===2)curve(u=>[x-58+u*116,y+60-Math.sin(u*TAU*2)*m.rise*6],cols[j],2,.65);
   if(j===3)for(const side of [-1,1])for(let n=0;n<3;n++)line([[x+side*(38+n*9),y-18],[x+side*(42+n*9),y-30-m.rise*10]],cols[j],2);
   // Each awakened spirit leaves a different thin contour, never a filled halo.
   const echo=smooth((p-.58-j*.035)/.17);
   curve(u=>{const a=-Math.PI*.8+u*Math.PI*1.6;return[x+Math.cos(a)*(62+echo*12),y-m.lift+Math.sin(a)*(66+echo*9)];},cols[j],1.5,echo*.55);
   for(let n=0;n<3;n++)at(x-35+n*35,y+70-echo*27,.45*echo,(j===1?.6:0),()=>{
    if(j===0){oval(0,0,12,7,cols[j]);line([[0,-6],[0,6]],'#c7dfb6',1);}
    else if(j===1){I.poly([[0,-15],[7,-3],[0,13],[-5,0]],'#e9bd8b');line([[0,-10],[0,10]],'#efdbac',1);}
    else if(j===2)curve(u=>{const a=u*TAU*1.3,r=13*(1-u);return[Math.cos(a)*r,Math.sin(a)*r];},cols[j],2);
    else{oval(0,3,7,5,cols[j]);for(let d=0;d<3;d++)oval(-7+d*7,-5,3,3,cols[j]);}
   });
  }else{at(x+53,y-25,1,Math.sin(t*.5)*.05,()=>{line([[-4,0],[4,0],[-4,10],[4,10]],cols[j],2);});}
 });
 if(!rest){
  // Four colors climb their own sides and meet in a warm sunrise, without a flash.
  for(let j=0;j<4;j++){const q=smooth((p-.31-j*.045)/.38);curve(u=>[344+u*1232,100+Math.sin(u*TAU)*10],cols[j],2,q*.45);}
  const rise=smooth((p-.44)/.32);at(960,1045-rise*18,1,0,()=>{I.puff(0,0,1.4,'#d9d8b755');for(let j=0;j<9;j++){const a=Math.PI+j*Math.PI/8;line([[Math.cos(a)*34,Math.sin(a)*34],[Math.cos(a)*(34+rise*18),Math.sin(a)*(34+rise*18)]],'#e9ce96',2);}oval(0,7,24,24*rise,'#e9ce96');});
 }else{
  at(960,1050,1,0,()=>{curve(u=>[-135+u*270,Math.sin(u*Math.PI)*15],'#aabcc4',3);oval(0,-4,15,17,'#cfdee0');I.face(0,-8,'sleep');});
 }
 return true;
}
