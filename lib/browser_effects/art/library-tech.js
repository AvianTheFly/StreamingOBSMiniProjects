// Individually authored focal subjects for short technology/optical sound cues.
const TECH_LIBRARY_CUES=new Set(['later','airlock','payment','ding-one','ding-two','disconnect','glitch','charge','cash','loading','behind','alert','piuw','scratch','smart','camera','respawn','casino','galaxy','intro','boom']);
function libraryTech(c,id,t,d){
 if(!TECH_LIBRARY_CUES.has(id))return false;
 const{p,line,poly,disc,curve,halo,light,metal,ring,text}=cueInk(c,t,d,{bpm:110}),q=smooth(p),ice='#b9e7f0',gold='#ebca8d',rose='#e6aecb',mint='#a9dec5';
 c.save();c.globalAlpha*=smooth(t/Math.min(.3,d*.18))*smooth((d-t)/Math.min(.4,d*.2));
 switch(id){
 case 'later':{
  c.save();c.translate(1115,68);c.rotate(-.08+.13*q);halo(0,0,65,gold,.25);ring(0,0,34,34,metal([-34,-34,34,34],['#f0d9a5','#9c744e','#f4ddb0','#795e49']),6);disc(0,0,30,30,'#233749');ring(0,-42,8,9,gold,3);
  for(let i=0;i<12;i++){const a=i*TAU/12;line([[Math.cos(a)*24,Math.sin(a)*24],[Math.cos(a)*28,Math.sin(a)*28]],gold,i%3?1:2,.8);}const a=-1.57+q*TAU*1.2;line([[0,0],[Math.cos(a)*24,Math.sin(a)*24]],ice,1.7);line([[0,0],[Math.cos(a*.2)*16,Math.sin(a*.2)*16]],gold,2.4);disc(0,0,3,3,'#edddb9');c.restore();break;
 }
 case 'airlock':{
  c.save();c.translate(1875,446+Math.sin(t*.9)*3);c.rotate(-.06+Math.sin(t*.4)*.04);poly([[-25,-25],[22,-25],[31,-11],[31,26],[20,36],[-20,36],[-30,23],[-30,-8]],metal([-30,-25,31,36],['#b38aa9','#9b647e','#cc9bac','#513d61']));poly([[-24,30],[-9,30],[-9,46],[-24,46]],'#70536b');poly([[9,30],[24,30],[24,46],[9,46]],'#70536b');poly([[-37,-10],[-26,-10],[-26,24],[-37,24]],'#a27f9a');disc(8,-13,23,13,metal([-15,-26,31,0],['#d9f3f3','#79a1b9','#435b83','#a4d1df']));curve(u=>[-6+u*23,-20+Math.sin(u*Math.PI)*2],'#ebffff',1.4,.8);c.restore();break;
 }
 case 'payment':{
  c.save();c.translate(1167,57);c.rotate(-.06+.09*q);poly([[-58,-30],[58,-30],[58,29],[-58,29]],metal([-58,-30,58,29],['#9db9c9','#537a90','#b1c9ce','#3e5e77']));line([[-49,-15],[49,-15]],'#192e48',8,.6);poly([[-43,-1],[-24,-1],[-24,12],[-43,12]],gold);for(let j=0;j<3;j++)line([[-40+j*6,0],[-40+j*6,12]],'#987854',.6);line([[5,8],[15,17],[37,-6]],mint,3.5,smooth((p-.22)/.25));c.restore();break;
 }
 case 'ding-one':{
  c.save();c.translate(1870,402);c.rotate(Math.sin(p*Math.PI*2)*.1*(1-p));ring(0,-33,5,7,gold,2);poly([[-7,-25],[-21,-8],[-24,17],[-30,23],[30,23],[24,17],[21,-8],[7,-25]],metal([-30,-25,30,23],['#f5ddb0','#a78256','#ebc188','#70563e']));line([[-29,23],[29,23]],'#fbebcb',2);disc(0,28,5,5,gold);halo(0,13,49,gold,.25);c.restore();break;
 }
 case 'ding-two':{
  for(let j=0;j<3;j++){const x=1836+j*27,y=305+j%2*27;line([[x,190],[x,y]],ice,.8,.45);c.save();c.translate(x,y);c.rotate(Math.sin(t*1.1+j)*.045);poly([[-9,0],[9,0],[14,31],[0,62],[-14,31]],metal([-14,0,14,62],['#dcf9ff','#8caac8','#bca4d3','#5d88a4']),.8);line([[-9,0],[0,62],[9,0]],'#e5faff',1,.73);c.restore();}break;
 }
 case 'disconnect':{
  const gap=5+q*40;curve(u=>[704+u*(245-gap),35+Math.sin(u*5)*11],ice,3,.7);curve(u=>[975+gap+u*(254-gap),37+Math.sin(u*5)*11],rose,3,.7);
  poly([[937-gap,22],[958-gap,22],[958-gap,48],[937-gap,48]],metal([937-gap,22,958-gap,48]));line([[958-gap,28],[968-gap,28]],gold,2.2);line([[958-gap,41],[968-gap,41]],gold,2.2);poly([[975+gap,22],[996+gap,22],[996+gap,48],[975+gap,48]],'#8b8da9');line([[974+gap,28],[974+gap,42]],'#293c59',4);break;
 }
 case 'glitch':{
  c.save();c.translate(60,437);c.rotate(-.14+q*.19);poly([[-27,-30],[25,-30],[31,-24],[31,26],[25,32],[-27,32],[-33,26],[-33,-24]],'#45556cb0');poly([[-19,-19],[19,-19],[19,19],[-19,19]],metal([-19,-19,19,19],['#a2cfd7','#7777a2','#b5c9de','#3b5270']));for(let j=0;j<5;j++){line([[-33,-20+j*10],[-43,-20+j*10]],gold,2,.7);line([[31,-20+j*10],[41,-20+j*10]],ice,2,.7);}line([[-11,-8],[8,-8],[8,7],[-6,7]],ice,1.1);c.restore();
  for(let j=0;j<4;j++){const a=smooth((p-j*.08)/.32);poly([[45+a*37,390+j*35],[54+a*37,390+j*35],[54+a*37,397+j*35],[45+a*37,397+j*35]],j%2?rose:ice,(1-a)*.7);}break;
 }
 case 'charge':{
  c.save();c.translate(1136,59);c.rotate(-.055);poly([[-24,-40],[24,-40],[28,-36],[28,37],[24,41],[-24,41],[-28,37],[-28,-36]],metal([-28,-40,28,41]));poly([[-22,-31],[22,-31],[22,30],[-22,30]],'#203c4c');line([[-6,-36],[6,-36]],'#253c50',2);const h=8+q*35;poly([[-14,23],[-14,23-h],[14,23-h],[14,23]],'#a6e7c1a0');line([[-5,-10],[4,-10],[-1,1],[7,1],[-4,15],[0,4],[-8,4],[-5,-10]],'#f1ffe9',1.5,.9);c.restore();break;
 }
 case 'cash':{
  c.save();c.translate(63,441);poly([[-42,-41],[39,-41],[39,36],[-42,36]],metal([-42,-41,39,36],['#889a96','#476369','#a0b6a9','#3c4e60']));poly([[-33,-28],[29,-28],[29,-1],[-33,-1]],'#203d48');line([[-28,1],[23,1]],gold,4);for(let i=0;i<3;i++)poly([[-29+i*18,11],[-17+i*18,11],[-17+i*18,22],[-29+i*18,22]],'#c7d3b0');c.restore();
  for(let j=0;j<4;j++){const age=Math.max(0,p*1.5-j*.12);if(age>1)continue;disc(67+Math.sin(j)*10,455+age*149,13*(.5+.5*Math.abs(Math.cos(age*4+j))),14,metal([50,450,80,450],['#e9d49e','#bb9257','#f2d39b','#957b4d']),Math.sin(age*Math.PI));}break;
 }
 case 'loading':{
  c.save();c.translate(963,61);halo(0,0,61,ice,.3);for(let j=0;j<6;j++){const a=j*TAU/6+t*.45,spread=35+(1-q)*13;poly([[Math.cos(a)*spread,Math.sin(a)*spread],[Math.cos(a+.19)*(spread+13),Math.sin(a+.19)*(spread+13)],[Math.cos(a+.38)*spread,Math.sin(a+.38)*spread]],j%2?ice:'#ab9fdb',.47+.37*Math.sin(t*.7+j)**2);}disc(0,0,10,10,'#a7c8d980');ring(0,0,17,17,ice,1,.6);c.restore();break;
 }
 case 'behind':{
  c.save();c.translate(61,389);c.rotate(.08);line([[0,78],[0,-16],[22,-16]],metal([-10,0,11,0]),15);poly([[14,-32],[44,-32],[44,2],[14,2]],'#7d9aaa');disc(31,-16,10,10,'#243b55');ring(31,-16,10,10,ice,1.4,.85);line([[-9,70],[9,70]],ice,1.2);c.restore();
  light(u=>[1877+Math.sin(u*Math.PI)*21,192+u*479],gold,0,.22,2.2);break;
 }
 case 'alert':{
  c.save();c.translate(1165,66);halo(0,0,63,gold,.25);poly([[0,-40],[39,28],[-39,28]],metal([-39,-40,39,28],['#e8bf7c','#ac7752','#f0ce90','#8d6654']));poly([[0,-31],[31,23],[-31,23]],'#384656');poly([[-4,-14],[4,-14],[3,8],[-3,8]],'#f5deb2');disc(0,16,3.5,3.5,'#f5deb2');c.restore();break;
 }
 case 'piuw':{
  const y=666-q*459,x=1888-18*Math.sin(p*Math.PI);c.save();c.translate(x,y);c.rotate(-.12);poly([[0,-31],[19,20],[0,10],[-19,20]],metal([-19,-31,19,20],['#f0f9fb','#6ea4c0','#abcce3','#527797']));line([[0,-31],[0,10]],'#efffff',1.3);halo(0,18,37,ice,.33);c.restore();light(u=>[1896-12*Math.sin(u*Math.PI),664-u*458],ice,0,.27,2.8);break;
 }
 case 'scratch':{
  c.save();c.translate(1010,58);poly([[-63,-38],[63,-38],[63,38],[-63,38]],metal([-63,-38,63,38],['#8fa5b7','#3c536c','#8398ac','#2c4359']));disc(-14,0,29,29,'#142b3d');for(let j=0;j<4;j++)ring(-14,0,14+j*4,14+j*4,ice,.6,.27);disc(-14,0,7,7,rose);const a=-.55+Math.sin(p*Math.PI)*.65;line([[43,-26],[43-30*Math.cos(a),-26+30*Math.sin(a)],[14,8]],gold,2.6,.9);c.restore();break;
 }
 case 'smart':{
  c.save();c.translate(1871,437);c.rotate(-.22+.25*q);disc(0,-23,7,7,gold);line([[0,-23],[-26,43]],metal([-26,-23,26,43]),6);line([[0,-23],[26,43]],'#afcad3',5);line([[26,43],[28,56]],ice,1.2);line([[-26,43],[-28,56]],ice,1.2);line([[-17,17],[16,17]],gold,1.8);c.restore();ring(64,475,33+q*10,19+q*6,ice,1,.53);break;
 }
 case 'camera':{
  c.save();c.translate(1067,64);poly([[-54,-24],[-31,-24],[-23,-35],[12,-35],[20,-24],[52,-24],[52,29],[-54,29]],metal([-54,-35,52,29],['#b3c3c9','#3e5a70','#8c9eac','#2a4159']));disc(0,1,27,27,'#203a51');ring(0,1,26,26,ice,2,.78);disc(0,1,19,19,metal([-19,-18,19,20],['#7dadc6','#1c405c','#809ac1','#12324e']));ring(0,1,10+Math.sin(p*Math.PI)*5,10+Math.sin(p*Math.PI)*5,ice,1,.65);disc(37,-10,3,3,rose);line([[-42,-12],[-32,-12]],gold,3);halo(0,1,64,ice,.13+.17*Math.sin(p*Math.PI));c.restore();break;
 }
 case 'respawn':{
  c.save();c.translate(960,70);halo(0,0,79,mint,.25);poly([[-28,-32],[22,-32],[35,-15],[32,21],[19,36],[-23,36],[-34,14],[-34,-14]],metal([-34,-32,35,36],['#b9c49b','#788c73','#acb59a','#4a6666']));poly([[-28,-14],[28,-14],[26,4],[-8,12],[-26,4]],metal([-28,-14,28,12],['#fae3a1','#b19258','#e5bc76','#796644']));line([[-24,23],[-12,17],[11,17],[24,23]],'#304e58',3);line([[-17,33],[15,33]],ice,1.3,.6);c.restore();break;
 }
 case 'casino':{
  c.save();c.translate(1110,58);c.rotate(-.07);poly([[-56,-32],[1,-32],[1,32],[-56,32]],'#d6e0d3');poly([[-2,-29],[57,-29],[57,35],[-2,35]],'#a9c7c9');poly([[27,-13],[38,0],[27,13],[16,0]],'#7a3b56');poly([[-28,-14],[-20,-3],[-28,10],[-36,-3]],'#344859');line([[-47,-24],[-37,-24]],gold,2);c.restore();ring(1880,426,25,25,gold,5,.9);ring(1880,426,16,16,ice,1,.7);break;
 }
 case 'galaxy':{
  c.save();c.translate(63,437);c.rotate(-.25);halo(0,0,92,'#aa92df',.35);disc(0,0,32,32,metal([-32,-32,32,32],['#c5c0df','#857aa6','#bba8d7','#485b87']));for(let j=0;j<4;j++)curve(u=>[-27+u*54,-15+j*10+Math.sin(u*Math.PI)*4],ice,.8,.24);ring(0,0,58,14,gold,2,.73);light(u=>[Math.cos(u*TAU)*58,Math.sin(u*TAU)*14],ice,0,.17,2);c.restore();break;
 }
 case 'intro':{
  c.save();c.translate(1000,64);poly([[-53,-17],[53,-17],[53,32],[-53,32]],metal([-53,-17,53,32],['#9bafb7','#354d61','#7d929e','#1d3c53']));c.save();c.translate(-53,-17);c.rotate(-.2*(1-q));poly([[0,-20],[106,-20],[106,-1],[0,-1]],'#aebdbb');for(let j=0;j<6;j++)poly([[j*18,-20],[j*18+8,-20],[j*18+17,-1],[j*18+9,-1]],'#30465b');c.restore();line([[-42,0],[18,0]],ice,1.2,.7);line([[-42,10],[37,10]],gold,1,.55);line([[-42,20],[-3,20]],ice,1,.45);c.restore();break;
 }
 case 'boom':{
  c.save();c.translate(57,447);disc(0,0,37,37,metal([-37,-37,37,37],['#a0b6c4','#425c74','#869ba9','#243d57']));disc(0,0,28,28,'#283e54');disc(0,0,13+Math.sin(p*Math.PI)*4,13+Math.sin(p*Math.PI)*4,'#84a2b585');ring(0,0,32,32,ice,1,.67);for(let j=0;j<6;j++){const a=j*TAU/6;disc(Math.cos(a)*33,Math.sin(a)*33,2,2,gold);}c.restore();for(let j=0;j<3;j++)ring(57,447,42+q*(24+j*13),42+q*(24+j*13),ice,1.5,(1-p)*.42);break;
 }
 }
 c.restore();return true;
}
