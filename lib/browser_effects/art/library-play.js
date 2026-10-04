// Playful subjects authored independently over their cue-specific edge scenery.
const PLAY_LIBRARY_CUES=new Set(['airburst','another','applause','brass','bruh','catlove','chill','confetti','dayum','downer','fail','fracture','gary','goofy','lizard','newt','opening','quack','revulsion','scream','suspicious','swear','troll','untouchable']);
function libraryPlay(c,id,t,d){
 if(!PLAY_LIBRARY_CUES.has(id))return false;
 const{p,line,poly,disc,curve,halo,light,metal,ring,text}=cueInk(c,t,d,{}),q=smooth(p),ice='#bde8f1',gold='#e9cb98',rose='#e3b0cb',mint='#b4d8b2';
 c.save();c.globalAlpha*=smooth(t/Math.min(.3,d*.18))*smooth((d-t)/Math.min(.4,d*.2));
 switch(id){
 case 'opening':{
  c.save();c.translate(1125,66);c.rotate(-.24+q*.08);poly([[-41,-32],[14,-32],[41,-17],[41,32],[-41,32]],metal([-41,-32,41,32],['#dad5e5','#8b91ad','#c6c4dc','#596f92']));poly([[-32,-23],[2,-23],[30,-9],[30,21],[-32,21]],'#405b7a');line([[-24,-12],[18,-12]],rose,3);line([[-24,-3],[24,-3]],ice,2);line([[-24,7],[7,7]],gold,1.4);poly([[14,-31],[14,-16],[39,-16]],'#ecdcdf');c.restore();break;
 }
 case 'another':{
  const stack=1+Math.floor(q*3);for(let j=0;j<stack;j++){const x=1060+j*19,y=73-j*9;poly([[x-31,y-22],[x+23,y-28],[x+37,y-15],[x+37,y+10],[x-17,y+20],[x-31,y+8]],metal([x-31,y-28,x+37,y+20],['#f0e0bd','#b58e68','#dcc8a9','#776856']));ring(x+4,y-4,10,7,ice,1.2,.75);}break;
 }
 case 'bruh':{
  c.save();c.translate(1007,58+q*13);c.rotate(q*.075);poly([[-56,-27],[55,-27],[63,-17],[63,22],[55,29],[-56,29],[-64,20],[-64,-18]],metal([-64,-27,63,29],['#c5c7c3','#8b919e','#bec9d1','#607489']));line([[-28,-3],[-8,-3]],'#344759',3);line([[10,-3],[30,-3]],'#344759',3);line([[-19,16],[21,16]],'#344759',2);c.restore();break;
 }
 case 'fracture':{
  c.save();c.translate(1130,64);c.rotate(.14);poly([[-38,-26],[38,-26],[38,28],[-38,28]],metal([-38,-26,38,28],['#edf0df','#c9d3d4','#f3eade','#a2b0bf']));const seam=[[-4,-26],[5,-9],[-7,2],[5,13],[-1,28]];line(seam,'#344d61',1.7);line([[5,-9],[21,-1]],'#59758b',1.2,q);line([[-7,2],[-22,14]],'#59758b',1.2,q);c.restore();break;
 }
 case 'revulsion':{
  c.save();c.translate(1872,435);c.rotate(-.09);poly([[-27,-35],[24,-35],[32,-21],[28,29],[0,43],[-28,28],[-32,-22]],metal([-32,-35,32,43],['#b8cbb0','#6c9292','#b4ceba','#4c6d7a']));disc(-13,-10,11,10,'#304e60');disc(13,-10,11,10,'#304e60');ring(0,21,15,12,gold,3,.85);for(let i=0;i<5;i++)line([[-8+i*4,13],[-8+i*4,29]],'#456d70',1.2);c.restore();break;
 }
 case 'untouchable':{
  c.save();c.translate(56,426);c.rotate(-.18+q*.15);poly([[-26,-39],[24,-39],[34,-28],[32,22],[4,43],[-27,25],[-33,-23]],metal([-33,-39,34,43],['#eadbbd','#9faeb3','#e4d9c8','#607b95']));poly([[-13,-18],[12,-18],[20,-5],[15,20],[-14,20],[-21,-5]],'#738ba985');line([[-13,-18],[12,-18],[20,-5],[15,20]],ice,1.4,.85);c.restore();break;
 }
 case 'chill':{
  c.save();c.translate(1130,69);c.rotate(-.11);line([[-27,22],[27,22]],'#849bad',5);poly([[-26,19],[-19,-13],[19,-13],[27,19]],metal([-27,-13,27,19],['#c4dfd0','#8bbaa7','#d5ead2','#6d9f9c']));poly([[-10,-15],[-6,-25],[6,-25],[10,-15]],'#a4caba');line([[-17,10],[17,10]],'#e5edcf',1.2,.7);ring(35,-1,10,12,ice,3,.7);curve(u=>[u*9, -29-u*21],ice,.9,.32);c.restore();break;
 }
 case 'confetti':{
  c.save();c.translate(61,590);c.rotate(-.25-q*.06);poly([[-16,-46],[16,-46],[21,29],[-21,29]],metal([-21,-46,21,29],['#d9c1df','#9884ac','#d7c7e5','#596d96']));ring(0,-45,16,5,ice,1.5,.9);for(let j=0;j<4;j++)line([[-17,-24+j*13],[18,-19+j*13]],gold,1.4,.7);c.restore();
  for(let j=0;j<12;j++){const age=Math.max(0,p*1.4-j*.025);if(age>1)continue;const x=61+Math.sin(j*2.3)*age*49,y=544-age*177+age*age*91;poly([[x,y],[x+6,y-2],[x+8,y+6],[x+2,y+8]],[ice,gold,rose][j%3],Math.sin(age*Math.PI));}break;
 }
 case 'dayum':{
  c.save();c.translate(1090,57);const spread=.7+.3*Math.sin(p*Math.PI);for(let j=0;j<9;j++){const a=(-.9+j*.22)*spread;poly([[0,25],[Math.sin(a)*48,-29+Math.abs(j-4)*3],[Math.sin(a+.12)*48,-26+Math.abs(j-4)*3]],metal([-44,-29,44,25],['#efcf9e','#b28c65','#e4bfc0','#765c79']),.84);}disc(0,25,4,4,gold);c.restore();break;
 }
 case 'applause':{
  c.save();c.translate(57,449);c.rotate(-.2+Math.sin(p*Math.PI)*.08);poly([[-24,-28],[-20,-42],[-14,-31],[-10,-47],[-3,-32],[3,-47],[10,-30],[16,-41],[22,-23],[20,22],[4,36],[-18,24]],metal([-24,-47,22,36],['#eddbbb','#bda085','#e4cab3','#967d76']));line([[-14,-26],[-12,-2]],gold,1.1,.6);line([[0,-27],[2,-2]],gold,1.1,.6);c.restore();for(let j=0;j<3;j++)ring(54,444,34+q*(19+j*11),34+q*(19+j*11),gold,1,(1-p)*.48);break;
 }
 case 'suspicious':{
  c.save();c.translate(1876,375);c.rotate(.08);poly([[-30,3],[-21,-26],[19,-26],[29,3]],metal([-30,-26,29,3],['#c3c6b4','#7e9692','#acb3a6','#425e76']));disc(0,6,43,7,'#7e969c');poly([[-26,-1],[24,-1],[21,8],[-22,8]],'#263f51');line([[-18,24],[-3,23],[0,27],[3,23],[18,24]],ice,2.2,.8);c.restore();break;
 }
 case 'downer':{
  c.save();c.translate(1055,60);poly([[-48,14],[-48,-2],[-35,-15],[-18,-14],[-6,-30],[16,-30],[27,-12],[43,-9],[52,7],[45,20],[-36,20]],metal([-48,-30,52,20],['#ced8df','#9db6c7','#bac4d3','#718ba3']),.85);for(let j=0;j<5;j++){const age=(p*1.5+j*.17)%1;disc(-30+j*16,28+age*36,1.7,4,ice,Math.sin(age*Math.PI));}c.restore();break;
 }
 case 'airburst':{
  c.save();c.translate(63,447);poly([[-32,-16],[20,-16],[20,16],[-32,16]],metal([-32,-16,20,16]));poly([[20,-8],[39,-8],[39,8],[20,8]],'#abc1cc');line([[-23,-22],[-23,22]],gold,4);c.restore();for(let j=0;j<3;j++){const fn=u=>[95+u*35,434+j*10+Math.sin(u*5+j)*7];light(fn,ice,j*.21,.3,2); }break;
 }
 case 'brass':{
  c.save();c.translate(1873,422);c.rotate(-.2);poly([[-31,-7],[15,-7],[37,-25],[37,25],[15,7],[-31,7]],metal([-31,-25,37,25],['#f0deb0','#ad875c','#e5c69b','#7e6955']));ring(37,0,8,26,gold,2,.95);for(let j=0;j<3;j++)line([[-19+j*12,-7],[-19+j*12,-19]],'#e5d8bc',3);line([[-32,-2],[-41,-2]],ice,2);c.restore();break;
 }
 case 'newt':{
  c.save();c.translate(66,468);c.rotate(-.17);curve(u=>[-15+u*56,5+Math.sin(u*6+t*.4)*12],metal([-15,0,42,0],['#91d6c4','#5389a1','#b3d7c7','#3b677d']),12);disc(-21,0,17,10,'#9ad7cb');for(const side of [-1,1])for(let j=0;j<2;j++)line([[-5+j*18,side*4],[-9+j*18,side*17],[-17+j*18,side*19]],ice,3,.8);disc(-28,-3,2,2,'#253e54');line([[-25,7],[-14,7]],'#315b67',1);c.restore();break;
 }
 case 'scream':{
  c.save();c.translate(1874,455);poly([[-33,-14],[-5,-14],[32,-35],[32,35],[-5,14],[-33,14]],metal([-33,-35,32,35],['#d4dce2','#8e9dab','#c9d2d9','#506c88']));poly([[-24,13],[-13,13],[-8,40],[-20,40]],'#849cae');ring(32,0,8,33,ice,1.5,.8);c.restore();break;
 }
 case 'swear':{
  c.save();c.translate(1065,57);c.rotate(-.06);poly([[-52,-27],[51,-27],[51,22],[8,22],[-12,37],[-8,22],[-52,22]],metal([-52,-27,51,37],['#dba8b6','#af6e8c','#d9a3b8','#705c8a']));text('@!#',0,7,'#f6e4dd',22);c.restore();break;
 }
 case 'gary':{
  c.save();c.translate(1866,479);disc(0,3,28,25,metal([-28,-22,28,28],['#e5b9cc','#b47caa','#dcb8d9','#816c9e']));curve(u=>{const a=u*TAU*2.1,r=2+u*20;return[Math.cos(a)*r,Math.sin(a)*r+3];},ice,1.6,.8);poly([[-32,25],[33,25],[42,32],[-38,32]],'#9dc7cb');line([[31,22],[33,-1]],'#b5ddd5',4);line([[39,23],[44,-1]],'#b5ddd5',4);disc(33,-4,4,5,'#e8eac8');disc(44,-4,4,5,'#e8eac8');disc(34,-5,1.5,2,'#354561');disc(45,-5,1.5,2,'#354561');c.restore();break;
 }
 case 'goofy':{
  for(let j=0;j<2;j++){c.save();c.translate(54,342+j*151);c.rotate(Math.sin(t*1.8+j*Math.PI)*.18);poly([[-25,-8],[-13,-28],[3,-28],[12,-6],[30,-2],[38,12],[-27,12]],metal([-27,-28,38,12],['#e9d5bd','#b69487','#ddbeb7','#7c708c']));line([[-22,14],[35,14]],ice,3);for(let k=0;k<3;k++)line([[-3+k*7,-12],[-8+k*7,-7]],gold,1.4);c.restore();}break;
 }
 case 'lizard':{
  c.save();c.translate(1868,462);c.rotate(.2);curve(u=>[9+u*36,Math.sin(u*5+t*.3)*13],'#95c5ba',9);disc(-7,0,23,13,metal([-30,-13,16,13],['#c6d0a6','#80af9f','#b5d9b4','#497f85']));poly([[-28,-10],[-42,-5],[-42,8],[-27,11]],'#aacdba');for(const side of [-1,1])for(let j=0;j<2;j++)line([[-15+j*23,side*6],[-18+j*23,side*23],[-25+j*23,side*24]],ice,3);disc(-35,-3,2,2,'#2e5263');for(let j=0;j<4;j++)poly([[-17+j*8,-4],[-13+j*8,-10],[-9+j*8,-4]],gold,.6);c.restore();break;
 }
 case 'catlove':{
  c.save();c.translate(1111,67);c.rotate(Math.sin(t*.45)*.035);poly([[-30,-15],[-24,-37],[-9,-21],[10,-21],[27,-37],[31,-12],[34,14],[22,27],[-22,27],[-34,14]],metal([-34,-37,34,27],['#e4e3d1','#b7c7c9','#e0d4df','#8aa6b8']));line([[-20,0],[-9,4]],'#40546a',2);line([[10,4],[21,0]],'#40546a',2);poly([[-4,9],[4,9],[0,14]],rose);for(const side of [-1,1])line([[side*15,13],[side*39,9]],ice,1,.8);c.restore();break;
 }
 case 'quack':{
  c.save();c.translate(65,494+Math.sin(t*.8)*3);disc(-2,13,27,19,metal([-29,-6,25,32],['#ede0af','#c4b77d','#e9d39f','#9b947a']));disc(12,-10,18,18,'#e8d4aa');poly([[26,-9],[42,-3],[27,4]],'#cb9e77');disc(16,-14,2,2,'#31475c');line([[-17,12],[-9,23],[8,22]],'#b1a479',1.2);c.restore();break;
 }
 case 'fail':{
  c.save();c.translate(1110,66);c.rotate(q*.16);poly([[-30,-26],[30,-26],[30,25],[-30,25]],metal([-30,-26,30,25],['#e1d3bb','#b29b86','#ddd2c1','#8b8796']));line([[-16,-13],[16,13]],'#9d657e',4);line([[16,-13],[-16,13]],'#9d657e',4);c.restore();break;
 }
 case 'troll':{
  c.save();c.translate(1872,442);c.rotate(-.1+q*.1);poly([[-29,-24],[28,-24],[37,-12],[36,20],[18,35],[-20,35],[-36,15],[-36,-10]],metal([-36,-24,37,35],['#d6dfd0','#8aa8ac','#c2d5d4','#567a96']));line([[-22,-5],[-9,-10]],'#38536a',2.5);line([[11,-10],[25,-4]],'#38536a',2.5);curve(u=>[-22+u*46,10+Math.sin(u*Math.PI)*10],'#294962',3);for(let i=0;i<5;i++)line([[-15+i*8,11],[-15+i*8,19]],'#d6e6dc',1);c.restore();break;
 }
 }
 c.restore();return true;
}
