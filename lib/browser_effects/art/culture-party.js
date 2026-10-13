// Nine independent party performances. The original video determines the subject.
function cultureParty(c,t,d,e){
 const key=e.scene||e.style;
 if(!['disco','coffin','mash','crabs','balloons','rats','shades','equalizer','nyan'].includes(key))return false;
 const I=cultureInk(c,t,d,e),{p,beat,sound,local,line,shape,disc,box,ring,word,sheen,event,curve,wake,sparkle,burst}=I;
 const tau=Math.PI*2;
 c.save();
 cultureSet(c,t,d,e);
 switch(key){
 case 'disco':{
  // Shuffle -> moonwalk -> one turn -> freeze, with the little dancer arriving late.
  const moon=smooth((p-.3)/.08)*(1-smooth((p-.53)/.07)),turn=smooth((p-.58)/.17),freeze=smooth((p-.82)/.07);
  const dance=(x,y,s,phase)=>local(x+(phase%2?1:-1)*moon*29,y-moon*6,s,(Math.sin(beat*tau+phase)*.075)*(1-freeze),()=>{
   c.scale(paperTurnMotion(turn).xScale,1);
   const step=Math.sin(beat*Math.PI+phase)*(1-freeze)*(1-2*moon),lift=Math.max(0,step)*13;
   for(const side of [-1,1]){const foot=side*29+step*side*14,yy=55-(side===1?lift:Math.max(0,-step)*13);line([[side*10,11],[side*(15-step*7),32],[foot,yy]],'#273e62',13);line([[side*10,10],[side*(15-step*7),31]],'#acb9da',3);box(foot-11,yy-1,25,10,4,'#fff2d7','#233047');}
   shape([[-25,-37],[25,-37],[20,18],[-19,18]],sheen(-25,-37,50,55,'#31a5ef'));
   for(const side of [-1,1]){const elbow=side*(40+step*7),yy=-24-side*step*19-freeze*(side===1?28:-12),handX=side*(25+freeze*23);line([[side*22,-31],[elbow,yy],[handX,yy-18]],'#1b92d4',11);disc(handX,yy-19,6,7,'#e8b888');}
   disc(0,-55,19,23,'#e8b888','#26314b');shape([[-20,-61],[-17,-80],[16,-80],[21,-59],[8,-69],[-8,-68]],'#293954');line([[-8,-53],[-4,-53]],'#26314b',2);line([[5,-53],[9,-53]],'#26314b',2);line([[-4,-40],[4,-39],[8,-43]],'#26314b',2);
  });
  for(const side of [0,1]){const x=side?1834:97;dance(x,side?537:408,1.12,side*1.3);curve(u=>[x+(side?-1:1)*Math.sin(u*9+beat)*34,235+u*552],side?'#ee73c5':'#40cffa',1.5,.3);for(let j=0;j<8;j++){const y=247+j*68;local(side?1903:17,y,1,Math.sin(beat+j)*.08,()=>box(-6,-9,12,18,3,j%2?'#ffd553':'#50d9e9'));}}
  for(let j=0;j<8;j++){const x=431+j*145,y=1044;const step=Math.sin(beat*Math.PI+j*.4);local(x,y,.7,step*.15,()=>{box(-20,-7,39,16,7,j%2?'#53ccef':'#ffbe77','#283450');line([[-15,-3],[10,-3]],'#fff1d1',2);});}
  event(.34,.98,q=>{dance(1000+q*85,126,.47,3);word(p<.58?'WAIT FOR IT…':p<.82?'STUCK THE TURN':'TOTALLY REHEARSED',1320,70,'#6de7f6',24,'Impact');});
  for(let j=0;j<5;j++)wake(u=>[355+u*1220,32+j*12+Math.sin(u*tau)*6],p*1.18-j*.07,['#ff7fc5','#51d3fd','#ffd557'][j%3],2.4);
  break;}
 case 'coffin':{
  const stumble=Math.sin(smooth((p-.44)/.2)*Math.PI),bow=smooth((p-.8)/.1);
  const swing=Math.sin(beat*Math.PI)*.035*(1-bow)+stumble*.072,carry=65+Math.sin(beat*tau)*4*(1-bow)+bow*13;
  // All shoulders, hands and casket share this one transform: no floating props.
  local(730+smooth(p/.27)*240,carry,1,swing,()=>{
   for(let j=0;j<6;j++){const x=-142+j*57;disc(x,31,10,12,'#8b573e','#201f32');box(x-13,43,26,42,4,'#292d43');shape([[x-7,44],[x,64],[x+7,44]],'#fff0d9');line([[x,49],[x,64]],'#cbb777',2);box(x-10,27,8,5,2,'#111a28');box(x+2,27,8,5,2,'#111a28');line([[x-12,49],[x-24,35],[x-24,10]],'#8b573e',5);line([[x+12,49],[x+24,35],[x+24,10]],'#8b573e',5);const step=Math.sin(beat*tau+j%2*Math.PI)*5;line([[x-7,82],[x-10+step,100]],'#292d43',7);line([[x+7,82],[x+10-step,100]],'#292d43',7);}
   shape([[-195,-23],[-166,-43],[169,-43],[195,-23],[181,15],[-181,15]],sheen(-190,-40,380,60,'#9e6c42'),'#271e2d',3);
   line([[-173,-22],[-153,-33],[152,-33],[173,-22],[164,6],[-164,6],[-173,-22]],'#ffda83',2);
   for(const x of [-130,-65,65,130])box(x-9,9,18,5,2,'#ebbd72');line([[0,-28],[0,4]],'#f1ce8d',4);line([[-12,-17],[12,-17]],'#f1ce8d',4);
  });
  const suitDancer=(x,y,s,phase)=>local(x,y+bow*9,s,Math.sin(beat*Math.PI+phase)*.13*(1-bow)+bow*.32,()=>{
   const step=Math.sin(beat*tau+phase)*(1-bow);shape([[-24,-22],[24,-22],[28,34],[-26,34]],'#32384d','#c8b48a',1.6);shape([[-11,-21],[0,4],[11,-21]],'#f3e5ca');line([[0,-8],[0,18]],'#d6b779',3);
   for(const side of [-1,1]){line([[side*21,-10],[side*38,step*side*15],[side*31,-23+step*side*15]],'#32384d',10);disc(side*31,-23+step*side*15,6,7,'#ede5d5','#b6a88e');line([[side*13,32],[side*(20+step*10),61]],'#30374b',10);box(side*(20+step*10)-11,58,25,10,3,'#263044');}
   disc(0,-43,21,24,'#926247','#293043');box(-21,-49,18,9,3,'#172537');box(3,-49,18,9,3,'#172537');line([[-4,-46],[4,-46]],'#dbc695',2);const hat=coffinHatMotion(phase===0?0:p);local(hat.x,hat.y,1,hat.a,()=>{box(-20,-20,40,24,4,'#32384b','#cbb789');box(-31,0,62,8,3,'#353b4e');});line([[-3,-30],[7,-30]],'#4b3532',2);
  });
  suitDancer(96,438,1.14,0);suitDancer(1838,584,1.02,1.2);
  for(const side of [0,1]){const x=side?1854:76;for(let j=0;j<8;j++){const y=260+j*68;local(x,y,.8,Math.sin(beat+j)*.08,()=>{box(-16,-8,32,16,5,'#313951');box(-14,-4,10,9,3,'#141d2d');box(4,-4,10,9,3,'#141d2d');line([[-12,-5],[-5,-5]],'#dfcaa1',1);});}wake(u=>[side?1899:20,219+u*579],p*1.32-side*.09,'#e8c47b',2.7);}
  for(let j=0;j<10;j++){const x=407+j*122;const step=Math.sin(beat*tau+j%2*Math.PI);local(x,1045,.7,step*.12,()=>{box(-16,-6,32,12,4,'#222a40');line([[-15,-4],[9,-4]],'#d9ba80',1.4);});}
  // One hat is lost on the wobble and caught on the final bow.
  event(.47,.97,q=>word(p<.64?'STEADY…':p<.8?'NOT A SCRATCH':'HAT INCLUDED.',1120,1020,'#eac98c',23,'Georgia'));
  break;}
 case 'mash':{
  const flex=smooth((p-.32)/.09),snack=smooth((p-.64)/.13);
  const anime=(x,y,s,phase)=>local(x,y,s,Math.sin(beat*Math.PI+phase)*.11*(1-flex),()=>{
   const move=Math.sin(beat*tau+phase)*(1-flex)+flex*1.35;shape([[-22,-26],[22,-26],[26,41],[-26,41]],'#172335','#c4a469',2);shape([[-14,-26],[0,-7],[14,-26]],'#f7edca');line([[0,-9],[0,32]],'#b09a5a',3);
   for(const side of [-1,1]){line([[side*19,-13],[side*36,-2+move*side*11],[side*(15+move*10),-31]],'#f2c39a',10);disc(side*(15+move*10),-31,7,7,'#f2c39a','#172335');line([[side*14,40],[side*(20+move*10),64]],'#1c293c',11);box(side*(20+move*10)-10,61,24,10,4,'#1c293c');}
   disc(0,-52,24,29,'#f3cca5','#1b2330');shape([[-26,-50],[-24,-82],[0,-86],[25,-81],[27,-49]],'#17212c');for(let j=0;j<7;j++)line([[-20+j*7,-79],[-22+j*7,-52]],'#2d3942',2,.5);line([[-12,-44],[-4,-44]],'#243041',2.2);line([[7,-44],[15,-44]],'#243041',2.2);line([[-10,-40],[-10,-27]],'#756641',2.2);line([[-5,-27],[5,-27]],'#384144',2);
   if(p>.6){const bite=smooth((p-.77)/.035);line([[19,-13],[36,-18],[21-snack*15,-14-snack*17]],'#f2c39a',10);disc(21-snack*15,-14-snack*17,7,7,'#f2c39a');local(14-snack*10,-18-snack*16,1-bite*.45,0,()=>{disc(0,0,15,11,'#dfa154','#573a2d');line([[-11,0],[10,0]],'#fff0bb',4);});if(bite>.5){disc(-14,-29,7,5,'#f3cca5');disc(14,-29,7,5,'#f3cca5');line([[-7,-26],[6,-26]],'#fff4cc',3);}}
  });
  anime(98,432,1.2,0);anime(1827,631,1.0,1.2);
  // The wand is bent by a flex, not a magical spell. Pastries are the victory loot.
  event(.19,.96,q=>local(1842,338,.9,0,()=>{const bend=smooth((p-.36)/.18);curve(u=>[-36+u*72,-20+Math.sin(u*Math.PI)*bend*40],'#edc56a',7);for(const side of [-1,1]){disc(side*44,14,17,18,'#f2c39a','#172335');line([[side*44,12],[side*30,-12]],'#f2c39a',15);}burst(0,-13,(p-.53)/.15,'#fff1b3',6,30);}));
  for(let j=0;j<8;j++){const x=444+j*150;local(x,1041,.6,Math.sin(beat+j)*.12,()=>{disc(0,0,25,18,'#df9d48','#573a2d');curve(u=>[-23+u*46,-1-Math.sin(u*Math.PI)*7],'#fff0bb',5);disc(-7,-9,6,4,'#ffd385');});}
  word('BLING',714,66,'#ffe452',46,'Impact',-.05);word('BANG',1191,89,'#fc7194',46,'Impact',.05);
  for(const side of [0,1])for(let j=0;j<11;j++){const y=238+j*52;line([[side?1910:10,y],[side?1866:54,y-11]],j%2?'#ffd260':'#f477ad',2.2,.25+sound*.3);}
  event(.65,.96,q=>{word('MAGIC? I LIFT.',991,1044,'#ffe28b',24,'Impact');burst(1841,324,q,'#ffcf54',9,64);});break;}
 case 'crabs':{
  const salute=smooth((p-.82)/.08);
  const crab=(x,y,s,phase,roll=0)=>local(x,y,s,Math.sin(beat*Math.PI+phase)*.065*(1-salute)+roll,()=>{
   const step=Math.sin(beat*tau+phase)*(1-salute)+salute;for(const side of [-1,1]){for(let j=0;j<3;j++){const kneeX=side*(33+j*3),kneeY=14+j*6+step*side*6;line([[side*20,6+j*5],[kneeX,kneeY],[side*(47+j*3),28+j*6-Math.max(0,step*side)*7]],'#b14b34',5);line([[side*20,6+j*5],[kneeX,kneeY]],'#ffb46e',2);}line([[side*23,-3],[side*43,-25-step*7]],'#da603b',8);local(side*45,-34-step*7,1,side*.4+step*.2,()=>{shape([[-10,14],[-15,-6],[-8,-20],[0,-6],[7,-21],[15,-7],[10,14]],sheen(-15,-20,30,35,'#ff7943'));});line([[side*10,-17],[side*11,-33]],'#c05636',4);disc(side*11,-34,5,7,'#fff4c9');disc(side*11,-34,2,4,'#213548');}
   disc(0,0,31,22,sheen(-31,-22,62,44,'#f87942'),'#703e35');curve(u=>[-23+u*46,-9-Math.sin(u*Math.PI)*7],'#ffca91',2);line([[-5,7],[0,10],[5,7]],'#653e38',2);
  });
  crab(90,358,1.35,0);crab(1835,493,1.48,.4);crab(100,715,.95,2);event(.22,.98,q=>crab(1848,748,1.03,1.4));
  // A beach ball rolls under the chorus. Six clear it; the last over-rotates.
  for(let j=0;j<7;j++){const m=cultureCrabMotion(p,j);crab(m.x,m.y,.55,j*.32,m.roll);}
  if(p>.3&&p<.86){const m=cultureCrabMotion(p,0);local(m.ballX,1059,.85,(m.ballX-345)/13.6,()=>{disc(0,0,16,16,'#fff0b9','#496778');shape([[0,0],[0,-16],[14,-7]],'#f79476',null);shape([[0,0],[0,16],[-14,7]],'#65dce0',null);});}
  for(const side of [0,1])for(let j=0;j<3;j++){const x=side?1901-j*18:18+j*18;curve(u=>[x+Math.sin(u*14-t*1.2+j)*12,230+u*579],'#40d4db',3,.16);wake(u=>[x+Math.sin(u*14-t*1.2+j)*12,230+u*579],p*1.2-j*.1,'#8aeeee',2.4);}
  for(let j=0;j<14;j++){const x=396+j*87;local(x,53+Math.sin(t*2+j)*4,.45,Math.sin(beat+j)*.1,()=>{disc(0,0,23,14,'#ffc795','#5c6668');for(let n=-2;n<=2;n++)line([[0,12],[n*8,-10]],'#e7986c',1);});}
  event(.48,.96,q=>{local(1857,301,.8,Math.sin(beat)*.08,()=>{disc(0,0,26,18,'#d7bd8c','#796347');ring(0,-1,19,12,'#fff2b9',2);line([[-18,-31],[-7,-13]],'#d09451',4);});burst(1848,309,Math.max(0,p-.53)*2.2,'#a6f0ea',9);});break;}
 case 'balloons':{
  // This cue is Toothless/Driftveil City, not balloons. Big eyes and floppy limbs.
  const notice=smooth((p-.32)/.1),gulp=smooth((p-.58)/.045),belly=smooth((p-.65)/.1),hop=Math.sin(smooth((p-.45)/.2)*Math.PI);
  const dragon=(x,y,s,phase)=>local(x,y-hop*34,s,Math.sin(beat*Math.PI+phase)*.13*(1-notice)+Math.sin(smooth((p-.76)/.15)*Math.PI)*.13,()=>{
   const step=Math.sin(beat*tau+phase)*(1-notice),squat=Math.abs(step)*7;
   curve(u=>[-6-u*56,31+Math.sin(u*4+beat)*19],'#26303e',13);shape([[-54,48],[-77,31],[-67,58],[-51,61]],'#2c3747');
   for(const side of [-1,1]){shape([[side*17,-10],[side*58,-39-step*side*10],[side*49,4],[side*36,-1],[side*25,24]],'#26303e','#111c2c',2);line([[side*17,-10],[side*49,-26]],'#43505b',1.5);line([[side*12,28],[side*(22+step*11),60-squat]],'#26303e',13);disc(side*(24+step*11),61-squat,18,8,'#303c49','#121e2f');}
   disc(0,12-squat,27+belly*8,36,'#273340','#152032');disc(0,-27-squat,41,29,'#2a3743','#152032');
   for(const side of [-1,1]){disc(side*28,-50-squat,8,14,'#263441','#142030');disc(side*15,-30-squat,14,15,'#cbf86b','#142030');disc(side*15+step*2,-30-squat,3,11,'#17242e');disc(side*15-4,-35-squat,3,3,'#fff6d1');line([[side*12,3],[side*34,-6-step*11],[side*37,-26-step*11]],'#32404d',10);}
   if(p>.47&&p<.63)disc(0,-10-squat,9,4+hop*9,'#101b2b');else line([[-8,-14-squat],[0,-9-squat],[8,-14-squat]],'#0f1b2c',2.4);
  });
  dragon(105,438,1.33,0);dragon(1825,660,1.05,1.4);event(.34,.99,q=>dragon(1166,1033,.64,2));
  const fish=(x,y,s,a)=>local(x,y,s,a,()=>{disc(0,0,24,11,'#73d9e1','#253746');shape([[-21,0],[-38,-13],[-37,13]],'#69bccb');disc(13,-2,3,3,'#203549');});
  if(p>.3&&p<.625){const m=toothlessFishMotion(p);fish(m.x,m.y,m.scale,m.a);}
  // A single fish-shaped burp escapes; the dragon follows it with its head.
  event(.76,.97,q=>{c.save();c.globalAlpha*=1-q;fish(105+q*52,405-q*93,.38+q*.14,-q);c.restore();});
  for(let j=0;j<9;j++)fish(421+j*134,60+Math.sin(beat+j)*5,.52,Math.sin(beat+j)*.14);
  for(const side of [0,1]){const x=side?1892:31;for(let j=0;j<7;j++){const y=237+j*82;shape([[x-11,y],[x+12,y-8],[x+11,y+9],[x-10,y+16]],'#627b6740',null);sparkle(x,y+22,5,'#cbea7b',Math.sin(beat+j)*.3);}wake(u=>[x+Math.sin(u*12+beat*.5)*12,243+u*530],p*1.23,'#c4ed73',2.7);}
  event(.64,.98,q=>{word(p<.79?'ONE THOUGHT.':'NO REGRETS.',777,1040,'#ccef85',29,'Impact');word('FISH.',1277,1069,'#73dbe5',24,'Impact');});break;}
 case 'rats':{
  const launch=smooth((p-.39)/.34),lost=p>.39&&p<.73,pose=smooth((p-.82)/.08);
  const boot=(x,y,a)=>local(x,y,1,a,()=>{box(-12,-6,19,19,4,'#151e2b');box(-14,6,34,11,4,'#192335');line([[-10,-2],[2,-2]],'#647085',2);});
  const rat=(x,y,s,phase)=>local(x,y-(lost?Math.abs(Math.sin(beat*Math.PI))*14:0),s,Math.sin(beat*Math.PI+phase)*.13*(1-pose)+(lost?.2:0),()=>{
   const step=Math.sin(beat*tau+phase)*(1-pose);curve(u=>[-9-u*58,28+Math.sin(u*4+beat)*18],'#cf9fa9',5);
   for(const side of [-1,1]){line([[side*13,22],[side*(20+step*14),49]],'#a5a09d',10);if(side===1&&lost){disc(20+step*14,52,10,5,'#dfb5b6');boot(20+step*14+Math.sin(launch*Math.PI)*40,52-Math.sin(launch*Math.PI)*147,launch*tau);}else boot(side*(20+step*14),52,side*step*.13);line([[side*20,-5],[side*39,-13-step*side*17-pose*24]],'#b0aaa2',9);disc(side*40,-13-step*side*17-pose*24,5,6,'#cabcb2');}
   disc(0,0,25,35,'#aaa49e','#33414c');disc(-20,-43,15,16,'#b3aaa3','#33414c');disc(18,-44,15,16,'#b3aaa3','#33414c');disc(-20,-43,8,9,'#e1b4b8');disc(18,-44,8,9,'#e1b4b8');disc(0,-24,29,26,'#b4afa8','#33414c');disc(16,-18,19,13,'#c9bdb2','#33414c');disc(30,-22,4,4,'#d795a5');disc(-10,-30,3,4,'#1d2939');disc(12,-32,3,4,'#1d2939');for(let j=0;j<3;j++)line([[20,-15],[43,-20+j*5]],'#ece6d8',1.2);line([[8,-9],[21,-8]],'#47464b',1.5);
  });
  // Same dancing rat, progressively different little worlds, like the source edit.
  for(const side of [0,1]){const x=side?1838:97,y=side?520:396;
   const toSecond=smooth((p-.3)/.08),toThird=smooth((p-.64)/.08),stages=[1-toSecond,toSecond*(1-toThird),toThird];
   local(x,y,1,0,()=>{for(let stage=0;stage<3;stage++){c.save();c.globalAlpha*=.35*stages[stage];if(stage===0){box(-70,-97,140,183,12,'#714b60');for(let j=0;j<5;j++)line([[-65,-76+j*33],[65,-76+j*33]],'#edaa89',2);for(let j=0;j<4;j++)line([[-46+j*32,-97],[-46+j*32,83]],'#edaa89',1);}else if(stage===1){ring(0,-13,76,92,'#78ceba',3);for(let j=0;j<7;j++)line([[-68,-75+j*23],[67,-75+j*23]],'#65babe',1);}else{box(-69,-96,138,183,8,'#334f82');for(let j=0;j<5;j++)for(let n=0;n<3;n++)box(-58+n*43,-84+j*33,20,18,3,'#bba0d6');}c.restore();}});
   rat(x,y,1.18,side*.7);wake(u=>[side?1902:19,240+u*559],p*1.3-side*.13,side?'#ec89c3':'#62dec9',2.8);
  }
  event(.28,.98,q=>rat(401+q*1090,1040,.62,2));for(let j=0;j<12;j++){const x=404+j*104;local(x,54,.42,Math.sin(beat+j)*.15,()=>{box(-12,-15,18,22,3,'#1d2737');box(-14,4,32,9,3,'#2a3447');line([[-10,-11],[0,-11]],'#778fae',1.6);});}
  event(.42,.97,q=>word(p<.73?'ONE BOOT DOWN':'BOOT RECOVERED. KEEP DANCING.',1125,73,'#eea1c8',23,'Impact'));break;}
 case 'shades':{
  const lean=Math.sin(beat*Math.PI)*.065-(p>.52&&p<.68?Math.sin((p-.52)/.16*Math.PI)*.23:0);
  const glass=smooth((p-.53)/.24),arc=Math.sin(glass*Math.PI),finish=smooth((p-.8)/.09);
  const cool=(x,y,s,flip=1)=>local(x,y,s,lean*flip*(1-finish),()=>{shape([[-29,-26],[29,-26],[24,39],[-24,39]],'#eef1e0');shape([[-9,-26],[0,-3],[9,-26]],'#91b3c8');line([[0,0],[0,36]],'#64899b',2);for(const side of [-1,1]){const step=Math.sin(beat*tau)*(1-finish);line([[side*21,-14],[side*39,5-arc*20],[side*(27+Math.sin(beat*Math.PI)*14*(1-finish)),-11-arc*28]],'#b5bcd4',11);line([[side*13,36],[side*(19+step*8),67]],'#37466b',12);box(side*(19+step*8)-13,64,29,10,4,'#172740');}disc(0,-51,25,27,'#e7bc94','#25364a');shape([[-26,-56],[-17,-78],[18,-81],[25,-61],[9,-66],[-5,-64]],'#d9b36c');for(const side of [-1,1])disc(side*13,-49,3,4,'#29394b');local(arc*33,-arc*61,1,arc*.9,()=>{for(const side of [-1,1]){box(side*13-10,-55,20,12,3,'#152436','#86cbe1');line([[side*13-6,-53],[side*13+5,-53]],'#a8e5fa',1.3);}line([[-4,-50],[4,-50]],'#172638',3);});line([[-4,-35],[7,-35],[11,-39]],'#543e38',2);});
  cool(99,420,1.23);cool(1835,650,.9,-1);
  for(let j=0;j<6;j++){const y=251+j*96;line([[1899,y],[1855,y],[1868,y+13]],'#98c6f1',1.6,.4);word(j%2?'✓':'10',1902,y+37,'#aacceb',16,'Impact');}
  event(.21,.96,q=>{word('AURA',1130,58,'#c3e0ff',27,'Impact');const n=p<.54?999:p<.7?-1:1000;word(String(n),1130,108,p>.54&&p<.7?'#ff9d79':'#a7c7ff',42,'Impact');});
  event(.47,.86,q=>local(126,530,.8,0,()=>{shape([[-25,22],[0,-31],[25,22]],'#ffb15e');line([[-13,0],[13,0]],'#fff0d4',7);box(-30,20,60,9,3,'#425877');}));
  for(let j=0;j<7;j++){const x=453+j*172;line([[x-26,1046],[x+24,1046]],'#88a8d6',2,.4);wake(u=>[x-25+u*50,1046],p*1.15-j*.03,'#d5ecff',3);}break;}
 case 'equalizer':{
  const open=smooth((p-.49)/.1),shut=smooth((p-.82)/.1);
  // The trombone slide and the percussion oven are attached to their players.
  local(95,402,1.15,Math.sin(beat*Math.PI)*.05,()=>{
   shape([[-27,-26],[15,-26],[25,42],[-24,42]],'#b7b0a3');disc(-5,-49,21,24,'#d6a57e','#26364b');shape([[-26,-56],[-20,-74],[16,-73],[16,-54]],'#30434e');box(-24,-54,16,9,3,'#182635');box(-4,-54,16,9,3,'#182635');line([[-9,-50],[-3,-50]],'#172436',2);for(const side of [-1,1])line([[side*12,38],[side*17,69]],'#33435a',13);
   const slide=21+sound*37*(1-shut);line([[12,-38],[65,-38],[65,-12],[25,-12],[25,-35]],'#e3b64b',6);line([[44,-37],[44+slide,-37],[44+slide,-15],[45,-15]],'#f6da7f',4);disc(67,-38,17,10,'#d99b38','#5d4b34');disc(67,-38,10,6,'#eabd5c');line([[13,-19],[39,-22],[45+slide,-25]],'#d6a57e',8);line([[-21,-15],[-9,-33],[19,-37]],'#d6a57e',8);
  });
  local(1837,558,1.05,0,()=>{box(-57,-70,114,150,8,sheen(-57,-70,114,150,'#92b5b4'),'#24384e');box(-46,-47,92,28,5,'#324456');for(let j=0;j<4;j++)disc(-30+j*20,-33,6,6,'#e1cd83','#25354a');const door=(.16+sound*.52)*(1-open)+open*.96;local(0,56,1,0,()=>{c.scale(1,.25+door*(1-shut));box(-49,-69,98,84,5,'#485c70','#233448');box(-40,-58,80,58,4,'#111e30');line([[-32,-58],[32,-58]],'#a7d9e0',4);});line([[-44,-68],[-23,-97],[-4,-72]],'#eaad91',8);disc(-23,-98,5,7,'#eaad91');});
  if(p>.54){const m=cultureToastMotion(p);event(.65,1.05,q=>{line([[1787,435],[1807,423],[m.hand.x,m.hand.y+9]],'#91c6bf',14);disc(m.hand.x,m.hand.y+9,17,9,'#e4c886','#6c775e');});local(m.toast.x,m.toast.y,.8,m.toast.a,()=>{shape([[-23,23],[-23,-14],[-14,-25],[14,-25],[23,-14],[23,23]],'#e5bc7a','#876548',2);line([[-13,3],[13,3]],'#fff1bc',3);});}
  for(let j=0;j<12;j++){const x=410+j*100;local(x,1047,.62,Math.sin(beat+j)*.2,()=>{line([[0,8],[0,-14],[12,-10]],j%2?'#e7c354':'#7fdec8',4);disc(-6,10,8,5,j%2?'#e7c354':'#7fdec8');});}
  for(const side of [0,1])for(let j=0;j<7;j++){const y=225+j*88;curve(u=>[side?1898-u*34:17+u*34,y+Math.sin(u*tau)*sound*18],'#f9da83',2,.35);}
  word('OVEN: ON BEAT',1064,69,'#ffd75b',31,'Impact',-.035);event(.54,.96,q=>{word(p<.77?'TOAST SOLO':'BREAKFAST INCLUDED',1250,1030,'#a3e1d3',22,'Impact');burst(1830,642,q,'#f5cc68');});break;}
 case 'nyan':{
  const palette=['#ff446d','#ffac41','#ffe24d','#70df73','#53c8ff','#b078ef'];
  const dodge=Math.sin(smooth((p-.52)/.23)*Math.PI),roll=smooth((p-.7)/.18);
  const pixelcat=(x,y,s,flip=false,a=0)=>local(x,y,s,a,()=>{
   if(flip)c.scale(-1,1);c.imageSmoothingEnabled=false;
   box(-38,-18,53,38,0,'#332f47');box(-34,-14,45,30,0,'#e1b889');box(-30,-11,37,24,0,'#f69dcb');for(const[xx,yy]of [[-21,-4],[-9,-6],[-17,8],[-1,6]])box(xx,yy,3,3,0,'#ef589e');
   shape([[7,-12],[7,-28],[15,-28],[15,-20],[30,-20],[30,-28],[38,-28],[38,-12],[45,-12],[45,16],[8,16]],'#343346',null);shape([[11,-11],[11,-23],[15,-23],[15,-16],[30,-16],[34,-23],[34,-11],[41,-8],[41,12],[11,12]],'#a4a5ac',null);
   box(17,-8,4,5,0,'#282c3b');box(32,-8,4,5,0,'#282c3b');box(23,2,8,3,0,'#ee7c9b');box(15,6,5,3,0,'#ed94bd');box(34,6,5,3,0,'#ed94bd');
   const step=Math.sin(beat*tau)*3;for(const x of [-25,-2,28])box(x,19+step,10,7,0,'#a4a5ac','#343346');line([[-37,5],[-53,5-step],[-56,-3-step]],'#a4a5ac',7);
  });
  const x=340+p*1210,y=65+dodge*56;
  for(let j=0;j<6;j++){const fn=u=>[318+u*(x-318),65+dodge*56*u*u-15+j*7+Math.sin(u*10-t*1.7)*3];curve(fn,palette[j],7,.6);}
  // Dodge a pixel moon, barrel-roll once, then scatter a finite crumb trail.
  event(.34,.92,q=>local(1145,47,.8,0,()=>{shape([[-26,-17],[-12,-28],[16,-28],[30,-10],[26,14],[7,23],[-20,16]],'#737b9f','#383a58',3);box(-13,-11,12,12,0,'#525b83');box(12,3,8,8,0,'#525b83');}));
  pixelcat(x,y,1.1,false,roll*tau);pixelcat(93,415,.93,false,-dodge*.35);pixelcat(1836,651,.95,true,dodge*.35);
  for(let j=0;j<7;j++){const q=smooth((p-.74-j*.013)/.18);if(q>0){c.save();c.globalAlpha*=1-q;box(1220+q*112-j*13,79+Math.sin(j*2)*q*39,4,4,0,palette[j%6]);c.restore();}}
  for(const side of [0,1])for(let j=0;j<6;j++){const fn=u=>[side?1900-j*12:20+j*12,226+u*573];curve(fn,palette[j],3.5,.22);wake(fn,p*1.32-j*.055,palette[j],4.5,.19);}
  for(let j=0;j<23;j++){const x=379+j*54,y=1048+(j%3-1)*13;local(x,y,1,0,()=>{const s=2+Math.round(sound*2);box(-s,-s,s*2,s*2,0,'#e4f3ff');box(-s*3,-s,s*2,s*2,0,'#e4f3ff');box(s,-s,s*2,s*2,0,'#e4f3ff');box(-s,-s*3,s*2,s*2,0,'#e4f3ff');box(-s,s,s*2,s*2,0,'#e4f3ff');});}
  event(.65,.98,q=>word('NYAN',1021,1040,'#ffb6dd',25,'"Courier New"'));break;}
 }
 c.restore();return true;
}
