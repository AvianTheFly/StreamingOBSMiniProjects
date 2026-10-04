// Hextech alone uses conductive hard-surface architecture.
function leagueFrame(c,e){
 if(e.key==='dragon_hextech'){hextechArchitecture(c,e);return;}
 const k=e.key,t=e.elapsed||0,p=Number.isFinite(e.duration)?t/e.duration:.5,z=smooth(p),w=new WorldPaint(c),a=palette[e.theme]||'#bba8de',gold='#e8ce92',ice='#b9e5eb';
 const line=(fn,col=a,width=1,alpha=.6)=>w.line(fn,col,width,alpha);
 const wake=(fn,col=a,j=0,width=2)=>w.light(fn,Number.isFinite(e.duration)?p*1.25-j:(t*.055+j)%1.35,col,width,.23,.9);
 const poly=(pts,col,alpha=.8)=>{c.save();c.globalAlpha*=alpha;c.fillStyle=col;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.restore();};
 const wash=(draw,col,axis,alpha=.6)=>{c.save();c.globalAlpha*=alpha;const g=c.createLinearGradient(...axis);g.addColorStop(0,col+'ec');g.addColorStop(.45,col+'76');g.addColorStop(1,col+'00');c.fillStyle=g;c.beginPath();draw(c);c.fill();c.restore();};
 const arc=(x,y,rx,ry,start=0,end=TAU)=>u=>[x+Math.cos(start+u*(end-start))*rx,y+Math.sin(start+u*(end-start))*ry];
 const particles=(x,y,col,n=29,spread=30,height=475)=>{for(let j=0;j<n;j++){const epoch=Math.floor(t*.12+j*.618),age=t*.12+j*.618-epoch;w.mote(x+Math.sin(j*7+epoch*2.41+age*2)*spread,y-age*height,1+j%3*.5,col,Math.sin(age*Math.PI)*.7);}};
 c.save();
 if(k==='dragon_earth'){
  // Sedimentary cliff on one side, crystalline mineral seams along the other.
  for(let j=0;j<15;j++){const y=174+j*34,x=33+(j*17)%39;poly([[0,y],[x,y-8],[x+15,y+19],[x-12,y+37],[0,y+31]],j%2?'#75664e':'#494e41',.85);w.beam([[0,y+4],[x,y-6],[x+9,y+16]],gold,.8,.55);}
  for(let j=0;j<3;j++){const fn=u=>[1905-j*12+Math.sin(u*17+j)*11,181+u*492];line(fn,'#c6bb86',1.4,.6);wake(fn,gold,j*.2);}
  for(let j=0;j<17;j++){const x=353+j*71;poly([[x,0],[x+54,0],[x+36,11+j%3*4],[x+11,7]],'#a19b73',.65);}
 }else if(k==='dragon_fire'){
  // Long translucent flame tongues climb out of warm black cinders.
  for(let j=0;j<13;j++){const y=194+j*36;wash(q=>{q.moveTo(0,y+85);q.bezierCurveTo(49,y+63,2,y+15,35+Math.sin(t*.6+j)*9,y-10);q.bezierCurveTo(15,y+51,85,y+77,0,y+92);},j%3?'#e9965f':'#dd6657',[0,0,94,0],.59);}
  particles(1883,662,'#ffc68c',44,29);for(let j=0;j<9;j++){const fn=u=>[370+u*1150,12+j*2+Math.sin(u*18-t*.45+j*.4)*6];line(fn,j%2?'#d9715f':'#e6ae75',.8,.25);}
 }else if(k==='dragon_water'){
  // Suspended water lenses and refractive rain; no shore, no coral.
  for(let j=0;j<7;j++){const y=217+j*67;wash(q=>{q.moveTo(1920,y-42);q.bezierCurveTo(1815,y-35,1854,y+24,1920,y+48);},'#84dccc',[1920,0,1811,0],.52);line(arc(1919,y,49,35,1.57,4.71),'#c8fff0',1,.7);}
  for(let j=0;j<22;j++){const age=(t*.12+j*.618)%1;w.petal(17+Math.sin(j)*16,181+age*481,3+j%3,ice,1.57,.7);}
  for(let j=0;j<5;j++){const fn=u=>[356+u*1190,20+Math.sin(u*10-t*.27+j*.2)*12+j*2];line(fn,ice,.9,.43);wake(fn,'#d2fff2',j*.18);}
 }else if(k==='dragon_air'){
  // Wind shear moves in unequal pale cloud streaks across the upper margin.
  for(let j=0;j<19;j++){const x=350+j*64,y=12+Math.sin(j*.9+t*.11)*11;w.mist(x,y,55,9,ice,.2);}
  for(let j=0;j<6;j++){const fn=u=>[1897-j*6+Math.sin(u*11+t*.13+j)*14,187+u*477];line(fn,ice,.85,.32);wake(fn,'#eaf8ef',j*.18,1.5);}
  for(let j=0;j<17;j++){const age=(t*.065+j*.618)%1;w.petal(27+Math.sin(age*6+j)*27,661-age*478,7+j%3,'#dce5d8',-.5+age,.6);}
 }else if(k==='dragon_chemtech'){
  // Pressurized glass reservoirs, viscous acid, and rising condensation.
  for(let j=0;j<4;j++){const y=202+j*119;wash(q=>{q.moveTo(0,y);q.lineTo(36,y+7);q.quadraticCurveTo(63,y+50,24,y+82);q.lineTo(0,y+75);},'#9cc85f',[0,0,67,0],.58);line(arc(20,y+43,26,43),'#c0c99a',1.2,.7);}
  for(let j=0;j<28;j++){const age=(t*.12+j*.618)%1;line(arc(1894+Math.sin(j)*14,661-age*468,2+j%3,3+j%3),'#cce793',1,.7);}
  const fn=pathOf([[363,11],[718,11],[751,37],[1143,37],[1174,11],[1550,11]]);line(fn,'#7b8153',5,.55);wake(fn,'#e2f3a9',0,1.7);
 }else if(k==='dragon_elder'){
  // Ancient spectral plumage sweeps inward, bones turn into cold gold dust.
  for(let j=0;j<17;j++){const y=185+j*28;w.petal(13+j%3*10,y,19-j%4,ice,-.7+Math.sin(t*.2+j)*.04,.7);}
  for(let j=0;j<8;j++){const fn=u=>[1908-j*8+Math.sin(u*Math.PI)*(j+8),190+u*460];line(fn,j%2?'#bdcbdc':'#d4d0b5',1,.38);wake(fn,gold,j*.1,1.4);}
  for(let j=0;j<13;j++){const x=360+j*96;w.petal(x,14+Math.sin(j)*5,11,ice,.24,.6);}particles(1868,660,gold,26,27);
 }else if(k==='baron'){
  // Living void musculature winds around one edge in a deep iridescent spiral.
  for(let j=0;j<9;j++){const fn=u=>[13+j*5+Math.sin(u*12+t*.27+j*.3)*17,180+u*490];line(fn,j%2?'#694982':'#b188ce',5-j*.4,.52);wake(fn,'#dac2ed',j*.14,1.7);}
  for(let j=0;j<8;j++){const y=210+j*60;wash(q=>{q.moveTo(1920,y-23);q.quadraticCurveTo(1814,y,1920,y+42);},'#9e70bb',[1920,0,1828,0],.45);}
  particles(1847,661,'#c1a4e6',33,24);for(let j=0;j<4;j++)wake(u=>[350+u*1200,17+Math.sin(u*12+t*.14+j)*12],a,j*.18,1.4);
 }else if(k==='herald'){
  // A watchful eye-shaped optical aperture blinks at the right margin.
  for(let j=0;j<6;j++)line(arc(1943,417,48+j*8,71+j*18,1.6,4.65),j%2?'#ccafef':'#706487',j?1.3:5,.65);
  wash(q=>{q.moveTo(1920,343);q.quadraticCurveTo(1819,417,1920,491);},'#a59beb',[1920,0,1825,0],.5);
  particles(34,663,'#b59cdc',29,25);for(let j=0;j<11;j++){const x=358+j*109;poly([[x,0],[x+62,0],[x+24,19]],'#8e76ac',.65);}
 }else if(k==='void_grub'){
  // A low marching colony: successive shell backs move with staggered legs.
  for(let j=0;j<21;j++){const x=350+j*59+z*18,y=1066-Math.sin(t*.9+j)*4;wash(q=>{q.ellipse(x,y,15,8,0,Math.PI,TAU);q.closePath();},'#bca3dc',[x,y-8,x,y+4],.8);for(let leg=0;leg<3;leg++)w.beam([[x-9+leg*8,y],[x-12+leg*8,y+6]],'#a38bb9',1,.75);}
  particles(1900,660,'#c1acd9',21,16);for(let j=0;j<8;j++)w.mote(18,238+j*49,2,'#c6b4ed',.8);
 }else if(k==='atakhan_legacy'){
  for(let j=0;j<11;j++){const y=184+j*42;poly([[0,y],[65,y-16],[27,y+13],[46,y+38],[0,y+28]],'#49313f',.9);w.beam([[0,y],[65,y-16]],'#d19a98',1,.75);}
  for(let j=0;j<6;j++){const fn=u=>[1903-j*7+Math.sin(u*12+j)*9,184+u*480];line(fn,'#99566d',2,.5);wake(fn,'#e1a5a9',j*.14);}particles(1854,661,'#c68ca3',24,20);
 }else if(k.includes('inhibitor')){
  const destroy=k==='inhibitor_destroyed',soon=k==='inhibitor_respawning_soon',spread=destroy?z*19:soon?8:(1-z)*19;
  for(let j=0;j<16;j++){const y=190+j*30,x=12+j%3*15+Math.sin(j)*spread;poly([[x,y-8],[x+9,y],[x+2,y+20],[x-7,y+9]],j%3?a:ice,soon?.4:.7);}
  for(let j=0;j<4;j++){const fn=arc(1929,428,40+j*11+spread,92+j*24,1.63,4.65);line(fn,a,1.3,.5);wake(fn,ice,j*.19);}
 }else if(k.includes('turret')){
  const first=k==='first_turret';for(let j=0;j<(first?8:12);j++){const y=186+j*(first?61:40),dx=Math.sin(j*2.3)*z*12;poly([[0,y],[37+dx,y-5],[52+dx,y+21],[21+dx,y+35],[0,y+26]],j%2?'#718184':'#435661',.85);w.beam([[0,y+2],[37+dx,y-4],[48+dx,y+18]],'#bdc9b4',.8,.7);}
  particles(1888,664,gold,first?34:24,27);for(let j=0;j<15;j++){const x=377+j*81;poly([[x,0],[x+31,0],[x+23,13],[x+4,9]],a,.55);}
 }else if(k==='victory'){
  // Two unequal gilded laurel branches and a shower of small celebratory foil.
  for(const[x,s,n]of [[16,1,19],[1906,-1,12]]){const fn=u=>[x+s*Math.sin(u*5)*17,665-u*475];line(fn,gold,1.6,.8);for(let j=0;j<n;j++){const [xx,y]=fn(j/n);w.petal(xx+s*10,y,13+j%3,gold,s*-.65,.78);}}
  for(let j=0;j<37;j++){const x=350+j*33,y=7+Math.sin(j*.7+t*.22)*15;w.petal(x,y,3+j%3,j%3?gold:ice,j+p,.8);}
 }else if(k==='pentakill'){
  // Five independent luminous spears converge in sequence along the top crown.
  for(let j=0;j<5;j++){const x=452+j*247;wash(q=>{q.moveTo(x,0);q.lineTo(x+48,0);q.lineTo(x+24,76);},gold,[0,0,0,84],.69);wake(u=>[x+24,76-u*73],ice,j*.12,3);}
  for(let j=0;j<7;j++){const fn=u=>[15+j*5+Math.sin(u*8+j)*11,180+u*490];line(fn,'#bd95d6',1.2,.45);wake(fn,gold,j*.07,1.8);}particles(1886,665,gold,49,34);
 }else if(k==='defeat'||k==='game_end'){
  const ending=k==='game_end';for(let j=0;j<31;j++){const age=(p*1.1+j*.618)%1,x=ending?1897:22,y=182+age*485;w.petal(x+Math.sin(j)*22,y,3+j%4,a,j+age,Math.sin(age*Math.PI)*.65);}
  for(let j=0;j<5;j++)line(u=>[356+u*1200,8+j*4+Math.sin(u*Math.PI)*(ending?15:32)*z],a,1,.5-j*.05);particles(ending?24:1890,662,a,13,20);
 }else if(k==='respawn'||k==='game_start'){
  const start=k==='game_start';for(let j=0;j<(start?7:4);j++){const fn=u=>[15+j*8+Math.sin(u*Math.PI)*14,672-u*493];line(fn,a,1.4,.45);wake(fn,ice,j*.1,2.2);}
  for(let j=0;j<(start?9:5);j++){const x=390+j*(start?133:249);line(arc(x,-8,45,38,0,Math.PI),start?gold:a,1.3,.6);}particles(1888,662,ice,29,22);
 }else if(['kill','double_kill','triple_kill','quadra_kill','first_blood','low_hp_kill','low_hp_multikill'].includes(k)){
  const n={kill:1,double_kill:2,triple_kill:3,quadra_kill:4,first_blood:1,low_hp_kill:2,low_hp_multikill:3}[k],warm=k==='first_blood'||k.startsWith('low_hp');
  for(let j=0;j<n;j++){const side=j%2,x=side?1920:0,s=side?-1:1,y=186+Math.floor(j/2)*239;wash(q=>{q.moveTo(x,y);q.quadraticCurveTo(x+s*91,y+45,x+s*4,y+207);q.quadraticCurveTo(x+s*38,y+60,x,y+19);},warm?'#df94a4':ice,[x,0,x+s*98,0],.66);wake(u=>[x+s*(5+Math.sin(u*Math.PI)*37),y+u*199],warm?gold:ice,j*.08,2.1);}
  if(n>1)for(let j=0;j<n*4;j++){const x=377+j*1150/(n*4);w.petal(x,14+Math.sin(j)*8,5,a,.4,.75);}particles(1884,662,warm?gold:a,16+n*5,21);
 }else if(k==='assist'||k==='ace'||k==='manpower_advantage'){
  const n=k==='ace'?5:k==='assist'?3:8;for(let j=0;j<n;j++){const fn=u=>[353+u*1210,15+Math.sin(u*8+j*TAU/n)*12];line(fn,j%2?a:gold,1.1,.46);wake(fn,ice,j*.075,1.7);}
  for(let j=0;j<n*3;j++){const y=198+j*475/(n*3);w.mote(18+Math.sin(j)*13,y,2.3,a,.8);}particles(1896,663,a,22,18);
 }else if(['level_up','ultimate_learned','ability_rank_up'].includes(k)||e.kind==='streak'){
  const n=e.kind==='streak'?Math.max(3,e.rank||3):k==='ultimate_learned'?7:k==='level_up'?4:2;
  for(let j=0;j<n+4;j++){const y=197+j*455/(n+4),x=8+(j%3)*13;w.beam([[x,y+13],[x+13,y],[x+27,y+13]],j%2?a:gold,1.7,.7);wake(u=>[1900-j%4*8,664-u*476],a,j*.037,1.2);}
  for(let j=0;j<n;j++)line(arc(960,-18,69+j*47,39+j*6,0,Math.PI),gold,1,.55);
 }else if(k==='large_heal'||k==='possible_jungle_activity'||k==='cs_milestone'){
  const harvest=k==='cs_milestone';for(let j=0;j<19;j++){const y=189+j*25,x=12+Math.sin(j*.6)*14;w.petal(x,y,harvest?8:13,harvest?gold:a,j%2?-.6:.7,.8);}
  for(let j=0;j<21;j++){const x=367+j*56;w.petal(x,9+Math.sin(j)*7,5,harvest?gold:ice,-.3,.7);}particles(1891,664,harvest?gold:a,31,24);
 }else if(k==='vision_activity'){
  for(let j=0;j<7;j++)line(arc(1944,409,54+j*7,68+j*16,1.57,4.71),a,1.2,.65-j*.05);
  const fn=arc(-15,418,46,222,-1.46,1.46);line(fn,a,1,.3);wake(fn,ice,0,2.5);particles(32,661,a,17,22);
 }else if(k==='low_health'||k==='heavy_health_loss'||k==='resource_spent'){
  const heavy=k==='heavy_health_loss',spent=k==='resource_spent';for(let j=0;j<(heavy?6:3);j++){const fn=u=>[7+j*8+Math.sin(u*(spent?8:19)+t*.4+j)*7,183+u*484];line(fn,a,heavy?2:1.3,.48);wake(fn,spent?ice:'#e8a0ac',j*.13,1.7);}
  particles(1901,663,a,heavy?31:14,heavy?22:12);if(heavy)for(let j=0;j<12;j++)w.petal(383+j*92,8+j%3*6,6,a,j*.4,.65);
 }else if(k==='inventory_added'||k==='inventory_removed'||k==='possible_item_upgrade'||k==='possible_purchase'){
  const removal=k==='inventory_removed',upgrade=k==='possible_item_upgrade',x=removal?1911:9,s=removal?-1:1;for(let j=0;j<(upgrade?9:6);j++){const y=204+j*(upgrade?50:79);line(arc(x,y,20+j%3*6,23,0,TAU),a,1.5,.65);w.mote(x+s*10,y,2,gold,.8);}
  for(let j=0;j<23;j++){const x=360+j*54;poly([[x,0],[x+8,0],[x+8,7+j%3*4],[x,7+j%3*4]],removal?a:gold,.7);}particles(removal?28:1889,660,a,19,21);
 }else if(k==='minions_spawning'){
  for(let j=0;j<27;j++){const x=370+j*45+z*17,y=1067;poly([[x,y],[x+6,y-12],[x+12,y]],j%3?a:gold,.8);}for(let j=0;j<8;j++){const y=223+j*51;w.beam([[0,y],[19,y+8],[0,y+16]],a,1.2,.7);}particles(1898,662,a,20,16);
 }else if(k==='objective_steal'){
  // A gold hook sweeps around the rim and pulls a cold orbit apart.
  const fn=u=>[18+Math.sin(u*Math.PI)*37,668-u*483];line(fn,gold,3,.65);wake(fn,ice,0,3);for(let j=0;j<6;j++)line(arc(1940,428,43+j*9+z*8,76+j*25,1.58,4.7),gold,1,.55);particles(1867,657,gold,39,24);
 }else{
  // Context signals each have a specific directional action, never a metal skin.
  const n={possible_consumable_use:0,possible_base_visit:1,possible_combat:2,possible_low_hp_escape:3,possible_teamfight:4,possible_objective_fight:5,possible_power_spike:6,possible_roam:7}[k]??8;
  if(n===0)for(let j=0;j<14;j++)line(arc(24,216+j*32,8+j%3*3,11),a,1.3,.6);
  if(n===1)for(let j=0;j<4;j++)line(arc(960,-21,83+j*95,52+j*9,0,Math.PI),a,1.3,.55);
  if(n===2)for(let j=0;j<9;j++){const y=206+j*48;w.beam([[1920,y],[1881,y+31]],a,1.7,.65);}
  if(n===3)for(let j=0;j<6;j++)wake(u=>[13+j*5+Math.sin(u*8)*10,667-u*481],a,j*.12,1.7);
  if(n===4)for(let j=0;j<5;j++)line(u=>[361+u*1190,20+Math.sin(u*18+j*TAU/5+p)*13],a,1.2,.6);
  if(n===5)for(let j=0;j<7;j++)line(arc(-19,419,36+j*7,70+j*22,-1.5,1.5),a,1.2,.6-j*.04);
  if(n===6)for(let j=0;j<13;j++){const y=207+j*35;w.beam([[1875,y+12],[1891,y],[1907,y+12]],a,1.7,.7);}
  if(n===7){const fn=u=>[352+u*1200,16+Math.sin(u*7)*17];line(fn,a,1,.4);wake(fn,ice,0,2.4);}
  if(n===8){const seed=hash(k);for(let j=0;j<9;j++)line(arc(1924,230+j*48,22+j%3*5,15,(seed%6)*.2,(seed%6)*.2+TAU*.8),a,1.2,.6);}
  particles(n%2?34:1894,661,a,22,20);
 }
 c.restore();
}
function hextechArchitecture(c,e){
 const k=e.key,t=e.elapsed||0,finite=Number.isFinite(e.duration),p=finite?t/e.duration:.42+.24*Math.sin(t*.071),phase=.13+p*.78;
 const a=palette[e.theme]||palette.arcane,m=new FrameMaterial(c),w=new WorldPaint(c),gold='#dbc38d';
 const plate=(points,ink='#202c3b',accent=a,alpha=.85)=>m.panel(points,ink,accent,phase,alpha);
 const glass=(points,color=a)=>m.glass(points,color,phase,.62);
 const band=(points,width=14,ink='#182938',color=a)=>m.band(typeof points==='function'?points:pathOf(points),width,ink,color,p,.88);
 const sidePanel=(x,s,y,h,width,ink,color=a)=>plate([[x,y],[x+s*width,y+19],[x+s*width,y+h-33],[x+s*(width*.4),y+h],[x,y+h]],ink,color);
 c.save();
   // Conductive housings alternate with inset crystalline circuit bridges.
   for(const[x,s]of [[0,1],[1920,-1]]){
    plate([[x,143],[x+s*31,166],[x+s*31,323],[x+s*51,343],[x+s*51,434],[x+s*23,462],[x+s*23,682],[x,706]],'#162d46','#bfa777');
    band([[x+s*12,156],[x+s*12,330],[x+s*35,353],[x+s*35,424],[x+s*12,449],[x+s*12,670]],5,'#155474','#b3f0ff');
    for(let j=0;j<4;j++){const y=204+j*111;glass([[x+s*31,y],[x+s*58,y-16],[x+s*74,y],[x+s*58,y+18],[x+s*31,y+9]],a);}
   }
   plate([[278,0],[727,0],[750,22],[1132,22],[1155,0],[1640,0],[1610,28],[1240,28],[1220,47],[640,47],[620,28],[301,28]],'#162b40',gold);
   band([[312,14],[637,14],[660,34],[1201,34],[1224,14],[1590,14]],5,'#1b5271',a);
   for(let j=0;j<9;j++){const x=411+j*122;plate([[x,1080],[x+17,1045],[x+88,1045],[x+111,1080]],'#1b3046',gold);w.beam([[x+21,1061],[x+83,1061]],a,4,.82);}
 c.restore();
}
