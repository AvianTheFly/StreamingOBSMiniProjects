/* Continuous spectral counterpoint surrounding the authored main sculpture.
 * Eight fixed voices, matched paths through every scene, no particles or clocks.
 * Musical memory supplies relief; current sound supplies each path's leading edge. */
(function(root){
 'use strict';
 const Palette=typeof module!=='undefined'&&module.exports?require('./stage_palette.js'):root.VisualPalette;
 const TAU=Math.PI*2,mix=(a,b,t)=>a+(b-a)*t;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
 function camera(j){
  const yaw=clamp(j.space?.yaw||0,-.72,.72),tilt=clamp(j.space?.tilt||0,-.46,.46),roll=clamp(j.space?.roll||0,-.18,.18);
  const ca=Math.cos(yaw),sa=Math.sin(yaw),cb=Math.cos(tilt),sb=Math.sin(tilt),cr=Math.cos(roll),sr=Math.sin(roll);
  // A fixed lens and framing keep orbit motion from masquerading as musical
  // zoom. The full allowed XYZ orbit fits the same authored foreground volume.
  const focal=500,framing=.475,pivot=18;
  const rotate=p=>{
   // Undo each stage's authored projection before rotating real XYZ positions.
   const z=p[2]||0,s=(280+z)/280,x=p[0]*s,y=p[1]*s;
   const xx=x*ca+(z-pivot)*sa,zz=(z-pivot)*ca-x*sa,yy=y*cb-zz*sb,depth=zz*cb+y*sb+pivot;
   const scale=focal/Math.max(48,focal+depth);
   return [(xx*cr-yy*sr)*scale,(xx*sr+yy*cr)*scale,depth];
  };
  const view=p=>{const q=rotate(p);return [q[0]*framing,q[1]*framing,q[2]];};
  // Inverse rigid view basis, column-major for the shader. Surface grain uses
  // model coordinates so a turning camera cannot drag it across the sculpture.
  const basis=Object.freeze([ca*cr-sa*sb*sr,-cb*sr,sa*cr+ca*sb*sr,
   ca*sr+sa*sb*cr,cb*cr,sa*sr-ca*sb*cr,-sa*cb,sb,ca*cb]);
  view.lens=Object.freeze({focal,framing,pivot,basis});return view;
 }
 function view(p,j){return camera(j)(p);}
 function route(stage,voice,u,m,e,space){
  const lane=(voice-3.5)/3.5,phase=m.flowPhases[voice]||0,env=Math.sin(Math.PI*u);
  const local=(m.absoluteVoices?m.presenceVoices:m.voices)[voice];
  const history=space.at(voice,(1-u)*3.8,local);
  const stereo=m.voiceWidths[voice],pan=m.voiceBalances[voice];
  const relief=(history-.2)*env*(10+space.complexity*14);
  let x,y,z;
  if(stage===6||stage===8){
   // A perspective circuit floor with separate frequency lanes and memory relief.
   x=(u-.5)*365;y=70+lane*11-relief;
   z=70+voice*13+Math.sin(u*Math.PI)*space.depth*36;
   y+=Math.sin(u*TAU+phase*.17)*env*(2+local*7);
  }else if([1,7,9,10].includes(stage)){
   x=(u-.5)*375;y=lane*(46+stereo*8)+Math.sin(u*TAU*(.6+e.contour*.45)+phase*.21)*env*(7+local*17)+relief;
   z=80+lane*32+Math.sin(u*TAU+voice*.65+e.twist)*space.depth*48;
  }else if(stage===4){
   x=(u-.5)*380;y=58+voice*5-Math.sin(u*Math.PI)*(18+history*22)+Math.sin(u*8+phase*.13)*env*6;
   z=90+voice*15+stereo*35;
  }else if(stage===13){
   const side=voice<4?-1:1,v=voice%4;
   x=side*(20+u*(108+v*10))+Math.sin(u*5+phase*.18)*env*8;
   y=69-u*(87+v*9)-relief;z=75+v*17+stereo*34+Math.sin(u*Math.PI)*20;
  }else{
   const a=u*TAU+voice*.17+phase*.06,r=116+lane*17+history*12;
   x=Math.cos(a)*r*1.55;y=Math.sin(a)*(56+lane*9)+Math.sin(a*2+e.twist)*env*9;
   z=85+Math.sin(a)*(26+space.depth*37)+voice*6;
   if(stage===0){x*=.83;y*=1.08;z+=u*36;}
  }
  x+=pan*env*(9+stereo*12);
  // The audible register comes nearer; quieter registers sit behind it.
  z+=Math.abs(voice/7-space.focus)*24;
  const projection=280/(280+z);return [x*projection,y*projection,z];
 }
 function render(s,w,j){
  const m=j.motion,space=j.space;if(!space)return;
  const e=j.evolution,progress=j.transitioning?j.blend:0,stage=progress>=1?j.next:j.stage;
  const blend=progress>=1?0:progress,items=[];
  const voices=m.absoluteVoices?m.presenceVoices:m.voices,power=voices.reduce((sum,v)=>sum+v*v,0);
  for(let voice=0;voice<8;voice++){
   const points=[],colors=[],widths=[],alphas=[],local=(m.absoluteVoices?m.presenceVoices:m.voices)[voice],detail=m.details[voice];
   const head=((m.flowPhases[voice]*.11)%1+1)%1;
   const ca=Palette.color(stage,voice/7,j),cb=Palette.color(j.next,voice/7,j);
   // Allocate emphasis to prominent held registers, with a fixed floor and
   // absolute amplitude. Quiet music cannot normalize into a bright light show.
   const salience=local*local/Math.max(.15,power);
   const base=ca.map((v,k)=>mix(v,cb[k],blend));
   for(let i=0;i<=64;i++){
    const u=i/64,a=route(stage,voice,u,m,e,space),b=blend>0?route(j.next,voice,u,m,e,space):a;
    const point=a.map((v,k)=>mix(v,b[k],blend));points.push(point);
    const glint=Math.exp(-(((u-head)/.045)**2))*Math.sin(Math.PI*head)**2;
    colors.push(base.map((v,k)=>mix(v,[.91,.97,1][k],glint*(.18+detail*.35))));
    widths.push(Math.min(.62,.22+local*.16+salience*local*.10+glint*(.12+detail*.12)));
    alphas.push((.02+local*.065+salience*local*.16+glint*local*.12)*Math.sin(Math.PI*u)**.6);
   }
   items.push({points,colors,widths,alphas,z:points.reduce((v,p)=>v+p[2]/points.length,0)});
  }
  items.sort((a,b)=>b.z-a.z);
  for(const p of items)if(s.stroke)s.stroke(p.points,p.colors,p.widths,p.alphas,'spectral-counterpoint');
  else for(let i=1;i<p.points.length;i++)s.line(p.points[i-1],p.points[i],p.colors[i],p.widths[i],p.alphas[i]);
 }
 function material(points,c,j,lens=camera(j).lens){
  if(points.length<3)return c;
  const p=points.slice(0,3).map(v=>{const z=v[2]||0,s=Math.max(48,lens.focal+z)/lens.focal/lens.framing;return [v[0]*s,v[1]*s,z];});
  const a=p[1].map((v,k)=>v-p[0][k]),b=p[2].map((v,k)=>v-p[0][k]);
  const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const length=Math.hypot(...n);if(length<1e-6)return c;
  const light=Math.abs((n[0]*-.36+n[1]*-.47+n[2]*.8)/length);
  const sheen=Math.pow(light,12)*(.1+(j.motion.high||0)*.14),shade=.45+light*.45;
  return c.map((v,k)=>clamp(v*shade+sheen*[.88,.95,1][k]));
 }
 const api={render,view,camera,material};root.VisualDepth=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
