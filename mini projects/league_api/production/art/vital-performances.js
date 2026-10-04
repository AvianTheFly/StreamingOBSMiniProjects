// Health and revival: protective, restorative or fractured props with quiet edges.
function vitalPerformance(c,e){
 const custom=e.key?.startsWith('custom_');
 if(!['respawn','low_health','heavy_health_loss','large_heal'].includes(e.key)&&!custom)return false;
 const ink=eventInk(c,e),{w,o,t,p,line,poly,metal,place,arc,wake,shard,ring,motes}=ink,{heart,shield,vial}=eventProps(ink);
 const ice='#c0e5ef',mint='#a7dfbd',rose='#e3a3b9',gold='#e1ca98';
 c.save();
 if(e.key==='respawn'){
  // A small gate opens and an armored spirit steps through, trailing fresh leaves.
  const q=smooth((p-.04)/.68);
  place(76,439,1.1,0,()=>{
   for(const side of [-1,1]){poly([[side*25,-70],[side*43,-54],[side*43,66],[side*27,66]],metal([side*25,-70,side*43,66],['#cad9d3','#547b93','#adbabf','#3a607c']),.91);line([[side*29,-66],[side*29,61]],gold,1.3,.8);}
   poly([[-25,-70],[0,-99],[25,-70],[16,-64],[0,-80],[-16,-64]],metal([-25,-99,25,-64],['#d4dabc','#6c889b','#bccbcb']),.9);
   for(const side of [-1,1]){const x=side*(1+q*19);poly([[x,-64],[x+side*19,-61],[x+side*19,56],[x,59]],mint,.17);line([[x,-64],[x,59]],ice,1.2,.72);}
   o.orb(0,-23,12,ice,t*.4,{glass:true});poly([[-9,-4],[9,-4],[17,23],[8,37],[-8,37],[-17,23]],mint,.3);line([[-8,36],[-10,56],[0,61]],gold,1.2,.75);line([[8,36],[11,56],[19,57]],gold,1.2,.75);
   ring(0,71,50,11,mint,1.6,.75);
  });
  for(let j=0;j<9;j++){const y=230+j*54;place(1870,y,1,Math.sin(t*.4+j)*.06,()=>{for(let n=0;n<3;n++)w.petal(Math.cos(n*TAU/3)*8,Math.sin(n*TAU/3)*8,12,mint,n*TAU/3,.75);shard(0,0,5,gold,0);},j*.021);}
  for(let j=0;j<4;j++)wake(u=>[330+u*1260,1058-j*8-Math.sin(u*Math.PI)*13],j%2?mint:ice,j*.12,1.8,.27);
  motes(32,4,.09,(u,j,r,a)=>w.petal(j%2?1866:38,985-u*781,5+r*7,mint,j*.5+u,a*.64));
 }else if(e.key==='low_health'){
  // A glass heart hangs inside a protective cage; one gentle pulse traces its cable.
  heart(1859,442,.84,Math.sin(t*.6)*.025,rose);for(let j=0;j<3;j++)wake(arc(1859,435,36+j*8,62+j*13,.5,5.6),j%2?ice:rose,j*.17,1.4,.19);
  line([[1840,360],[1859,343],[1879,360]],gold,1.2,.68);line([[1859,343],[1859,212]],ice,.85,.5);
  const pulse=pathOf([[30,925],[30,623],[45,612],[23,595],[62,575],[30,552],[30,188]]);wake(pulse,rose,0,1.8,.24);
  for(let j=0;j<7;j++){const y=257+j*61;shield(41,y,.22,Math.sin(t*.5+j)*.07,j%2?ice:rose,j*.02);}
  for(let j=0;j<15;j++){const x=343+j*87;line([[x,1060],[x+17,1060],[x+25,1052],[x+31,1065],[x+40,1060]],rose,1,.48);}
  motes(20,3.8,.12,(u,j,r,a)=>w.mote(1863+Math.sin(j)*21,885-u*635,1+r*2,rose,a*.6));
 }else if(e.key==='heavy_health_loss'){
  // A transparent shield breaks into tempered panes that soften and settle.
  const q=smooth((p-.04)/.68);
  place(70,445,1.1,0,()=>{
   const parts=[[[-28,-35],[-4,-45],[-4,-4],[-23,8]],[[-1,-45],[28,-33],[24,9],[3,-4]],[[-23,11],[-5,-1],[0,35],[-16,20]],[[4,-1],[24,12],[14,23],[2,35]]];
   parts.forEach((pts,j)=>{c.save();c.translate(Math.cos(j*2.3)*q*13,Math.sin(j*2.1)*q*14);o.sheet(pts,j%2?ice:rose,p,{glass:true,alpha:.82});c.restore();});
   line([[-31,-36],[-4,-49],[30,-34]],gold,1.4,.72);for(let j=0;j<4;j++)shard(-24+j*17,68+q*12,8,ice,j*.45+q*.3);
  });
  for(let j=0;j<4;j++)wake(pathOf([[1882-j*9,225],[1875-j*9,355],[1890-j*9,391],[1849-j*9,431],[1880-j*9,476],[1871-j*9,713]]),j%2?rose:ice,j*.11,1.6,.19);
  for(let j=0;j<13;j++){const x=350+j*93;shard(x,44+Math.sin(t*.4+j)*4,7+j%3*2,j%2?ice:rose,j*.4);}
  motes(28,4,.085,(u,j,r,a)=>shard(1871+Math.sin(j+u*3)*27,279+u*413,3+r*5,rose,j*.4+u));
 }else if(e.key==='large_heal'){
  // Restorative garden: a vial pours into a sprouting glass heart and fresh leaves.
  vial(1849,352,.91,-.42-smooth(p)*.25,mint);heart(1849,484,.95,.06,mint,.03);
  wake(u=>[1856+Math.sin(u*9-t)*6,373+u*80],mint,0,1.9,.3);
  for(const side of [-1,1]){const path=u=>[1849+side*(22+Math.sin(u*Math.PI)*18),508-u*110];wake(path,gold,side>0?.15:0,1.5,.22);for(let j=0;j<6;j++){const [x,y]=path(j/6);w.petal(x+side*10,y,14,mint,side*.7+Math.sin(t*.5+j)*.05,.65);}}
  for(let j=0;j<8;j++){const y=241+j*67;place(45,y,.7,Math.sin(t*.5+j)*.07,()=>{for(let n=0;n<5;n++)w.petal(Math.cos(n*TAU/5)*9,Math.sin(n*TAU/5)*9,12,n%2?mint:ice,n*TAU/5,.66);o.orb(0,0,4,gold,t*.3);},j*.02);}
  for(let j=0;j<3;j++)wake(u=>[320+u*1270,1057-j*9+Math.sin(u*12-t*.4+j)*7],j%2?mint:ice,j*.15,1.8,.23);
  motes(30,4,.09,(u,j,r,a)=>w.petal(j%2?1867:39,954-u*739,5+r*7,mint,j*.3+u,a*.68));
 }else{
  // The saved disabled health-threshold example has a calibrated warning instrument.
  // Unknown future custom rules keep a neutral instrument without claiming a cause.
  const health=String(e.title||'').toLowerCase().includes('health');
  place(1848,428,1,0,()=>{ring(0,0,39,67,health?rose:ice,1.7,.72);for(let j=0;j<12;j++){const a=-1.3+j*.23;line([[Math.cos(a)*39,Math.sin(a)*64],[Math.cos(a)*45,Math.sin(a)*73]],gold,j%3===0?2:1,.7);}line([[0,0],[Math.cos(-.8+p*.35)*29,Math.sin(-.8+p*.35)*48]],ice,2,.9);o.orb(0,0,6,gold,t*.4);if(health)heart(0,23,.31,.05,rose);else shard(0,23,14,ice,.05);});
  for(let j=0;j<9;j++){const y=233+j*57;ring(39,y,9,14,health?rose:ice,1,.61);shard(39,y,5,gold,0);}
  for(let j=0;j<3;j++)wake(u=>[330+u*1250,36+j*12+Math.sin(u*10+j)*6],health?rose:ice,j*.14,1.6,.21);
 }
 c.restore();return true;
}
