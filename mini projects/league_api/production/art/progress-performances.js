// Spell progression and resource use: books, instruments and small magical machines.
function progressPerformance(c,e){
 if(!['resource_spent','level_up','ultimate_learned','ability_rank_up'].includes(e.key))return false;
 const ink=eventInk(c,e),{w,o,t,p,line,poly,metal,place,arc,wake,shard,ring,motes}=ink,{book,vial}=eventProps(ink);
 const ice='#bae6ef',violet='#c4b1e9',gold='#e4cc97';
 c.save();
 if(e.key==='resource_spent'){
  // A translucent mana reservoir drains into three travelling droplets.
  place(1848,437,1,0,()=>{
   poly([[-27,-75],[27,-75],[31,64],[19,76],[-19,76],[-31,64]],'#afd4eb1e',.85);line([[-27,-75],[-31,64],[-19,76],[19,76],[31,64],[27,-75]],ice,1.4,.72);line([[-30,-77],[30,-77]],gold,4,.8);line([[-20,-67],[-20,54]],ice,1,.55);
   const level=-45+smooth(p)*83;poly([[-25,level],[25,level],[28,61],[16,69],[-16,69],[-28,61]],violet,.33);line([[-24,level],[24,level]],ice,1.1,.8);for(let j=0;j<8;j++)line([[15,-55+j*15],[28,-55+j*15]],gold,1,.6);ring(0,81,38,11,ice,1,.6);
  });
  for(let j=0;j<3;j++){const q=smooth((p-j*.09)/.71),y=409+q*203;shard(1882,y,10,violet,-.3);wake(u=>[1882+Math.sin(u*6+j)*7,407+u*214],ice,j*.13,1.6,.2);}
  for(let j=0;j<8;j++){const y=243+j*61;vial(43,y,.32,Math.sin(t*.6+j)*.09,j%2?violet:ice,j*.022);}
  for(let j=0;j<3;j++)wake(u=>[1570-u*1240,1061-j*8+Math.sin(u*11+j)*6],violet,j*.15,1.5,.2);
 }else if(e.key==='level_up'){
  // A tiny rune staircase unfolds while a book turns its illuminated pages.
  book(1845,421,1.02,.1,violet);
  for(let j=0;j<8;j++){const y=654-j*54,x=21+j%3*12,q=smooth((p-j*.035)/.27);place(x,y,1,0,()=>{poly([[0,10],[43,10],[43,-3],[0,-3]],metal([0,-3,43,10],['#ceccad','#607b91','#bdb5d2']),.77);line([[0,-3],[43,-3]],j%2?gold:ice,1.4,.85);shard(24,-12,7,violet,0);},j*.035);wake(u=>[x+24,y+6-u*33],gold,j*.06,1.6,.33);}
  for(let j=0;j<12;j++){const x=370+j*96;place(x,48,1,0,()=>{poly([[-11,10],[0,-8],[11,10]],ice,.2);line([[-11,10],[0,-8],[11,10]],gold,1.1,.6);},j*.019);}
  motes(28,3.8,.085,(u,j,r,a)=>w.star(1868+Math.sin(j)*27,988-u*750,2+r*3,gold,a*.63));
 }else if(e.key==='ultimate_learned'){
  // Four floating spell panels rotate open around an arcane observatory.
  place(75,438,1,0,()=>{
   for(let j=0;j<4;j++){const a=j*TAU/4+t*.2,x=Math.cos(a)*34,y=Math.sin(a)*78;c.save();c.translate(x,y);c.rotate(a*.12);o.sheet([[-17,-25],[17,-25],[17,25],[-17,25]],j%2?violet:ice,p,{glass:true,alpha:.8});shard(0,0,10,j%2?gold:ice,0);c.restore();}
   o.orb(0,0,21,violet,t*.4,{glass:true});for(let j=0;j<3;j++)wake(arc(0,0,31+j*12,59+j*20),j%2?gold:ice,j*.15,1.8,.2);line([[0,-129],[0,-104]],gold,1.3,.7);ring(0,-139,8,8,ice,1,.6);
  });
  book(1848,433,.96,-.08,violet,.04);
  for(let j=0;j<9;j++){const y=221+j*61;shard(1872,y,9+j%3*2,violet,j*.2);line([[1860,y],[1884,y]],gold,.8,.45);}
  for(let j=0;j<4;j++)wake(u=>[330+u*1250,35+j*11+Math.sin(u*Math.PI)*18],j%2?gold:violet,j*.11,1.8,.25);
  for(let j=0;j<16;j++){const x=350+j*79;ring(x,1060,9,9,ice,1,.53);if(j%3===0)shard(x,1060,5,gold,0);}
 }else{
  // One ability rune clicks into a machined notch; little spell seals witness it.
  place(1849,433,1,0,()=>{
   ring(0,0,40,54,ice,1.7,.75);for(let j=0;j<8;j++){const a=j*TAU/8;poly([[Math.cos(a)*36,Math.sin(a)*49],[Math.cos(a)*47,Math.sin(a)*62],[Math.cos(a+.13)*46,Math.sin(a+.13)*61]],gold,.7);}shard(0,-28+smooth(p)*28,25,violet,.04,false);line([[-14,38],[14,38]],gold,2,.8);ring(0,0,22,31,violet,1,.5);
  });
  for(let j=0;j<7;j++){const y=243+j*66;place(42,y,1,Math.sin(t*.4+j)*.04,()=>{poly([[-12,-10],[0,-18],[12,-10],[12,10],[0,18],[-12,10]],ice,.13);line([[-12,-10],[0,-18],[12,-10]],gold,1,.7);shard(0,0,7,violet,.1);},j*.019);}
  for(let j=0;j<3;j++)wake(u=>[320+u*1260,1059-j*8+Math.sin(u*8+j)*5],j%2?ice:gold,j*.16,1.6,.2);
 }
 c.restore();return true;
}
