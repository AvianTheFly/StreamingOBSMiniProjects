// Short success, reaction and return cues: finite setup, action and held payoff.
const SOUND_SHORT_STORIES={
 sparkles:'Anime wow: huge starry eyes follow a tiny star; the jaw drops and the star gets an embarrassed bow.',
 arcade:'Roblox win: a blocky avatar climbs four podium steps, lands on the top and collects its crown.',
 approval:'A check-mark stamp meets a doodled checklist; the stamped paper unfolds into an absurd victory flag.',
 oops:'The local anxious-creature clip: a lantern discovers an acorn domino chain; the listener covers its ears as the last acorn tips over.',
 intro:'We are so back: a sleepy battery mascot pulls a return lever, refills and raises the BACK flag.',
};
function soundShorts(c,elapsed,d,e){
 const key=e.scene||e.style;if(!SOUND_SHORT_STORIES[key])return false;
 const I=cultureInk(c,elapsed,d,e),{p,beat,local,line,shape,disc,box,ring,word,event,curve,sparkle,burst}=I,t=Math.min(elapsed,d*.86);
 const q=smooth((p-.17)/.3),end=smooth((p-.65)/.18),ink='#334459';
 // Sparse paper lanes answer the main subject, without a glowing rectangle.
 for(const bottom of [0,1])curve(u=>[362+u*1180,(bottom?1051:53)+Math.sin(u*12+t*.9)*7],'#b9c6ca',1.6,.45);
 if(key==='sparkles'){
  const gaze=smooth(elapsed/SOUND_LINEUPS.wowOn),wow=smooth((elapsed-SOUND_LINEUPS.wowOn)/(SOUND_LINEUPS.wowFull-SOUND_LINEUPS.wowOn));
  for(const side of [0,1])local(side?1829:96,side?584:397,side?.84:1.15,Math.sin(t*1.2)*.045,()=>{
   disc(0,0,42,48,'#e4c8b1',ink);shape([[-43,-17],[-36,-59],[-12,-50],[4,-66],[40,-49],[43,-14],[20,-31],[-8,-25]],'#8ca5ba',ink);
   for(const s of [-1,1]){disc(s*18,-1,14,17+wow*4,'#edf0d5',ink);sparkle(s*18+gaze*4,-4,7+wow*2,'#c2a2ce',.2);line([[s*7,-24],[s*28,-29]],ink,2);}
   disc(0,26,5+wow*7,3+wow*10,'#9c6d7b',ink);disc(-33,17,6,3,'#d7a5b2');disc(33,17,6,3,'#d7a5b2');
  });
  local(1080,90-Math.sin(q*Math.PI)*25,1,-end*.32,()=>{sparkle(0,0,27,'#e4ca96');disc(-7,-2,2,3,ink);disc(7,-2,2,3,ink);disc(-13,7,end*5,end*2,'#d7a5b2');disc(13,7,end*5,end*2,'#d7a5b2');curve(u=>[-7+u*14,8+Math.sin(u*Math.PI)*4],ink,2);});
  for(let j=0;j<9;j++)sparkle(450+j*128,1042,5+wow*4,j%2?'#b8d7d4':'#d2b5d2',t*.2+j);
  event(.64,1.04,()=>word('WOW.',1510,82,'#d6b7d6',27));
 }else if(key==='arcade'){
  const step=q*3,n=Math.min(2,Math.floor(step)),f=step-n;
  local(95,467,1.2,0,()=>{
   for(let j=0;j<4;j++)box(-69+j*42,50-j*26,43,28,2,['#a3c4ca','#b1c8ac','#d9c695','#cbb4cf'][j],ink);
   local(-53+n*42+f*42,27.9-n*26-f*26-Math.sin(f*Math.PI)*26,.85,0,()=>{
    box(-19,-39,38,43,1,'#a3c4d6',ink);box(-15,-70,30,30,1,'#e5d0a0',ink);for(const s of [-1,1]){box(s*16-6,-31,12,34,1,'#e5d0a0',ink);box(s*9-6,3,12,23,1,'#99aec3',ink);disc(s*6,-58,1.7,2.5,ink);}line([[-4,-47],[4,-47]],ink,1.6);
    if(end>0)shape([[-15,-73],[-19,-94],[-6,-85],[0,-104],[7,-85],[20,-94],[15,-73]],'#e5ca91',ink);
   });
  });
  local(1828,585,1.2,0,()=>{box(-52,-37,104,75,3,'#aec9b7',ink);word('WIN',0,8,'#eee0b8',31,'Impact');sparkle(0,-68,15+end*5,'#dac799');});
  for(let j=0;j<8;j++)local(514+j*137,1047,1,0,()=>box(-8,-8-end*5,16,16,1,j%2?'#c9b4d6':'#bad7c1',ink));
 }else if(key==='approval'){
  const motion=stampLineupMotion(elapsed),stamp=motion.approach,unfurl=motion.unfurl;
  local(95,475,1.2,0,()=>{
   box(-53,-12,106,95,6,'#e0dac0',ink);for(let j=0;j<3;j++){box(-40,5+j*22,12,12,2,'#bdccbe',ink);line([[-18,10+j*22],[36,10+j*22]],'#819b9d',2);}
   local(0,motion.y,1,-.1*(1-stamp),()=>{box(-23,-35,46,32,7,'#c3accd',ink);box(-39,-8,78,24,4,'#96b9ad',ink);});
   if(motion.hit){line([[-36,32],[-30,38],[-18,22]],'#6c9f88',4);burst(0,-12,motion.age/.3,'#d8c89a',52);}
  });
  local(1827,584,1.2,0,()=>{line([[0,75],[0,-70]],'#b6c6b0',5);shape([[0,-64],[unfurl*74,-52],[unfurl*72,-6],[0,-18]],'#bdd6b5',ink);line([[unfurl*13,-36],[unfurl*29,-22],[unfurl*58,-48]],'#5e8d83',4);});
  event(.59,1.03,()=>word('APPROVED BY ONE VERY SMALL STAMP',1078,71,'#b8d5b6',19));
 }else if(key==='oops'){
  const discover=smooth((p-.17)/.21),panic=smooth((elapsed-5.24)/(SOUND_LINEUPS.noLate-5.24));
  local(96,460,1.1,Math.sin(t*5)*.018*panic,()=>{
   for(const s of [-1,1])disc(s*30,-38,18,21,'#b6b095',ink);disc(0,-3,39,44,'#c7bd9d',ink);disc(0,22,25,15,'#e0d2af');
   for(const s of [-1,1]){disc(s*15,-8,12,14+discover*4,'#e9e0c4',ink);disc(s*15,-6,4,6,ink);line([[s*25,52],[s*(42-panic*13),34],[s*(43-panic*13),-38*panic]],'#b6b095',10);}
   disc(0,13,6,4,'#7a7b73');disc(0,31,4+panic*5,3+panic*7,'#8c7a77');
   local(60,75,.8,-.07,()=>{box(-16,-34,32,47,4,'#d1c299',ink);box(-11,-27,22,34,2,'#e2d4a0');ring(0,-43,11,11,'#a8afa1',3);});
  });
  for(let j=0;j<9;j++){const born=3.38+(SOUND_LINEUPS.noFinal-3.38)*j/8,fall=smooth((elapsed-born)/.45);local(482+j*121,1047,1,fall*.92,()=>{disc(0,0,13,18,'#c5b595',ink);disc(0,-12,15,6,'#9f9b82',ink);line([[0,-18],[2,-24]],'#9d997e',3);});}
  local(1828,544,1.2,0,()=>{disc(0,34,30,29,'#a9bfc7',ink);for(const s of [-1,1])disc(s*18,6,12,13,'#acbdc8',ink);disc(0,21,30,27,'#b9c7c9',ink);for(const s of [-1,1])disc(s*11,16,3,4,ink);disc(0,33,8,5,'#80939e');line([[-37,70],[37,70]],'#d2ceb1',3);});
  event(.51,1.04,()=>word(elapsed<SOUND_LINEUPS.noLate?'OH.':'…NO.',1062,75,'#d5cbb5',31,'Georgia'));
 }else{
  const lever=smooth((p-.2)/.2),charge=smooth((p-.4)/.35);
  local(95,446,1.2,-.07*(1-charge),()=>{box(-44,-69,88,125,10,'#a8bccb',ink);box(-17,-80,34,12,3,'#b8c9b6',ink);box(-32,44-charge*100,64,charge*100,6,'#b5d19e');disc(-14,-19,3,4,ink);disc(14,-19,3,4,ink);curve(u=>[-10+u*20,5+Math.sin(u*Math.PI)*6*charge],ink,2);line([[35,23],[58,16],[62+lever*13,-14]],'#bac9b4',8);disc(62+lever*13,-17,8,8,'#d4a1b1',ink);});
  local(1826,546,1.2,0,()=>{line([[0,89],[0,-65]],'#b9cbb6',5);shape([[0,-63],[81*charge,-58],[74*charge,-13],[0,-16]],'#c6d5b0',ink);if(charge>.5)word('BACK',38*charge,-30,'#4f756d',17,'Impact');});
  for(let j=0;j<8;j++){const rise=smooth((p-.42-j*.023)/.31);local(495+j*139,1049-rise*15,1,0,()=>{shape([[-14,7],[0,-10],[14,7],[0,1]],'#bdd0af',ink);});}
  event(.74,1.04,()=>word('WE ARE SO BACK',1100,77,'#d9ceab',25));
 }
 return true;
}
