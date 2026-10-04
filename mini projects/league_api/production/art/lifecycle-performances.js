// Match milestones. Pictures retain their existing owner; these decorate their edges.
function lifecyclePerformance(c,e){
 if(!['game_start','minions_spawning','victory','defeat','game_end'].includes(e.key))return false;
 const ink=eventInk(c,e),{w,o,t,p,line,poly,metal,place,arc,wake,shard,ring,motes}=ink,{helmet,book,shield}=eventProps(ink);
 const ice='#c0e3ef',gold='#e8cc92',mint='#aedcbd',violet='#bfaee0';
 c.save();
 if(e.key==='game_start'){
  // Two summoning pillars reveal little allied heralds and a ceremonial entry key.
  for(const [x,sgn]of [[55,1],[1865,-1]])place(x,437,1,0,()=>{
   poly([[-24,-104],[24,-104],[31,88],[-31,88]],metal([-31,-104,31,88],['#d4d9c4','#5d7c98','#a8b9c8','#3c5f7c']),.84);line([[sgn*18,-97],[sgn*18,77]],gold,1.4,.8);for(let j=0;j<7;j++){shard(0,-75+j*24,8,j%2?ice:violet,.1);line([[-17,-66+j*24],[17,-66+j*24]],ice,.8,.45);}ring(0,96,42,11,gold,1.3,.72);
  });
  for(let j=0;j<5;j++){const x=494+j*237;helmet(x,55,.44,-.1+j*.04,ice,j*.023);}
  for(let j=0;j<4;j++)wake(u=>[315+u*1290,1063-j*8-Math.sin(u*Math.PI)*13],j%2?gold:violet,j*.13,1.8,.25);
  motes(30,4,.085,(u,j,r,a)=>w.star(j%2?1880:37,975-u*754,2+r*3,ice,a*.65));
 }else if(e.key==='minions_spawning'){
  // Little armored and caster minions take an uneven march along the lower lane.
  for(let j=0;j<13;j++){const x=335+j*99+smooth(p)*34,y=1049+Math.sin(t*3+j*.8)*3;
   place(x,y,.41,Math.sin(t*3+j)*.05,()=>{
    if(j%3===0){poly([[-15,10],[-20,-8],[0,-38],[20,-8],[15,10]],violet,.4);o.orb(0,-12,7,ice,t*.5);line([[17,-17],[17,29]],gold,2,.8);shard(17,-22,7,violet,.1);}else{helmet(0,-12,.7,.02,j%2?gold:ice);poly([[-13,0],[13,0],[18,18],[-18,18]],metal([-18,0,18,18],['#bacfcd','#526b89','#a8b8cb']),.81);shield(-18,6,.38,-.1,ice);}
    const gait=Math.sin(t*5+j*.8)*6;line([[-7,18],[-10-gait,29]],ice,3,.8);line([[7,18],[10+gait,29]],ice,3,.8);
   },j*.013);
  }
  for(let j=0;j<7;j++){const y=235+j*71;place(40,y,.74,Math.sin(t*.6+j)*.055,()=>{line([[-17,-24],[-17,27]],gold,1.1,.71);poly([[-17,-24],[20,-19+Math.sin(t+j)*2],[13,11],[-17,5]],j%2?ice:violet,.22);line([[-17,-24],[20,-19+Math.sin(t+j)*2]],ice,1,.6);},j*.021);}
  for(let j=0;j<8;j++){const y=239+j*62;shard(1878,y,8+j%3*2,ice,j*.3);}
  wake(u=>[320+u*1270,43+Math.sin(u*11-t*.4)*8],violet,0,1.6,.23);
 }else if(e.key==='victory'){
  // A gold cup, moving laurel branches, foil ribbons and champion's pennants.
  place(75,411,1.03,-.06,()=>{
   poly([[-30,-61],[30,-61],[26,-11],[10,10],[-10,10],[-26,-11]],metal([-30,-61,30,10],['#fae5b4','#988d72','#dbc69b','#5f7485']),.94);for(const side of [-1,1]){const path=arc(side*28,-38,16,21,-1.57,1.57);o.ribbon(path,{width:6,color:gold,secondary:ice,phase:t*.25,alpha:.8});}line([[0,10],[0,47]],gold,7,.87);poly([[-27,47],[27,47],[32,59],[-32,59]],metal([-32,47,32,59],['#dbcda4','#788c9a','#edddb4']),.9);shard(0,-31,13,ice,.1);line([[-22,-52],[22,-52]],ice,1.2,.78);
  });
  for(const side of [0,1]){const x=side?1894:19,sgn=side?-1:1,path=u=>[x+sgn*Math.sin(u*5-t*.06)*18,873-u*652];wake(path,gold,side*.18,1.6,.26);for(let j=0;j<15;j++){const [xx,y]=path(j/15);w.petal(xx+sgn*12,y,15, j%3?gold:mint,sgn*(-.65)+Math.sin(t*.4+j)*.055,.69);}}
  for(let j=0;j<11;j++){const x=371+j*115;place(x,48,1,Math.sin(t*.6+j)*.04,()=>{line([[-15,-24],[-15,23]],gold,.9,.67);poly([[-15,-21],[19,-21+Math.sin(t+j)*3],[13,16],[0,10],[-15,16]],gold,.25);shard(0,-4,6,ice,0);},j*.014);}
  for(let j=0;j<3;j++)o.ribbon(u=>[310+u*1290,1061-j*8+Math.sin(u*12-t*.5+j)*6],{width:5,color:gold,secondary:ice,phase:t*.3+j,glass:true,alpha:.49});
  motes(32,4.3,.075,(u,j,r,a)=>w.petal(j%2?1866:51,204+u*633,4+r*7,gold,j*.5+u,a*.7));
 }else if(e.key==='defeat'){
  // A torn silver standard, dimming lamps and a few persistent blue fireflies.
  place(1857,412,1.05,.07,()=>{
   line([[-18,-92],[-18,94]],gold,2,.72);poly([[-18,-84],[32,-78+Math.sin(t*.6)*3],[26,-12],[9,-19],[16,-4],[-3,-10],[-18,3]],metal([-18,-84,32,3],['#b9c5d9','#758499','#b1c0c9','#3b5771']),.62);line([[-18,-84],[32,-78+Math.sin(t*.6)*3]],ice,1,.65);shard(-18,-98,8,ice,.03);ring(-18,99,22,6,ice,1,.4);
  });
  for(let j=0;j<7;j++){const y=240+j*67;place(43,y,.68,Math.sin(t*.5+j)*.04,()=>{poly([[-17,-21],[17,-21],[13,21],[-13,21]],ice,.13);line([[-17,-21],[-13,21],[13,21],[17,-21]],ice,1,.62);w.mist(0,0,15,21,ice,.22*(1-p)+.05);ring(0,-28,6,7,gold,.9,.58);},j*.018);}
  for(let j=0;j<3;j++)wake(u=>[1560-u*1230,1062-j*9+Math.sin(u*8+j)*5],ice,j*.2,1.2,.27);
  for(let j=0;j<13;j++){const x=360+j*91;w.petal(x,41+Math.sin(t*.3+j)*5,7,ice,-.4+j*.07,.47);}
  motes(22,4.3,.115,(u,j,r,a)=>w.star(j%2?1879+Math.sin(j+u*7)*18:43+Math.sin(j+u*5)*20,900-u*652,1+r*2,ice,a*.54));
 }else{
  // The final folio closes; tiny paper stars leave through a hanging keyhole.
  const q=smooth((p-.05)/.74);book(77,439,1-q*.35,-.06,violet);
  place(1857,437,1,0,()=>{ring(0,-22,29,38,gold,1.7,.72);poly([[-10,4],[10,4],[14,52],[-14,52]],ice,.2);o.orb(0,-22,12,violet,t*.3,{glass:true});line([[-14,52],[14,52]],gold,1.1,.64);});
  for(let j=0;j<12;j++){const x=371+j*96;place(x,50,1,Math.sin(t*.5+j)*.07,()=>{poly([[-11,-12],[11,-12],[11,12],[-11,12]],ice,.13);line([[-8,-6],[7,-6]],gold,.8,.55);line([[-8,0],[5,0]],violet,.8,.5);},j*.018);}
  for(let j=0;j<3;j++)wake(u=>[330+u*1250,1061-j*9+Math.sin(u*9+j)*7],j%2?ice:violet,j*.16,1.5,.24);
  motes(25,4,.095,(u,j,r,a)=>w.star(1869+Math.sin(j+u*4)*24,933-u*710,2+r*2,gold,a*.6));
 }
 c.restore();return true;
}
