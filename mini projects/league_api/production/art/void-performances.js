// Void objectives and theft: creature acting, not recolored trophy frames.
function voidPerformance(c,e){
 if(!['baron','herald','void_grub','objective_steal','atakhan_legacy','dragon'].includes(e.key))return false;
 const {w,o,t,p,line,poly,metal,place,arc,wake,shard,ring,motes}=eventInk(c,e);
 const violet='#c4a4ef',pink='#e79cc8',ice='#bedcf3',gold='#e6c787';
 c.save();
 if(e.key==='baron'){
  // An iridescent serpentine head, fanged jaw, three eyes and living side tendrils.
  place(85,446,1.03,-.09+Math.sin(t*.6)*.025,()=>{
   o.ribbon(u=>[-30+Math.sin(u*8+t*.36)*30,205-u*215],{width:50,color:violet,secondary:pink,phase:t*.3,alpha:.86});
   poly([[-57,-29],[-52,-80],[-23,-113],[-20,-151],[-7,-108],[9,-132],[18,-98],[47,-73],[41,-46],[20,-18],[-7,-10]],metal([-57,-151,47,-10],['#bcaddf','#504971','#9b79b1','#302f51']),.95);
   for(const [x,y,r]of [[-28,-71,8],[0,-77,10],[26,-62,7]]){o.orb(x,y,r,pink,t*.7,{glass:true});line([[x-4,y],[x+4,y]],ice,1.5);}
   const jaw=7+Math.sin(t*1.1)*4;poly([[-35,-26],[-15,-11],[18,-21],[35,-38],[28,-10-jaw],[-13,8+jaw],[-35,-6]],'#292942',.94);line([[-35,-26],[-15,-11],[18,-21],[35,-38]],violet,1.4);for(let j=0;j<6;j++){const x=-27+j*10,y=-23+Math.sin(j*.5)*9;poly([[x,y],[x+5,y+10],[x+8,y-1]],metal([x,y,x+8,y+11],['#e9ddcd','#798397','#c9d1d9']),.94);}
   for(let j=0;j<8;j++)shard(-21+Math.sin(j*.7+t*.3)*22,30+j*20,13,ice,-.25+j*.045);line([[-52,-80],[-23,-113],[-7,-108]],gold,1,.7);
  });
  for(let j=0;j<6;j++){const side=j%2,x=side?1891:20,sgn=side?-1:1;const tendril=u=>[x+sgn*(Math.sin(u*11+t*.4+j)*25+u*16),925-u*(580+j*20)];o.ribbon(tendril,{width:10+j%3*3,color:violet,secondary:pink,phase:t*.3+j,glass:true,alpha:.59});wake(tendril,j%2?pink:ice,j*.075,1.7,.21);}
  for(let j=0;j<13;j++){const x=358+j*92;place(x,48,1,0,()=>{poly([[-23,-8],[0,-22],[23,-8],[17,6],[0,16],[-17,6]],'#64568955',.8);o.orb(0,-1,8,pink,t*.4+j,{glass:true,flat:.67});line([[-23,-8],[0,-22],[23,-8]],violet,1,.6);},j*.014);}
  for(let j=0;j<4;j++)wake(u=>[340+u*1220,1059-j*6+Math.sin(u*10+t*.5+j)*9],j%2?pink:violet,j*.15,2,.19);
  motes(40,5,.08,(u,j,r,a)=>w.mist(j%2?1863+Math.sin(j)*29:56+Math.sin(j)*25,998-u*814,4+r*6,7+r*13,violet,a*.45));
 }else if(e.key==='herald'){
  // Shelly's eye turns and blinks above her segmented shell and little feet.
  place(1835,441,1.04,Math.sin(t*.65)*.035,()=>{
   poly([[-44,40],[-59,-12],[-41,-65],[-15,-88],[19,-83],[51,-47],[57,2],[38,47]],metal([-59,-88,57,47],['#bca4d4','#485d78','#8e83bb','#2d445e']));
   for(let j=0;j<5;j++){const y=-48+j*19;line([[-40,y],[-12,y+9],[28,y-2],[47,y-16]],violet,1.1,.71);}
   const blink=.28+.72*Math.abs(Math.cos(t*1.2));poly([[-37,-13],[0,-13-29*blink],[37,-13],[0,-13+29*blink]],'#332d59',.94);ring(0,-13,19,19*blink,pink,2,.85);o.orb(Math.sin(t*.9)*4,-13,10,pink,t*.5,{glass:true,flat:blink});line([[-9,-13],[-2,-20],[5,-14]],ice,1.5,.8);
   for(const side of [-1,1])for(let j=0;j<3;j++){const y=10+j*17;line([[side*41,y],[side*(64+Math.sin(t*3+j)*4),y+8],[side*57,y+16]],ice,3,.75);}shard(0,-74,13,gold,0);
  });
  for(let j=0;j<4;j++){const path=arc(1835,428,56+j*13,107+j*24,.7,5.5);wake(path,j%2?pink:ice,j*.12,1.7,.17);}
  for(let j=0;j<8;j++){const y=238+j*60;place(51,y,.65,Math.sin(t*.6+j)*.08,()=>{poly([[-20,0],[0,-15],[20,0],[0,15]],violet,.3);ring(0,0,8,9,ice,1,.65);shard(0,0,7,pink,.1);},j*.016);}
  for(let j=0;j<11;j++){const x=350+j*115;poly([[x,1077],[x+14,1053],[x+28,1077]],metal([x,1053,x+28,1077],['#aab2d4','#4e657d','#9186b6']),.67);wake(u=>[x+14,1077-u*24],pink,j*.033,1.6,.5);}
  wake(u=>[300+u*1300,42+Math.sin(u*Math.PI)*34],violet,0,2.1,.24);motes(24,4,.12,(u,j,r,a)=>w.star(44+Math.sin(j+u*5)*30,928-u*747,2+r*2,pink,a*.55));
 }else if(e.key==='void_grub'){
  // Three large playful grubs and an independently marching swarm of voidmites.
  const grub=(x,y,s,phase)=>place(x,y,s,Math.sin(t*2.5+phase)*.06,()=>{
   poly([[-31,19],[-36,-13],[-23,-34],[0,-43],[24,-31],[37,-9],[31,21]],metal([-36,-43,37,21],['#c9c0e0','#6d669a','#a994c6','#454568']),.9);for(let j=0;j<3;j++)line([[-26,-19+j*12],[0,-12+j*12],[26,-19+j*12]],violet,1,.75);
   for(const side of [-1,1])for(let j=0;j<3;j++){const x=side*(16+j*8),y=12+j%2*3;line([[x,y],[x+side*9,y+7+Math.sin(t*5+phase+j)*4],[x+side*5,y+14]],ice,2,.8);}o.orb(-10,-20,4,pink,t*.5);o.orb(10,-20,4,pink,t*.5);line([[-4,-9],[0,-6],[4,-9]],ice,1.2,.85);
  });
  grub(57,327,1.14,0);grub(1869,563,1.04,2);grub(1390,1050,.8,4);
  for(let j=0;j<18;j++){const x=320+j*71+(p*.4+Math.sin(t*.6+j)*.05)*42,y=1054+Math.sin(t*3+j)*4;grub(x,y,.24+(j%3)*.06,j*.8);}
  for(let j=0;j<8;j++){const y=208+j*66;shard(1887,y,9+j%3*3,violet,Math.sin(t*.4+j)*.2);wake(u=>[1892-u*35,y-16+u*43],pink,j*.04,1.4,.32);}
  wake(u=>[280+u*1340,35+Math.sin(u*12-t*.5)*9],ice,0,1.5,.2);for(let j=0;j<4;j++)wake(u=>[20+j*9+Math.sin(u*11+t*.5+j)*7,927-u*690],violet,j*.14,1.5,.2);
 }else if(e.key==='objective_steal'){
  // A hooked light steals a jewel out of one socket into a waiting glove.
  const q=smooth((p-.13)/.6),x=1600-q*1120,y=44+Math.sin(q*Math.PI)*48;
  place(1597,50,1,-.1,()=>{ring(0,0,34,19,violet,2,.75);line([[-25,0],[-25,24],[25,24],[25,0]],ice,1.2,.6);});
  place(470,49,1,-.12,()=>{poly([[-38,23],[-41,3],[-34,-13],[-24,-18],[-19,-10],[-12,-24],[-3,-25],[2,-10],[11,-19],[19,-15],[19,6],[35,-1],[42,6],[19,32]],metal([-41,-25,42,32],['#e7cf98','#617881','#ccb47b','#3f5564']),.92);line([[-34,-13],[-24,-18],[-19,-10]],ice,1.2);line([[-19,16],[7,22],[19,13]],gold,1,.8);});
  const path=u=>[1600-u*1120,44+Math.sin(u*Math.PI)*48];o.ribbon(path,{width:9,color:gold,secondary:ice,phase:p*6.5,glass:true,alpha:.6});wake(path,gold,0,2.5,.23);shard(x,y,18,ice,t*1.2,false);ring(x,y,25,12,gold,1,.55);
  for(let j=0;j<6;j++){const yy=243+j*70;place(1859,yy,.7,Math.sin(t*.5+j)*.05,()=>{poly([[-18,15],[-13,-19],[0,-29],[18,-11],[13,16]],violet,.26);line([[-18,15],[-13,-19],[0,-29],[18,-11]],gold,1.3,.72);},j*.027);}
  for(let j=0;j<4;j++)wake(u=>[22+j*15,899-u*655],j%2?ice:gold,j*.12,2,.2);motes(28,4,.09,(u,j,r,a)=>w.star(j%2?1863:57,1000-u*800,2+r*3,gold,a*.7));
 }else if(e.key==='atakhan_legacy'){
  // Archived event only: blood roses and a thorned, slowly opening mask.
  const red='#df9ba6';
  place(1852,425,1.2,.08,()=>{poly([[-42,-51],[-14,-104],[0,-74],[22,-111],[38,-54],[43,28],[13,57],[-21,47],[-45,4]],metal([-45,-110,43,57],['#d4a8ab','#4d3e59','#ad7c9a','#293747']),.93);poly([[-31,-19],[-5,-26],[-12,-9]],red);poly([[6,-26],[29,-21],[15,-10]],red);line([[-17,14],[0,28],[15,10]],gold,1.4);shard(0,-50,15,red,t*.4);});
  for(let j=0;j<9;j++){const y=230+j*53;place(41,y,.75,Math.sin(t*.3+j)*.07,()=>{for(let n=0;n<5;n++)w.petal(Math.cos(n*TAU/5)*11,Math.sin(n*TAU/5)*11,13,red,n*TAU/5+t*.05,.76);shard(0,0,8,gold,0);},j*.018);}
  const stem=u=>[18+Math.sin(u*12+t*.27)*14,922-u*736];wake(stem,red,0,2.2,.24);for(let j=0;j<16;j++){const [x,y]=stem(j/16);poly([[x,y],[x+16,y-9],[x+7,y+3]],'#b597b166',.8);}
  for(let j=0;j<3;j++)wake(u=>[310+u*1300,1060-j*10+Math.sin(u*9+t*.3+j)*7],j%2?gold:red,j*.15,1.8,.18);motes(24,5,.12,(u,j,r,a)=>w.petal(1871+Math.sin(j+u*3)*26,190+u*628,4+r*7,red,j+u,a*.65));
 }else{
  // Unspecialized dragon event still has its own ancient scale procession.
  place(1831,434,1.1,.12,()=>{poly([[-43,37],[-42,-37],[-23,-84],[-15,-119],[-3,-70],[23,-74],[39,-45],[54,-22],[29,-2],[7,-2],[-4,31]],metal([-43,-119,54,37],['#e2d5ac','#4e7890','#9fb7bd','#3b4d72']),.94);line([[-15,-119],[-3,-70],[23,-74],[39,-45],[54,-22]],gold,1.1);poly([[14,-38],[29,-34],[18,-28]],ice);for(let j=0;j<5;j++)shard(-26+j*3,7+j*15,12,ice,-.25);});
  for(let j=0;j<15;j++){const y=216+j*38;place(41,y,1,-.2,()=>{poly([[0,-14],[15,0],[0,19],[-15,0]],metal([-15,-14,15,19],['#cadcdd','#53748f','#bdc1aa','#374b70']),.73);line([[0,-14],[0,12]],gold,1,.65);},j*.014);}
  for(let j=0;j<4;j++)wake(u=>[320+u*1270,38+j*11+Math.sin(u*8-t*.35+j)*9],j%2?gold:ice,j*.13,1.7,.23);motes(28,5,.11,(u,j,r,a)=>w.petal(j%2?1884:57,997-u*778,6+r*5,ice,j*.2+u,a*.6));
 }
 c.restore();return true;
}
