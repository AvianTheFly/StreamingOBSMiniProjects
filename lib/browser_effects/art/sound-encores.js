// Small second-act props for the established cast. Keep the main story readable.
const SOUND_ENCORE_STORIES={
 disco:'Shuffle shoes kick their own laces into a little bow at the encore.',
 coffin:'A tiny tea service wobbles with the crew, but the cup stays level: not a drop spilled.',
 mash:'Cream-puff dumbbell weights reveal one suspiciously snack-sized bite after the flex.',
 crabs:'An upside-down crab on the sandcastle’s flag echoes the chorus dancer’s upside-down landing.',
 balloons:'Toothless’s fish dinner earns a little fishbone trophy.',
 rats:'The recovered boot stamps one shoeprint into a cheese dance ticket, then lifts away.',
 raccoon:'Pedro’s stolen-record concert leaves a tiny bite in the record sleeve.',
 shades:'Sigma’s self-rated aura prints an overlong curling receipt and awards itself a star.',
 racing:'The spare tire reaches its rack; the pit crew finally raises its flag after the car has already raced past.',
 equalizer:'Three toast slices actually tumble into a breakfast podium after the oven’s catch.',
 nyan:'Nyan’s crumbs form a tiny pixel constellation.',
 arena:'An empty winner’s portrait keeps trying to autofocus on the invisible champion.',
 tantrum:'A failed click ticket crumples and makes one surprisingly successful throw into the bin.',
 kitchen:'The toaster’s verdict spits out a COOKED recipe receipt.',
 meltdown:'The disconnected banana phone’s DND tag falls asleep as its ring waveform goes flat.',
 rewind:'The detective arrests the overlooked banana clue with absurdly small cuffs inside its evidence bag.',
 violin:'A score becomes a paper boat; one oversized tear lands beside it and lifts it on a tiny ripple.',
 spill:'The warning cone keeps itself dry on a tiny raft in its own coffee puddle.',
 heartbreak:'A crooked heart bandage earns one fragile little new sprout.',
 isolation:'One last ping tries to enter the quiet window, folds away at its mute mark, and the window dozes.',
 prowler:'A ward report rolls out a detected-footprints strip.',
 lizard:'Tom’s button press ejects a popcorn-stamped cinema ticket, readable as a picture in the half-second cue.',
 gary:'Gary’s fish biscuit leaves a crumb trail shaped like a little fishbone.',
 quack:'The escaped ducks leave a three-footprint error report.',
 bonk:'A pot-lid aftershock bounces once and settles on its coaster.',
 piuw:'The returning zap charges one tiny failed-catch battery.',
 'mom-frog':'One croak wakes a pair of polite lily-pad spectators.',
};
function soundEncores(c,t,d,e){
 const key=e.scene||e.style;if(!SOUND_ENCORE_STORIES[key])return;
 const I=cultureInk(c,t,d,e),{p,local,line,shape,disc,box,ring,word,event,curve,sparkle}=I;
 const born={coffin:.48,mash:.65,crabs:.63,balloons:.66,rats:.73,raccoon:.7,shades:.72,racing:.76,equalizer:.77,nyan:.74,arena:.69,tantrum:.67,kitchen:.64,meltdown:.72,rewind:.55,violin:.61,spill:.65,heartbreak:.67,isolation:.7,prowler:.65,lizard:.34,gary:.54,quack:.6,bonk:.33,piuw:.79,'mom-frog':.26}[key]??.43;
 const reveal=smooth((p-born)/Math.min(.04,(1-born)*.2)),q=smooth((p-born)/((1-born)*.62)),end=smooth((p-born-(1-born)*.58)/((1-born)*.3)),ink='#3a4960',paper='#dfd2ad',mint='#b5cbb1',rose='#cfafc7';
 if(!reveal)return;c.save();c.globalAlpha*=reveal;
 // Secondary acts answer the main action. Parallel jokes stay in a separate rim slot.
 local(812,1011,.78,['coffin','rats','tantrum','equalizer'].includes(key)?0:Math.sin(Math.min(t,d*.86)*.55)*.025,()=>{
  switch(key){
  case 'disco':curve(u=>[-38+u*76,20+Math.sin(u*TAU*2)*q*9],paper,2);for(const s of [-1,1])ring(s*15,17,16*end,7*end,'#abcbd1',2);break;
  case 'coffin':{const m=encoreTeaMotion(q);local(0,25,1,m.tray,()=>{line([[-47,0],[47,0]],mint,4);for(const s of [-1,1])line([[s*32,2],[s*32,15]],mint,3);local(0,0,1,m.cup,()=>{box(-18,-30,36,28,5,paper,ink);ring(24,-18,7,8,paper,3);line([[-14,-26],[14,-26]],'#997d65',3);disc(0,-2,25,3,'#b9c8d0');curve(u=>[-5+Math.sin(u*TAU)*3,-34-u*19],paper,1.3,.6);});});break;}
  case 'mash':line([[-47,7],[47,7]],mint,7);for(const s of [-1,1])local(s*46,7,1,0,()=>{c.beginPath();c.moveTo(-22,4);c.quadraticCurveTo(-27,-22,0,-21);c.quadraticCurveTo(24,-19,23,0);if(s>0){c.quadraticCurveTo(23-end*27,3,22,13);c.quadraticCurveTo(22-end*24,16,16,22);}else c.quadraticCurveTo(28,19,16,22);c.quadraticCurveTo(-19,30,-22,4);c.closePath();c.fillStyle=paper;c.fill();c.strokeStyle=ink;c.lineWidth=2;c.stroke();curve(u=>[-18+u*32,-5-Math.sin(u*Math.PI)*7],'#e7ddd1',4);});for(let j=0;j<3;j++){const a=smooth((q-.6-j*.04)/.3);c.save();c.globalAlpha*=Math.sin(a*Math.PI);disc(66+j*8,17+a*17,2,2,paper);c.restore();}break;
  case 'crabs':shape([[-52,36],[-45,8],[-32,8],[-32,-1],[32,-1],[32,8],[45,8],[52,36]],paper,ink);line([[0,-3],[0,-q*48]],mint,3);shape([[0,-q*48],[q*46,-q*40],[q*43,-q*14],[0,-q*27]],rose,ink);local(q*24,-q*31,.65*end,Math.PI,()=>{disc(0,0,12,7,'#d8bd93');for(const s of [-1,1]){line([[s*7,2],[s*17,8]],paper,2);disc(s*17,-2,4,5,paper);disc(s*5,-7,2,3,ink);}});break;
  case 'balloons':box(-22,30,44,11,3,mint,ink);line([[0,30],[0,-14]],paper,3);line([[-30,-14],[30,-14]],paper,3);for(let j=0;j<4;j++)line([[-21+j*14,-23],[-21+j*14,-6]],paper,3);shape([[29,-14],[43,-26],[43,-2]],paper,ink);break;
  case 'rats':{const m=encoreBootMotion(q);box(-38,7,76,33,5,paper,ink);for(let j=0;j<3;j++)disc(-24+j*24,23,4,4,'#b0b09b');c.save();c.globalAlpha*=m.stamp;disc(-3,23,7,10,'#9ca48b');disc(10,25,10,5,'#9ca48b');c.restore();c.save();c.globalAlpha*=m.alpha;local(0,m.y,.7,0,()=>{box(-15,-18,30,37,4,'#b5bed0',ink);box(-15,17,45,13,5,'#a2aec1',ink);});c.restore();break;}
  case 'raccoon':shape([[-39,-24],[14,-24],[18,-24+end*7],[24,-24+end*4],[26,-24+end*12],[34,-24+end*9],[39,-13],[39,41],[-39,41]],'#bdc8ad',ink);disc(0,7,27,27,'#899cb0',ink);ring(0,7,20,20,rose,2);disc(0,7,6,6,paper);break;
  case 'shades':box(-23,-18,46,26,6,'#9eafc3',ink);shape([[-17,6],[-17,6-q*107],[17,6-q*107],[17,6],[11,3],[6,7],[0,3],[-6,7],[-12,3]],paper,ink);for(let j=0;j<9;j++)line([[-10,1-j*q*10],[10,1-j*q*10]],'#adb39f',1.3,q);sparkle(0,-q*84,9*end,'#cfb380');curve(u=>[-17+u*34,10+Math.sin(u*Math.PI)*end*9],paper,2);break;
  case 'racing':line([[-46,26],[-46,46],[46,46],[46,26]],'#acc4bd',4);local(-57+q*64,20,1,q*TAU,()=>{ring(0,0,22,22,'#8295ac',9);ring(0,0,11,11,paper,2);});line([[53,42],[53,12-end*50]],mint,3);for(let j=0;j<3;j++)for(let n=0;n<3;n++)box(53+n*8,12-end*50+j*8,8,8,0,(j+n)%2?ink:paper);break;
  case 'equalizer':for(let j=0;j<3;j++){const m=encoreToastMotion(q,j);local(m.x,m.y,1,m.a,()=>{shape([[-28,8],[-28,-3],[-18,-13],[18,-13],[28,-3],[28,8]],j%2?'#dfc794':'#c2b797',ink);line([[-18,-1],[18,-1]],paper,2);});}box(-8,-20-end*2,16,7,2,'#e5d196',ink);break;
  case 'nyan':for(let j=0;j<6;j++){const x=-43+j*17,y=8+Math.sin(j*2)*17;box(x,y,4+q*3,4+q*3,0,j%2?rose:paper);}line([[-40,18],[-21,-6],[0,13],[22,-4],[41,20]],'#acbed0',1,q*.5);break;
  case 'arena':line([[-28,-45],[28,-45],[28,9],[-28,9],[-28,-45]],paper,5);for(const s of [-1,1])line([[s*(13+Math.sin(q*Math.PI)*7),-32],[s*(20+Math.sin(q*Math.PI)*7),-32],[s*(20+Math.sin(q*Math.PI)*7),-24]],mint,2);box(-29,15,58,10,3,ink,paper);box(-10,11,20,18,3,paper,ink);break;
  case 'tantrum':{const m=encoreThrowMotion(q);box(34,12,29,28,3,'#b6c6b6',ink);local(m.x,m.y,.5,m.a,()=>shape([[-17,-13],[8,-19],[22,-2],[14,17],[-14,12],[-22,-1]],paper,ink));if(q>.85)sparkle(72,7,8*end,mint);break;}
  case 'kitchen':box(-38,-10,76,29,7,'#b9c7b0',ink);box(-26,17,52,q*31,1,paper,ink);if(q>.4)word('COOKED',0,32,'#776d69',10);break;
  case 'meltdown':ring(0,-17,13,13,mint,4);box(-27,-4,54,44,5,'#c6ceb1',ink);for(const s of [-1,1])curve(u=>[s*9-4+u*8,9-Math.sin(u*Math.PI)*end*3],ink,1.5);curve(u=>[-23+u*46,30+Math.sin(u*TAU*3)*(1-end)*5],mint,2);break;
  case 'rewind':box(-38,-25,76,66,4,'#b8c6cc55',ink);shape([[-27,17],[-14,5],[0,12],[13,-4],[25,-3],[4,28],[-27,17]],paper,ink);line([[-31,-17],[31,-17]],mint,3);for(const s of [-1,1])ring(s*14,20-s*5,7,6,mint,2,end);curve(u=>[-7+u*14,24+Math.sin(u*Math.PI)*end*4],mint,2,end);break;
  case 'violin':{const splash=smooth((q-.46)/.34),tear=smooth(q/.46);ring(49-splash*30,36,6+splash*35,3+splash*7,mint,1.5,Math.sin(splash*Math.PI));local(0,-Math.sin(splash*Math.PI)*10,1,Math.sin(splash*Math.PI)*.12,()=>{shape([[-42,12],[42,12],[25,35],[-25,35]],'#b9c8d0',ink);shape([[0,-30],[0,12],[-29,12]],paper,ink);shape([[4,-19],[4,12],[27,12]],'#cec1d1',ink);line([[-16,0],[-16,7],[-9,4]],ink,1.3);});c.save();c.globalAlpha*=1-smooth((q-.46)/.07);local(49,-57+tear*93,1,0,()=>shape([[0,-15],[-8,0],[0,8],[8,0]],mint,ink));c.restore();break;}
  case 'spill':disc(0,45,53,6,'#a88b7266');local(0,-Math.sin(q*Math.PI)*7,1,Math.sin(q*Math.PI)*.08,()=>{disc(0,40,32,4,'#b8c5bd',ink);shape([[-22,38],[0,-20],[22,38]],paper,ink);line([[-14,21],[13,21]],rose,5);word('!',0,17,'#a28484',20);});break;
  case 'heartbreak':curve(u=>[0+Math.sin(u*2)*8,39-u*end*62],mint,3);for(const s of [-1,1])disc(s*11*end,9,15*end,5*end,mint);break;
  case 'isolation':{const m=encoreSilenceMotion(q);box(-39,-24,78,64,6,'#b5cbbe',ink);shape([[-25,-7],[25,-7],[25,15],[5,15],[-4,25],[-4,15],[-25,15]],'#d7dfc7',ink);ring(-28,8,9,9,ink,1.5);line([[-34,14],[-22,2]],ink,1.5);c.save();c.globalAlpha*=m.alpha;local(m.x,m.y,.55*(1-m.fold),0,()=>{box(-12,-9,24,18,4,rose,ink);disc(0,0,2,2,ink);});c.restore();for(const s of [-1,1])line([[s*8-4,2],[s*8+4,2+m.sleep*2]],ink,1.2);break;}
  case 'prowler':box(-32,-24,64,66,2,paper,ink);for(let j=0;j<3;j++){disc((j%2?1:-1)*12,-11+j*18,4,6,'#b1a3bc');disc((j%2?1:-1)*12,-19+j*18,2,2,'#b1a3bc');}break;
  case 'lizard':c.beginPath();c.moveTo(-38,-13);c.lineTo(38,-13);c.lineTo(38,1);c.quadraticCurveTo(24,8,38,15);c.lineTo(38,29);c.lineTo(-38,29);c.lineTo(-38,15);c.quadraticCurveTo(-24,8,-38,1);c.closePath();c.fillStyle=paper;c.fill();c.strokeStyle=ink;c.lineWidth=2;c.stroke();shape([[-12,4],[12,4],[9,22],[-9,22]],rose,ink);for(const [x,y] of [[-9,0],[0,-6],[9,0]])disc(x,y,7,7,mint,ink);break;
  case 'gary':line([[-27,9],[24,9]],rose,2);for(let j=0;j<3;j++)line([[-18+j*13,1],[-18+j*13,17]],paper,2);shape([[24,9],[37,0],[37,18]],paper,ink);break;
  case 'quack':box(-36,-21,72,56,4,'#c0cfb8',ink);for(let j=0;j<3;j++){const x=-22+j*22;line([[x,-7],[x,5],[x-5,1]],'#b09c77',2);line([[x,5],[x+5,1]],'#b09c77',2);}break;
  case 'bonk':ring(0,31,31,8,mint,3);local(0,26-Math.sin(q*Math.PI)*30,1,Math.sin(q*Math.PI)*.25,()=>{disc(0,0,25,7,'#b2c3ce',ink);box(-7,-11,14,8,3,paper,ink);});break;
  case 'piuw':box(-27,-13,54,43,6,'#b6b8cf',ink);box(-9,-20,18,7,2,mint,ink);box(-20,23-q*28,40,q*28,2,'#b6d1b9');break;
  case 'mom-frog':for(const s of [-1,1]){disc(s*26,26,24,7,'#a3c6ac');disc(s*26,4,14,15,'#b3c6a6',ink);for(const eye of [-1,1]){disc(s*26+eye*6,-7,5,6,'#cad9b4',ink);disc(s*26+eye*6,-6,2,Math.max(1,3-q*2),ink);}line([[s*26-5,11],[s*26+5,11]],ink,1.5);}break;
  }
 });c.restore();
}
