/* Authored flowing ensembles. Components share seams, orbits and musical
 * gesture histories so interaction belongs to the design, not an overlay. */
(function(root){
 'use strict';
 function create({TAU,mix,color,path,project,rot,evolution}){
  const voice=(m,i)=>{
   const lane=Math.max(0,Math.min(7,i)),a=Math.floor(lane),b=Math.min(7,a+1),levels=m.presenceVoices||m.voices||[];
   return mix(levels[a]||0,levels[b]||0,lane-a);
  };
  const gesture=(m,i,u=0)=>m.dance?.at(i,u)||0;
  const flow=(m,i)=>m.dance?.flow[i]??m.flowPhases?.[i]??0;
  function ribbon(s,rails,c,j,key,alpha=.22,edgeColor=c){
   for(let i=1;i<rails[0].length;i++)s.face([rails[0][i-1],rails[0][i],rails[1][i],rails[1][i-1]],c,alpha,`${key}-skin-${i}`);
   for(let side=0;side<2;side++)path(s,rails[side],side?edgeColor:c,side?.85:1.05,side?.75:.9,j,side*.8,key+'-'+side);
  }
  function vortex(s,w,j){
   const m=j.motion,e=evolution(j),throat=14+e.open*14+(m.spring||0)*25;
   // Three connected spiral sails pull around one throat. Their shared centre
   // sways with the mid voice; individual registers alter twist and separation.
   for(let arm=0;arm<3;arm++){
    const rails=[[],[]],lane=arm*2+1,peer=((arm+1)%3)*2+1,v=voice(m,lane),phase=flow(m,lane);
    for(let i=0;i<=80;i++)for(let side=0;side<2;side++){
     const u=i/80,g=gesture(m,lane,u),answer=gesture(m,peer,Math.min(1,u+.2)),envelope=Math.sin(u*Math.PI);
     const angle=u*TAU*(.7+e.contour*.7)+arm*TAU/3+j.travel*.18+(g-answer)*1.3;
     const r=throat+Math.pow(u,1+e.open*.65)*85+envelope*((side?5:-5)*(1+v)+(g+answer)*20);
     const z=(1-u)*(50+e.depth*85)-24+Math.sin(angle+phase*.25)*u*18+envelope*(g-answer)*40;
     rails[side].push(project([Math.cos(angle)*r*1.15,Math.sin(angle)*r*.63+gesture(m,3,u)*8,z]));
    }
    ribbon(s,rails,color(1,arm===1?1:.15+arm*.2,j),j,'vortex-'+arm,.24);
   }
  }
  function folded(s,w,j){
   const m=j.motion,e=evolution(j),nodes=[],tops=[];
   // Adjacent panels share the exact hinge. A note rolls along the connected
   // fan, passing its fold into the next panel with the gesture history.
   for(let i=0;i<=8;i++){
    const lane=Math.min(7,i),g=gesture(m,lane,.12*i)+gesture(m,3,i/8)*.8-gesture(m,7-lane,i/8)*.35;
    const angle=(i-4)*(.14+e.open*.09)+g*.65;
    nodes.push([-132+i*33,18+Math.sin(i*.7+j.travel*.18)*12+g*18,Math.sin(angle)*50]);
    const fold=(i%2?1:-1)*(.55+e.depth*.6)+g*.7,lift=40+e.open*25+voice(m,lane)*22+(m.spring||0)*32,p=nodes[i];
    tops.push([p[0],p[1]-Math.cos(fold)*lift,p[2]+Math.sin(fold)*lift]);
   }
   for(let i=0;i<8;i++){
    const p=[nodes[i],nodes[i+1],tops[i+1],tops[i]].map(q=>project(rot(q,-.16,e.twist*.2)));
    const c=color(3,i===3||i===6?1:.18+i*.06,j);
    s.face(p,c,.48,`fold-panel-${i}`);path(s,[...p,p[0]],c,1,.85,j,i*.2,`fold-edge-${i}`);
    path(s,[p[0],p[2]],c,.4,.3,j,i*.3,`fold-crease-${i}`);
   }
  }
  function aurora(s,w,j){
   const m=j.motion,e=evolution(j);
   // Two pairs orbit shared centre-lines. Their separation rotates in YZ so
   // every crossing actually passes over/under; partner notes torque the braid.
   for(let curtain=0;curtain<4;curtain++){
    const rails=[[],[]];
    for(let i=0;i<=88;i++)for(let side=0;side<2;side++){
     const u=i/88,pair=Math.floor(curtain/2),sign=curtain%2?1:-1,lane=pair*3+1,peer=lane+1;
     const g=gesture(m,lane,u*.7),answer=gesture(m,peer,.25+u*.65),env=Math.sin(Math.PI*u);
     const phase=u*TAU*(.85+e.contour*.65)+j.travel*.23+pair*1.4;
     const braid=u*TAU*(1+e.depth*.45)-(flow(m,lane)+flow(m,peer))*.25+(g-answer)*2;
     const radius=14+e.open*8+(g+answer)*12;
     const height=Math.sin(phase)*(18+e.open*24+(m.spring||0)*30)+(g+answer)*20;
     const width=(4+voice(m,lane+curtain%2)*10)*env;
     const z=(pair-.5)*48+Math.cos(phase)*15+sign*Math.sin(braid)*radius*1.6;
     rails[side].push(project([(u-.5)*292,height+sign*Math.cos(braid)*radius+(side?1:-1)*width,z]));
    }
    ribbon(s,rails,color(4,curtain%2?1:.18,j),j,'aurora-'+curtain,.26);
   }
  }
  function knot(s,w,j){
   const m=j.motion,e=evolution(j),rails=[[],[]];
   // One unbroken trefoil with three over/under crossings. Pitch-directed
   // torsion rolls the ribbon around its centreline; opposite lobes trade pull.
   for(let i=0;i<=144;i++)for(let side=0;side<2;side++){
    const u=i/144,a=u*TAU,lane=(.5+.5*Math.sin(a))*7,age=.5-.5*Math.cos(a);
    const g=gesture(m,lane,age),answer=gesture(m,7-lane,1-age);
    const r=60+(m.spring||0)*24+(20+e.open*12)*Math.cos(a*3+j.travel*.10);
    const twist=a*3+e.twist+(g-answer)*2.4,edge=(side?1:-1)*(4+voice(m,lane)*7)*(1+.2*Math.sin(a*3-flow(m,3)*.3));
    const p=[Math.cos(a*2)*(r+edge*Math.cos(twist))*1.3,Math.sin(a*2)*(r+edge*Math.cos(twist))*.7,
     (24+e.depth*20)*Math.sin(a*3+j.travel*.10)+edge*Math.sin(twist)+(g+answer)*22];
    rails[side].push(project(rot(p,.25+e.depth*.25,e.twist*.25,j.travel*.04)));
   }
   ribbon(s,rails,color(6,.23,j),j,'infinity',.4,color(6,1,j));
   // A thin accent follows the same closed ribbon, never detaches from it.
   const seam=rails[0].map((p,i)=>p.map((v,k)=>mix(v,rails[1][i][k],.5)));
   path(s,seam,color(6,.65,j),.55,.5,j,1.2,'infinity-seam');
  }
  function medusa(s,w,j){
   const m=j.motion,e=evolution(j),radius=55+e.open*21+(m.spring||0)*26;
   const rim=a=>[Math.cos(a)*radius,Math.sin(a)*radius*.23-8,Math.sin(a)*radius*.6+gesture(m,3,1)*8];
   const rings=[];
   for(let layer=0;layer<7;layer++){
    const q=layer/6,pts=[];
    for(let i=0;i<=72;i++){
     const a=i/72*TAU,r=Math.sin(q*Math.PI/2)*radius;
     pts.push(project([Math.cos(a)*r,-8-Math.cos(q*Math.PI/2)*(43+e.depth*15)+Math.sin(a)*r*.23,
      Math.sin(a)*r*.6+gesture(m,3,q)*8]));
    }rings.push(pts);
    path(s,pts,color(7,layer===6?1:.2+q*.3,j),layer===6?1.1:.45,layer===6?.9:.4,j,q,'canopy-'+layer);
   }
   for(let rib=0;rib<8;rib++){
    const a=rib/8*TAU,origin=rim(a),peer=rib%2?rib-1:rib+1,partnerOrigin=rim(peer/8*TAU),pts=[];
    const center=origin.map((v,k)=>(v+partnerOrigin[k])*.5),dx=origin[0]-center[0],dz=origin[2]-center[2];
    for(let i=0;i<=64;i++){
     const u=i/64,g=gesture(m,rib,u),partner=gesture(m,peer,Math.min(1,u+.18)),curl=u*u;
     const braid=curl*(5+e.depth*3)-(flow(m,rib)+flow(m,peer))*.2*u+(g-partner)*u*2;
     const cs=Math.cos(braid),sn=Math.sin(braid),separation=1-u*.25;
     pts.push(project([center[0]*(1-u*.3)+(dx*cs-dz*sn)*separation+(g+partner)*u*20,
      origin[1]+u*(82+voice(m,rib)*18)-curl*12+Math.cos(u*5+flow(m,rib)*.3)*curl*10,
      center[2]*(1-u*.4)+(dx*sn+dz*cs)*separation+Math.sin(u*5+rib-rib%2)*curl*18]));
    }
    path(s,pts,color(7,rib%2?1:.28,j),1,.86,j,rib*.4,'tendril-'+rib);
    const meridian=rings.map(p=>p[rib*9]);path(s,meridian,color(7,.3,j),.55,.55,j,rib,'canopy-rib-'+rib);
   }
  }
  function mandala(s,w,j){
   const m=j.motion,e=evolution(j);
   // Counter-rotating rosettes create a continuous moire weave. Inner and outer
   // loops exchange their lobes through opposing frequency gesture histories.
   for(let layer=0;layer<6;layer++){
    const pts=[],sign=layer%2?1:-1,lane=layer+1,peer=layer%2?lane-1:lane+1;
    const phase=(flow(m,lane)+flow(m,peer))*.12*sign;
    for(let i=0;i<=144;i++){
     const a=i/144*TAU,petals=layer%2?5:3;
     const age=.5+.5*Math.sin(a),g=gesture(m,lane,age),answer=gesture(m,peer,1-age);
     const r=34+layer*7+(m.spring||0)*25+(13+e.open*15+(g-answer)*15)*Math.cos(a*petals+phase+e.twist*.5);
     const exchange=(g+answer)*22;
     pts.push(project(rot([Math.cos(a+phase)*r*1.15,Math.sin(a+phase)*r*.83,
      sign*(12+e.depth*17)*Math.sin(a*2+phase)+exchange],e.twist*.18,.2+e.depth*.25)));
    }
    path(s,pts,color(9,layer===1||layer===4?1:.15+layer*.08,j),layer%2?.8:1,.83,j,layer*.5,'rosette-'+layer);
   }
  }
  return {vortex,folded,aurora,knot,medusa,mandala};
 }
 root.VisualStageDesigns={create};if(typeof module!=='undefined'&&module.exports)module.exports={create};
})(globalThis);
