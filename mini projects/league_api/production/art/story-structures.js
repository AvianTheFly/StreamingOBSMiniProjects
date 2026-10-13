// Architecture grows into eccentric shapes, then collapses into settled rubble.
function storyStructures(c,e){
 if(!['turret_destroyed','first_turret','inhibitor_destroyed','inhibitor_respawning_soon','inhibitor_respawned'].includes(e.key))return false;
 const I=storyInk(c,e),{p,t,at,line,poly,oval,ring,box,star,face,burst,trim,coin}=I;
 const restoring=e.key==='inhibitor_respawned',waiting=e.key==='inhibitor_respawning_soon',tower=e.key.includes('turret'),first=e.key==='first_turret';
 const col=tower?'#b4c7b5':'#b9a1da',m=structureChoreography(p,restoring);trim(col,'stone');
 for(const side of [0,1])at(side?1825:95,side?563:432,side?.92:1.18,0,()=>{
  oval(0,80,62,10,'#77919a44');line([[-67,81],[65,81]],'#8daba6',3);
  if(waiting){
   for(let j=0;j<5;j++){const a=j*TAU/5+t*.35;at(Math.cos(a)*36,Math.sin(a)*47-8,1,a,()=>poly([[0,-16],[12,0],[0,18],[-12,0]],col));}
   ring(0,-8,63,72,'#94c8d0',2,.65);at(0,61,1,0,()=>{box(-23,-16,46,27,'#e1d2a4');face(0,-3,'sleep');});
   line([[0,-8],[Math.sin(t)*29,-31]],'#e1d2a4',3);
  }else{
   const base=tower?6:5;
   for(let j=0;j<base;j++){
    const a=(j%2?1:-1),dx=a*m.spread*(.4+j*.1),y=65-j*(tower?24:27)*m.height+m.crush*(j%2?3:-3);
    at(dx,y,1,a*m.crush*(.1+j*.06),()=>{
     if(tower){const w=29+(j%2?m.grow*13:-m.grow*3);poly([[-w,-16],[w,-16],[w+6,6],[-w-6,6]],j%2?'#d2c7aa':col);line([[-w+7,-9],[w-7,-9]],'#8f9c90',2);}
     else poly([[0,-32*m.height-9],[24,0],[0,21],[-24,0]],j%2?'#d3b4e4':col);
    });
   }
   if(tower)at(m.crush*22,-94*m.height+48*m.crush,1,m.crush*.4,()=>{poly([[-45,0],[-45,-26],[-28,-26],[-28,-9],[-10,-9],[-10,-35],[10,-35],[10,-9],[28,-9],[28,-26],[45,-26],[45,0]],'#cbbd98');face(0,-10,m.crush>.5?'sad':'happy');});
   // The impact originates at the collapsed foundation; dust settles once.
   burst(0,76,(p-.43)/.27,'#d9c9a3',63);
   if(m.crush>0)for(let j=0;j<5;j++){const q=smooth((p-.49)/.27);c.save();c.globalAlpha*=Math.sin(q*Math.PI)*.46;I.puff(-44+j*22,76-q*17,.48,'#e3d5b7');c.restore();}
   if(restoring){for(let j=0;j<4;j++)star((j-1.5)*25,28-m.join*90,5,'#e3d3a1',t*.2+j);}
   if(first){const reward=smooth((p-.57)/.18);for(let j=0;j<5;j++)coin((j-2)*21,69-Math.sin(reward*Math.PI)*69-j%2*12,.8);star(0,-35,13,'#e9ca88',-.1);}
  }
 });
 // Echo the same structural transformation along the rim, never across gameplay.
 for(let j=0;j<9;j++)at(454+j*126,1037,1,0,()=>{
  const q=waiting?.4+.1*Math.sin(t+j):restoring?m.join:m.grow*(1-m.crush*.82);
  poly([[-18,13],[-12,-q*24],[0,-q*39],[12,-q*24],[18,13]],col);
  if(!waiting&&!restoring)line([[-19-m.crush*7,14],[19+m.crush*7,14]],'#b7c6b7',2);
 });
 return true;
}
