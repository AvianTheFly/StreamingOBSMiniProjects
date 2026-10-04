// Cue-specific supporting casts for the extended library. Reusable silhouettes
// are props, not frames: each cue authors its own set, route, scale and gesture.
function libraryAccents(c,id,t,d){
 const {p,line,poly,disc,curve,halo,light,metal,ring}=cueInk(c,t,d,{});
 const q=smooth(p),tau=TAU;
 let arrivals=0;
 const put=(kind,x,y,s,color,angle=0)=>{const arrive=smooth((p-(arrivals++%7)*.023)/.10);c.save();c.globalAlpha*=arrive;c.translate(x,y+(1-arrive)*9);c.rotate(angle);c.scale(s*(1.2+.15*arrive),s*(1.2+.15*arrive));
  const shade=metal([-25,-30,25,30],['#e3f7ef',color,'#c3dbeb',color]);
  switch(kind){
  case 'coin':disc(0,0,21,23,shade);ring(0,0,16,18,'#fff0be',1.3,.7);line([[-6,-9],[4,-9],[7,-4],[-4,3],[-6,8],[5,8]],'#8b7359',2);break;
  case 'note':disc(-9,15,9,5,color);line([[-1,14],[-1,-22],[15,-17],[15,10]],color,3);disc(7,12,9,5,color);line([[-1,-18],[15,-13]],'#e9ffff',.8,.8);break;
  case 'star':poly([[0,-24],[6,-6],[24,0],[6,6],[0,24],[-6,6],[-24,0],[-6,-6]],shade,.83);line([[0,-17],[0,17]],'#efffff',1,.75);break;
  case 'heart':poly([[0,24],[-25,1],[-23,-14],[-12,-21],[0,-11],[12,-21],[23,-14],[25,1]],shade,.82);curve(u=>[-19+u*14,-10-Math.sin(u*Math.PI)*7],'#ffe4f1',1.4,.8);break;
  case 'gem':poly([[0,-31],[24,-7],[15,27],[-15,27],[-24,-7]],shade,.8);line([[0,-31],[-4,-1],[15,27]],'#dcffff',1.2,.8);line([[-24,-7],[-4,-1],[24,-7]],'#dbcdff',1,.7);break;
  case 'leaf':poly([[0,-32],[24,-10],[13,17],[0,29],[-13,17],[-24,-10]],color,.7);line([[0,-31],[0,28]],'#e2f6da',1.2,.85);for(const sign of [-1,1])line([[0,8],[sign*15,-3]],'#daf5ed',.8,.7);break;
  case 'bubble':disc(0,0,23,23,color+'35');ring(0,0,23,23,'#c3eff6',1.2,.75);curve(u=>[-17+u*17,-9-Math.sin(u*Math.PI)*10],'#eaffff',1.7,.72);break;
  case 'gear':for(let j=0;j<10;j++){const a=j*tau/10;line([[Math.cos(a)*18,Math.sin(a)*18],[Math.cos(a)*28,Math.sin(a)*28]],color,7,.87);}ring(0,0,20,20,shade,9,.95);ring(0,0,9,9,'#d9faff',1.2,.8);break;
  case 'bolt':poly([[-2,-29],[20,-29],[3,-4],[15,-4],[-19,31],[-7,5],[-18,5]],shade,.8);break;
  case 'page':poly([[-22,-30],[8,-30],[23,-15],[23,30],[-22,30]],color+'70');poly([[8,-30],[8,-15],[23,-15]],color,.7);for(let j=0;j<4;j++)line([[-14,-13+j*10],[14,-13+j*10]],'#d9f3f6',1.2,.7);break;
  case 'bell':poly([[-6,-30],[-20,-11],[-24,18],[-29,24],[29,24],[24,18],[20,-11],[6,-30]],shade);disc(0,29,5,5,color);ring(0,-38,6,7,color,2);break;
  case 'feather':curve(u=>[Math.sin(u*2)*10,-35+u*70],color,2,.85);for(let j=0;j<8;j++){const y=-26+j*7,w=Math.sin(j/8*Math.PI)*20;line([[Math.sin(j*.25)*9,y],[w+5,y-12]],color,3,.65);line([[Math.sin(j*.25)*9,y],[-w+3,y-10]],'#b0e4ec',2,.6);}break;
  case 'flag':line([[-20,-33],[-20,33]],'#bfeaf3',3);poly([[-19,-30],[22,-23],[15,-6],[-19,-10]],color+'95');line([[-19,-30],[22,-23]],'#e2eefa',1.2,.8);break;
  case 'ticket':poly([[-34,-20],[34,-20],[34,-8],[27,0],[34,8],[34,20],[-34,20],[-34,8],[-27,0],[-34,-8]],color+'85');for(let j=0;j<5;j++)line([[17,-14+j*6],[17,-11+j*6]],'#dcf3e8',1.2,.8);line([[-23,-5],[7,-5]],'#e4eff8',2,.7);break;
  case 'eye':curve(u=>[-31+u*62,-Math.sin(u*Math.PI)*16],color,2,.8);curve(u=>[-31+u*62,Math.sin(u*Math.PI)*16],color,2,.8);disc(0,0,12,12,shade);disc(0,0,5,8,'#28435e');disc(-3,-3,2,2,'#edffff');break;
  case 'mask':poly([[-28,-26],[28,-26],[33,-11],[25,19],[0,34],[-25,19],[-33,-11]],shade,.86);line([[-24,-5],[-9,-1]],'#385371',3);line([[9,-1],[24,-5]],'#385371',3);curve(u=>[-10+u*20,19+Math.sin(u*Math.PI)*4],'#e4f5ed',1.6,.8);break;
  case 'moon':disc(0,0,24,24,color,.64);disc(10,-10,21,21,'#3b52764c');curve(u=>[-18+u*21,15+Math.sin(u*Math.PI)*6],'#e9ebff',1.2,.8);break;
  case 'flame':poly([[0,-35],[15,-7],[11,4],[25,-9],[24,17],[10,30],[-12,30],[-24,12],[-11,-12],[-9,8]],color+'86');poly([[0,-11],[10,17],[1,27],[-10,17]],'#ffe6b973');break;
  case 'crown':poly([[-30,23],[-33,-20],[-14,-5],[0,-29],[14,-5],[33,-20],[30,23]],shade);line([[-28,16],[28,16]],'#eaf3cf',2,.8);for(const x of [-19,0,19])disc(x,5,3,4,'#c0e7f0');break;
  case 'mug':poly([[-22,-21],[18,-21],[18,24],[-22,24]],shade,.83);ring(28,-1,13,17,color,4,.85);disc(-2,-20,20,5,'#364f66');break;
  case 'rose':for(let j=5;j>=0;j--)disc(Math.cos(j*1.2)*j*3,Math.sin(j*1.2)*j*3,10+j,5+j*.7,shade,.87);curve(u=>[Math.sin(u*4)*6,15+u*55],'#95c79c',2,.8);break;
  case 'shoe':poly([[-26,-4],[-18,-24],[1,-24],[12,-4],[30,1],[39,16],[-28,16]],shade);line([[-24,19],[36,19]],'#dcf7ee',3);for(let j=0;j<3;j++)line([[-7+j*7,-10],[-12+j*7,-3]],'#eef3e2',1.3);break;
  case 'fish':poly([[-22,0],[-11,-16],[14,-13],[25,0],[14,13],[-11,16],[-22,0],[-34,-15],[-34,15]],shade);disc(14,-2,3,3,'#34536a');line([[-8,-12],[-1,0],[-8,13]],'#cdf7ee',1,.8);break;
  case 'cherry':curve(u=>[-13+u*27,-5-Math.sin(u*Math.PI)*31],'#b6d199',2,.8);disc(-13,9,13,14,shade);disc(13,9,13,14,shade);disc(-17,3,3,4,'#f4d7e5',.6);break;
  case 'die':poly([[-24,-23],[24,-23],[24,23],[-24,23]],shade);for(const[x,y]of [[-12,-11],[12,-11],[0,0],[-12,11],[12,11]])disc(x,y,3.5,3.5,'#3d5870');break;
  case 'shield':poly([[-27,-31],[27,-31],[30,10],[0,36],[-30,10]],shade);line([[0,-21],[0,19]],'#def3da',2,.8);line([[-14,-4],[14,-4]],'#def3da',2,.8);break;
  case 'planet':disc(0,0,24,24,shade,.85);ring(0,0,42,10,color,2,.8,-.2);curve(u=>[-18+u*36,-6+Math.sin(u*Math.PI)*5],'#d7e8fa',1,.5);break;
  case 'paw':disc(0,8,13,12,shade,.8);for(const[x,y]of [[-15,-7],[-5,-15],[7,-15],[17,-6]])disc(x,y,5,7,color,.77);break;
  case 'ring':ring(0,0,24,24,shade,6);poly([[-12,-22],[0,-38],[12,-22],[0,-11]],'#c7e4f396');line([[0,-38],[0,-11]],'#ecffff',1.1,.85);break;
  case 'lantern':line([[0,-34],[0,-24]],color,1.4);poly([[-17,-24],[17,-24],[22,24],[-22,24]],color+'51');line([[-17,-24],[-22,24],[22,24],[17,-24]],'#d2eff7',1.1,.7);disc(0,12,5,10,'#f0d99f',.8);halo(0,6,39,color,.3);break;
  }
  c.restore();
 };
 const sweep=(fn,color,phase=0,speed=.24)=>{curve(fn,color,.8,.3);light(fn,color,phase,speed,2);};
 c.save();c.globalAlpha*=smooth(t/Math.min(.35,d*.18))*smooth((d-t)/Math.min(.45,d*.2));
 switch(id){
 case 'later':
  put('gear',83,345,.8,'#d4b381',t*.6);put('gear',1840,678,.7,'#adb9d2',-t*.8);put('page',613,1040,.55,'#b6c7d5',-.12);
  for(let j=0;j<7;j++)put('star',1850,230+j*59,.13,'#d8bf87',t*.1+j);break;
 case 'airlock':
  put('planet',90,285,.87,'#c8a1d6',-.3);put('planet',553,1040,.59,'#8bc9d5',.12);put('bolt',1443,63,.58,'#e99b9a',-.15);
  for(let j=0;j<15;j++)put('star',j%2?1843:84,222+j*35,.08+(j%3)*.06,j%3?'#99d6e8':'#dcb4df',t*.1+j);
  sweep(u=>[1857-42*Math.sin(u*3),184+u*584],'#b192e8',.3);break;
 case 'payment':
  for(let j=0;j<5;j++)put('coin',78,270+j*94,.5+(j%2)*.16,'#d6b376',Math.sin(t*1.1+j)*.2);
  put('ticket',1834,376,.9,'#89c9b8',-.14);put('gem',1462,1040,.55,'#9bbddf',t*.1);
  sweep(u=>[397+u*1120,1057+Math.sin(u*9-t*.6)*5],'#8fdbc0',0);break;
 case 'ding-one':
  put('bell',86,613,.72,'#d7b17a',Math.sin(t*2)*.2);put('bell',681,1041,.5,'#b7d2de',Math.sin(t*2+.8)*.14);
  for(let j=0;j<7;j++)put('note',j%2?1831:84,239+j*73,.24,'#e4cb92',Math.sin(t+j)*.2);break;
 case 'ding-two':
  for(let j=0;j<5;j++)put('gem',82,242+j*107,.4+(j%2)*.13,j%2?'#b99adc':'#8fd8df',Math.sin(t*.8+j)*.11);
  for(let j=0;j<6;j++)put('note',444+j*174,1047,.26,j%2?'#9cdddc':'#cdb0e5',-.15);
  sweep(u=>[389+u*1090,34+Math.sin(u*10-t)*8],'#b3cff8',.12);break;
 case 'disconnect':
  put('gear',87,331,.8,'#a3b9cd',t*.2*(1-q));put('bolt',1832,641,.72,'#e3a2be',q*.4);put('page',631,1041,.57,'#9eb5d3',-.2);
  for(let j=0;j<4;j++)put('bubble',1845,230+j*109,.22,'#bc99d2',Math.sin(t+j));break;
 case 'glitch':
  put('gear',1835,311,.76,'#a9a0df',-t*.4);put('gem',1833,673,.55,'#93d8de',t*.17);put('bolt',1487,1046,.56,'#d992ca',-.1);
  for(let j=0;j<12;j++){const x=438+j*91,drift=Math.sin(t*.8+j)*5;poly([[x,1040+drift],[x+17,1040+drift],[x+17,1046+drift],[x,1046+drift]],j%2?'#bc9deb65':'#8fe4ed61');}break;
 case 'charge':
  for(const[x,y,s]of [[86,270,.66],[1843,663,.72],[637,1041,.5]])put('bolt',x,y,s,'#8dd8b3',Math.sin(t*.6+x)*.1);
  put('gear',1833,330,.64,'#a3c9de',t*.6);for(let j=0;j<9;j++)put('star',82,367+j*43,.1,'#b4ead0',t*.2+j);break;
 case 'cash':
  for(let j=0;j<9;j++){const age=(t*.14+j*.12)%1;put('coin',1830+Math.sin(j+age*3)*20,725-age*501,.43+(j%3)*.12,'#dbb56c',t*.9+j);}
  put('ticket',675,1040,.67,'#92c2ab',.12);put('crown',1378,61,.5,'#dab16e',-.05);break;
 case 'loading':
  for(let j=0;j<4;j++)put('gear',j%2?1838:80,290+j*125,.45+j*.08,j%2?'#ac99d2':'#89c7df',(j%2?1:-1)*t*.55+j);
  put('gem',604,1040,.65,'#c99cda',t*.2);sweep(u=>[449+u*1031,1056+Math.sin(u*12-t*.8)*9],'#94c8ed',.4);break;
 case 'behind':
  put('eye',1830,290,.87,'#e6b381',Math.sin(t*.4)*.04);put('eye',1832,701,.65,'#9eb3d9',-.15);put('mask',1413,1040,.63,'#8aaec5',.1);
  for(let j=0;j<5;j++)put('paw',77,573+j*36,.2,'#aaadd371',.3);break;
 case 'alert':
  put('bell',87,303,.8,'#d3a26b',Math.sin(t*2)*.13);put('flag',1838,685,.76,'#e3a48c',-.1);put('bolt',680,1040,.53,'#dbb272',.1);
  for(let j=0;j<5;j++)ring(1840,324,21+j*8,21+j*8,'#efcc95',1,.14+Math.sin(t+j)*.08);break;
 case 'piuw':
  put('planet',88,291,.75,'#8cbad9',-.2);put('bolt',74,620,.53,'#b3daf2',-.18);put('gem',1481,1040,.47,'#b29edc',t*.2);
  for(let j=0;j<8;j++)sweep(u=>[395+u*1110,20+j*4+Math.sin(u*6)*2],j%2?'#8adcec':'#b7adea',j*.14,.43);break;
 case 'scratch':
  for(const[x,y,s]of [[83,284,.8],[1840,647,.9]]){disc(x,y,28*s,28*s,'#28415cae');ring(x,y,22*s,22*s,'#c694d5',1.6,.7);put('star',x+Math.cos(t*.9)*19,y+Math.sin(t*.9)*19,.13,'#89e9ef',t);}
  for(let j=0;j<10;j++)put('note',j%2?1840:82,371+j*38,.24,['#87d9e4','#d69ac7','#bc9ae4'][j%3],Math.sin(t+j)*.18);break;
 case 'smart':
  put('page',89,270,.84,'#a2d3c2',-.1);put('gear',1832,669,.71,'#d8c293',t*.5);put('gem',632,1040,.53,'#b3d5e7',.12);
  for(let j=0;j<7;j++){const x=437+j*151;poly([[x,32],[x+22,32],[x+33,22]],'#a7dbd658');}break;
 case 'camera':
  put('page',89,311,.8,'#aab6d6',-.15);put('page',1834,617,.7,'#d1a6cd',.13);put('ticket',615,1045,.63,'#a7cbdf',-.12);
  for(let j=0;j<12;j++){const a=t*.33+j*.61,x=j%2?1840:84,y=216+j*45;put('star',x,y,.11+.1*Math.sin(a)**4,j%2?'#dec0e7':'#b6e4ed',a);}break;
 case 'respawn':
  put('shield',86,300,.89,'#96b887',-.12);put('bolt',1840,676,.66,'#c9d893',.08);put('flag',1460,1043,.65,'#81b8a8',Math.sin(t)*.04);
  for(let j=0;j<7;j++)put('star',1828,236+j*49,.14,'#b9dcab',t*.1+j);break;
 case 'casino':
  put('die',86,277,.9,'#c6a7d3',t*.45);put('die',1838,684,.65,'#9fcad3',-t*.35);put('cherry',615,1040,.66,'#d79ab6',.1);
  for(let j=0;j<6;j++)put('coin',1842,235+j*56,.25,'#e1bf87',Math.sin(t+j)*.2);put('crown',1430,1042,.5,'#e6c48b',-.05);break;
 case 'galaxy':
  put('planet',1830,301,.95,'#85bfdc',-.3);put('planet',1450,1040,.57,'#c49ed7',.23);put('moon',1826,682,.69,'#d0bbf3',t*.05);
  for(let j=0;j<24;j++)put('star',j%2?1843:86,198+j*23,.05+(j%4)*.04,j%3?'#a4ddeb':'#d2b4eb',t*.14+j);break;
 case 'intro':
  put('ticket',90,320,.9,'#ceb29a',-.17);put('page',1836,683,.74,'#9bb4d7',.1);put('star',1470,1040,.6,'#e2c796',t*.1);
  for(let j=0;j<8;j++){const x=438+j*143;poly([[x,1044],[x+36,1044],[x+36,1061],[x,1061]],'#8aa4c64e');disc(x+7,1048,1.5,1.5,'#a7dceb');}break;
 case 'boom':
  put('bolt',1834,277,.78,'#baa5e0',-.1);put('gear',1830,676,.77,'#94bfd7',-t*.3);put('star',664,1040,.61,'#daafd2',t*.1);
  for(let j=0;j<6;j++){const age=(t*.22+j*.17)%1;ring(1840,449,14+age*59,10+age*36,'#baa0e9',1.2,(1-age)*.4);}break;
 case 'opening':
  put('page',89,293,.77,'#c59eda',Math.sin(t*.5)*.14);put('page',1836,638,.68,'#a8c8df',-.13);put('feather',628,1042,.65,'#d1b790',.3);
  for(let j=0;j<7;j++)put('star',1832,235+j*51,.13,'#c9b3ed',t*.1+j);break;
 case 'another':
  for(let j=0;j<4;j++){put('coin',85,311+j*97,.52,'#d2b78a',t*.5+j);put('coin',1834,299+j*102,.38,'#aacbdf',-t*.4+j);}
  put('crown',674,1043,.58,'#dfbf86',.09);break;
 case 'bruh':
  put('mask',86,300,.81,'#a9b3cb',Math.sin(t*.4)*.035);put('moon',1834,666,.74,'#b4a7dc',-.16);put('page',1432,1040,.53,'#b3c7d1',.2);
  for(let j=0;j<3;j++)disc(1840,355+j*47,5,5,'#b4c6d4',.58);break;
 case 'fracture':
  for(let j=0;j<8;j++)put('gem',j%2?1834:80,245+j*67,.26+(j%2)*.13,j%3?'#abcbd9':'#cfabd0',Math.sin(t*.7+j)*.25);
  put('page',668,1040,.61,'#c3c6d8',-.12);break;
 case 'revulsion':
  for(let j=0;j<9;j++){const age=(t*.16+j*.14)%1;put('bubble',80+Math.sin(j+age*6)*22,715-age*494,.2+j%3*.12,'#a2d18e');}
  put('leaf',1831,680,.63,'#acc397',Math.sin(t)*.15);put('mug',652,1040,.62,'#97b4a6',-.15);break;
 case 'untouchable':
  put('shield',1836,308,.87,'#acbedf',Math.sin(t*.5)*.09);put('crown',1470,1040,.64,'#d7c58b',.05);put('gem',86,684,.56,'#9dbfdc',t*.1);
  for(let j=0;j<4;j++)sweep(u=>[442+u*1023,31+j*5+Math.sin(u*5)*6],'#9abfe9',j*.2,.17);break;
 case 'chill':
  put('mug',85,319,.8,'#a6ccae',Math.sin(t*.4)*.04);put('leaf',1830,657,.65,'#9dc1a3',Math.sin(t*.5)*.1);put('moon',642,1040,.54,'#bac2de',-.15);
  for(let j=0;j<4;j++)sweep(u=>[1848+Math.sin(u*7-t*.7+j)*13,543-u*311],'#a6d6c0',j*.2,.13);break;
 case 'confetti':
  for(let j=0;j<10;j++)put('star',j%2?1835:86,214+j*52,.16+(j%3)*.05,['#d3a1de','#8fdbdf','#e5c387'][j%3],t*.3+j);
  put('crown',1340,1040,.65,'#e0ba88',Math.sin(t)*.05);put('ticket',661,69,.56,'#c69edb',-.15);break;
 case 'dayum':
  put('eye',86,286,.88,'#dfb09f',Math.sin(t*.6)*.05);put('star',1836,677,.79,'#c6a0d9',t*.1);put('gem',646,1040,.62,'#a8c4df',-.12);
  for(let j=0;j<5;j++)put('bolt',1838,262+j*68,.18,'#d7badf',-.2);break;
 case 'applause':
  put('crown',1841,296,.81,'#daba85',Math.sin(t*.7)*.06);put('star',87,692,.63,'#8fd4c2',t*.2);put('ticket',1384,1043,.67,'#c3aed9',-.14);
  for(let j=0;j<8;j++)put('star',410+j*155,31,.15,['#a6dcd4','#e3c58f','#ceabdd'][j%3],t*.2+j);break;
 case 'suspicious':
  put('eye',87,307,.84,'#9cb5cc',Math.sin(t*.8)*.08);put('mask',1837,669,.7,'#b0a4d2',-.1);put('paw',658,1040,.52,'#bcc9d2',.16);
  for(let j=0;j<5;j++)put('eye',84,437+j*55,.17,'#b3c0d9',Math.sin(t+j)*.07);break;
 case 'downer':
  put('moon',87,321,.85,'#a7bfe4',-.12);put('page',1835,682,.66,'#afb9d5',.14);
  for(let j=0;j<9;j++){const age=(t*.15+j*.13)%1;put('bubble',1839,704-age*463,.14,'#adcbe2');}put('note',656,1044,.43,'#c4b4de',-.3);break;
 case 'airburst':
  put('gear',1835,301,.8,'#a5c8da',t*.6);put('flag',1841,683,.7,'#c0d6de',Math.sin(t*1.4)*.15);put('feather',652,1040,.58,'#d1c7e0',.4);
  for(let j=0;j<6;j++)sweep(u=>[398+u*1060,31+j*4+Math.sin(u*8-t)*4],'#aad9e4',j*.17,.34);break;
 case 'brass':
  for(let j=0;j<13;j++){const age=(t*.1+j*.081)%1;put('note',j%2?1838:88,723-age*511,.3+(j%3)*.09,j%2?'#dfb679':'#abcbd9',Math.sin(t*.8+j)*.15);}
  put('star',1420,1040,.57,'#ddc896',t*.2);break;
 case 'newt':
  for(let j=0;j<7;j++)put('leaf',1836,248+j*73,.25+(j%2)*.1,'#94c9b2',Math.sin(t*.8+j)*.16);
  put('fish',656,1040,.59,'#9ec6d4',Math.sin(t)*.1);put('bubble',88,295,.48,'#9eddd0');put('bubble',1450,64,.31,'#b2d9c0');break;
 case 'scream':
  put('mask',87,294,.91,'#dab4c8',Math.sin(t*1.6)*.11);put('bolt',1836,682,.63,'#c5b1df',Math.sin(t*1.3)*.1);
  for(let j=0;j<8;j++)put('note',89,405+j*43,.2,'#b9c8e6',Math.sin(t*2+j)*.2);break;
 case 'swear':
  for(const[x,y,s,color]of [[89,302,.81,'#dab0c3'],[1836,680,.75,'#a9b0dc'],[653,1040,.55,'#bc96cc']])put('bolt',x,y,s,color,Math.sin(t+x)*.12);
  for(let j=0;j<5;j++)put('star',1837,259+j*61,.2,'#e3bad3',t*.3+j);break;
 case 'gary':
  put('fish',87,304,.89,'#8fc4cf',Math.sin(t*.9)*.1);put('fish',1826,698,.66,'#d4abc6',Math.sin(t*.8+2)*.12);
  for(let j=0;j<10;j++){const age=(t*.15+j*.117)%1;put('bubble',85+Math.sin(j+age*4)*21,746-age*414,.12+j%3*.08,'#96d7df');}put('leaf',1448,1040,.51,'#9bceb1',-.3);break;
 case 'goofy':
  put('shoe',1834,306,.79,'#c9a0c0',Math.sin(t*2)*.23);put('shoe',1834,681,.68,'#9fc0d7',Math.sin(t*2+2)*.24);
  for(let j=0;j<6;j++)put('paw',461+j*199,1045,.22,'#bfadd3',Math.sin(t+j)*.18);put('star',1448,64,.48,'#d7b799',t*.3);break;
 case 'lizard':
  for(let j=0;j<5;j++)put('leaf',88,267+j*96,.32+(j%2)*.13,'#98cba9',Math.sin(t*.9+j)*.17);
  put('fish',672,1041,.55,'#b5c790',.2);put('bubble',1840,312,.36,'#8ccbc6');put('gem',1441,67,.42,'#c5daa4',-.2);break;
 case 'catlove':
  for(let j=0;j<6;j++)put('paw',j%2?1834:83,282+j*76,.35,'#c6b0d6',Math.sin(t+j)*.12);
  put('heart',1436,1040,.7,'#d89dc4',-.08);put('heart',658,1040,.5,'#9bcad6',.1);put('star',1458,66,.36,'#d9c6a7',t*.1);break;
 case 'quack':
  put('feather',85,305,.85,'#e0c78c',Math.sin(t*.8)*.2);put('fish',1838,673,.68,'#9ed0d1',-.12);
  for(let j=0;j<9;j++){const x=425+j*133;ring(x,1048,12,3,'#a9d5d6',1,.38);put('bubble',x,1038+Math.sin(t+j)*5,.13,'#bddcde');}break;
 case 'fail':
  put('page',89,300,.8,'#cdaac0',Math.sin(t*.5)*.12);put('gear',1831,681,.75,'#a4b5d0',t*.13*(1-q));put('shoe',647,1040,.63,'#c3acc8',-.14);
  for(let j=0;j<4;j++)put('star',1835,249+j*73,.15,'#b9c5df',t*.1+j);break;
 case 'troll':
  put('mask',87,318,.9,'#a2c5be',Math.sin(t*1.1)*.12);put('eye',1834,677,.74,'#c6acd8',Math.sin(t*.8)*.09);put('crown',1480,1040,.58,'#d5bf88',-.13);
  for(let j=0;j<7;j++)put('paw',82,416+j*44,.17,'#a5b8d6',Math.sin(t+j)*.25);break;
 case 'paradise':
  put('lantern',1840,299,.9,'#e3be84',Math.sin(t*.5)*.06);put('leaf',1835,684,.7,'#a4d1b4',Math.sin(t*.7)*.16);put('moon',663,1041,.63,'#c9b6db',-.15);
  for(let j=0;j<7;j++)put('star',88,271+j*64,.11,'#dfc892',t*.1+j);break;
 case 'heaven':
  for(const[x,y,s]of [[1840,293,.9],[83,694,.7],[1439,1040,.56]])put('feather',x,y,s,'#d9d3aa',Math.sin(t*.6+x)*.1);
  for(let j=0;j<10;j++)put('note',j%2?1835:85,251+j*51,.24,'#b6d9e2',Math.sin(t+j)*.1);put('crown',664,1042,.53,'#e1c892');break;
 case 'love':
  put('rose',88,321,.77,'#d69dbf',Math.sin(t*.5)*.12);put('ring',1834,676,.79,'#cbafd3',-.12);
  for(let j=0;j<9;j++){const age=(t*.1+j*.12)%1;put('heart',1832+Math.sin(j+age*4)*17,727-age*485,.18+j%3*.06,'#d1a9dc',Math.sin(t+j)*.1);}put('page',644,1040,.6,'#d8bacd',-.1);break;
 case 'falling':
  for(let j=0;j<8;j++){const age=(t*.13+j*.137)%1;put('leaf',89+Math.sin(age*6+j)*25,228+age*506,.3+j%3*.08,['#d1a6d3','#a6c5e0','#ddbccd'][j%3],age*.9+j*.1);}
  put('moon',1438,1040,.56,'#b2b2df',-.2);put('feather',684,67,.44,'#d6d0bb',t*.1);break;
 case 'isolation':
  put('lantern',1841,302,.9,'#abc6e4',Math.sin(t*.3)*.035);put('moon',1829,683,.75,'#bba8d9',-.2);put('page',640,1040,.58,'#acc0d6',-.2);
  for(let j=0;j<8;j++)put('star',87,258+j*63,.09,'#b8cbe2',t*.1+j);break;
 case 'mystery':
  put('mask',86,303,.88,'#b3d6be',Math.sin(t*.5)*.08);put('eye',1837,676,.82,'#bfb0e0',-.08);put('gem',661,1040,.58,'#c1badf',t*.12);
  for(let j=0;j<6;j++)put('feather',1837,236+j*73,.17,'#a3d4c8',Math.sin(t*.7+j)*.15);break;
 case 'refusal':
  put('shield',86,320,.82,'#d4abc1',Math.sin(t*.4)*.08);put('flag',1838,678,.7,'#beadd7',Math.sin(t*.7)*.12);put('page',650,1040,.54,'#c2c4d8',-.15);
  for(let j=0;j<5;j++)put('bolt',1835,256+j*67,.16,'#dcadc5',-.1);break;
 case 'prowler':
  put('eye',88,302,.89,'#b89cdd',Math.sin(t*.5)*.04);put('moon',1831,682,.77,'#adb0dc',-.18);
  for(let j=0;j<7;j++)put('paw',87,427+j*43,.21,'#a49bcd',Math.sin(t*.7+j)*.12);put('gem',1432,1040,.61,'#b2a0d7',t*.12);break;
 case 'rizz':
  put('rose',86,302,.8,'#d49abe',Math.sin(t*.6)*.1);put('heart',1836,674,.74,'#be9fd9',Math.sin(t*.7)*.1);put('ring',1450,1040,.59,'#c7bbdd',-.14);
  for(let j=0;j<10;j++)put('star',j%2?1840:88,254+j*50,.11,'#d7bfe8',t*.2+j);break;
 case 'romance':
  put('rose',1841,297,.84,'#d9a6ca',Math.sin(t*.5)*.1);put('page',1833,681,.66,'#d6b8d2',-.12);put('heart',645,1040,.58,'#d6abc8',.1);
  for(let j=0;j<9;j++)put('leaf',j%2?1836:87,277+j*53,.18,'#b4d3af',Math.sin(t+j)*.14);break;
 case 'run':
  put('shoe',86,295,.89,'#b7ccce',Math.sin(t*2.5)*.15);put('shoe',1837,682,.72,'#a9bfd5',Math.sin(t*2.5+2)*.15);put('flag',670,1041,.53,'#8ac5b2',Math.sin(t*1.7)*.16);
  for(let j=0;j<5;j++)sweep(u=>[1850-u*54,250+j*80+Math.sin(u*3)*4],'#9cd9c5',j*.2,.5);break;
 case 'disgust':
  put('leaf',1838,295,.84,'#b4cf9b',Math.sin(t*.7)*.12);put('mug',1831,674,.73,'#91b9a6',-.13);
  for(let j=0;j<10;j++){const age=(t*.13+j*.11)%1;put('bubble',90+Math.sin(age*5+j)*18,728-age*469,.13+j%3*.07,'#adcfab');}put('fish',1460,1040,.54,'#9ab9b8',.1);break;
 case 'awww':
  for(let j=0;j<6;j++)put('paw',j%2?1840:87,259+j*91,.31,'#cab2d3',Math.sin(t+j)*.12);
  put('heart',1835,670,.76,'#d1a2cb',.06);put('heart',668,1040,.54,'#a8c4dd',-.1);put('star',1460,1040,.45,'#d7c39d',t*.15);break;
 case 'weeknd':
  for(let j=0;j<10;j++)put('note',j%2?1835:87,249+j*52,.25,'#d0a7cb',Math.sin(t*.9+j)*.18);
  put('moon',1836,674,.73,'#b89fd9',-.14);put('star',1456,1040,.58,'#abc6df',t*.2);put('ticket',643,1040,.6,'#d3b4ca',-.2);break;
 case 'sparta':
  put('shield',1835,303,.91,'#d4b279',Math.sin(t*.5)*.05);put('flag',1833,674,.85,'#c195a3',Math.sin(t*.8)*.13);put('crown',1422,1040,.6,'#d5bf83',-.1);
  for(let j=0;j<8;j++)put('flame',87,263+j*61,.19,'#d9b184',Math.sin(t*1.1+j)*.1);break;
 case 'confusion':
  put('eye',87,302,.85,'#bdafd9',Math.sin(t*.5)*.15);put('die',1838,675,.74,'#a8c2df',t*.4);put('gear',659,1040,.57,'#c5b9d7',-t*.3);
  for(let j=0;j<6;j++)put('page',1838,250+j*71,.19,'#b4c2e2',Math.sin(t+j)*.3);break;
 case 'western':
  put('shoe',85,317,.86,'#d2b096',Math.sin(t*.6)*.08);put('star',1837,678,.75,'#d6bb88',Math.sin(t*.6)*.05);put('ticket',643,1040,.58,'#c5b7a0',-.14);
  for(let j=0;j<5;j++)put('gear',1837,244+j*74,.17,'#ccb99b',t*.7+j);break;
 case 'rescue':
  put('flag',86,302,.89,'#9dc9d4',Math.sin(t*.9)*.14);put('shield',1835,685,.77,'#b3cbd9',-.1);put('heart',1452,1040,.61,'#d0a9c2',.08);
  for(let j=0;j<10;j++){const age=(t*.16+j*.11)%1;put('bubble',88+Math.sin(j+age*6)*18,727-age*486,.13+j%3*.07,'#a8d9df');}break;
 }
 c.restore();
}
