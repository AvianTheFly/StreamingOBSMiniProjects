// Optional inferred signals remain tentative. Artwork never upgrades their confidence.
function inferencePerformance(c,e){
 if(!e.key?.startsWith('possible_'))return false;
 const ink=eventInk(c,e),{w,o,t,p,line,poly,metal,place,arc,wake,shard,ring,motes}=ink,{coin,vial,blade,heart,shield,book}=eventProps(ink);
 const ice='#b2dfea',gold='#dfc68e',mint='#a5d5b9',violet='#c2abe1';
 c.save();c.globalAlpha*=.86;
 switch(e.key){
 case 'possible_purchase':{
  // A merchant purse with a few tentative coins, no receipt or purchase claim.
  place(1847,445,1,0,()=>{poly([[-24,-31],[-14,-48],[14,-48],[24,-31],[34,23],[17,45],[-17,45],[-34,23]],metal([-34,-48,34,45],['#c9c2a6','#5f8096','#a4a1b3','#405e7b']),.88);line([[-23,-28],[23,-28]],gold,2,.7);line([[-5,-28],[-11,-52]],ice,1,.6);line([[5,-28],[13,-53]],ice,1,.6);coin(0,6,.57,.05);});
  for(let j=0;j<9;j++)coin(42,242+j*64,.42,Math.sin(t*.5+j)*.13,j*.022);
  for(let j=0;j<12;j++){const x=370+j*94;ring(x,1059,7,8,gold,1,.53);}
  for(let j=0;j<2;j++)wake(u=>[330+u*1250,39+j*15+Math.sin(u*11+j)*7],j?ice:gold,j*.2,1.6,.22);break;
 }
 case 'possible_item_upgrade':{
  // A jeweller's small hammer checks a faceted stone on a floating forge.
  place(73,448,1,0,()=>{poly([[-38,34],[38,34],[27,56],[-27,56]],metal([-38,34,38,56],['#c9c9b5','#627f93','#acbac6']),.84);shard(0,8,27,violet,.02);const a=-.45+Math.sin(t*1.2)*.14;c.save();c.translate(12,-52);c.rotate(a);line([[0,-20],[0,43]],gold,4,.8);poly([[-23,-32],[23,-32],[23,-12],[-23,-12]],metal([-23,-32,23,-12],['#d8d8c5','#5c7d96','#bcc6ce']),.88);c.restore();});
  for(let j=0;j<9;j++){const y=239+j*63;shard(1873,y,9+j%3*2,violet,j*.4);ring(1873,y,16,7,ice,1,.49);}
  for(let j=0;j<3;j++)wake(u=>[330+u*1250,1059-j*8+Math.sin(u*10+j)*6],j%2?gold:violet,j*.16,1.5,.21);break;
 }
 case 'possible_consumable_use':{
  // Cork, vial and botanical vapor make a small apothecary moment.
  vial(1852,438,1.04,-.12,mint);place(1837,370-smooth(p)*22,.9,-.2-p*.2,()=>{poly([[-10,-7],[10,-7],[9,8],[-9,8]],gold,.78);line([[-8,-2],[8,-2]],ice,.8,.53);});
  for(let j=0;j<3;j++)wake(u=>[1856+Math.sin(u*9-t*.5+j)*12,417-u*172],j%2?ice:mint,j*.16,1.4,.21);
  for(let j=0;j<8;j++){const y=235+j*71;w.petal(42,y,13,mint,-.6+Math.sin(t*.5+j)*.08,.61);shard(42,y,4,gold,.1);}
  for(let j=0;j<13;j++){const x=350+j*92;ring(x,1059,6,7,mint,1,.53);}break;
 }
 case 'possible_base_visit':{
  // A little home gate, hanging key and replenishment lanterns suggest a return.
  place(75,444,1,0,()=>{poly([[-33,49],[-33,-51],[0,-78],[33,-51],[33,49]],metal([-33,-78,33,49],['#c7d5c8','#5e7d92','#a7b4c7']),.8);poly([[-19,45],[-19,-30],[0,-47],[19,-30],[19,45]],ice,.18);line([[-19,-30],[0,-47],[19,-30]],gold,1.2,.65);ring(8,6,4,4,gold,1.3,.7);});
  for(let j=0;j<7;j++){const y=249+j*67;place(1870,y,.7,Math.sin(t*.5+j)*.08,()=>{ring(0,-10,10,11,gold,1.3,.7);line([[0,0],[0,22],[9,22],[9,16]],ice,2,.7);},j*.022);}
  for(let j=0;j<3;j++)wake(u=>[1570-u*1240,1059-j*8-Math.sin(u*Math.PI)*18],j%2?gold:ice,j*.16,1.5,.23);break;
 }
 case 'possible_combat':{
  // One partially drawn blade beside a scabbard and a few restrained clash rings.
  const q=smooth(p);blade(1849,414-q*15,.85,.25,ice);place(1866,475,1,.25,()=>{poly([[-9,-31],[9,-31],[9,43],[0,59],[-9,43]],metal([-9,-31,9,59],['#8092aa','#344f71','#a0aec0']),.74);line([[-11,-32],[11,-32]],gold,2,.7);});
  for(let j=0;j<7;j++){const y=242+j*70;ring(42,y,13,17,violet,1,.55);wake(arc(42,y,13,17),ice,j*.07,1.4,.19);}
  for(let j=0;j<2;j++)wake(u=>[330+u*1250,40+j*15+Math.sin(u*9+j)*7],j?gold:ice,j*.2,1.5,.2);break;
 }
 case 'possible_low_hp_escape':{
  // A paper bird carries a small heart toward the outside of the right edge.
  const q=smooth((p-.03)/.76),x=1842+q*47,y=472-q*164;
  place(x,y,.83,-.27,()=>{const flap=Math.sin(t*3)*6;poly([[-32,3],[0,-17],[38,-8],[12,12],[-3,7],[-18,32]],metal([-32,-17,38,32],['#d3e5e0','#778caa','#c2cad7']),.8);poly([[-4,-11],[-29,-34-flap],[-8,12]],ice,.48);poly([[7,-7],[32,-31+flap],[15,11]],violet,.4);line([[-3,7],[-13,29]],gold,.9,.7);heart(-13,36,.2,.08,'#dda4ba');});
  for(let j=0;j<8;j++){const y=240+j*70;poly([[35,y-8],[47,y],[35,y+8],[42,y]],ice,.45);}
  for(let j=0;j<3;j++)wake(u=>[1863-j*10+Math.sin(u*6+j)*7,844-u*591],j%2?gold:ice,j*.15,1.5,.19);wake(u=>[330+u*1250,1059+Math.sin(u*9)*6],violet,0,1.4,.2);break;
 }
 case 'possible_teamfight':{
  // Allied shield pennants gather around a glass rendezvous knot.
  for(let j=0;j<4;j++){const y=281+j*102;shield(46,y,.52,Math.sin(t*.5+j)*.07,j%2?mint:ice,j*.023);shield(1873,y+31,.43,-.1,j%2?violet:gold,j*.027);}
  for(let j=0;j<3;j++)wake(u=>[325+u*1270,1057+Math.sin(u*12+j*TAU/3)*11],j===1?gold:ice,j*.15,1.5,.22);
  for(let j=0;j<11;j++){const x=370+j*112;place(x,47,1,0,()=>{ring(0,0,12,8,mint,1,.53);ring(7,0,12,8,violet,1,.53);},j*.019);}break;
 }
 case 'possible_objective_fight':{
  // Two opposing pit gates face a small suspended objective crystal.
  for(const[x,sgn]of [[40,1],[1880,-1]])place(x,440,1,0,()=>{for(let j=0;j<5;j++){const y=-94+j*43;poly([[0,y],[sgn*27,y-10],[sgn*35,y+19],[0,y+31]],metal([0,y,sgn*35,y+31],['#bdb0cf','#4c647e','#9884af']),.76);line([[sgn*5,y+4],[sgn*23,y-3]],ice,.9,.6);}shard(sgn*39,0,24,violet,.05);});
  for(let j=0;j<11;j++){const x=350+j*117;shard(x,50,8,j%2?gold:ice,.15);}
  for(let j=0;j<3;j++)wake(u=>[320+u*1280,1059-j*8+Math.sin(u*12+j)*8],j%2?gold:violet,j*.15,1.6,.21);break;
 }
 case 'possible_power_spike':{
  // A charged prism and ascending instrument needles hint at a new power window.
  place(1848,438,1,0,()=>{shard(0,0,49,violet,.04);for(let j=0;j<3;j++)wake(arc(0,0,35+j*11,64+j*15),j%2?gold:ice,j*.15,1.6,.19);line([[-29,76],[29,76]],gold,2,.72);});
  for(let j=0;j<8;j++){const y=244+j*65;place(43,y,.74,0,()=>{ring(0,0,16,23,ice,1,.6);line([[0,0],[10*Math.sin(p+1),-18*Math.cos(p+1)]],gold,1.5,.8);shard(0,0,4,violet,.1);},j*.023);}
  for(let j=0;j<3;j++)wake(u=>[330+u*1250,38+j*13+Math.sin(u*Math.PI)*18],j%2?violet:gold,j*.15,1.6,.24);break;
 }
 case 'possible_roam':{
  // A compass on a folded map and travelling footprint lights along an unequal route.
  place(77,437,1,0,()=>{poly([[-44,-30],[-15,-40],[15,-29],[44,-39],[44,32],[15,42],[-15,31],[-44,41]],metal([-44,-40,44,42],['#d8d4b5','#8b9aa5','#d0c9b5','#627c95']),.73);line([[-15,-40],[-15,31]],gold,.9,.6);line([[15,-29],[15,42]],gold,.9,.6);ring(0,0,27,31,ice,1.5,.75);const a=-.3+t*.18;line([[Math.sin(a)*16,-Math.cos(a)*23],[-Math.sin(a)*16,Math.cos(a)*23]],violet,3,.75);shard(0,0,5,gold,0);});
  for(let j=0;j<9;j++){const y=240+j*63;place(1871+Math.sin(j)*12,y,.7,(j%2?1:-1)*.15,()=>{ring(0,-3,5,9,ice,1,.58);ring(0,12,5,4,gold,1,.58);},j*.022);}
  wake(pathOf([[335,1064],[625,1064],[655,1044],[1160,1044],[1190,1064],[1590,1064]]),ice,0,1.7,.24);for(let j=0;j<12;j++){const x=375+j*93;w.star(x,44+Math.sin(j*.6)*9,3,gold,.5);}break;
 }
 case 'possible_jungle_activity':{
  // A lantern among mushrooms, leaves and individually born forest fireflies.
  place(1853,430,1,Math.sin(t*.5)*.045,()=>{line([[0,-100],[0,-58]],gold,.9,.6);ring(0,-53,9,9,gold,1.2,.7);poly([[-24,-32],[24,-32],[19,33],[-19,33]],ice,.18);line([[-24,-32],[-19,33],[19,33],[24,-32]],gold,1.2,.67);w.mist(0,4,24,38,mint,.5);shard(0,5,12,mint,.05);});
  for(let j=0;j<7;j++){const y=250+j*68;place(46,y,.78,Math.sin(t*.4+j)*.045,()=>{line([[0,-3],[0,27]],gold,4,.72);poly([[-22,-4],[-13,-21],[3,-27],[21,-14],[24,-4]],metal([-22,-27,24,-4],['#c8d7ba','#668b8a','#b6c79e']),.77);ring(-7,-13,3,2,ice,1,.55);ring(9,-12,4,2,ice,1,.55);},j*.02);}
  for(let j=0;j<16;j++){const x=350+j*80;w.petal(x,1059+Math.sin(t*.4+j)*5,10,mint,-.4+j*.05,.6);}
  motes(26,4,.09,(u,j,r,a)=>w.star(j%2?1868+Math.sin(j+u*6)*24:43+Math.sin(j+u*4)*26,939-u*716,1+r*2,mint,a*.7));break;
 }
 default:c.restore();return false;
 }
 c.restore();return true;
}
