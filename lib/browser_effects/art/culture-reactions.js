// Each reaction has a causal visual joke rather than interchangeable mascot props.
function cultureReaction(c,t,d,e){
 const key=e.scene||e.style;
 if(!['tantrum','kitchen','meltdown','rewind','spill','heartbreak','isolation','prowler','rescue','confusion'].includes(key))return false;
 const I=cultureInk(c,t,d,e),{p,beat,sound,local,line,shape,disc,box,ring,word,sheen,event,curve,wake,sparkle,burst}=I,tau=Math.PI*2;
 c.save();
 cultureSet(c,t,d,e);
 switch(key){
 case 'tantrum':{
  // Buttercup's frantic run becomes a rubber-hose sprint and one miniature hurdle.
  const brake=smooth((p-.69)/.12),slump=smooth((p-.83)/.1);
  const runner=(x,y,s)=>local(x-brake*13,y+slump*13,s,.12+Math.sin(beat*tau)*.03*(1-brake)-brake*.38+slump*.38,()=>{
   const stride=Math.sin(beat*tau)*(1-brake)+brake*.6;for(const side of [-1,1]){line([[side*10,10],[side*stride*30,33],[side*stride*45,58-Math.max(0,side*stride)*18]],'#263745',9);disc(side*stride*45+7,58-Math.max(0,side*stride)*18,16,7,'#e8ddaf','#263745');line([[side*21,-21],[side*36,-12+side*stride*16],[side*28,-37+side*stride*16+slump*56]],'#f18e69',9);disc(side*28,-37+side*stride*16+slump*56,6,6,'#f1bd90');}
   shape([[-24,-36],[22,-36],[21,17],[-18,17]],'#f67b60');disc(0,-59,22,25,'#f1bd90','#28384b');shape([[-23,-64],[-15,-83],[19,-80],[23,-65],[8,-70],[-7,-68]],'#294350');for(const x of [-9,10])disc(x,-59,3,5,'#28384b');disc(3,-43,7,6,'#384251');
  });
  const hop=p>.4&&p<.64?Math.sin((p-.4)/.24*Math.PI)*47:0;runner(91,423-hop,1.19);runner(1830,618-hop*.6,.92);
  for(const side of [0,1])for(let j=0;j<10;j++){const y=231+j*56,len=13+sound*38;line([[side?1908:10,y],[side?1908-len:10+len,y-7]],j%2?'#ffab42':'#eb5e54',2.4,.5);}
  for(let j=0;j<5;j++){const x=453+j*244;const step=Math.sin(beat*tau+j);local(x,1056,.6,step*.1,()=>disc(0,0,22,7,'#ebc688','#334b50'));}
  event(.34,.76,q=>local(109,469,.75,0,()=>{line([[-27,0],[-27,55],[27,55],[27,0]],'#8abeb0',5);line([[-37,0],[37,0]],'#ffcf5f',8);}));
  local(1119,69,.7,Math.sin(t)*.12,()=>{for(let j=0;j<7;j++){const a=j*tau/7;disc(Math.cos(a)*18,Math.sin(a)*18,12,12,'#ffda5d','#b98946');}disc(0,0,15,15,'#82573f');line([[0,16],[0,50]],'#84b58f',4);});
  event(.7,.96,q=>{for(let j=0;j<4;j++)line([[91-q*52-j*11,498],[104-q*52-j*11,498]],'#ffcf7c',2,1-q);});
  event(.65,.98,q=>word('ALL THAT FOR ONE MISCLICK',1032,1040,'#ffd374',25,'Impact',-.025));break;}
 case 'kitchen':{
  const dog=(x,y,s)=>local(x,y,s,Math.sin(t*1.1)*.035,()=>{
   disc(0,36,29,37,'#99754d','#3c3934',3);disc(0,39,17,25,'#b89465');
   for(const side of [-1,1]){line([[side*16,54],[side*20,70]],'#95734e',12);disc(side*20,72,12,6,'#c1a172','#3c3934',2);}
   for(const side of [-1,1])disc(side*35,-8,20,40,'#554031','#242a32',3);disc(0,-13,40,44,sheen(-40,-50,80,90,'#99754d'),'#2e3031',3);disc(0,11,29,22,'#b38e60','#3c3632');
   for(const side of [-1,1]){disc(side*16,-19,10,12,'#c0a376');disc(side*16+Math.sin(t)*2,-15,5,7,'#252b2e');disc(side*16-2,-20,2,2,'#f7e3be');line([[side*7,-36],[side*23,-31]],'#41392e',3);}
   disc(0,5,11,8,'#252b2e');line([[0,12],[0,20],[-11,24]],'#44362e',2);line([[0,20],[12,22]],'#44362e',2);
   // The "this is fine" coffee denial is an added homage, not the source clip.
   const sip=Math.sin(smooth((p-.12)/.21)*Math.PI),hand={x:48-sip*30,y:24-sip*17};
   line([[26,22],[38,37],[hand.x,hand.y]],'#9d7b53',10);disc(hand.x,hand.y,7,7,'#c5a575');
   local(hand.x-6,hand.y-9,.75,-sip*.5,()=>{box(-14,-17,28,32,5,'#e7d8be','#453d39');ring(19,-4,7,9,'#e7d8be',4);line([[-10,-12],[10,-12]],'#6b4e3b',3);});
   if(p>.53){disc(-13,-5,2,2,'#634d3c');disc(8,-24,2,2,'#634d3c');}
  });
  const pop=smooth((p-.38)/.12),settle=smooth((p-.54)/.16),height=pop*82-settle*60;
  local(96,543,1,0,()=>{dog(0,-48-height,1.2);box(-74,-3,148,82,18,sheen(-74,-3,148,82,'#8db6c5'),'#253748');box(-57,-9,114,15,7,'#263c4d');line([[-50,21],[41,21]],'#e9e0bd',2);disc(51,49,10,10,'#e1ba72','#334454');line([[71,32],[71,60]],'#e1ba72',5);box(-56,73,22,10,3,'#314453');box(34,73,22,10,3,'#314453');});
  local(1838,468,.95,-.1+pop*.2,()=>{shape([[-38,35],[-38,-24],[-29,-40],[0,-47],[29,-40],[38,-24],[38,35]],'#dc9c5a','#573d33',3);shape([[-29,27],[-29,-17],[-20,-30],[0,-35],[20,-30],[29,-17],[29,27]],'#f7d8a0','#b77c40',2);word(p<.46?'OK?':'COOKED',0,11,'#624533',17,'Impact');});
  for(let j=0;j<6;j++){const x=462+j*200;local(x,1047,.54,Math.sin(t*2+j)*.1,()=>{shape([[-26,20],[-26,-17],[-19,-26],[19,-26],[26,-17],[26,20]],'#f3ca8b','#936340');line([[-15,-9],[12,-9]],'#ffe7b9',2);});}
  for(const side of [0,1])for(let j=0;j<3;j++){const x=side?1898-j*16:23+j*16;const fn=u=>[x+Math.sin(u*14+t+j)*10,813-u*587];curve(fn,'#ecd7ba',2,.14+sound*.12);wake(fn,p*1.22-j*.09,'#f7d29d',2.2);}
  for(let j=0;j<5;j++){const q=cultureUnit((p-.4-j*.016)/.24);if(q>0&&q<1){c.save();c.globalAlpha*=1-q;disc(92+(j-2)*q*27,477-q*94+q*q*57,2.5,2.5,'#a77c53');c.restore();}}
  event(.11,.39,q=>word('THIS IS FINE.',1070,63,'#f6ce8c',26,'Georgia'));
  event(.55,1.02,q=>{word('UPDATE: COOKED.',1070,63,'#f6ce8c',29,'Georgia');burst(95,414,(p-.5)/.14,'#ffd67f');});break;}
 case 'meltdown':{
  // The banana phone answers the local "oh no" repetitions, not a random alarm.
  const picks=[.149,.391,.58],unplug=smooth((p-.76)/.1),answer=Math.max(...picks.map(v=>Math.max(0,1-Math.abs(p-v-.07)/.19)))*(1-unplug);
  local(92,448,1.17,Math.sin(t*3)*.035,()=>{
   box(-56,7,112,61,14,sheen(-56,7,112,61,'#86b49b'),'#223b3f');ring(0,36,25,23,'#243f43',8);for(let j=0;j<10;j++){const a=j*tau/10;disc(Math.cos(a)*17,36+Math.sin(a)*16,3,3,'#e5d7a7');}
   const yy=-7-answer*55;local(0,yy,1,-answer*.45,()=>{curve(u=>[-42+u*84,Math.sin(u*Math.PI)*19],'#cedb74',15);disc(-42,0,10,13,'#adc259','#324344');disc(42,0,10,13,'#adc259','#324344');curve(u=>[-38+u*76,2+Math.sin(u*Math.PI)*14],'#eff3a0',2);});curve(u=>[-48+Math.sin(u*tau*6)*7,yy+u*(37-yy)],'#314e4a',3);
  });
  for(let j=0;j<5;j++){const born=.13+j*.14;event(born,Math.min(1,born+.35),q=>{const y=272+j*100-q*28;local(1838,y,1,Math.sin(q*Math.PI)*.1,()=>{box(-54,-28,108,44,12,'#bedbb766','#608f82');word('NO',0,5,'#dbf4b6',33,'Impact');});});}
  for(const side of [0,1])for(let j=0;j<7;j++){const x=side?1899:19,y=238+j*80;ring(x,y,7+sound*7,7+sound*7,'#b8dd87',1.5,.4);}
  for(const hit of picks){const age=(p-hit)/.22;burst(104,369,age,'#e2ed8d',8,75);wake(u=>[363+u*1200,62+Math.sin(u*13)*8],(p-hit)*3.8,'#ddf496',2.7);}
  // After the third answer the plug is physically pulled; the handset stays down.
  box(137,582,18,26,4,'#63887a','#d2dfae');disc(143,590,2,2,'#264942');disc(143,597,2,2,'#264942');
  local(112-unplug*26,593+unplug*21,.9,unplug*.35,()=>{curve(u=>[-54+u*51,-118+u*118],'#5c8879',3);box(-5,-7,21,17,4,'#bfd4a7','#3b6558');line([[16,-3],[26,-3]],'#e7dfad',3);line([[16,4],[26,4]],'#e7dfad',3);});
  event(.72,.98,q=>word(p<.86?'ABSOLUTELY NOT.':'LINE DISCONNECTED.',1004,1046,'#d4eab4',25,'Impact'));break;}
 case 'rewind':{
  // Hindsight/Frolic: inspect the giant clue, step on the real peel, freeze.
  const m=cultureDetectiveMotion(p),reveal=smooth((p-.43)/.09);
  line([[25,557],[204,557]],'#a2bdbf',2,.35);
  local(m.peel.x,m.peel.y,1,0,()=>{shape([[-27,9],[-14,2],[0,0],[14,3],[25,11],[3,5],[0,15],[-4,4]],'#f2da78','#9f804e',2);});
  // The rotation pivot is the planted shoe on the peel, not the body's center.
  local(m.pivot.x,m.pivot.y-m.rise,1,m.a,()=>local(-22,-85,1,0,()=>{
   shape([[-27,-28],[27,-28],[33,42],[-32,42]],'#3b5477');line([[-14,-26],[0,1],[15,-26]],'#ded9ba',3);
   disc(0,-56,23,30,'#d2ab82','#26334b');disc(0,-73,18,10,'#d5af84');
   for(const side of [-1,1]){const lift=side<0?m.slip:0;disc(side*11,-56,3,3+reveal*2,'#20344e');line([[side*15,41],[side*(22+lift*13),64-lift*60],[side*22,81-lift*75]],'#354765',12);disc(side*22,81-lift*75,12,4,'#273a51');}
   line([[-9,-39],[9,-39]],'#533c32',2);
   line([[-23,-13],[-36,10],[-2,-34-m.slip*19]],'#d2ab82',9);
   line([[21,-9],[37,7],[46,-7]],'#d2ab82',9);ring(46,-7,19,22,'#d6bc7f',4);line([[34,13],[21,32]],'#7d6448',6);
   local(m.glasses*29,-m.glasses*9,1,m.glasses*.6,()=>{for(const side of [-1,1])ring(side*12,-56,9,7,'#192f48',2.2);line([[-3,-55],[3,-55]],'#1f334b',2);});
  }));
  // An absurdly clear evidence board makes the failure legible before it happens.
  local(1836,498,1,0,()=>{box(-66,-86,132,159,8,'#3d4c6140','#bea678');word('EXHIBIT A',0,-61,'#e4d5aa',17,'Georgia');shape([[-29,9],[-20,-17],[0,0],[20,-17],[29,9],[7,0],[0,30],[-7,0]],'#f2da78','#b79956',2);word(p<.43?'WATCH YOUR STEP':'CASE CLOSED',0,57,'#d7e5db',13,'Georgia');});
  for(const side of [0,1]){const x=side?1903:14;curve(u=>[x,223+u*590],'#e8d6a2',1,.25);for(let j=0;j<17;j++)box(x-4,235+j*33,8,11,1,'#d3ba8980');wake(u=>[x,224+u*571],reveal,'#fff0bd',3);}
  burst(m.peel.x,m.peel.y,(p-.405)/.16,'#f7db91',8,46);
  event(.62,1.03,q=>{word('HINDSIGHT: 20/20',1030,69,'#f1d590',28,'Georgia');word('FORESIGHT: 0/20',1030,1040,'#aac9d5',23,'Georgia');});break;}
 case 'spill':{
  // One misclick, a real landing, then Curb-style credits. The game stays visible.
  const m=cultureSpillMotion(p);
  line([[14,399],[93,399]],'#97b8c4',4,.7);line([[18,399],[18,437]],'#97b8c4',3,.45);
  line([[21,m.surface],[208,m.surface]],'#8eaaaa',2,.6);
  if(m.puddle>0)disc(114,m.surface+2,49*m.puddle,5*m.puddle,'#bc885c99');
  local(m.x,m.y,1.05,m.a,()=>{box(-29,-32,58,62,9,'#e9ddd0','#2a394d');ring(37,-6,12,17,'#e9ddd0',7);line([[-19,-19],[17,-19]],'#b89376',3);});
  // The pointer nudges the handle, then scrambles toward an unavailable undo.
  const tap=smooth((p-.04)/.075),panic=smooth((p-.19)/.24);
  local(168-tap*38+panic*13,342+panic*226,.8,-panic*.3,()=>shape([[0,0],[0,29],[7,21],[15,33],[22,28],[15,18],[27,18]],'#e9e8ce','#354555',2));
  for(let j=0;j<5;j++){const q=cultureUnit((p-.22-j*.016)/.2);if(q>0&&q<1)disc(108+q*43+j*6,425+q*q*125,3,6,'#b8865e');}
  burst(107,555,(p-.38)/.18,'#e2c59e',8,35);
  event(.43,1.04,q=>{box(46,600,111,35,7,'#3d4d6550','#8e9fac');word('UNDO',90,624,'#9ea9b0',17,'Georgia');line([[133,609],[144,621]],'#d99e8e',2);line([[144,609],[133,621]],'#d99e8e',2);});
  event(.42,1.03,q=>{const credits=[['DIRECTED BY','ROBERT B. WEIDE'],['WRITTEN BY','ONE MISCLICK'],['SPECIAL THANKS','GRAVITY']];for(let j=0;j<3;j++){const y=296+j*166-q*24;word(credits[j][0],1838,y,'#c5c7c4',13,'Georgia');word(credits[j][1],1838,y+25,'#fff3de',16,'Georgia');}word('AND… CUT.',1000,72,'#f4efdb',31,'Georgia');});
  event(.68,1.03,q=>local(95,735,.87,-.1,()=>{box(-56,-16,112,58,3,'#243447','#b9c4c6');local(-56,-19,1,-.42*(1-smooth((p-.74)/.09)),()=>{box(0,-20,112,20,2,'#eee9ce');for(let j=0;j<5;j++)shape([[j*24,-20],[j*24+12,-20],[j*24+1,0],[j*24-11,0]],'#344654',null);});word('TAKE 2',0,20,'#d7d8c8',16,'Georgia');}));
  for(let j=0;j<10;j++){const x=425+j*118;line([[x-23,1049],[x+22,1049]],'#b4b5ab',1,.4);}break;}
 case 'heartbreak':{
  const cloud=(x,y,s)=>local(x,y,s,Math.sin(t*.7)*.045,()=>{for(const[x0,y0,r]of [[-31,0,22],[0,-19,32],[33,0,23]])disc(x0,y0,r,r,'#8d9cba','#28384f');box(-35,0,69,24,11,'#8d9cba');for(const side of [-1,1]){line([[side*21,-7],[side*7,-2]],'#28384f',3);disc(side*13,5,3,4,'#27354b');}line([[-8,18],[0,14],[8,18]],'#28384f',2);ring(0,-5,53,48,'#27354b',6);box(-57,-6,13,28,6,'#566385');box(44,-6,13,28,6,'#566385');});
  cloud(96,387,1.17);cloud(1832,634,.94);
  local(1828,349,1.04,Math.sin(t)*.05,()=>{const repair=smooth((p-.73)/.16),split=smooth((p-.21)/.25)*9*(1-repair);for(const side of [-1,1])local(side*split,0,1,side*.08,()=>{shape(side===-1?[[-3,-19],[-20,-37],[-47,-17],[-38,12],[-5,41],[-5,14],[4,5],[-5,-3]]:[[4,-19],[23,-37],[47,-17],[38,12],[5,41],[5,15],[-4,4],[5,-3]],'#e297b6','#433856',3);});if(repair>0){c.save();c.globalAlpha*=repair;local(0,0,1,-.2,()=>{box(-23,-8,46,16,5,'#dfcea2','#7d7281');box(-8,-7,16,14,2,'#f2e4bc');for(const xx of [-16,16])for(const yy of [-3,3])disc(xx,yy,1,1,'#917e8a');});c.restore();}});
  for(const side of [0,1])for(let j=0;j<9;j++){const age=Math.max(0,Math.min(1,p*1.3-j*.08));c.save();c.globalAlpha*=Math.sin(age*Math.PI)*.6;const x=side?1884-j%3*19:36+j%3*18,y=268+age*480;line([[x,y],[x-3,y+13]],'#a0c2e5',2);c.restore();}
  event(.53,.99,q=>local(100,699,.9,.08,()=>{box(-47,-12,94,51,5,'#bfcdd9','#33485c');shape([[-36,-12],[0,-27],[36,-12],[0,3]],'#dde4df');shape([[-17,-18],[-16,-50],[0,-62],[18,-45],[14,-16],[0,-8]],'#f7f0df','#8ba0b2',1.5);word('gg',0,23,'#344b68',20,'Georgia');}));
  for(let j=0;j<9;j++){const x=419+j*139;curve(u=>[x,1035+u*25],'#84a8b9',2,.45);disc(x,1031,7,3,'#be86aa');}
  event(.64,.98,q=>word('ONE LOST FIGHT. A WHOLE MUSIC VIDEO.',1053,71,'#cfb6d9',21,'Georgia'));break;}
 case 'isolation':{
  // The cursor must reach the mute control before any ping disappears.
  const m=cultureMuteMotion(p),overload=smooth((p-.14)/.2),release=m.release,strain=overload*(1-release);
  local(94,451,1.2,Math.sin(t*8)*.025*strain,()=>{
   shape([[-28,-26],[28,-26],[32,44],[-32,44]],'#e98079','#303652',3);disc(0,-53,26,30,'#eeb897','#263450');shape([[-28,-60],[-18,-87],[24,-82],[30,-57],[4,-73],[-13,-60]],'#354154');
   for(const side of [-1,1]){line([[side*20,-60-release*3],[side*6,-52-release*9]],'#28384e',3);if(release>.6)line([[side*6,-44],[side*17,-44]],'#29394e',2);else disc(side*11,-43,4,5+strain*2,'#29394e');const hand=[side*30,-47+release*76];line([[side*24,0],[side*42,-13+release*31],hand],'#eeb897',9);disc(...hand,7,10,'#eeb897','#293b4e');}
   if(release>.6)curve(u=>[-7+u*14,-27+Math.sin(u*Math.PI)*4],'#633e46',2);else disc(0,-26,7,5+strain*6,'#633e46');
  });
  for(let j=0;j<7;j++){const born=.035+j*.073,fall=smooth((p-.715-j*.008)/.13);event(born,1.05,q=>{c.save();c.globalAlpha*=1-fall;const y=241+j*77+fall*58,x=1839+Math.sin(t*2+j)*13*(1-fall);local(x,y,1,fall*.3,()=>{box(-41,-19,82,40,11,'#cfb9da35','#b6a6d4');word(j%2?'?':'PING',0,7,j%2?'#efacbd':'#c9b5f2',j%2?30:17,'Impact');});c.restore();});}
  event(.48,1.05,q=>{local(m.target.x,m.target.y,.9,0,()=>{box(-64,-29,128,58,29,'#2c4961','#829fc2');disc(-34+m.settle*68,0,21,21,m.clicked?'#b0e0cb':'#d0b3d1','#26374c');});word(m.clicked?'ALL MUTED':'MUTE ALL',1841,600,m.clicked?'#bce3d1':'#d4bfdf',20,'Impact');});
  event(.49,.9,q=>local(m.cursor.x,m.cursor.y,.8*(1-Math.sin(smooth((p-.69)/.04)*Math.PI)*.13),0,()=>shape([[0,0],[0,29],[8,21],[16,33],[22,28],[15,18],[27,18]],'#f3e9c9','#2a4055',2)));
  burst(m.target.x,m.target.y,(p-.7)/.12,'#c6e7c2',6,29);
  for(let j=0;j<4;j++)wake(u=>[356+u*1230,46+j*13+Math.sin(u*12)*6],(p-.1-j*.16)*3,'#e5a1b9',2);
  event(.27,.67,q=>word('LET ME THINK',1081,1048,'#e9bdc8',30,'Impact',-.025));
  event(.84,1.04,q=>{word('INNER PEACE',1081,1048,'#b6ddcb',26,'Georgia');ring(94,344,32,7,'#ddd9ae',2,.8);});break;}
 case 'prowler':{
  const gaze=.2+sound*.8,stalk=smooth(p);
  for(const side of [0,1])local(side?1840:94,side?572:359,1.15,side?-.03:.03,()=>{
   shape([[-56,64],[-43,-15],[-29,-61],[0,-43],[28,-61],[43,-15],[56,64],[14,44],[-20,52]],'#403055','#122138',3);shape([[-35,-14],[0,-29],[35,-14],[23,29],[-23,29]],'#251f39');
   for(const s of [-1,1]){line([[s*7,-7],[s*28,-16]],'#b8ffb0',4,.5+gaze*.5);line([[s*7,-7],[s*28,-16]],'#e7ffcb',1.5,gaze);}
   shape([[-31,34],[-15,45],[0,25],[13,45],[30,33]],'#785a9a','#a782c5',1);
  });
  for(const side of [0,1])for(let j=0;j<3;j++){const x=side?1906-j*17:14+j*17;const fn=u=>[x+(side?-1:1)*Math.sin(u*Math.PI)*19,220+u*585];curve(fn,'#9271ba',4-j,.12);wake(fn,p*1.26-j*.11,'#d188f2',2.6,.24);}
  const ward=smooth((p-.44)/.14),hide=smooth((p-.66)/.17);
  event(.12,1.04,q=>local(99,731,.85,0,()=>{c.save();c.beginPath();c.rect(-48,-62,96,113);c.clip();local(0,hide*45,1,0,()=>{disc(0,-14,23,25,'#d6647d','#242b43');line([[-18,-18],[18,-18]],'#30324c',1);for(const side of [-1,1])shape([[side*3,-16],[side*18,-21],[side*14,-7],[side*5,-5]],'#deead8','#29324a',1);});c.restore();box(-39,0,78,51,5,'#3c4260','#8d75ac');line([[-35,2],[-11,21],[34,2]],'#aa89b8',1.5);}));
  // A ward switches on beside the hiding place; the attempted gank was visible.
  local(174,704,.67,0,()=>{line([[0,0],[0,45]],'#8ca889',6);shape([[-25,0],[0,-16],[25,0],[0,16]],'#456d69','#adcf93',2);disc(0,0,5+ward*3,8,'#e7c46b');disc(0,0,2,6,'#364857');});
  if(ward>0){c.save();c.globalAlpha*=ward*.13;shape([[174,704],[47,665],[43,774]],'#d9eaae',null);c.restore();burst(174,704,(p-.48)/.19,'#dcf4ba',7,33);}
  for(let j=0;j<11;j++){const x=459+j*95;line([[x-8,1051],[x+8,1038],[x+15,1051]],'#a57ecb',1.5,.3+sound*.4);}
  event(.61,1.02,q=>word('IT WAS WARDED.',1134,66,'#d4b2e7',27,'Impact',-.03));break;}
 case 'rescue':{
  const hero=(x,y,s,a)=>local(x,y,s,a,()=>{
   const wind=Math.sin(t*3)*6;shape([[-16,-29],[-61,-20],[-84,31],[-39,23],[-8,49]],'#e46766','#2c3450',2);line([[-31,-15],[-64,20+wind]],'#f4987b',2);
   shape([[-21,-27],[20,-27],[17,30],[-15,30]],'#4284cc','#253b53');shape([[-15,-10],[15,-10],[8,5],[0,12],[-8,5]],'#f0cd5d','#e16968',2);word('S',0,4,'#d95359',15,'Georgia');
   disc(0,-50,20,23,'#edc7a1','#2b3b54');shape([[-21,-55],[-13,-75],[14,-74],[23,-54],[4,-61]],'#31445a');curve(u=>[1+u*8,-71+Math.sin(u*Math.PI)*12],'#31445a',3);line([[-8,-48],[-4,-48]],'#26374f',2);line([[5,-48],[9,-48]],'#26374f',2);line([[-5,-36],[3,-34],[8,-38]],'#584344',2);
   line([[15,-18],[40,-41],[52,-51]],'#edc7a1',9);disc(53,-52,6,7,'#edc7a1');line([[-16,-15],[-27,12],[-6,25]],'#edc7a1',9);for(const side of [-1,1])line([[side*9,27],[side*(16+Math.sin(t*2)*2),53]],'#4084ce',11);
  });
  const rescue=cultureRescueMotion(p),catchIt=rescue.catch;
  hero(rescue.hero.x,rescue.hero.y,1.2,0);hero(101,400,.92,.09);
  local(rescue.ally.x,rescue.ally.y,.7,(1-catchIt)*Math.sin(t)*.1,()=>{disc(0,0,16,21,'#c4d9d7','#35526a');disc(0,-26,17,18,'#f3c69e','#35526a');for(const side of [-1,1])line([[side*11,-2],[side*26,-18]],'#f3c69e',6);line([[-8,20],[-17,37]],'#5c7dab',7);line([[8,20],[17,37]],'#5c7dab',7);});
  const block=cultureRescueBlockMotion(p);
  // The Starman save gets a second payoff: the last hit reaches his raised fist.
  if(p>=.59&&p<.89){const fn=u=>{const q=cultureRescueBlockMotion(.59+u*.29);return[q.bolt.x,q.bolt.y];};wake(fn,(p-.59)/.29,'#f6bd72',4,.11);disc(block.bolt.x,block.bolt.y,4,4,'#fff0b7');}
  burst(block.fist.x,block.fist.y,(p-.72)/.1,'#c9edfd',7,31);
  local(1742,rescue.ally.y+14,1,0,()=>{box(-9,-4,75,11,4,'#243b53','#668492');box(-7,-2,3+block.health*68,7,2,block.health>.5?'#a5dab8':'#ed9a88');word(block.health>.9?'SAVED':'1 HP',29,26,block.health>.5?'#c4e7d0':'#f1c49c',14,'Impact');});
  for(const side of [0,1])for(let j=0;j<6;j++){const x=side?1900-j*13:18+j*13;wake(u=>[x+Math.sin(u*4)*11,810-u*581],p*1.28-j*.08,j%2?'#eebd59':'#78c8ed',2.8);}
  for(let j=0;j<13;j++)sparkle(407+j*94,57+Math.sin(t+j)*5,4+sound*4,j%2?'#ffe28b':'#96d6f3',t*.08);
  event(.59,.98,q=>{word('SUPPORT DIFF',1075,1048,'#ffe083',30,'Impact');burst(1830,532,q,'#f7de8d',10);});break;}
 case 'confusion':{
  const returned=smooth((p-.73)/.13),beam=smooth((p-.22)/.16)*(1-smooth((p-.86)/.09)),lift=smooth((p-.47)/.2)*118*(1-returned);
  local(1834,319-smooth((p-.86)/.12)*115,1.25,Math.sin(t*1.1)*.05,()=>{disc(0,-6,34,24,'#9ee3cb88','#95e9df');disc(0,9,67,16,sheen(-67,-7,134,32,'#afc2d1'),'#334559');disc(0,17,37,9,'#566e87');for(let j=-2;j<=2;j++)disc(j*22,10+Math.abs(j)*2,3.5,3,'#d4f997');});
  c.save();c.globalAlpha*=beam*.18;shape([[1804,343],[1864,343],[1889,620],[1778,620]],'#b2f08c',null);c.restore();
  local(1834,590-lift,.85,Math.sin(t*2)*.08,()=>{disc(-22,-4,15,23,'#7a5d49','#2f3542');disc(22,-4,15,23,'#7a5d49','#2f3542');disc(0,-5,26,30,'#b9956c','#334052');disc(0,10,18,13,'#ddbe8e');disc(0,2,7,5,'#343846');for(const side of [-1,1]){disc(side*11,-11,7,8,'#e7d7b4');disc(side*11,-10,3,4,'#29384a');}disc(0,42,22,25,'#af8d63','#334052');for(const side of [-1,1])line([[side*12,58],[side*18,73]],'#b9956c',8);word('?',39,-19,'#c6f6b8',27,'Georgia');if(p>.73){shape([[-30,-25],[-13,-57],[0,-47],[14,-62],[31,-25]],'#cddbd8','#527585',2);line([[-13,-55],[0,-25],[14,-60]],'#f3f3dc',2);}});
  local(95,471,1.15,0,()=>{for(const r of [22,43,63])ring(0,0,r,r,'#87cbb6',1,.5);line([[-68,0],[68,0]],'#80b6ae',1,.3);line([[0,-68],[0,68]],'#80b6ae',1,.3);const a=-2.6+p*5.1;line([[0,0],[Math.cos(a)*61,Math.sin(a)*61]],'#b8f2a3',2.5);disc(Math.cos(a)*43,Math.sin(a)*43,4,4,'#dcffbe');});
  for(const side of [0,1])for(let j=0;j<9;j++){const x=side?1908:11,y=241+j*62;line([[x,y],[x+(side?-12:12),y]],'#9dccb5',1.5,.4);}
  // The abductee is returned with a badly folded foil hat, then the UFO leaves.
  event(.52,.98,q=>{word('THE DOG FILES',1020,68,'#b9edc1',31,'"Courier New"');word(p<.86?'EVIDENCE: ONE VERY CONFUSED DOG':'RETURNED WITH A SOUVENIR',1083,1047,'#a9cbc8',19,'"Courier New"');});break;}
 }
 c.restore();return true;
}
export function cultureRescueMotion(p){
 const caught=smooth((p-.36)/.17),hero={x:1835,y:633-caught*60};
 const support={x:hero.x-6*1.2,y:hero.y+25*1.2};
 const falling=345+230*smooth(p/.56),landed=support.y-37*.7;
 return{catch:caught,hero,support,ally:{x:support.x,y:falling*(1-caught)+landed*caught}};
}
