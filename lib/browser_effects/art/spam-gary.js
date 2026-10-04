function spamGary(c,t,d,e){
 const {p,sprite,local,line,disc,curve,poly,ring,bubble,metal}=spamInk(c,t,d,e);
 const rose='#efa8c4',cyan='#94e0ee',lemon='#e8df87',violet='#bdb1e2';
 const meow=smooth((p-.16)/.12)*(1-smooth((p-.78)/.12));
 sprite('gary',0,112,350,208,{alpha:1-meow});
 sprite('gary',1,112,350-Math.sin(p*Math.PI)*7,208,{alpha:meow});
 sprite('gary',2,1807,495,218,{flip:true,angle:Math.sin(p*4)*.025});
 sprite('gary',0,636+p*22,75,140,{angle:.01});
 sprite('gary',1,1241,72,137,{flip:true});
 sprite('gary',2,725,1000,157);sprite('gary',0,1305-p*26,1006,168,{flip:true});
 // Pearlescent slime carries shell-colored glints along Gary's actual route.
 for(let j=0;j<3;j++)curve(u=>[354+u*1210,1049+j*5+Math.sin(u*12-p*2+j)*3],[cyan,lemon,rose][j],2-j*.45,.42);
 for(let j=0;j<8;j++){
  const yy=226+j*57-p*24; bubble(35+Math.sin(j+p*2)*17,yy,6+j%3*3,cyan,.67);
  bubble(1888+Math.sin(j-p*2)*14,yy+19,5+j%3*3,rose,.58);
 }
 const jelly=(x,y,s,phase)=>local(x,y+Math.sin(p*5+phase)*6,s,Math.sin(p*3+phase)*.08,()=>{
  for(let j=0;j<4;j++)curve(u=>[-17+j*11+Math.sin(u*7+p*6+phase+j)*5,8+u*38],j%2?rose:cyan,1.4,.65);
  c.beginPath();c.moveTo(-29,8);c.bezierCurveTo(-33,-36,34,-36,29,8);c.quadraticCurveTo(0,20,-29,8);
  c.fillStyle=metal([-30,-27,30,14],['#fff0f3',rose,'#8c8dbc','#edbad9']);c.fill();
  ring(0,8,29,7,'#e6effc',1.2,.7);disc(-9,-9,3,3,lemon,.65);
 });
 jelly(92,596,.72,0);jelly(1819,285,.78,1.1);jelly(1057,65,.6,2);
 const biscuit=(x,y,s,angle)=>local(x,y,s,angle,()=>{
  poly([[-18,0],[-30,-12],[-30,12]],'#d9ac65');disc(0,0,21,11,metal([-21,-11,21,11],['#f6e2aa','#d9ac65','#eed091','#bc9264']));
  disc(12,-3,1.5,1.5,'#936c52');curve(u=>[-7+u*8,-7+Math.sin(u*Math.PI)*4],'#fff0c9',1,.65);
 });
 for(let j=0;j<9;j++)biscuit(380+j*144,22+Math.sin(p*3+j)*7,.30,j*.7+p*.3);
 for(let j=0;j<5;j++)biscuit(1822+Math.sin(j)*35,605+j*19-p*29,.3+j%2*.08,j+p);
 for(let j=0;j<3;j++)ring(177,347,20+j*12+p*16,10+j*6,lemon,1.1,meow*.42);
}
