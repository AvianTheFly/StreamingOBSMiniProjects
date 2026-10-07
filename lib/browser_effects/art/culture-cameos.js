// Specific supporting gags for the approved main shows and recognizable short casts.
function cultureCameos(c,t,d,e){
 const key=e.scene||e.style||'muffins';
 if(!['muffins','arena','racing','raccoon','violin','lizard','gary','quack','bonk','piuw','mom-frog'].includes(key))return;
 const I=cultureInk(c,t,d,e),{p,beat,sound,local,line,shape,disc,box,ring,word,event,curve,wake,sparkle,burst}=I;
 c.save();
 switch(key){
 case 'muffins':
  // A conducting oven mitt replaces the generic pastel musical-note row.
  event(.18,.98,q=>local(1809,748,.77,Math.sin(beat*Math.PI)*.16,()=>{shape([[-19,33],[-25,-18],[-17,-40],[5,-45],[23,-26],[31,-2],[24,29]],'#ffd09a','#76503f',2);for(let j=0;j<5;j++)line([[-19,-19+j*10],[24,-28+j*10]],'#e6a466',1);line([[23,-6],[54,-33]],'#fbe6c9',4);sparkle(57,-36,5,'#fff0a9');}));
  event(.61,.97,q=>word('BAKERY ENCORE',825,1038,'#ffdc97',21,'Impact',-.03));
  for(let j=0;j<6;j++){const x=430+j*208;wake(u=>[x-29+u*58,1073],p*1.22-j*.03,'#fbe1a1',2.4);}break;
 case 'arena':{
  const flashes=[.11,.25,.4,.56,.72,.88];for(let j=0;j<flashes.length;j++){const age=(p-flashes[j])/.1;const x=j%2?1892:29,y=238+j*86;burst(x,y,age,'#fff5ca',6,38);}
  // The championship belt settles into the bottom strip after the entrance.
  const taunt=smooth((p-.17)/.28),gone=smooth((p-.51)/.11),drop=smooth((p-.69)/.12);
  // Literal "you can't see me": an open palm passes the face, then autofocus loses him.
  local(174,716,.92,0,()=>{
   c.save();c.globalAlpha*=1-gone;
   for(const side of [-1,1]){line([[side*14,21],[side*19,58]],'#436283',17);box(side*19-13,53,29,13,4,'#d6e2db','#293d50');}
   shape([[-28,-29],[28,-29],[30,24],[-29,24]],'#abd663','#284b49',3);word('U C ME',0,4,'#345949',11,'Impact');
   disc(0,-55,24,26,'#ebbd91','#3d4852');box(-24,-78,47,14,5,'#9dca65','#35544d');line([[-25,-66],[35,-66]],'#a6d370',7);
   for(const side of [-1,1])disc(side*9,-52,2.5,3,'#34404b');line([[-7,-38],[4,-36],[10,-40]],'#745148',2);
   line([[-24,-16],[-42,8],[-30,18]],'#e5b68b',12);line([[-39,4],[-34,11]],'#a8cf6b',8);
   const hand={x:29-Math.sin(taunt*Math.PI*3)*23,y:-51};
   line([[24,-16],[47,-24],[hand.x,hand.y+13]],'#e5b68b',12);line([[hand.x,hand.y+12],[hand.x,hand.y+8]],'#a8cf6b',10);
   disc(hand.x,hand.y,9,12,'#efc597','#735848',1.5);
   for(let j=0;j<4;j++)line([[hand.x-6+j*4,hand.y-4],[hand.x-9+j*5,hand.y-21+(j%3)*2]],'#efc597',4);line([[hand.x-7,hand.y+1],[hand.x-16,hand.y-8]],'#efc597',4);
   c.restore();
   // The abandoned belt lands on the same floor that supported his shoes.
   local(0,17+drop*36,1,0,()=>{box(-36,-8,72,16,5,'#364a5b','#b79257');box(-15,-13,30,26,5,'#ead083','#79623d');ring(0,0,9,9,'#fff0b8',1.4);});
   if(gone>0){const hunt=Math.sin(smooth((p-.62)/.24)*Math.PI)*16;c.save();c.globalAlpha*=gone;for(const side of [-1,1]){line([[side*40+ hunt,-92],[side*53+hunt,-92],[side*53+hunt,-76]],'#b6e3df',1.5);line([[side*53+hunt,39],[side*53+hunt,54],[side*40+hunt,54]],'#b6e3df',1.5);}c.restore();}
  });
  event(.66,1.04,q=>word('SUBJECT LOST',174,819,'#d9e9cd',15,'"Courier New"'));
  event(.5,.98,q=>local(1118,1049,.84,Math.sin(beat)*.03,()=>{box(-100,-13,200,26,9,'#39425a','#ba9761');box(-38,-24,76,48,9,'#e3c16e','#695640');ring(0,0,23,18,'#fff0bb',2);word('1',0,8,'#664f36',25,'Impact');for(const x of [-66,66])box(x-13,-11,26,22,4,'#c9a767');}));break;}
 case 'racing':{
  const gear=Math.min(5,1+Math.floor(p*5));
  // The spare wheel crew panics as the car graduates from first to fifth gear.
  local(1833,665,.66,.05,()=>{ring(0,0,39,39,'#314357',13);ring(0,0,29,29,'#86c8cd',2);ring(0,0,12,12,'#d4ddca',3);for(let j=0;j<5;j++){const a=j*Math.PI*2/5-t*gear*.5;line([[Math.cos(a)*11,Math.sin(a)*11],[Math.cos(a)*29,Math.sin(a)*29]],'#afcbd0',4);}disc(-49,-16,14,15,'#f5d49d','#293f52');disc(-54,-18,2,3,'#273e52');disc(-44,-18,2,3,'#273e52');line([[-48,-5],[-48,21],[-60,37]],'#5391a4',9);line([[-43,7],[-32,-6]],'#f1c48f',6);});
  for(const[x,y,a]of [[144,813,-.25],[1775,233,.25]])local(x,y,.45,a,()=>{line([[0,0],[0,56]],'#c9e5ff',4);for(let j=0;j<4;j++)for(let n=0;n<3;n++)box(n*9,-3+j*9,9,9,0,(j+n)%2?'#31445e':'#e6edff');});break;}
 case 'raccoon':{
  // The source's circular crop spins once around an actual dancing cameo.
  const q=smooth((p-.21)/.65);local(777,80,.62,q*Math.PI*2,()=>{ring(0,0,64,64,'#e0c89a',1.5);for(let j=0;j<12;j++){const a=j*Math.PI/6;line([[Math.cos(a)*59,Math.sin(a)*59],[Math.cos(a)*64,Math.sin(a)*64]],j%2?'#81d6d2':'#e7a4d2',2);}disc(0,10,24,28,'#879baa','#304057');shape([[-22,-6],[-18,-30],[-6,-13]],'#9cafb8');shape([[22,-6],[18,-30],[6,-13]],'#9cafb8');disc(0,-3,25,21,'#b8b7b7','#304057');for(const side of [-1,1]){disc(side*12,-4,11,7,'#304057');disc(side*12,-5,3,3,'#e9d9ab');}disc(0,8,4,3,'#304057');});
  for(const side of [0,1])for(let j=0;j<4;j++){const y=256+j*140,x=side?1900:17;burst(x,y,(p-.08-j*.15)/.18,j%2?'#efabc9':'#a0e5df',7,33);}break;}
 case 'violin':{
  // Sad hamster's gigantic watery eyes make a minor loss into a tragic concert.
  local(87,783,.76,Math.sin(t*.7)*.05,()=>{disc(-29,-22,12,14,'#8b837b','#3d454e');disc(29,-22,12,14,'#8b837b','#3d454e');disc(0,0,35,34,'#aaa091','#3d454e',3);disc(0,17,23,14,'#d9c9ae');for(const side of [-1,1]){disc(side*15,-3,12,14,'#263743','#536473',2);disc(side*15-4,-9,4,5,'#d3e6e8');disc(side*15+4,4,2,2,'#c1d7df');}disc(0,13,5,4,'#957b7b');line([[-4,23],[4,23]],'#66554c',1.7);line([[24,20],[52,-3]],'#bba790',4);sparkle(56,-6,4,'#e9d4ae');});
  event(.42,.97,q=>local(1830,772,.61,-.04,()=>{box(-38,-12,76,49,5,'#adc4d1','#496077');shape([[-14,-13],[-21,-36],[0,-48],[23,-33],[14,-12]],'#efebe0','#72949f',1.5);}));
  // On the snapped string, the conductor's tissue becomes a tiny surrender flag.
  event(.61,.99,q=>local(120,769-q*36,.7,-.22+q*.3,()=>{line([[0,28],[0,-34]],'#e9d4ae',3);shape([[0,-33],[31,-33+q*9],[30,-9],[0,-12]],'#efe9d8','#8c9daa',1.2);line([[5,-29],[24,-26+q*6]],'#fff5df',1.3);}));
  event(.62,.96,q=>word('EVEN THE STRING GAVE UP',1060,125,'#dcc5ce',19,'Georgia'));break;}
 case 'lizard':{
  // One outgoing contact wave connects the button to the popcorn audience.
  const hit=smooth((p-.2)/.14);wake(u=>[353+u*1210,100+Math.sin(u*Math.PI)*10],Math.max(0,(p-.27)/.62),'#b9e9b2',3.2,.23);
  for(let j=0;j<7;j++){const age=Math.max(0,(p-.27-j*.015)/.62);if(age>1)continue;local(1835+Math.sin(j*2.4)*34,458-age*99+age*age*75,.65,j+age*2,()=>{for(const[x,y]of [[-3,-2],[3,-4],[0,4]])disc(x,y,4,4,'#f7dda0','#ad7e44',1);});}
  local(1040,1048,.62,-.07,()=>{box(-48,-20,96,36,5,'#c793b6','#564366');word(hit>.2?'BUTTON: PRESSED':'DO NOT PRESS',0,3,'#fff0bf',15,'Impact');});break;}
 case 'gary':
  for(let j=0;j<4;j++){const fn=u=>[sideX(j),258+u*493];curve(fn,'#83d1df',1,.18);wake(fn,p*1.3-j*.08,['#f2acc5','#95dfcc'][j%2],2.1);}
  // Shell spirals travel as a soft meow echo; no invented feline character.
  for(let j=0;j<6;j++)local(464+j*187,1053,.7,0,()=>curve(u=>{const a=u*Math.PI*5;const r=2+u*12;return[Math.cos(a)*r,Math.sin(a)*r];},'#eba0c0',1.8,.7));break;
 case 'quack':{
  // Closing a duck program produces more ducks. Pointer tip meets the actual X.
  const close=smooth((p-.46)/.1),q=smooth((p-.15)/.29),target={x:1878,y:622};
  c.save();c.globalAlpha*=1-close;local(1832,654,1,0,()=>{box(-62,-40,124,72,3,'#c1d8cd','#4a6b6d');box(-59,-37,118,13,0,'#739a9c');word('QUACK.EXE',-8,5,'#2d575b',14,'"Courier New"');line([[41,-37],[51,-27]],'#fae1b5',2);line([[51,-37],[41,-27]],'#fae1b5',2);});c.restore();
  local(1780+(target.x-1780)*q,732+(target.y-732)*q,.72,-.04,()=>shape([[0,0],[0,31],[8,23],[15,34],[22,29],[15,19],[27,18]],'#fff1a7','#475e65',2));
  if(p>.46)for(let j=0;j<3;j++){const age=smooth((p-.46-j*.025)/.32);local(target.x-28*age-j*17*age,target.y+age*(23+j*43)-Math.sin(age*Math.PI)*53,.58,-age*.2+j*.13,()=>{disc(0,9,18,12,'#f3d879','#78684e');disc(10,-4,11,11,'#ffe495','#78684e');shape([[18,-4],[31,1],[19,4]],'#efab62','#78684e',1);disc(12,-6,2,2,'#3c4f54');curve(u=>[-12+u*17,8+Math.sin(u*Math.PI)*7],'#d5b565',2);});}
  burst(target.x,target.y,(p-.46)/.19,'#f7d993',7,27);
  event(.69,1.05,q=>word('TASK FAILED SUCCESSFULLY',1060,1039,'#c6e7d4',20,'"Courier New"'));
  for(let j=0;j<7;j++)wake(u=>[432+j*165+u*70,1063],p*1.3-j*.04,'#7ddbc8',2);break;}
 case 'bonk':
  // Main owner guarantees mallet/helmet contact; this is only the comic aftermath.
  event(.31,.96,q=>{word('BONK',1110,73,'#f9d1a7',39,'Impact',-.045);word('THINK AGAIN',1104,108,'#a8d6e3',17,'Impact');});
  for(const side of [0,1])for(let j=0;j<4;j++){const x=side?1900:19,y=246+j*138;const age=(p-.31-j*.025)/.63;burst(x,y,age,j%2?'#efb2ce':'#ffd895',6,29);}break;
 case 'piuw':{
  const fn=u=>[1890-42*Math.sin(u*Math.PI),278+u*489],head=smooth((p-.51)/.4);wake(fn,head,'#e9a0d8',3.4,.23);
  const [x,y]=fn(head);ring(x,y,7,7,'#98e7df',1.6);burst(1851,767,(p-.84)/.16,'#f7d989',7,47);
  local(1066,1049,.7,0,()=>{ring(0,0,31,12,'#8be0dc',2);disc(0,-4,17,16,'#bfade7','#53647d');disc(0,-4,11,11,'#cbeef0');line([[-8,-6],[-4,-6]],'#4c677a',2);line([[3,-6],[7,-6]],'#4c677a',2);});break;}
 case 'mom-frog':
  // The grumpy original frog remains photographic. A single croak gets an absurd marquee.
  local(1032,1050,.8,0,()=>{word('ONE CROAK. STANDING OVATION.',0,0,'#f1e0a4',21,'Georgia');for(let j=0;j<9;j++){const x=-218+j*55;disc(x,16,2+sound*2,2+sound*2,'#f7dd90');}});
  for(const side of [0,1])for(let j=0;j<6;j++){const x=side?1907:10,y=244+j*88;const a=Math.max(0,(p-j*.035)/.9);ring(x,y,4+a*17,4+a*17,'#94d9b8',1.5,(1-a)*.55);}
  break;
 }
 c.restore();
 function sideX(j){return j%2?1902-j*8:16+j*8;}
}
