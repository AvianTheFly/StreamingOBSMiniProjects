// Counted combat achievements have different silhouettes and one finite reveal.
export function doubleFistMotion(p){return {reach:19*(1-smooth((p-.13)/.39)),y:8};}
export function tripleStarMotion(p,index){const q=smooth((p-.39-index*.045)/.26),radius=14,foot=radius*Math.cos(Math.PI/5);return {q,y:21-Math.sin(q*Math.PI)*65-q*foot,radius,foot,support:21};}
function storyCombos(c,e){
 const keys=['double_kill','triple_kill','quadra_kill','pentakill','ace'];if(!keys.includes(e.key))return false;
 const I=storyInk(c,e),{p,at,line,poly,oval,ring,box,star,face,curve,bean,burst}=I;
 const open=smooth((p-.13)/.39),finish=smooth((p-.64)/.2),count={double_kill:2,triple_kill:3,quadra_kill:4,pentakill:5,ace:5}[e.key];
 const number=(x,y,n,col)=>at(x,y,1,0,()=>{c.font='600 23px Georgia';c.textAlign='center';c.fillStyle=col;c.fillText(String(n),0,0);});
 if(e.key==='double_kill'){
  at(95,421,1.2,0,()=>{
   for(const s of [-1,1])at(s*(43-open*17),0,1,s*(-.22+open*.22),()=>{
    poly([[-19,-50],[19,-50],[19,6],[0,23],[-19,6]],s<0?'#9acbd2':'#dab496');line([[-12,-43],[12,-43]],'#e7d6af',2);
    star(0,-16,14,'#e4d3aa');line([[0,24],[0,59]],'#b7cbbb',3);oval(0,62,11,5,'#c2d2b5');
   });
   curve(u=>[-48+u*96,48+Math.sin(u*Math.PI)*open*18],'#b0c9c3',3);number(0,6,2,'#ecd6a4');
  });
  at(1827,595,1.12,0,()=>{const m=doubleFistMotion(p);for(const s of [-1,1]){bean(s*(37-open*13),19,1,s<0?'#a7cbd3':'#d4b49c',finish*.7);line([[s*26,19],[s*m.reach,m.y]],'#d9c6aa',7);}burst(0,8,(p-.49)/.2,'#dcd09e',35);});
 }else if(e.key==='triple_kill'){
  at(95,424,1.18,0,()=>{
   for(let j=0;j<3;j++){const q=smooth((p-.13-j*.06)/.3);at(0,52,1,(j-1)*q*.48,()=>{
    line([[0,0],[0,-90*q]],['#a8cbd1','#d9ba9a','#c2aed2'][j],7);poly([[0,-112*q],[-13,-76*q],[0,-67*q],[13,-76*q]],['#b5d5d7','#e4c49e','#d1bbdf'][j]);
    line([[-19,-38*q],[19,-38*q]],'#e4d3b2',4);
   });}box(-27,51,54,17,'#a6bdb7');number(0,34,3,'#e5d2a5');
  });
  at(1826,585,1.15,0,()=>{poly([[-49,39],[-49,21],[49,21],[49,39]],'#bba5cc');for(let j=0;j<3;j++){const m=tripleStarMotion(p,j);star((j-1)*32,m.y,m.radius,['#a9ccd5','#ddbc93','#c6afd8'][j],(1-m.q)*.3);}face(0,51);});
 }else if(e.key==='quadra_kill'){
  at(95,429,1.2,open*Math.PI/2,()=>{
   for(let j=0;j<4;j++)at(0,0,1,j*Math.PI/2,()=>{poly([[-16,-18],[-23,-35-open*29],[0,-43-open*38],[23,-35-open*29],[16,-18]],['#aacdd2','#d0b391','#c4acd5','#abc5ad'][j]);line([[0,-25],[0,-41-open*25]],'#e8d5b0',2);});
   ring(0,0,24,24,'#daca9d',3);star(0,0,14,'#ead7ab');
  });number(95,517,4,'#d6c3a2');
  at(1826,587,1.15,0,()=>{for(let j=0;j<4;j++){const a=Math.PI/4+j*Math.PI/2,q=smooth((p-.33-j*.04)/.28);star(Math.cos(a)*(15+q*41),Math.sin(a)*(15+q*41),14,['#aacdd2','#d0b391','#c4acd5','#abc5ad'][j],a);}bean(0,12,.85,'#b4c9b6',finish);});
 }else if(e.key==='pentakill'){
  // A small flat concert nods to League's Pentakill band, without glossy materials.
  at(95,446,1.18,0,()=>{
   const strum=Math.sin(smooth((p-.34)/.19)*Math.PI);
   bean(0,14,1.5,'#b6a1cc',strum*.8);poly([[-25,-38],[-29,-60],[-9,-48],[0,-70],[9,-48],[29,-60],[25,-38]],'#dac292');
   at(8,35,1,-.54,()=>{poly([[-23,9],[-29,-9],[-13,-26],[-3,-13],[12,-25],[26,-5],[20,19],[0,29]],'#b29cc8');box(-5,-75,10,64,'#cabb98');poly([[-7,-75],[-9,-92],[11,-92],[7,-75]],'#d1bc94');for(let j=0;j<5;j++)line([[-3+j*1.5,-88],[-3+j*1.5,20]],'#e6d1b3',.8);oval(0,2,8,9,'#786a90');});
   line([[-24,14],[-5,35],[20-strum*24,26+strum*11]],'#d5c4ad',7);number(-38,75,5,'#e3cca1');
  });
  at(1826,579,1.16,0,()=>{for(let j=0;j<5;j++){const a=-Math.PI/2+j*TAU/5,q=smooth((p-.18-j*.035)/.35);poly([[Math.cos(a)*12,Math.sin(a)*12],[Math.cos(a)*(28+q*29),Math.sin(a)*(28+q*29)],[Math.cos(a+.36)*22,Math.sin(a+.36)*22]],j%2?'#c6afd5':'#d7bd95');}ring(0,0,24,25,'#ded0aa',2);star(0,0,19,'#e3cb95');face(0,42);});
  for(let j=0;j<5;j++){const q=smooth((p-.23-j*.065)/.22);at(596+j*182,74,1,0,()=>{line([[0,-24],[0,-8]],'#aaadc2',2);oval(0,0,11,13,['#a5c8d4','#cbb0d1','#dbc098','#a6c9b5','#c7b5d2'][j]);c.save();c.globalAlpha*=q;star(0,0,7,'#e9d3a5');c.restore();});}
 }else{
  // Clean sweep: five earned stars are swept into one cup, not a second pentakill.
  at(95,438,1.16,0,()=>{poly([[-40,-19],[40,-19],[27,27],[0,40],[-27,27]],'#c2cdb2');line([[0,39],[0,65]],'#cbbd95',7);box(-26,63,52,13,'#b4c6c6');for(let j=0;j<5;j++){const q=smooth((p-.21-j*.025)/.3);star((j-2)*16*(1-q),-72+q*56,10,['#d9c28e','#a7c9d2','#c3afd2'][j%3]);}face(0,6);});
  at(1826,582,1.15,0,()=>{const m=aceSweepMotion(p),sweep=smooth((p-.31)/.27);line([[-60,63],[62,63]],'#a8c4b7',2);at(m.x,0,1,m.a,()=>{line([[0,-47],[0,44]],'#c9b892',5);poly([[-18,38],[18,38],[25,61],[-24,61]],'#d8c79d');for(let j=0;j<5;j++)line([[-14+j*7,44],[-19+j*9,58]],'#ad9e83',1);});for(let j=0;j<5;j++)star(-24+j*15+sweep*19,57-sweep*(j%3),5,'#d1c69d');c.save();c.globalAlpha*=m.speck;poly([[49,54],[56,54],[56,60],[49,60]],'#d3bdd1');c.restore();});
  for(let j=0;j<5;j++)bean(594+j*183,92,.68,['#a8cbd2','#c2afd5','#d4bc97','#acc9b0','#b9bfd3'][j],finish);
 }
 for(let j=0;j<count;j++){const q=smooth((p-.36-j*.035)/.31),x=618+j*(count===2?550:count===3?340:count===4?232:177);at(x,1046-Math.sin(q*Math.PI)*14,1,(1-q)*.3,()=>{if(e.key==='pentakill'){line([[0,8],[0,-12],[12,-9]],'#d8c293',3);oval(-4,9,6,4,'#c3abd4');}else if(e.key==='ace')poly([[-12,-15],[12,-15],[12,6],[0,15],[-12,6]],'#c1cdb6');else star(0,0,9+count,'#d7c49c');});}
 return true;
}
