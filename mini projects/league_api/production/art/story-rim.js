// Event-specific peripheral motion. Open contours and sparse particles, no panels.
function storyRim(c,e){
 const I=storyInk(c,e),{t,p,finite,at,line,poly,oval,ring,curve,star,heart,trim}=I,key=e.key||'';
 if(key==='dragon_hextech')return;
 const element=key.startsWith('dragon_')?key.slice(7):null;
 const structure=['turret_destroyed','first_turret','inhibitor_destroyed','inhibitor_respawned','inhibitor_respawning_soon'].includes(key);
 const spirit=key==='respawn'||key==='death'||key==='ultimate_learned';
 const signature=STORY_MOTIFS[key]||['rune','#b9afd0','#d6c9a5'],cool=[signature[1],signature[2],signature[1],signature[2]];
 const xy=(side,u,depth)=>side===0?[342+u*1236,depth]:side===1?[1920-depth,210+u*614]:side===2?[1578-u*1236,1080-depth]:[depth,824-u*614];
 c.save();c.globalAlpha*=finite?.78:.35;
 for(let side=0;side<4;side++){
  const col=spirit?['#91c3ad','#dda17c','#baa6d2','#99c7d0'][side]:element?({earth:'#c3bea3',fire:'#dfaf85',water:'#9bcdd0',air:'#b4d4dd',chemtech:'#b8ca99',elder:'#c5c3d7'}[element]||cool[side]):cool[side];
  if(structure){
   const restored=key==='inhibitor_respawned',waiting=key==='inhibitor_respawning_soon',m=structureChoreography(p,restored),grow=waiting?.5:restored?m.join:m.grow,crush=waiting||restored?0:m.crush;
   // Four short masonry phrases, never a continuous solid wall.
   for(let j=0;j<9;j++){
    const u=.08+j*.1,[x,y]=xy(side,u,22+Math.sin(j*1.4)*7+crush*13);
    at(x,y,1,side*Math.PI/2+crush*Math.sin(j)*.6,()=>{
     const height=5+grow*(12+j%3*4)*(1-crush*.85);
     if(key.includes('inhibitor'))poly([[0,-height-7*grow],[-10,-height*.35],[0,6],[10,-height*.35]],col+'88',col,1.4);else poly([[-13,0],[-9,-height],[0,-height-7*grow],[10,-height+3],[15,1],[0,5]],col+'70',col,1.4);if(key==='first_turret'&&crush>.5&&j%3===1)ring(0,-8,5,5,'#deca9d',1.5,crush);
     if(crush>0)line([[-16,-2],[0,-9-crush*7],[17,-1]],col,1.2,.6*(1-crush*.6));
    });
   }
  }else if(spirit){
   const rise=key==='death'?.15:spiritChoreography(p,side).rise;
   const path=u=>{const [x,y]=xy(side,u,24);return side%2?[x+Math.sin(u*TAU*2+t*.7)*11,y]:[x,y+Math.sin(u*TAU*2+t*.7)*11];};
   curve(path,col,2,.65);
   for(let j=0;j<8;j++){
    const [x,y]=path(.08+j*.12);at(x,y,.55+rise*.1,side*Math.PI/2+Math.sin(t*.7+j)*.15,()=>{
     if(side===0){oval(0,0,15,5,col+'99');line([[-10,0],[10,0]],col,1.1);}
     else if(side===1){poly([[0,-20],[7,-5],[2,15],[-6,8],[-7,-6]],col+'aa',col,1);line([[0,-13],[0,13]],'#e1c799',1);}
     else if(side===2){curve(u=>{const a=u*TAU*1.5,r=17*(1-u);return[Math.cos(a)*r,Math.sin(a)*r];},col,1.6,.8);}
     else{oval(0,5,6,5,col+'a0');for(let n=0;n<3;n++)oval(-7+n*7,-5,3,4,col+'a0');}
    });
   }
  }else if(element){
   // Layered elemental currents surround the principal habitat props.
   for(let strand=0;strand<2;strand++)curve(u=>{const [x,y]=xy(side,u,17+strand*10),wave=Math.sin(u*(element==='earth'?23:13)-t*(element==='fire'?1.5:.75)+strand)*8;return side%2?[x+wave,y]:[x,y+wave];},col,element==='water'?3:1.6,strand?.28:.65);
   for(let j=0;j<8;j++){
    const born=storyParticleProgress(p,j,.08,.047,.53);if(finite&&!born.visible)continue;const travel=finite?born.phase:(t*.06+j*.127)%1,[x,y]=xy(side,travel,36+Math.sin(j+t)*7);
    c.save();c.globalAlpha*=Math.sin(travel*Math.PI)*.7;
    at(x,y,.7,side*Math.PI/2+Math.sin(t*.6+j)*.2,()=>{
     if(element==='fire')poly([[-3,7],[0,-9],[5,5]],'#ddbc93',null);
     else if(element==='water')ring(0,0,4+j%3,4+j%3,col,1.3);
     else if(element==='air')curve(u=>[-12+u*24,Math.sin(u*Math.PI)*6],col,2);
     else if(element==='earth')poly([[-7,1],[-2,-5],[6,-3],[8,4],[-3,6]],col+'a0',col,1);
     else if(element==='chemtech'){ring(0,0,6,6,col,1.4);oval(-1,-1,2,2,'#cddab9');}
     else star(0,0,5,col,t*.1);
    });c.restore();
   }
  }else{
   const kind=signature[0],travel=finite?smooth((p-.12-side*.025)/.62):.5;
   const fn=u=>{const [x,y]=xy(side,u,22),wave=kind==='pulse'||kind==='clutch'?Math.sin(u*TAU*4)*6:kind==='music'?Math.sin(u*TAU*3)*4:kind==='steps'?Math.abs(Math.sin(u*TAU*3))*7:Math.sin(u*TAU*1.5)*7;return side%2?[x+wave,y]:[x,y+wave];};
   curve(fn,col,1.7,.45);
   // One authored phrase travels once and settles; semantic glyphs develop in place.
   for(let j=0;j<16;j++){const u=travel-j*.014;if(u<0||u>1)continue;line([fn(Math.max(0,u-.014)),fn(u)],col,3,(1-j/16)*.8);}
   for(let j=0;j<5;j++){
    const reveal=finite?smooth((p-.09-side*.02-j*.032)/.24):1,u=.12+j*.185,[x,y]=xy(side,u,39);
    c.save();c.globalAlpha*=reveal*.85;
    at(x,y,.62,side*Math.PI/2,()=>{storyMotif(I,key,j,reveal);if(key.startsWith('possible_')&&j%3===1){line([[21,-8],[26,-12],[32,-8],[27,-1],[27,3]],signature[2],1.3);oval(27,8,1,1,signature[2]);}});c.restore();
   }
  }
 }
 c.restore();
}
