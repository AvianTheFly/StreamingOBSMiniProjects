// Six separate romance performances, grounded in the local clips and their tone.
const SOUND_ROMANCE_STORIES={
 romance:'A nervous rose courier drops a rose, reaches for its stem, catches it and blushes.',
 rizz:'A tiny charm merchant slides sunglasses on, offers a rose and gets a bashful heart receipt.',
 weeknd:'A late-night microphone serenade makes a tiny moon blush; the record wobbles and settles.',
 love:'The local Super Idol singer gets an ice-cream microphone; the sweet serenade grows a flower that claps once.',
 catlove:'The local spinning cat under a moon gets a banana-shaped dance floor and a moonlit cat duet.',
 falling:'The local Cena/Cupid edit becomes a clumsy heart archer: the arrow loops around and charms its own sender.',
};
function soundRomance(c,elapsed,d,e){
 const key=e.scene||e.style;if(!SOUND_ROMANCE_STORIES[key])return false;
 const I=cultureInk(c,elapsed,d,e),{p,beat,local,line,shape,disc,box,ring,word,event,curve,sparkle,burst}=I,ink='#39475d',t=Math.min(elapsed,d*.86),settle=1-smooth((p-.75)/.12);
 const q=smooth((p-.19)/.38),end=smooth((p-.7)/.19),rose='#d7a8be',mint='#b2c8ac',paper='#e5d4ad';
 const heart=(x,y,s,color=rose)=>local(x,y,s,0,()=>{c.beginPath();c.moveTo(0,14);c.bezierCurveTo(-29,-5,-11,-28,0,-12);c.bezierCurveTo(11,-28,29,-5,0,14);c.fillStyle=color;c.fill();c.strokeStyle=ink;c.lineWidth=2;c.stroke();});
 const roseProp=(x,y,s,a=0)=>local(x,y,s,a,()=>{line([[0,38],[0,-4]],mint,4);for(const side of [-1,1])disc(side*12,17,13,5,mint);for(let j=0;j<5;j++){const a=j*TAU/5;disc(Math.cos(a)*9,Math.sin(a)*9,12,9,rose,ink,1);}ring(0,0,6,7,'#e7c4cf',2);});
 const cat=(x,y,s,a,phase)=>local(x,y,s,a,()=>{disc(0,30,28,24,'#b4bcca',ink);disc(0,0,30,27,'#c7c4ce',ink);shape([[-28,-7],[-27,-35],[-10,-20]],'#c7c4ce',ink);shape([[28,-7],[27,-35],[10,-20]],'#c7c4ce',ink);for(const side of [-1,1]){curve(u=>[side*9-5+u*10,-2-Math.sin(u*Math.PI)*4],ink,2);line([[side*15,11],[side*39,8]],'#9ca7b5',1.5);}disc(0,9,4,3,rose);line([[-5,17],[0,20],[5,17]],ink,1.5);curve(u=>[24+Math.sin(u*Math.PI)*30,32-u*39+Math.sin(t*2+phase)*4],'#b4bcca',8);});
 for(const side of [0,1])for(let j=0;j<6;j++){const x=side?1900:20,y=245+j*89;heart(x,y,.25+Math.sin(t*.9+j)*.03,j%2?rose:'#b6c9ce');}
 for(const bottom of [0,1])curve(u=>[380+u*1170,(bottom?1050:56)+Math.sin(u*10+t*.7)*7],rose,1.8,.45);
 if(key==='romance'){
  const m=roseCourierMotion(p),fumble=Math.sin(smooth((p-.32)/.41)*Math.PI);
  local(95,444,1.2,-fumble*.2,()=>{box(-26,-18,52,65,11,'#b6b5cc',ink);disc(0,-44,23,27,paper,ink);for(const side of [-1,1]){disc(side*9,-48,2,3,ink);line([[side*19,37],[side*25,65]],'#a5a9c1',8);}line([[-6,-30],[5,-28],[10,-32]],ink,2);line([[21,-4],[41,12],[m.hand.x,m.hand.y]],paper,9);roseProp(m.rose.x,m.rose.y,.83,m.rose.a);for(const side of [-1,1])disc(side*16,-34,5*m.blush,3*m.blush,rose);});
  local(1827,522,1,0,()=>{box(-36,40,72,42,7,'#b4c8b4',ink);roseProp(0,16-q*30,1.5,Math.sin(t)*.05*settle);for(const side of [-1,1])line([[side*15,62],[side*48,22+end*12]],mint,5);heart(0,-65,.35+end*.25);});event(.69,1.04,()=>word('DELIVERY: BLUSHING',1050,78,'#d8b5c7',23,'Georgia'));
 }else if(key==='rizz'){
  local(1826,444,1.2,-.05+q*.09,()=>{shape([[-36,-9],[36,-9],[27,62],[-27,62]],'#a6b9cb',ink);disc(0,-38,30,34,paper,ink);shape([[-31,-49],[-22,-78],[27,-73],[33,-48],[8,-57]],'#8b91b0',ink);for(const side of [-1,1]){box(side*15-13,-49+q*11,27,13,4,'#617a91',ink);disc(side*22,-22,5,3,'#d9adbd');}line([[-3,-36+q*11],[3,-36+q*11]],ink,2);line([[-7,-18],[7,-16],[12,-21]],ink,2);roseProp(-51,13,.8,-.5+q*.5);});
  local(95,568,1.2,0,()=>{box(-50,-36,100,78,5,'#c6ceb9',ink);word('CHARM',0,-9,'#57776e',15);const receipt=roseReceiptMotion(p);box(-24,37,48,receipt.open*51,2,paper,ink);for(let j=0;j<3;j++)line([[-15,45+j*9],[15,45+j*9]],'#aab49e',1.3,receipt.open);heart(0,17,.6);heart(0,72,.23*receipt.stamp);});event(.58,1.04,()=>word('SMOOTH. MOSTLY.',1080,1042,'#d9b6cd',23));
 }else if(key==='weeknd'){
  local(94,429,1.2,Math.sin(beat*Math.PI)*.045*settle,()=>{line([[0,13],[0,109]],'#a2b4c2',5);disc(0,-4,20,30,'#c2b0cd',ink);for(let j=0;j<6;j++)line([[-13,-22+j*7],[13,-22+j*7]],'#8493b0',1.2);ring(0,-2,32,39,'#b6c5d2',2);line([[-31,102],[31,102]],'#b5c3be',4);});
  local(1826,510,1.2,Math.sin(t*.7)*.08,()=>{c.beginPath();c.moveTo(30,-37);c.bezierCurveTo(-28,-60,-62,-12,-34,33);c.bezierCurveTo(-6,65,35,46,43,13);c.bezierCurveTo(2,40,-25,-3,30,-37);c.closePath();c.fillStyle='#ded6b6';c.fill();c.strokeStyle=ink;c.lineWidth=2;c.stroke();disc(-18,2,3,4,ink);disc(-18,17,9*q,4*q,'#d6a8bd');heart(-5,64-q*19,.75);});
  local(1050,1050,1,-q*.18+end*.18,()=>{disc(0,0,37,13,'#94a8bd',ink);ring(0,0,24,9,'#cab1d1',2);disc(0,0,7,4,paper);});event(.71,1.03,()=>word('EVEN THE MOON BLUSHED',1060,73,'#cdbad9',21,'Georgia'));
 }else if(key==='love'){
  // The actual Super Idol clip inspires an ice-cream concert and a growing flower.
  local(94,447,1.2,Math.sin(beat*Math.PI)*.04*settle,()=>{shape([[-30,-10],[30,-10],[26,64],[-26,64]],'#a6c4c8',ink);disc(0,-36,25,29,paper,ink);shape([[-26,-47],[-15,-70],[23,-65],[27,-41],[7,-52]],'#8293a7',ink);for(const s of [-1,1])disc(s*9,-40,2,3,ink);disc(0,-20,4,5,'#9b7782');line([[25,11],[43,-14],[51,-28]],paper,9);shape([[44,-30],[58,-30],[51,-9]],'#ccb48f',ink);disc(51,-36,13,11,'#e5c5ce',ink);});
  local(1827,594,1.2,0,()=>{box(-30,23,60,46,8,'#cbb79e',ink);curve(u=>[Math.sin(u*3)*7,25-u*q*92],mint,5);for(let j=0;j<6;j++){const a=j*TAU/6;disc(Math.cos(a)*21,-q*69+Math.sin(a)*21,13,10,rose,ink,1);}disc(0,-q*69,12,12,paper,ink);disc(-4,-q*69-2,2,2,ink);disc(4,-q*69-2,2,2,ink);const clap=Math.sin(smooth((p-.65)/.17)*Math.PI);for(const s of [-1,1]){line([[s*18,-5],[s*32,-22],[s*(22-clap*17),-40]],mint,5);disc(s*(22-clap*17),-40,5,5,mint,ink);}});
  for(let j=0;j<6;j++)local(585+j*150,1045,.55,Math.sin(t+j)*.1,()=>{shape([[-9,0],[9,0],[0,24]],'#ccb48f',ink);disc(0,-4,14,13,'#dac0cd',ink);});
 }else if(key==='catlove'){
  const turn=smooth((p-.28)/.24);
  cat(95,409,1.15,Math.sin(beat)*.06*settle,0);local(1827,610,1,0,()=>{c.scale(paperTurnMotion(turn).xScale,1);cat(0,0,1,Math.sin(beat+1)*.06*settle,1);});for(const [x,y] of [[95,467],[1827,668]])ring(x,y,53,9,'#bac5cf',1.5,.6);
  local(1070,97,1,0,()=>{c.beginPath();c.moveTo(15,-22);c.bezierCurveTo(-18,-38,-37,-5,-19,20);c.bezierCurveTo(2,39,27,22,26,7);c.bezierCurveTo(0,20,-10,-9,15,-22);c.closePath();c.fillStyle=paper;c.fill();c.strokeStyle=ink;c.lineWidth=2;c.stroke();});
  local(980,1040,1,0,()=>{shape([[-83,-7],[-36,18],[39,12],[80,-18],[51,5],[-34,27],[-83,-7]],'#d8c58e',ink);for(let j=0;j<3;j++)heart(-43+j*43,3-Math.sin(q*Math.PI)*25,.36);});
  event(.65,1.03,()=>word('MOONLIGHT. MEOWLIGHT.',1410,71,'#d0bedb',22,'Georgia'));
 }else{
  const m=cupidArrowMotion(p),caught=smooth((p-.73)/.08);
  local(95,459,1.2,-caught*.13,()=>{for(const s of [-1,1]){shape([[s*19,-10],[s*54,-37],[s*71,-4],[s*25,22]],'#cdd6c4',ink);for(let j=0;j<3;j++)line([[s*24,6],[s*(42+j*8),-14+j*4]],'#a2bac0',2);}shape([[-21,-4],[21,-4],[21,50],[-21,50]],'#c496a5',ink);disc(0,-33,25,29,paper,ink);shape([[-25,-45],[-17,-65],[23,-61],[27,-44]],'#94a7b8',ink);for(const s of [-1,1]){if(caught>.5)heart(s*9,-37,.23);else disc(s*9,-37,2.5,3,ink);}curve(u=>[48+Math.sin(u*Math.PI)*21,-36+u*82],'#b3c8b6',5);line([[48,-36],[48,46]],'#d5ccad',1.7);line([[22,5],[47,5]],paper,8);});
  c.save();c.globalAlpha*=m.fade;local(m.x,m.y,.7,m.a,()=>{line([[-29,0],[23,0]],'#c5cdb9',3);heart(29,0,.4);shape([[-26,0],[-37,-7],[-36,0],[-37,7]],'#c4a8cf',ink);});c.restore();
  local(1827,543,1.2,Math.sin(t)*.04,()=>{ring(0,0,47,60,'#b7c9b6',3);heart(0,0,1.5);disc(-7,-5,2,3,ink);disc(7,-5,2,3,ink);});
  event(.79,1.03,()=>word('CUPID HIT HIMSELF.',1110,73,'#d7b1c4',24));
 }
 for(let j=0;j<6;j++){const x=448+j*197,a=smooth((p-.16-j*.035)/.42);local(x,1048,1,0,()=>{if(key==='weeknd'){ring(0,0,13,5,'#b7aecb',1.2,.6);line([[12,0],[19,-11]],paper,1.4,a);}else if(key==='rizz'){line([[-9,4],[-9,-5],[9,-5],[9,4]],mint,1.4,a);heart(0,0,.18*a);}else if(key==='romance'){roseProp(0,0,.29*a,-.2);}else if(key==='falling'){line([[-17,0],[16,0]],mint,1.6,a);heart(18,0,.21*a);}else if(key==='catlove'){disc(-5,-4,2,3,mint);disc(0,-7,2,3,mint);disc(5,-4,2,3,mint);disc(0,2,4,3,mint);}});}
 for(let j=0;j<7;j++){const born=.22+j*.045,age=smooth((p-born)/.48);c.save();c.globalAlpha*=Math.sin(age*Math.PI)*.65;heart(j%2?1888:32,756-age*414,.29,j%2?rose:'#bccdd1');c.restore();}
 return true;
}
