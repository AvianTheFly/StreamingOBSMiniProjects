/* Deliberately composed musical instruments. Each scene has a primary silhouette,
 * a restrained palette and separate physical roles for bass, mids and highs.
 * Pure geometry: the motion owner advances all envelopes, springs and history.
 */
(function(root){
 'use strict';
 const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const mix=(a,b,t)=>a+(b-a)*t;
 const Palette=typeof module!=='undefined'&&module.exports?require('./stage_palette.js'):root.VisualPalette;
 const Designs=typeof module!=='undefined'&&module.exports?require('./stage_designs.js'):root.VisualStageDesigns;
 const color=(stage,t,j)=>Palette.color(stage,t,j);
 const neutral={open:.5,twist:0,depth:.5,contour:.5};
 const evolution=j=>j.evolution||neutral;
 function rot(p,x,y,z=0){
  let [a,b,c]=p;[b,c]=[b*Math.cos(x)-c*Math.sin(x),b*Math.sin(x)+c*Math.cos(x)];
  [a,c]=[a*Math.cos(y)+c*Math.sin(y),-a*Math.sin(y)+c*Math.cos(y)];
  return [a*Math.cos(z)-b*Math.sin(z),a*Math.sin(z)+b*Math.cos(z),c];
 }
 function project(p,framing=1){const s=280/(280+p[2])*framing;return [p[0]*s,p[1]*s,p[2]];}
 function sample(a,u){u=clamp(u)*(a.length-1);const i=Math.floor(u);return mix(a[i]||0,a[Math.min(i+1,a.length-1)]||0,u-i);}
 function path(s,pts,col,width,alpha,j,offset=0,key){
  const m=j.motion,colors=[],widths=[],alphas=[];
  for(let i=0;i<pts.length;i++){
   const u=i/(pts.length-1),lane=clamp(u)*7,lo=Math.floor(lane),hi=Math.min(7,lo+1);
   const phase=u*TAU-j.lamp+offset;
   // Interpolate wave values, never accumulating phase angles: adjacent
   // registers may diverge for hours without creating dense light stripes.
   const travel=m.flowPhases?mix(Math.cos(phase-m.flowPhases[lo]*.7),Math.cos(phase-m.flowPhases[hi]*.7),lane-lo):Math.cos(phase);
   const light=.74+.26*Math.pow(.5+.5*travel,3);
   const tension=m.strings?Math.min(1,Math.abs(m.strings.at((pts[i][1]+85)/170*7,(pts[i][0]+180)/360))*.05):0;
   const tick=m.tick*Math.pow(Math.max(0,Math.cos(phase*3)),12);
   colors.push(col.map((v,k)=>mix(v,[.78,.94,1][k],Math.min(.65,tick*.35+tension*.3))));
   const voice=Math.min(7,Math.floor(u*8)),detail=m.details?.[voice]||0,depth=pts[i][2]||0;
   widths.push(width*(1+m.snap*.5+tick*.4+detail*.25+tension*.35)*clamp(1-depth/450,.7,1.15));
   const role=width<.7?.55:1;
   alphas.push(clamp(alpha*role*Math.min(1,light+tension*.16)*clamp(1-depth/220,.48,1.16)*(1+detail*.15),0,.98));
  }
  if(s.stroke)s.stroke(pts,colors,widths,alphas,key);
  else for(let i=1;i<pts.length;i++)s.line(pts[i-1],pts[i],colors[i],widths[i],alphas[i]);
 }
 function circle(r,cx=0,cy=0,n=72){return Array.from({length:n+1},(_,i)=>{const a=i/n*TAU;return [cx+Math.cos(a)*r,cy+Math.sin(a)*r];});}
 function prism(s,w,j){
  const t=j.travel,m=j.motion,e=evolution(j),rings=[];
  const section=(a,r)=>{
   const sector=((a+Math.PI/6)%(Math.PI/3)+Math.PI/3)%(Math.PI/3)-Math.PI/6;
   const hex=Math.cos(Math.PI/6)/Math.cos(sector);
   return r*mix(hex,1,e.contour)*(1+Math.sin(a*3+e.twist)*e.depth*.085);
  };
  for(let n=0;n<11;n++){
   const u=(n/11+t*.13)%1;
   const r=8+Math.pow(u,1.65)*(173+m.spring*37);
   const turn=t*.10+(1-u)*(.42+m.width*.48+e.twist*1.1)+m.snap*.035+(m.dance?.at(3,1-u)||0)*.35;
   const center=[Math.sin(t*.38+(1-u)*e.depth*2)*(1-u)*28+m.balance*(1-u)*11,Math.cos(t*.27)*(1-u)*16*e.open],pts=[];
   for(let i=0;i<=72;i++){
    const a=i/72*TAU,voice=Math.floor((i%72)/9),local=m.presenceVoices?.[voice]??m.voices?.[voice]??0,phase=m.flowPhases?.[voice]||t;
    const rr=section(a,r)*(1+local*.045*Math.sin(a*3+phase*.17)+(m.dance?.at(voice,1-u)||0)*.08);
    const p=rot([Math.cos(a)*rr,Math.sin(a)*rr*(.47+e.open*.3),0],0,0,turn);
    pts.push([center[0]+p[0],center[1]+p[1],(1-u)*190-24]);
   }
   rings.push({u,pts});
  }
  rings.sort((a,b)=>a.u-b.u);
  for(let n=0;n<rings.length;n++){
   const {u,pts}=rings[n],fade=Math.sin(u*Math.PI)**.55;
   const c=n%4===0?color(0,.98,j):color(0,.12+u*.34,j);
   if(n>0){const prev=rings[n-1].pts;
    for(let k=0;k<6;k++){
     const a=k*12,b=(k+1)*12;
     if(k%2===0)s.face([prev[a],pts[a],pts[b],prev[b]],color(0,.15+k/6*.35,j),fade*.16);
     s.line(prev[a],pts[a],color(0,.15,j),.32,fade*.24);
    }
   }
   path(s,pts,c,.55+u*.55,fade*.85,j,u*3);
  }
  // One substantial kick gate, carried forward by the spring rather than a flash.
  const radius=51+m.bass*15+m.spring*58,gate=[];
  for(let i=0;i<=72;i++){const a=i/72*TAU,r=section(a,radius),p=rot([Math.cos(a)*r,Math.sin(a)*r*(.47+e.open*.3),0],0,0,t*.1);gate.push(p);}
  path(s,gate,color(0,1,j),1.1+m.kick*.6,.28+m.kick*.7,j);
 }
 function orbit(s,w,j){
  const t=j.travel,m=j.motion,e=evolution(j),segments=[],traces=[];
  for(let ring=0;ring<5;ring++){
   const local=m.presenceVoices?.[ring+1]??m.voices?.[ring+1]??m.mid,phase=m.flowPhases?.[ring+1]||t;
   const r=34+ring*10+m.bass*9+m.spring*23,c=color(2,ring===1?1:.18+ring*.25,j);
   const inner=[],outer=[];
   for(let i=0;i<=112;i++){
    const g=m.dance?.at(ring+1,.5-.5*Math.cos(i/112*TAU))||0,partner=m.dance?.at(6-ring,.35)||0;
    const a=i/112*TAU,tilt=ring*(.22+e.open*1.05)+t*.12+g*.45,twist=ring*.55-t*.17+m.snap*.12-partner*.4;
    for(const [pts,rad] of [[inner,r-2-local*3.5],[outer,r+2+local*3.5]]){
     const breathing=1+Math.cos(a*2+ring*.45+phase*.09)*e.contour*.16;
     pts.push(project(rot([Math.cos(a)*rad*breathing,Math.sin(a)*rad*(.66+e.open*.45),
      Math.sin(a*2+ring)*e.depth*22+(m.voiceWidths?.[ring+1]||0)*Math.sin(a)*12],tilt,twist+e.twist*.35,t*.08)));
    }
   }
   traces.push({points:outer,c,ring});
   for(let i=0;i<112;i++)segments.push({pts:[inner[i],inner[i+1],outer[i+1],outer[i]],a:outer[i],b:outer[i+1],c,z:outer[i][2],u:i/112,ring,key:`orbit-${ring}-${i}`});
  }
  segments.sort((a,b)=>b.z-a.z);
  for(const q of segments){const depth=clamp(.75-q.z/190,.28,1);s.face(q.pts,q.c,depth*.24,q.key);}
  for(const {points,c,ring} of traces){
   const colors=points.map(()=>c),widths=points.map(()=>.85+m.snap*.3);
   const alphas=points.map((p,i)=>clamp(.75-p[2]/190,.28,1)*(.6+.4*Math.pow(.5+.5*Math.cos(i/112*TAU-j.lamp*1.7+ring),3))*.9);
   if(s.stroke)s.stroke(points,colors,widths,alphas,`ring-${ring}`);
   else for(let i=1;i<points.length;i++)s.line(points[i-1],points[i],c,widths[i],alphas[i]);
  }
  // The low end is the core's mass; mids torque the outer gimbals.
  const r=13+m.bass*11+m.spring*20;
  const core=[[0,-r,0],[r,0,0],[0,0,r],[-r,0,0],[0,0,-r],[0,r,0]].map(p=>project(rot(p,t*.12,t*.17,e.twist*.2)));
  for(const [id,ids] of [[0,[0,1,2]],[1,[0,2,3]],[2,[0,3,4]],[3,[0,4,1]],
    [4,[5,2,1]],[5,[5,3,2]],[6,[5,4,3]],[7,[5,1,4]]]){
   const pts=ids.map(i=>core[i]);s.face(pts,color(2,id/7,j),.57,`orbit-core-${id}`);
   path(s,[...pts,pts[0]],color(2,.85,j),.6,.65,j,id*.4,`orbit-core-${id}`);
  }
 }
 function petals(s,w,j){
  const t=j.travel,m=j.motion,e=evolution(j);
  for(let petal=0;petal<8;petal++){
   const g=m.dance?.at(petal,0)||0,answer=m.dance?.at((petal+1)%8,.28)||0;
   const angle=petal/8*TAU+t*.11+m.snap*.1+(g-answer)*.2,center=28+e.open*23+m.spring*25+m.bass*10+answer*10;
   const width=20+e.contour*18+m.mid*8,height=6+e.open*10+m.width*4;
   const contours=[];
   for(let layer=0;layer<4;layer++){
    const pts=[],scale=1-layer*.16;
    for(let i=0;i<=64;i++){
     const a=i/64*TAU,px=Math.cos(a)*width*scale,py=Math.sin(a)*height*scale;
     const leaf=rot([px,py,Math.sin(a)*e.depth*14],e.twist*.75+g,e.depth*.5+answer*.5, e.twist*.6);
     const p=rot([center+leaf[0],leaf[1],leaf[2]+Math.sin(petal/8*TAU+e.twist)*e.depth*28],Math.sin(t*.14)*.25,0,angle);
     pts.push(project([p[0]*1.45,p[1],p[2]]));
    }contours.push(pts);
   }
   const c=color(5,petal%2===0?.3:1,j);
   // Convex petals, with a clear aperture and only two internal contours.
   s.face(contours[0].slice(0,-1),c,.18);
   for(let layer=0;layer<4;layer++)path(s,contours[layer],c,layer===0?1:.45,layer===0?.85:.4,j,petal*.7+layer*.22);
  }
 }
 function lattice(s,w,j){
  const t=j.travel,m=j.motion,e=evolution(j),grid=[],rows=13,cols=16;
  for(let row=0;row<rows;row++){
   const v=row/(rows-1),line=[],history=j.history[Math.max(0,j.history.length-1-row*3)]||w.bands;
   for(let col=0;col<=cols;col++){
    const u=col/cols,x=(u-.5)*(246+m.width*26+m.spring*22),z=(v-.5)*(105+e.depth*58+m.spring*14);
    const radius=Math.hypot((u-.5)*1.5,v-.5),edge=Math.sin(u*Math.PI)*Math.sin(v*Math.PI);
    const pressure=Math.cos(radius*5-e.open*2)*(12+m.bass*23+m.spring*64);
    const relief=(Math.sqrt(sample(history,u))-.25)*(18+m.snap*17);
    const y=(Math.sin(u*TAU+e.twist)*Math.cos(v*Math.PI)*(6+e.contour*24)+pressure+relief+(m.dance?.at(u*7,v)||0)*26)*edge;
    line.push(project(rot([x,y,z+Math.sin(u*Math.PI)*e.twist*25],.67+e.depth*.24,e.twist*.23,Math.sin(t*.12)*.09),.88));
   }grid.push(line);
  }
  for(let row=rows-1;row>=0;row--){
   const c=color(8,.12+row/(rows-1)*.58,j);
   if(row>0)for(let col=0;col<cols;col+=2)
    s.face([grid[row][col],grid[row][col+1],grid[row-1][col+1],grid[row-1][col]],c,.12,`lattice-cell-${row}-${col}`);
   path(s,grid[row],c,row%3===0?.9:.45,row%3===0?.86:.46,j,row*.24,`lattice-row-${row}`);
  }
  for(let col=0;col<=cols;col++)path(s,grid.map(row=>row[col]),color(8,col%4===0?1:.3,j),col%4===0?.8:.4,
   col%4===0?.8:.42,j,col*.3,`lattice-column-${col}`);
  // Four separated corner brackets frame the floating surface without a HUD.
  for(const [r,c,dr,dc] of [[0,0,1,1],[0,cols,1,-1],[rows-1,0,-1,1],[rows-1,cols,-1,-1]])
   path(s,[grid[r+dr][c],grid[r][c],grid[r][c+dc]],color(8,1,j),1.6,.9,j,r+c,`lattice-corner-${r}-${c}`);
 }
 // Paired rails exchange torsion along the same connected helix rungs.
 function helix(s,w,j){
  const t=j.travel,m=j.motion,e=evolution(j),strands=[];
  for(let strand=0;strand<2;strand++){
   const rails=[[],[],[]];
   for(let i=0;i<=120;i++){
    const u=i/120,env=.68+.32*Math.sin(u*Math.PI),a=u*TAU*(1.35+e.contour*1.1)+strand*Math.PI+t*.3+(m.dance?.at(u*7,u)||0)*.9;
    const voice=Math.min(7,Math.floor(u*8)),local=m.presenceVoices?.[voice]??m.voices?.[voice]??m.mid;
    const radius=(21+e.open*13+m.bass*8+m.spring*29+local*7)*env;
    const wave=(sample(w.wave,u-.02)+sample(w.wave,u)+sample(w.wave,u+.02))/3*(2+m.snap*6),axis=(u-.5)*(250+m.width*22);
    for(let rail=0;rail<3;rail++){
     const r=radius+(rail-1)*(3+local*5);
     rails[rail].push(project(rot([axis,Math.cos(a)*r+Math.sin(u*Math.PI*2)*e.twist*18+wave,
      Math.sin(a)*r*(.55+e.depth*.7+(m.voiceWidths?.[voice]||0)*.2)],-.18-e.twist*.22,e.twist*.25,-.16)));
    }
   }strands.push(rails);
  }
  for(let i=0;i<=120;i+=5){
   const c=color(10,i/120,j),band=sample(w.bands,i/120),a=strands[0][1][i],b=strands[1][1][i];
   s.line(a,b,c,.45+Math.sqrt(band)*.8,.24+Math.sqrt(band)*.48,`helix-rung-${i}`);
  }
  for(let strand=0;strand<2;strand++){
   const rails=strands[strand],c=color(10,strand===0?.2:1,j);
   for(let i=0;i<120;i++)s.face([rails[0][i],rails[0][i+1],rails[2][i+1],rails[2][i]],c,.42,`helix-ribbon-${strand}-${i}`);
   for(let rail=0;rail<3;rail++)path(s,rails[rail],c,rail===1?1.2:.4,rail===1?.95:.36,j,strand*2+rail*.15,`helix-rail-${strand}-${rail}`);
  }
 }
 // A continuous ribbed shell: rounded square sections soften into lobes, the
 // aperture opens and the surface curls in depth. Sparse facets retain air.
 function shell(s,w,j){
  const t=j.travel,m=j.motion,e=evolution(j),major=31+e.open*24+m.spring*34+m.bass*9,minor=16+(1-e.open)*19+m.mid*5;
  const point=(a,b)=>{
   const turn=b+Math.sin(a)*e.twist*.85+(m.dance?.at((.5+.5*Math.sin(a))*7,.5-.5*Math.cos(b))||0)*.65,power=.55+e.contour*.45;
   const signed=x=>Math.sign(x)*Math.pow(Math.abs(x),power);
   const ripple=1+Math.cos(a*3+e.twist)*e.contour*.12;
   const r=(major+signed(Math.cos(turn))*minor)*ripple;
   return project(rot([Math.cos(a)*r*1.25,Math.sin(a)*r,
    signed(Math.sin(turn))*minor*(.65+e.depth*.9)+Math.sin(a*2)*e.twist*18],.35+e.depth*.6,e.twist*.32,t*.055),.8);
  };
  for(let rib=0;rib<12;rib++){
   const a=rib/12*TAU,pts=[];
   for(let i=0;i<=48;i++)pts.push(point(a,i/48*TAU));
   path(s,pts,color(11,rib%3===0?1:.3,j),rib%3===0?.9:.48,rib%3===0?.9:.52,j,rib*.4,`shell-rib-${rib}`);
  }
  for(let latitude=0;latitude<9;latitude++){
   const b=latitude/9*TAU,pts=[];
   for(let i=0;i<=96;i++)pts.push(point(i/96*TAU,b));
   const c=color(11,latitude/8,j);
   path(s,pts,c,latitude%3===0?1:.5,latitude%3===0?.94:.5,j,latitude*.5,`shell-latitude-${latitude}`);
   if(latitude%3===0)for(let i=0;i<48;i++){
    const a=i/48*TAU,next=(i+1)/48*TAU;
    s.face([point(a,b),point(next,b),point(next,b+.12),point(a,b+.12)],c,.15,`shell-panel-${latitude}-${i}`);
   }
  }
 }
 const designs=Designs.create({TAU,mix,color,path,project,rot,evolution});
 const renderers=[prism,designs.vortex,orbit,designs.folded,designs.aurora,petals,
  designs.knot,designs.medusa,lattice,designs.mandala,helix,shell];
 // A coherent displacement field lets every authored silhouette carry the
 // sustained spectrum. Identical points stay joined, including facet edges;
 // it never invents an onset, advances a clock, or changes primitive identity.
 // Local musical motion is subordinate to the scene's authored silhouette.
 // Fluid contours can bend farther than rigid towers or recognizable animals.
 const bendLimits=[6,9,5,4,7,5,6,8,6,4.5,6,5];
 function flowingPoint(p,m,stage){
  if(!m.strings)return p;
  const x=p[0],y=p[1],z=p[2]||0,u=(x+180)/360,lane=(y+85)/170*7;
  const limit=bendLimits[stage],wave=limit*Math.tanh(m.strings.at(lane,u)*.60/limit);
  const slope=m.strings.at(lane,u+.018)-m.strings.at(lane,u-.018);
  const row=clamp(Math.round(lane),0,7),width=m.voiceWidths[row];
  const edge=clamp((105-Math.abs(y))/24)*clamp((187-Math.abs(x))/30);
  // No signal-dependent global magnification: it used to amplify the warp
  // again at the outer edges. Depth and lateral strain have their own budgets.
  const dx=limit*.18*Math.tanh(slope/8)*edge,dz=wave*width*.65*edge;
  const texture=((m.roughness||0)*.85+(m.grain||0)*.18)*(m.body||0);
  const vibration=Math.sin(x*.48+y*.035-(m.texturePhase||0))*texture*Math.min(2.4,limit*.45)*edge;
  const relief=wave*edge+vibration*(1-Math.abs(wave*edge)/limit);
  return [x-dx,y+relief,z+dz+vibration*width*.3];
 }
 function render(stage,sink,world,journey){
  const point=p=>flowingPoint(p,journey.motion,stage);
  const performed={
   line(a,b,c,width,alpha,key){sink.line(point(a),point(b),c,width,alpha,key);},
   face(points,c,alpha,key){sink.face(points.map(point),c,alpha,key);}
  };
  if(sink.stroke)performed.stroke=(points,c,width,alpha,key)=>sink.stroke(points.map(point),c,width,alpha,key);
  renderers[stage](performed,world,journey);
 }
 const api={render,palettes:Palette.families,deform:flowingPoint,bendLimits:Object.freeze(bendLimits)};
 root.VisualStages=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
