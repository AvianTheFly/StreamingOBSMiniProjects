// Supporting stage performances. All poses derive from the existing event clock.
// The score supplies contact, reaction and caption beats; no timers or game policy.
export function leagueStageMotion(key,p){
 const score=leagueScore(key),beat=score?.[3]??.52,age=p-beat;
 return {...leagueBeat(p,beat),beat,age,enter:smooth((p-.04)/.15),
  approach:smooth((p-beat+.25)/.25),follow:smooth(age/.16),
  caption:smooth((p-leaguePunchlineBeat(key))/.075)};
}
export function leaguePunchlineBeat(key){
 // Later secondary gags get their own reveal, after the original action.
 return ({ace:.64,kill:.72,dragon_chemtech:.76,herald:.83,void_grub:.77,
  resource_spent:.76,inventory_added:.71,inventory_removed:.71,
  defeat:.76,game_end:.78,baron:.77,cs_milestone:.75,
  respawn:.74,ultimate_learned:.75,heavy_health_loss:.74}[key]??Math.min(.72,(leagueScore(key)?.[3]??.52)+.14));
}
export function theaterShardMotion(p,beat,index){
 const born=beat+index*.005,life=Math.max(.04,Math.min(.24,.85-born));
 const raw=(p-born)/life,q=Math.max(0,Math.min(1,raw));
 return {visible:raw>0&&raw<1,q,alpha:Math.sin(q*Math.PI)*(1-q*.5)};
}
export function theaterClimbMotion(p,beat){
 const q=smooth((p-beat+.25)/.25),step=3*q,part=step-Math.floor(step),foot=24*.9;
 const support=45-step*19;
 return {x:-58+step*39,y:support-foot-Math.sin(part*Math.PI)*28,foot,support,landed:q===1};
}
// Comic contact replaces the disconnected sword on the opposite side of the target.
function theaterTarget(I){
 const {p,at,line,poly,star,box,face}=I,m=killContactMotion(p);
 at(1832,604,1,0,()=>{
  box(-40,-32,67,57,'#7b92c8');face(0,-10,m.contact?'sleep':'happy');
  if(m.contact){line([[-21,-22],[-6,-8],[-18,6]],'#dce9ff',2);star(0,-37-m.star*38,17*m.star,'#ffe29b',m.star*.4);}
  at(m.tipX,m.tipY,1,0,()=>{poly([[0,0],[-25,-8],[-36,0],[-25,8]],'#90e7f5');line([[-35,-14],[-35,14]],'#ffe09b',5);line([[-37,0],[-50,0]],'#93cdbd',7);});
  const flag=m.flag;line([[25,14],[44,14-flag*57]],'#b9dfda',3,flag);
  if(flag>0){I.c.save();I.c.globalAlpha*=flag;poly([[44,14-flag*57],[70,19-flag*57],[44,35-flag*57]],'#fff0cd');I.c.restore();}
  I.burst(-40,0,(p-.43)/.22,'#98eff7',42);
 });
}
function storyTheater(c,e){
 const score=leagueScore(e.key);if(!score)return;
 const I=storyInk(c,e),{p,t,finite,at,line,poly,oval,ring,curve,star,heart,face,box,bean,coin,puff}=I;
 const [kind,col,accent,beat,joke,power]=score;
 if(!finite){
  if(e.key==='death')at(1050,972+Math.sin(t*.7)*3,.8,0,()=>{
   curve(u=>[-79+158*u,13+Math.sin(u*Math.PI)*23],col,3,.8);
   for(const x of [-79,79])line([[x,-33],[x,42]],accent,3,.7);
   oval(0,9,20,25,'#cad9ed');poly([[-20,12],[-20,32],[-9,27],[0,34],[9,27],[20,32],[20,12]],'#cad9ed');face(0,4,'sleep');
   c.save();c.fillStyle=accent;c.font='700 19px Segoe UI';c.fillText('z',32,-12-Math.sin(t)*3);c.restore();
  });
  return;
 }
 const m=leagueStageMotion(e.key,p),hit=m.follow,approach=m.approach;
 if(e.key==='kill')theaterTarget(I);
 // Local color wells frame the performers rather than flooding gameplay.
 for(const x of [92,1828]){
  const y=e.key==='respawn'?520:480,r=112+power*9+m.impact*18;
  const g=c.createRadialGradient(x,y,10,x,y,r);g.addColorStop(0,col+'38');g.addColorStop(.5,col+'12');g.addColorStop(1,col+'00');
  c.save();c.globalAlpha*=m.enter;c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();
  for(let j=0;j<3;j++)ring(x,y,66+j*14+m.impact*12,94+j*13,col,1.2,(.12+m.anticipation*.24)*(1-j*.2));
 }
 // Comic reaction / hero tableau inhabits the lower apron (never the game center).
 at(1100,983+(1-m.enter)*95,1.1,0,()=>{
  oval(0,51,119,9,col+'18');line([[-125,53],[125,53]],col,2,.55);
  switch(kind){
   case 'strike':
    bean(-56,22,1.2,col,hit*.5);at(18,-13,1,hit*.08,()=>{line([[0,62],[0,-39]],accent,3);poly([[0,-39],[70,-30],[0,-7]],'#fff0cc');});
    c.save();c.globalAlpha*=hit;c.font='800 21px Segoe UI';c.fillStyle='#192941';c.fillText('GG',28,-19);c.restore();break;
   case 'link':
    for(const s of [-1,1]){bean(s*(72-approach*35),22,1.12,s<0?col:accent,hit);line([[s*(72-approach*35),12],[s*(41-approach*41),-13]],s<0?col:accent,9);oval(s*(41-approach*41),-13,9,10,'#ffe0ae');}
    I.burst(0,-13,m.age/.21,accent,48);if(hit>0)heart(0,-26-hit*19,hit*.55,'#ff9aba');break;
   case 'cherry':
    box(-32,-26,64,76,col);oval(0,-27,33,9,accent);face(0,13);
    for(let j=0;j<9;j++){const s=theaterShardMotion(p,beat,j);if(!s.visible)continue;c.save();c.globalAlpha*=s.alpha;oval((j-4)*s.q*18,-30-s.q*110+s.q*s.q*48,4+j%3,6,j%2?col:accent);c.restore();}
    at(0,-27-hit*24,hit,0,()=>poly([[-26,0],[-30,-21],[-12,-12],[0,-26],[12,-12],[30,-21],[26,0]],accent));break;
   case 'clutch':
    c.save();c.globalAlpha*=hit;poly([[-15,-6],[-93,42],[-26,29],[27,42],[18,-6]],'#b58dff');c.restore();
    at(0,8,1.2,(1-hit)*Math.sin(t*13)*.09,()=>{heart(0,0,1.5,col);face(0,-5,hit>.3?'happy':'sad');});
    box(-59,43,118,13,'#182943');box(-56,46,6,7,col);for(let j=0;j<(e.key==='low_hp_multikill'?3:1);j++)star(-33+j*33,-58-hit*9,12*hit,accent);break;
   case 'combo':{
    const count={double_kill:2,triple_kill:3,quadra_kill:4}[e.key];
    for(let j=0;j<count;j++){const q=smooth((p-beat-j*.028)/.14);at((j-(count-1)/2)*45,31-Math.sin(q*Math.PI)*58,1,0,()=>{box(-17,14,34,9,col);star(0,0,15,accent,(1-q)*.4);});}
    for(const s of [-1,1])poly([[s*100,46],[s*108,-31],[s*135,-10],[s*117,10]],col);break;}
   case 'concert':
    for(let j=0;j<5;j++){
     const q=smooth((p-beat-j*.025)/.15),x=(j-2)*48;
     c.save();c.globalAlpha*=q*.18;poly([[x,-79],[x-36,38],[x+36,38]],j%2?col:accent,null);c.restore();
     bean(x,23-Math.sin(q*Math.PI)*20,.85,[col,'#76e4e5',accent,'#ffa6c9','#91e5a5'][j],m.recoil*3);star(x,-66,8+q*4,accent);
     line([[x-7,31],[x+6,13],[x+21,1]],accent,4);oval(x-5,27,9,11,col,'#152d45');
    }
    for(const s of [-1,1]){box(s*156-18,-17,36,68,'#243450');ring(s*156,27,12,12,col,3);ring(s*156,-2,7,7,accent,2);}
    break;
   case 'sweep':{
    const b=aceSweepMotion(p);for(let j=0;j<5;j++)star(-72+j*36,20-hit*30,10,accent);
    at(b.x,-5,1,b.a,()=>{line([[0,-56],[0,24]],col,5);poly([[-20,23],[20,23],[26,44],[-26,44]],accent);});
    if(b.speck>0)poly([[49,38],[56,38],[56,44],[49,44]],'#e5a8ff');break;}
   case 'squad':case 'march':case 'gates':
    if(kind==='gates')for(const s of [-1,1]){line([[s*115,50],[s*115,-60]],accent,6);poly([[s*115,-60],[s*(115-hit*45),-40],[s*(115-hit*45),42],[s*115,50]],col+'90');}
    for(let j=0;j<5;j++){const late=kind==='squad'&&j===4;bean(-82+j*40+(late?75*(1-approach):0),22-Math.sin(Math.min(1,Math.max(0,(p-beat+j*.015)/.17))*Math.PI)*11,.88,j%2?accent:col,Math.sin(t*7+j)*(1-hit));}
    if(kind==='march'){line([[-103,30],[-103,-46]],accent,3);poly([[-103,-46],[-65,-35],[-103,-21]],col);}break;
   case 'dragon':case 'earth':case 'fire':case 'water':case 'air':case 'chemtech':case 'elder':case 'hextech':
    theaterElement(I,kind,m,col,accent);break;
   case 'void':
    bean(0,19,1.3,'#b28aea',m.recoil);at(0,-22,1,Math.sin(hit*TAU)*.23*(1-hit),()=>{for(const s of [-1,1])poly([[s*13,13],[s*65,-59],[s*53,24]],col);oval(0,9,25,13,accent);});
    for(const s of [-1,1])curve(u=>[s*(55+u*64),45-Math.sin(u*Math.PI)*hit*72],col,5,.7);break;
   case 'eye':
    poly([[-61,-3],[0,-41],[61,-3],[0,35]],col);oval(0,-3,21,28,'#ffe1a2');oval(0,-3,7,19,'#192d46');
    at(0,-3-41*(1-approach),1,0,()=>ring(0,0,31,33,accent,4));curve(u=>[32+Math.sin(u*Math.PI)*10,-3+u*48],accent,2,approach);break;
   case 'grubs':
    for(let j=0;j<3;j++){const g=grubHopMotion(p,j);at((j-1)*58,20+g.y,1,0,()=>{oval(0,0,23,17,col,'#192d46');face(0,-2,g.sleep?'sleep':'happy');for(const s of [-1,1])poly([[s*7,-11],[s*17,-29],[s*19,-7]],accent);});}break;
   case 'heist':
    box(-79,-13,56,56,'#5e739b');face(-51,13,'sad');
    at(-51,-16-hit*41,hit,-hit*.08,()=>{box(-27,-15,54,30,'#ffedc3',2);c.font='800 16px Segoe UI';c.fillStyle='#203350';c.textAlign='center';c.fillText('IOU',0,5);});
    at(70+hit*37,13,1,-hit*.2,()=>{bean(0,0,1,col,hit);poly([[-16,-12],[16,-12],[12,0],[-12,0]],'#26364f');star(-30,-10,14*hit,accent);});break;
   case 'thorn':
    for(let j=0;j<8;j++){const a=j*TAU/8;poly([[0,15],[Math.cos(a)*(29+hit*38),15+Math.sin(a)*(29+hit*38)],[Math.cos(a+.3)*23,15+Math.sin(a+.3)*23]],j%2?col:accent);}
    oval(0,15,19,20,'#513854');face(0,12);break;
   case 'rubble':case 'shatter':case 'waiting':case 'restore':
    theaterStructure(I,kind,m,col,accent);break;
   case 'rest':
    curve(u=>[-90+u*180,22+Math.sin(u*Math.PI)*20],col,4);oval(0,17,23,24,'#d0dcef');face(0,12,'sleep');star(44,-23,8,accent);break;
   case 'spirits':case 'unlock':
    for(let j=0;j<4;j++)at((j-1.5)*66,19-hit*11,.47+.08*hit,0,()=>paintUdyrSpirit(I,j,smooth((p-.24-j*.04)/.3)));
    if(kind==='unlock'){ring(0,-66,16,15,col,5);line([[15,-66],[53,-66],[53,-54]],accent,5);star(0,-37,13*hit,accent);}break;
   case 'pulse':case 'bandage':case 'heal':
    at(0,9,1,kind==='bandage'?m.recoil*.23:0,()=>{heart(0,0,1.8,col);face(0,-5,kind==='heal'?'happy':'sad');});
    if(kind==='bandage'&&p>.58){const band=smooth((p-.58)/.16);c.save();c.globalAlpha*=smooth((p-.58)/.04);at(-73+band*73,7,1,-.2,()=>{box(-39,-10,78,20,'#ffe2ad');box(-10,-9,20,18,'#fff3d9');});c.restore();}
    else if(kind==='heal')for(let j=0;j<7;j++){const s=theaterShardMotion(p,beat-.06,j);if(!s.visible)continue;c.save();c.globalAlpha*=s.alpha;heart((j-3)*21,-9-s.q*93,.35,accent);c.restore();}
    else{line([[-115,48],[-28,48],[-14,35],[0,60],[12,47],[115,47]],accent,3);c.font='800 20px Segoe UI';c.fillStyle='#ffe5ce';c.textAlign='center';c.fillText('1 HP CLUB',0,-57);}break;
   case 'empty':
    box(-27,-47,54,98,'#335981');box(-18,-37,36,88*(1-approach),col,0);face(0,30,'sad');
    if(m.age>0&&m.age<.16){const q=m.age/.16;poly([[42,-10+q*40],[49,2+q*40],[42,11+q*40],[36,2+q*40]],accent);}break;
   case 'level':case 'rank':
    for(let j=0;j<4;j++)box(-72+j*39,45-j*19,40,10,j%2?col:accent,2);
    {const climb=theaterClimbMotion(p,beat);bean(climb.x,climb.y,.9,col,0);}star(59,-63,13+hit*3,accent);break;
   case 'loot':case 'unpack':
    box(-40,-1,80,52,col);face(0,26);at(-40,-1,1,-approach*.7,()=>box(0,-14,80,14,accent,2));
    {const q=kind==='loot'?1-approach:approach;at(q*68,-18-q*40,1,q*.3,()=>poly([[0,-19],[-17,0],[0,19],[17,0]],accent));}
    line([[41,23],[68,7],[71,-6-Math.sin(hit*Math.PI)*17]],col,5);break;
   case 'harvest':
    for(let j=0;j<5;j++){const q=smooth((p-beat-j*.015)/.12);I.sprout(-83+j*41,47,1-q,'#a4de89');coin(-83+j*41,28-q*57,.75*q);}
    line([[-115,24],[89-approach*200,24-approach*35]],accent,3);break;
   case 'vision':
    line([[-50,46],[-50,9]],accent,5);poly([[-81,-10],[-50,-32],[-19,-10],[-50,12]],col);oval(-50,-10,9,14,accent);
    for(let j=0;j<3;j++)ring(-50,-10,30+hit*37+j*13,26+hit*23+j*9,col,1.8,.4*(1-hit*.4));
    bean(65,21,1,'#a1d27b',hit);c.save();c.globalAlpha*=1-hit;puff(65,4,1.4,'#899eb6b0');c.restore();break;
   case 'trophy':
    poly([[-43,-31],[43,-31],[29,10],[0,25],[-29,10]],accent);line([[0,25],[0,47],[-29,47],[29,47]],accent,7);face(0,-5);
    star(0,-56-hit*16,22,col);for(const s of [-1,1]){bean(s*91,19-Math.sin(hit*Math.PI)*30,1,col,hit);line([[s*91,6],[s*117,-17]],accent,6);}break;
   case 'rain':
    puff(-45,-53,1.3,'#8dabd1');face(-45,-56,p>.73?'happy':'sad');I.sprout(42,46,.3+hit*.7,'#aee5a3');
    for(let j=0;j<5;j++){const q=smooth((p-.18-j*.03)/.4);line([[-80+j*17,-38+q*68],[-83+j*17,-28+q*68]],col,3,Math.sin(q*Math.PI));}heart(42,-40,.5*hit,accent);break;
   case 'book':
    poly([[-70,-25],[0,-10],[70,-25],[70,41],[0,52],[-70,41]],'#f2ddb3');line([[0,-10],[0,52]],col,3);
    for(const s of [-1,1])for(let j=0;j<4;j++)line([[s*12,j*12],[s*55,-8+j*12]],'#b49f7c',2);
    at(0,0,1,0,()=>{poly([[0,-10],[hit*70,-25],[hit*70,41],[0,52]],col);});star(-33,-45,15*(1-hit),accent);break;
   case 'signal':case 'custom':
    // Keep the context-specific original vignette; an uncertain scanning lens answers it.
    ring(-28,-8,32,32,col,4);line([[0,19],[32,48]],accent,9);
    at(-28,-8,1,0,()=>{storyMotif(I,e.key,0,approach);});
    bean(80,22,1,col,hit*.5);c.font='800 32px Segoe UI';c.fillStyle=accent;c.textAlign='center';c.fillText(kind==='signal'?'?':'✦',80,-33);break;
  }
 });
 // Impact bursts are born once from the actor margins; never recycled spark queues.
 if(!e.key.startsWith('possible_')&&kind!=='rest')for(const [x,y] of [[94,440],[1826,585]])for(let j=0;j<10+Math.ceil(power*3);j++){
  const s=theaterShardMotion(p,beat,j);if(!s.visible)continue;
  const a=j*2.399,travel=s.q*(25+power*22),dx=Math.cos(a)*travel,dy=Math.sin(a)*travel;
  c.save();c.globalAlpha*=s.alpha*.75;at(x+dx,y+dy,.35+.3*(1-s.q),a,()=>storyMotif(I,e.key,j,s.q));c.restore();
 }
 if(joke&&m.caption>0){
  c.save();c.globalAlpha*=m.caption;c.textAlign='center';c.textBaseline='middle';c.font='800 22px "Segoe UI",sans-serif';
  c.strokeStyle='#111f36e0';c.lineWidth=5;c.strokeText(joke,1100,881,580);c.fillStyle=accent;c.fillText(joke,1100,881,580);c.restore();
 }
}
function theaterElement(I,kind,m,col,accent){
 const {p,t,at,line,poly,oval,ring,star,face,box,curve,puff}=I,q=m.follow;
 if(kind==='fire'){
  line([[-64,40],[13,24]],'#ac704c',12);line([[-63,21],[13,43]],'#d4925d',10);
  for(let j=0;j<4;j++)poly([[-58+j*17,32],[-45+j*17,-27-q*23-Math.sin(t*6+j)*7],[-29+j*17,32]],j%2?accent:col,null);
  line([[79,31],[67,-4],[0,-21]],'#c5e5ba',5);box(-12,-34,25,21,q>.6?'#dca76c':'#fff0d0',5);face(0,-25,'happy',.6);
 }else if(kind==='water'){
  for(let j=0;j<3;j++)ring(0,35,64+q*20+j*10,8+j*5,col,3,.7);
  oval(26,8,27,16,accent);oval(43,-12,14,15,accent);poly([[53,-14],[73,-7],[54,-2]],'#ffad5a');oval(44,-15,2,3,'#20304b');
  line([[20,8],[20,-52]],'#8bd6aa',3);at(20,-52,q,0,()=>poly([[-50,0],[-30,-26],[0,-35],[30,-26],[50,0]],'#a9ecba'));puff(-62,-58,.7,'#9cccff');
 }else if(kind==='air'){
  curve(u=>[-125+250*u,25+Math.sin(u*TAU+t)*8],col,3,.6);
  at(-95+m.approach*165,-20-Math.sin(m.approach*Math.PI)*35,1.3,-.1,()=>poly([[-30,-12],[35,0],[-23,18],[-10,0]],accent));
  for(let j=0;j<3;j++)puff(-62+j*65,35-j%2*30,.7,col+'60');
 }else if(kind==='chemtech'){
  box(-23,-48,46,15,accent);poly([[-15,-33],[-15,-17],[-42,43],[42,43],[15,-17],[15,-33]],col+'50');poly([[-32,11],[32,11],[41,41],[-41,41]],col);face(0,26);
  I.sprout(0,-33,q*.45,col);for(let j=0;j<6;j++){const a=j*TAU/6;oval(Math.cos(a)*10,-33-q*29.7+Math.sin(a)*10,7*q,7*q,'#ffa6dc');}oval(0,-33-q*29.7,6*q,6*q,accent);
 }else if(kind==='hextech'){
  for(let j=0;j<3;j++){const r=25+j*14;poly(Array.from({length:6},(_,n)=>[Math.cos(n*TAU/6)*r,Math.sin(n*TAU/6)*r]),col+'18',j%2?col:accent,2);}
  poly([[3,-28],[-17,6],[-1,6],[-8,29],[21,-9],[5,-9]],accent);for(const s of [-1,1])line([[s*59,27],[s*78,27],[s*78,-12],[s*116,-12]],col,3);
 }else if(kind==='elder'){
  ring(0,-9,56,56,col,3);for(let j=0;j<3;j++)at((j-1)*38,33-q*29,.8,0,()=>{oval(0,0,15,23,'#dee8ff');face(0,-3,'sleep');});star(0,-67,13,accent);
 }else{
  for(let j=0;j<5;j++)poly([[-88+j*35,48],[-70+j*35,-18-q*(j%2?30:10)],[-44+j*35,48]],j%2?accent:col);
  if(kind==='earth')for(let j=0;j<3;j++)I.sprout(-60+j*60,45,q,'#b7f5a8');
  else for(const s of [-1,1])poly([[s*12,9],[s*83,-68*q],[s*76,14],[s*30,33]],col);star(0,-44,13+q*6,accent);
 }
}
function theaterStructure(I,kind,m,col,accent){
 const {p,at,line,poly,oval,box,face,coin}=I,restoring=kind==='restore',waiting=kind==='waiting';
 const motion=structureChoreography(p,restoring),q=waiting?.6:restoring?motion.join:1-motion.crush;
 for(let j=0;j<5;j++)at((j%2?1:-1)*motion.spread*.7,36-j*19*q,1,(j%2?1:-1)*motion.crush*.3,()=>{
  if(kind==='shatter'||restoring||waiting)poly([[0,-24],[-21,0],[0,16],[21,0]],j%2?col:accent);
  else box(-33,-15,66,18,j%2?col:accent,2);
 });
 if(waiting){for(let j=0;j<3;j++)oval(-9+j*9,-65,3,3,accent);}
 else if(!restoring){
  // A sheltered marshal reacts only after the collapse at .49.
  at(105,13,1,0,()=>{poly([[-19,34],[0,-7],[19,34]],'#ffb55e');face(0,22);line([[0,15],[0,-51]],accent,3);poly([[-47,-34],[-22,-51],[0,-57],[22,-51],[47,-34]],col);});
  I.burst(0,35,m.age/.25,accent,62);
  if(I.e.key==='first_turret')for(let j=0;j<5;j++)coin(-44+j*22,28-Math.sin(m.follow*Math.PI)*68,.7*m.follow);
 }else for(let j=0;j<4;j++)I.star(-54+j*36,-57-m.follow*15,8*m.follow,accent);
}
