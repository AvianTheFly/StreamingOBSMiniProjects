const REACTION_CUES=new Set(['oops','tantrum','kitchen','meltdown','rewind','violin','spill','heartbreak','arcade','approval']);
function reactionCue(c,t,d,e){
 if(!REACTION_CUES.has(e.style))return false;
 const{p,beat,line,poly,disc,curve,halo,light,metal,ring,text}=cueInk(c,t,d,e),ice='#bce9f3',gold='#e8c98f',rose='#e4abc9';
 c.save();c.globalAlpha*=smooth(t/.35)*smooth((d-t)/.5);
 if(e.style==='oops'){
  // The impossible balancing act tips one porcelain teacup, then catches it.
  const tilt=.15+Math.sin(p*Math.PI)*.52;c.save();c.translate(60,430);c.rotate(tilt);
  ring(0,29,38,7,ice,2,.75);poly([[-26,-22],[28,-22],[21,22],[-19,22]],metal([-26,-22,28,22],['#edf1ec','#a9c7d2','#f2e9e5','#718d9b']));ring(0,-22,27,6,ice,1.4);ring(35,-4,13,17,'#d6e6e8',4,.9);line([[-20,-7],[21,-7]],rose,1.2,.6);c.restore();
  for(let j=0;j<9;j++){const a=Math.max(0,p*1.2-j*.055);if(a>1)continue;disc(20+a*49,448+a*a*184,2+j%2,3+j%3,ice,Math.sin(a*Math.PI));}
  for(let j=0;j<4;j++){const fn=u=>[1890+Math.sin(u*9+j+t*.2)*15,194+u*488];curve(fn,'#a4b3d1',1,.3);light(fn,rose,j*.18,.17,2);}
  text('OH NO',1080,51,'#dce8f5',29);
 }else if(e.style==='tantrum'){
  // A chrome tension spring compresses, releases and softly oscillates.
  const squeeze=Math.sin(p*Math.PI)**2,len=206-squeeze*81;
  poly([[10,259],[70,259],[70,269+len],[10,269+len]],'#80a4c22f');
  line([[11,259],[11,267+len]],ice,.8,.3);line([[69,259],[69,267+len]],ice,.8,.3);
  curve(u=>[40+Math.sin(u*TAU*8)*(24-squeeze*7),260+u*len],metal([15,260,67,260]),6,.98);
  curve(u=>[38+Math.sin(u*TAU*8)*(24-squeeze*7),260+u*len],'#edf5f2',1,.65);
  poly([[8,246],[70,246],[76,259],[4,259]],'#6f8b9e');poly([[5,265+len],[73,265+len],[70,278+len],[8,278+len]],'#8ba6b5');
  for(let j=0;j<6;j++){const age=p*1.45-j*.09;if(age<0||age>1)continue;ring(43,272+len,12+age*42,4+age*13,gold,1.2,(1-age)*.6);}
  for(let j=0;j<12;j++){const x=398+j*95;line([[x,12],[x+21,26],[x+42,12]],j%3?ice:gold,1.2,.42);}
  text('DANG IT',1090,60,gold,28);
 }else if(e.style==='kitchen'){
  // A copper skillet catches a dancing ember; steel vents emit soft heat ribbons.
  c.save();c.translate(56,481);c.rotate(-.23+Math.sin(t*.7)*.04);
  ring(0,0,39,24,gold,6,.96);disc(0,0,35,20,metal([-30,-20,30,20],['#5b433b','#7e5f4d','#312e39','#b28c60']));line([[30,0],[89,-13]],'#9dadb5',10);line([[34,-2],[85,-13]],'#e2e8e4',1.8);disc(-2,-2,14,8,'#dcba7475');c.restore();
  for(let j=0;j<5;j++){const fn=u=>[37+j*6+Math.sin(u*8-t*.8+j)*11,460-u*226];curve(fn,j%2?gold:ice,.9,.24);light(fn,gold,j*.2,.17,1.7);}
  for(let j=0;j<17;j++){const age=(t*.23+j*.618)%1;disc(1891+Math.sin(j+age*4)*22,677-age*465,1.2+j%2,1.4+j%2,gold,Math.sin(age*Math.PI));}
  for(let j=0;j<9;j++)line([[505+j*111,15],[547+j*111,15]],'#c18f61',2,.55);
  text('COOKED',1050,57,'#f3d19d',31);
 }else if(e.style==='meltdown'){
  // A glass pressure vessel develops glowing fractures and releases its charge.
  c.save();c.translate(1870,419);halo(0,0,77,rose,.28);poly([[-29,-65],[24,-65],[34,-43],[34,59],[-31,59],[-35,-40]],'#78769938');line([[-29,-65],[24,-65],[34,-43],[34,59],[-31,59],[-35,-40],[-29,-65]],ice,1.7,.7);
  const heat=9+smooth(p)*83;poly([[-28,52],[-28,52-heat],[28,52-heat],[28,52]],'#dc829960');line([[-34,62],[35,62]],metal([-34,62,35,62]),8);line([[-29,-66],[24,-66]],'#c0cfdf',5);
  const fault=[[5,-61],[-8,-27],[13,-2],[-5,22],[14,48]];line(fault,rose,1.4,.55);light(u=>{const q=u*4,i=Math.min(3,Math.floor(q)),f=q-i;return[fault[i][0]+(fault[i+1][0]-fault[i][0])*f,fault[i][1]+(fault[i+1][1]-fault[i][1])*f];},'#ffe1b0',0,.23,2.3);c.restore();
  for(let j=0;j<6;j++){const fn=u=>[8+j*7+Math.sin(u*9+t*.23+j)*10,187+u*503];curve(fn,rose,1,.25);light(fn,gold,j*.18,.2,2);}
  text('NO NO NO',935,52,rose,30);
 }else if(e.style==='rewind'){
  // Two machined reels reverse a perforated film ribbon; each frame drifts past.
  const reel=(x,y,r)=>{halo(x,y,r*1.7,gold,.18);disc(x,y,r,r,'#40576f');ring(x,y,r,r,ice,1.5,.85);disc(x,y,6,6,gold);for(let i=0;i<5;i++){const a=i*TAU/5-t*.7;disc(x+Math.cos(a)*r*.58,y+Math.sin(a)*r*.58,r*.23,r*.23,'#183043');}};
  reel(50,309,35);reel(42,599,27);
  const strip=u=>[37+Math.sin(u*8-t*.4)*18,350+u*214];curve(strip,'#708393',24,.75);curve(strip,ice,.8,.4);
  for(let i=0;i<23;i++){const u=(i/23+t*.14)%1,[x,y]=strip(u);poly([[x-10,y],[x-7,y],[x-7,y+4],[x-10,y+4]],ice,.75);poly([[x+7,y],[x+10,y],[x+10,y+4],[x+7,y+4]],ice,.75);}
  for(let j=0;j<3;j++){const xx=1130+j*53;poly([[xx,39],[xx+26,24],[xx+26,54]],metal([xx,24,xx+26,54]),.8);}
  for(let j=0;j<9;j++){const y=208+j*51;light(u=>[1909-u*51,y+Math.sin(u*Math.PI)*10],ice,j*.12,.25,1.8);}
 }else if(e.style==='violin'){
  // An expressive miniature orchestra, not a single instrument on an empty rail.
  const violin=(x,y,s,phase)=>{c.save();c.translate(x,y+Math.sin(beat*1.2+phase)*4);c.scale(s,s);c.rotate(-.16+Math.sin(t*.7+phase)*.065);
  const body=[[-12,-57],[-27,-45],[-28,-23],[-14,-9],[-24,5],[-31,23],[-27,51],[-12,62],[11,62],[27,51],[31,23],[24,5],[14,-9],[28,-23],[27,-45],[12,-57],[-12,-57]];
  poly(body,metal([-31,-60,31,65],['#deac72','#92513e','#d09260','#563a3b']));line(body,gold,1,.77);line([[0,-104],[0,53]],'#5d4141',9);for(let j=0;j<4;j++)line([[-3+j*2,-101],[-3+j*2,50]],'#f0d7b0',.6,.8);
  ring(0,-111,8,11,gold,3,.9);line([[-18,-6],[-20,13],[-16,19]],'#443940',2);line([[18,-6],[20,13],[16,19]],'#443940',2);
  const yy=Math.sin(beat*1.4+phase)*22;line([[-60,yy],[56,yy+16]],'#bea888',4);line([[-57,yy+3],[51,yy+18]],'#f2e5cb',1);c.restore();};
  violin(81,430,1.04,0);violin(1848,577,.9,2.1);
  violin(472,1044,.53,3);violin(1480,1034,.61,4.8);violin(1296,86,.43,1.4);
  const note=(x,y,s,color,phase)=>{c.save();c.translate(x,y);c.rotate(Math.sin(t*.9+phase)*.17);c.scale(s,s);disc(-7,12,7,4,color);line([[-1,11],[-1,-18]],color,2.2);curve(u=>[-1+Math.sin(u*Math.PI)*12,-18+u*21],color,2.3);c.restore();};
  for(const side of [0,1]){
   for(let j=0;j<5;j++){const fn=u=>[side?1896-j*7+Math.sin(u*12-t*.6)*8:20+j*7+Math.sin(u*9-t*.5)*8,185+u*574];curve(fn,j%2?gold:ice,.8,.34);light(fn,ice,j*.17+side*.4,.16,1.7);}
   for(let j=0;j<10;j++){const age=(t*.12+j*.137+side*.23)%1,y=755-age*545,x=side?1848+Math.sin(age*8+j)*22:81+Math.sin(age*9+j)*24;c.save();c.globalAlpha*=Math.sin(age*Math.PI)**.6;note(x,y,.65+(j%3)*.17,j%3?gold:rose,j);c.restore();}
  }
  // Tearful glass cameos sway between the instruments; highlights remain translucent.
  for(const[x,y,s,phase]of [[71,674,.92,0],[1862,278,.76,1],[715,58,.6,2],[1590,1024,.65,3]]){
   c.save();c.translate(x,y+Math.sin(t*.65+phase)*5);c.rotate(Math.sin(t*.5+phase)*.09);c.scale(s,s);halo(0,0,51,ice,.3);disc(0,0,28,28,metal([-28,-28,28,28],['#a1c7e377','#bf98d85b','#82b8c455','#aac8eb88']));ring(0,0,28,28,ice,1,.72);curve(u=>[-17+u*12,-7-Math.sin(u*Math.PI)*3],ice,1.7,.9);curve(u=>[5+u*12,-7-Math.sin(u*Math.PI)*3],ice,1.7,.9);curve(u=>[-10+u*20,15-Math.sin(u*Math.PI)*7],gold,1.8,.9);
   for(const sign of [-1,1]){const drop=(t*.4+phase+sign*.2)%1;disc(sign*15,3+drop*13,2.5,4,ice,Math.sin(drop*Math.PI)*.85);}c.restore();
  }
  // Five-line staves undulate across the top and bottom, carrying independent notes.
  for(const bottom of [0,1])for(let j=0;j<5;j++)curve(u=>[335+u*1210,(bottom?1032:24)+j*7+Math.sin(u*13-t*.9)*5],j%2?gold:ice,.8,.32);
  for(let j=0;j<14;j++){const age=(t*.06+j*.071)%1;note(345+age*1170,j%2?1047:43,.58,[gold,ice,rose][j%3],j);}
  // A tiny open score turns a page at the foot of the orchestra.
  c.save();c.translate(990,1034);c.rotate(-.05+Math.sin(t*.3)*.03);poly([[-47,-23],[-4,-27],[0,-19],[5,-27],[47,-23],[44,24],[0,20],[-44,24]],'#c6d8e354');line([[-47,-23],[-4,-27],[0,-19],[5,-27],[47,-23]],gold,1,.7);line([[0,-19],[0,20]],ice,1,.6);for(const side of [-1,1])for(let j=0;j<4;j++)line([[side*8,-14+j*9],[side*38,-12+j*9]],ice,.8,.55);c.restore();
 }else if(e.style==='spill'){
  // A tipped glass vial pours a glossy green ribbon that separates into droplets.
  c.save();c.translate(1034,49);c.rotate(-.7*smooth(p));poly([[-17,-29],[17,-29],[22,24],[-22,24]],'#abd9d155');line([[-17,-29],[17,-29],[22,24],[-22,24],[-17,-29]],ice,1.4,.8);poly([[-19,5],[19,5],[21,22],[-21,22]],'#98d69788');line([[-19,-31],[19,-31]],'#acb6c9',7);c.restore();
  for(const side of [0,1]){const x=side?1899:22;const fn=u=>[x+Math.sin(u*11-t*.6)*12,188+u*505];curve(fn,'#abcfa5',8,.29);curve(fn,'#e2f6c6',1.2,.64);light(fn,ice,side*.4,.16,2.1);for(let j=0;j<9;j++){const age=(p*1.1+j*.11)%1;disc(x+Math.sin(j)*21,203+age*453,3+j%3,5+j%4,'#c1e4b0',Math.sin(age*Math.PI)*.65);}}
  text('WOOPS',1280,59,'#d4ebc3',25);
 }else if(e.style==='heartbreak'){
  // Two cut rose-quartz halves separate slowly; silver seam glints fall like petals.
  c.save();c.translate(996,55);halo(0,0,74,rose,.29);const gap=3+smooth(p)*13;
  poly([[-gap,29],[-35-gap,2],[-34-gap,-19],[-17-gap,-29],[-gap,-20],[-7-gap,-5],[2-gap,7],[-gap,29]],metal([-46,-29,-gap,29],['#ead0df','#bd81a1','#ecc4d4','#795675']));
  poly([[gap,29],[35+gap,2],[34+gap,-19],[17+gap,-29],[gap,-20],[7+gap,-5],[-2+gap,7],[gap,29]],metal([gap,-29,46,29],['#d0cde7','#9ba9cb','#ebe3f0','#746c93']));line([[-gap,-20],[-7-gap,-5],[2-gap,7],[-gap,29]],'#f2e2ee',1,.72);c.restore();
  for(let j=0;j<19;j++){const age=(t*.1+j*.618)%1,x=j%2?1888:28,y=198+age*485;c.save();c.translate(x+Math.sin(age*4+j)*20,y);c.rotate(age*2+j);poly([[-3,-7],[4,-3],[3,7],[-3,2]],j%2?rose:ice,Math.sin(age*Math.PI)*.74);c.restore();}
  for(let j=0;j<3;j++)light(u=>[390+u*1170,1064-6*Math.sin(u*5+j)],rose,j*.23,.12,1.8);
 }else if(e.style==='arcade'){
  // A pixel trophy assembles into a compact score tower; success scans its edges.
  halo(1010,67,83,'#a3d9ca',.42);
  const x=1010,y=29,s=5;for(const [xx,yy,w,h,color]of [[-6,0,12,5,'#ead391'],[-4,5,8,3,'#d5b777'],[-1,8,2,5,'#f5e3ae'],[-5,13,10,2,'#b0cbd1'],[-8,1,2,5,'#98b6c5'],[6,1,2,5,'#98b6c5']])poly([[x+xx*s,y+yy*s],[x+(xx+w)*s,y+yy*s],[x+(xx+w)*s,y+(yy+h)*s],[x+xx*s,y+(yy+h)*s]],color);
  for(const side of [0,1])for(let j=0;j<16;j++){const x=side?1901-(j%3)*11:12+(j%3)*11,y=205+j*29,lit=smooth((p-j*.012)/.15);poly([[x+5,y-5],[x+18,y-1],[x+18,y+11],[x+5,y+7]],'#8ebfd15b',lit);poly([[x,y],[x+7,y],[x+7,y+7],[x,y+7]],j%3?ice:'#c5e0b1',lit*.8);light(u=>[x,y+u*19],ice,j*.1,.3,1.5);}
  text('YOU WIN',1250,61,'#ddecc7',28);
 }else if(e.style==='approval'){
  // An enamel success seal turns once, while laurel leaves unfurl independently.
  c.save();c.translate(960,63);c.rotate(-.12+.24*smooth(p));halo(0,0,86,'#9fddc6',.4);disc(0,0,74,62,'#9fddc62e');ring(0,0,74,62,ice,.8,.48);for(let j=0;j<12;j++){const a=j*TAU/12+t*.06;line([[Math.cos(a)*45,Math.sin(a)*40],[Math.cos(a)*68,Math.sin(a)*57]],gold,.8,.45);}disc(0,0,31,31,metal([-31,-31,31,31],['#dae4c2','#98bcab','#d2e8dc','#638f9a']));ring(0,0,33,33,gold,1.6,.9);line([[-15,0],[-3,12],[18,-13]],'#edf8eb',4);c.restore();
  for(const side of [0,1]){c.save();if(side){c.translate(1920,0);c.scale(-1,1);}curve(u=>[25+Math.sin(u*5)*15,680-u*475],gold,1.4,.75);for(let j=0;j<12;j++){const y=661-j*38,xx=25+Math.sin(j/12*5)*15,unfurl=smooth((p-j*.023)/.21);c.save();c.translate(xx,y);c.rotate(-.6+Math.sin(t*.2+j)*.04);disc(11,0,14*unfurl,5*unfurl,j%2?'#aad9c0':'#c5ddba',.82);line([[0,0],[22*unfurl,0]],ice,.6,.5);c.restore();}c.restore();}
 }
 c.restore();return true;
}
