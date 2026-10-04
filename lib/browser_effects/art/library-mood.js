// Atmospheric and dramatic subjects; each owns its silhouette and gesture.
const MOOD_LIBRARY_CUES=new Set(['awww','confusion','disgust','falling','heaven','isolation','love','mystery','paradise','prowler','refusal','rescue','rizz','romance','run','sparta','weeknd','western']);
function libraryMood(c,id,t,d){
 if(!MOOD_LIBRARY_CUES.has(id))return false;
 const{p,line,poly,disc,curve,halo,light,metal,ring,text}=cueInk(c,t,d,{}),q=smooth(p),ice='#c5e8ef',gold='#e6c897',rose='#e4b5ce',violet='#b5b0e1';
 c.save();c.globalAlpha*=smooth(t/Math.min(.3,d*.18))*smooth((d-t)/Math.min(.4,d*.2));
 switch(id){
 case 'paradise':{
  c.save();c.translate(60,433);line([[0,60],[0,-54],[20,-54]],metal([-5,0,6,0],['#c9b595','#8c806d','#c6bd9a','#626e7d']),7);poly([[12,-54],[26,-54],[31,-33],[8,-33]],'#b4a382');poly([[11,-51],[24,-51],[27,-36],[9,-36]],'#ecd09555');halo(19,-43,43,gold,.34);line([[-15,63],[15,63]],gold,4);c.restore();break;
 }
 case 'heaven':{
  c.save();c.translate(61,450);halo(0,0,89,gold,.21);line([[-24,-48],[-27,44],[29,44]],metal([-27,-48,29,44],['#ede3c9','#b7aa97','#e7dcc5','#9ba9b9']),7);curve(u=>[-24+u*54,-49+Math.sin(u*Math.PI)*20],gold,5,.95);line([[30,-47],[29,44]],'#ddd4be',5);for(let j=0;j<7;j++){const xx=-18+j*6;line([[xx,-48+Math.sin(j/7*Math.PI)*19],[xx,38]],ice,.7,.74);}c.restore();break;
 }
 case 'love':{
  c.save();c.translate(1078,62);c.rotate(-.09+q*.12);poly([[-39,-27],[39,-27],[39,27],[-39,27]],metal([-39,-27,39,27],['#eadad9','#bd9aaa','#e5c9d6','#927e9b']));line([[-39,-27],[0,4],[39,-27]],'#f2e4df',1.4,.85);line([[-39,27],[-12,3]],rose,1,.7);line([[39,27],[12,3]],rose,1,.7);disc(0,8,9,9,'#ad7998');poly([[-5,7],[0,12],[5,7],[5,3],[1,2],[0,4],[-1,2],[-5,3]],'#eed5db');c.restore();break;
 }
 case 'falling':{
  c.save();c.translate(1872,318+q*226);c.rotate(-.25+q*.42);poly([[-22,-33],[0,-45],[22,-33],[27,-2],[0,37],[-27,-2]],metal([-27,-45,27,37],['#ecc9dc','#a8a0c6','#ddc0df','#7f94b4']),.84);line([[0,-45],[0,37]],ice,1.3,.75);line([[-22,-33],[0,-3],[22,-33]],rose,1,.55);c.restore();break;
 }
 case 'isolation':{
  c.save();c.translate(60,452);c.rotate(-.09);poly([[-26,-35],[24,-35],[24,-3],[-26,-3]],metal([-26,-35,24,-3],['#9baac4','#677c9a','#9aaac0','#4b6280']));line([[-22,-3],[-25,38]],ice,3);line([[20,-3],[23,38]],ice,3);poly([[-29,-2],[27,-2],[35,11],[-23,11]],'#7b91ad');line([[-22,11],[-18,54]],'#7d9ab1',3);line([[29,11],[32,54]],'#7d9ab1',3);c.restore();break;
 }
 case 'mystery':{
  c.save();c.translate(1120,66);c.rotate(-.04);poly([[-31,-26],[31,-26],[35,-13],[28,20],[0,34],[-28,20],[-35,-13]],metal([-35,-26,35,34],['#d4e1cf','#93baaa','#c7dfd4','#657f9b']));poly([[-27,-4],[-15,-14],[-3,-3],[-14,2]],'#3c5d69');poly([[27,-4],[15,-14],[3,-3],[14,2]],'#3c5d69');curve(u=>[-10+u*20,19+Math.sin(u*Math.PI)*3],gold,1.2,.7);line([[0,2],[-3,11],[3,11]],ice,.8,.5);c.restore();break;
 }
 case 'refusal':{
  c.save();c.translate(1070,62);c.rotate(-.08);ring(0,0,31,31,metal([-31,-31,31,31],['#e7bdc2','#ad6f8e','#ddb0c0','#785e8b']),6);line([[-20,20],[20,-20]],rose,6);line([[-19,19],[19,-19]],'#f1d6d9',1.2);halo(0,0,62,rose,.2);c.restore();break;
 }
 case 'prowler':{
  c.save();c.translate(1871,433);halo(0,0,61,violet,.24);poly([[-29,-27],[-19,-45],[-8,-31],[8,-31],[19,-45],[29,-27],[31,13],[19,32],[-19,32],[-31,13]],metal([-31,-45,31,32],['#7787a3','#334760','#6d7a9c','#263f58']));line([[-24,-6],[-8,0]],violet,2.5,.92);line([[8,0],[24,-6]],violet,2.5,.92);poly([[-7,13],[7,13],[0,21]],'#9da7c7');line([[-19,27],[0,32],[19,27]],'#bcc4dd',.8,.56);c.restore();break;
 }
 case 'rizz':{
  c.save();c.translate(1877,427);c.rotate(.16);ring(0,0,25,29,metal([-25,-29,25,29],['#ecd0d8','#b78aab','#e5c4d6','#8883a4']),6);poly([[-12,-31],[0,-47],[12,-31],[0,-20]],metal([-12,-47,12,-20],['#f1f9ef','#a0bfd4','#d9e5f4','#7e96b5']));line([[0,-47],[0,-20]],ice,1,.9);halo(0,-30,46,rose,.22);c.restore();break;
 }
 case 'romance':{
  c.save();c.translate(62,433);c.rotate(-.2);curve(u=>[0+Math.sin(u*4)*9,31+u*93],'#8aad98',3,.9);for(let j=0;j<3;j++){const a=j*1.1;disc(7+Math.sin(a)*7,54+j*20,13,4,'#b5ceb0',.77);}for(let j=6;j>=0;j--){const a=j*.91+t*.04;disc(Math.cos(a)*j*2.7,Math.sin(a)*j*2.5,11+j,5+j*.4,metal([-27,-23,27,23],['#eed1dc','#b67f9e','#dfa9c4','#97749a']),.89);}disc(0,0,6,6,'#d1a8c2');c.restore();break;
 }
 case 'run':{
  c.save();c.translate(1110,63);poly([[-36,-27],[36,-27],[36,27],[-36,27]],metal([-36,-27,36,27],['#abc9bf','#5e9f9a','#98c6bb','#477e91']));poly([[4,-16],[14,-7],[6,0],[22,8],[19,14],[1,6],[-9,22],[-15,19],[-4,0],[-13,-8],[-26,-2],[-29,-8],[-13,-17],[0,-9]],'#d9efe1');disc(5,-21,5,5,'#d9efe1');c.restore();break;
 }
 case 'disgust':{
  c.save();c.translate(61,444);poly([[-30,-25],[30,-25],[26,22],[-26,22]],metal([-30,-25,30,22],['#cadbbd','#90af9e','#d0dbc4','#678e91']));disc(0,-23,30,8,'#bbd3ad');disc(0,-24,23,5,'#789b90');line([[-31,-29],[31,-29]],gold,2);for(let j=0;j<3;j++)curve(u=>[-15+j*14+Math.sin(u*5+t*.4)*5,-31-u*29],mintColor(),.8,.3);c.restore();break;
 }
 case 'awww':{
  c.save();c.translate(1068,61);c.rotate(Math.sin(t*.5)*.04);disc(-23,-15,13,13,'#aebccc');disc(23,-15,13,13,'#aebccc');disc(0,8,29,27,metal([-29,-19,29,35],['#dcd5cb','#aaa3b4','#d6ced9','#8297b4']));disc(-10,3,2,2,'#40516d');disc(10,3,2,2,'#40516d');disc(0,13,10,8,'#d7c7c1');disc(0,10,3,2,'#5a5b73');line([[-4,17],[0,20],[4,17]],'#657087',1);c.restore();break;
 }
 case 'weeknd':{
  c.save();c.translate(59,436);c.rotate(-.13);poly([[-8,-14],[8,-14],[8,40],[-8,40]],metal([-8,-14,8,40]));disc(0,-21,17,23,metal([-17,-44,17,2],['#d9b9ca','#947b9d','#d6b1c3','#566e94']));for(let j=0;j<7;j++)line([[-13,-37+j*5],[13,-37+j*5]],'#485e7d',.8,.7);line([[0,42],[0,93]],ice,3,.8);halo(0,-21,72,rose,.28);c.restore();break;
 }
 case 'sparta':{
  c.save();c.translate(66,447);c.rotate(-.12);disc(0,0,39,39,metal([-39,-39,39,39],['#ead2a0','#ad8756','#d8b787','#7b684e']));ring(0,0,32,32,gold,1.6,.85);disc(0,0,9,9,'#d5b991');for(let i=0;i<8;i++){const a=i*TAU/8;line([[Math.cos(a)*14,Math.sin(a)*14],[Math.cos(a)*30,Math.sin(a)*30]],'#957d57',1.2,.7);}line([[-24,-28],[24,28]],'#7a684f',1,.3);line([[32,81],[32,-81]],'#a58e74',3);poly([[25,-80],[32,-106],[39,-80],[32,-69]],ice);c.restore();break;
 }
 case 'confusion':{
  c.save();c.translate(1090,66);const turn=q*.36;for(let j=0;j<3;j++){c.save();c.translate(-31+j*31,Math.sin(j+p*2)*7);c.rotate((j-1)*.08+turn);poly([[-16,-26],[16,-26],[21,-17],[21,19],[12,28],[-12,28],[-21,17],[-21,-17]],metal([-21,-26,21,28],['#d8d4e6','#9b9dbf','#d0c7df','#6e86aa']));line([[-8,-5],[0,-12],[8,-7],[6,1],[0,6],[0,12]],'#617491',2);disc(0,20,2,2,'#617491');c.restore();}c.restore();break;
 }
 case 'western':{
  c.save();c.translate(1130,68);c.rotate(-.07);disc(0,10,57,8,metal([-57,2,57,18],['#dfc5a4','#a28a72','#d2b99c','#756c71']));poly([[-30,7],[-22,-26],[-10,-34],[10,-34],[23,-26],[30,7]],metal([-30,-34,30,7],['#e1ccb0','#ae9278','#d8c1a4','#7e756e']));line([[-24,-2],[24,-2]],'#7e7779',6);poly([[-4,-6],[4,-6],[4,2],[-4,2]],ice);c.restore();break;
 }
 case 'rescue':{
  c.save();c.translate(1869,453);halo(0,0,73,ice,.28);ring(0,0,34,34,metal([-34,-34,34,34],['#e5ded4','#9dafbc','#d9e1e2','#72899f']),10);for(let j=0;j<4;j++){const a=j*TAU/4;line([[Math.cos(a)*25,Math.sin(a)*25],[Math.cos(a)*42,Math.sin(a)*42]],rose,7,.9);}curve(u=>[-29+u*58,Math.sin(u*TAU)*6+41],gold,1.2,.6);c.restore();break;
 }
 }
 c.restore();return true;
}
function mintColor(){return '#b5d5b7';}
