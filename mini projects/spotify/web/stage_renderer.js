/* Bounded crisp geometry renderer. One GPU program/buffer/VAO; no bloom,
 * history textures or stationary lights. Canvas uses the same compositions.
 * The caller owns frame scheduling and this renderer's disposal.
 */
(function(root){
 'use strict';
 const CAPACITY=120000,STRIDE=10,WIDTH=1200,HEIGHT=660;
 function bodyScale(m){
  const presence=m.pacing.sustainedPresence??m.pacing.presence;
  // Immediate expansion belongs to a measured low-frequency attack. The
  // released spring moves local structure; it cannot invert the onset's size.
  return .96+presence*.16+m.kick*.09+Math.max(0,m.spring)*.025;
 }
 function compose(sink,world,journey){
  const camera=VisualDepth.camera(journey);
  const decorate=target=>{
   // Preserve space around metadata and give every stage a gradual edge exit.
   const expression=journey.motion.pacing;
   // The sculpture breathes with the phrase. A released bass impulse moves
   // its mass; stereo and individual voices remain local, readable details.
   const mass=bodyScale(journey.motion);
   const m=journey.motion,vibration=Math.sin(m.texturePhase||0)*(m.roughness||0)*m.body;
   const roll=(m.sway||0)+vibration*.006,cos=Math.cos(roll),sin=Math.sin(roll);
   const point=p=>{
    const x=p[0]*mass*(1+(expression.expanse-.4)*.08),y=p[1]*mass*(1-expression.swell*.06);
    return camera([x*cos-y*sin+m.balance*5,x*sin+y*cos+expression.release*4-m.spring*26+m.kick*4+vibration*.7,
     (p[2]||0)*(.75+expression.fullness*.3+expression.expanse*.15)]);
   };
   const grade=c=>c.map((v,i)=>v*(1-journey.warmth*.05)+[1,.7,.43][i]*journey.warmth*.05);
   const ink=.20+.80*Math.pow(journey.energy,.45),surfaceInk=.15+.85*Math.pow(journey.energy,.7);
   const adapter={
    line(a,b,c,width,alpha,key){target.line(point(a),point(b),grade(c),width,
     Math.min(.98,alpha*1.35)*ink*(width<.7?.35+expression.fullness*.5:1),key);},
    face(points,c,alpha,key){const posed=points.map(point);target.face(posed,grade(c),Math.min(.88,alpha*1.5)*surfaceInk,key);}
   };
   if(target.stroke)adapter.stroke=(points,colors,widths,alphas,key)=>target.stroke(points.map(point),colors.map(grade),widths,
    alphas.map((a,i)=>Math.min(.98,a*1.45)*ink*(widths[i]<.7?.35+expression.fullness*.5:1)),key);
   return adapter;
  };
  VisualDepth.render(decorate(sink),world,journey);
  VisualMorph.render(sink,world,journey,decorate);
  return camera.lens;
 }
 class Renderer{
  constructor(options={}){
   this.direct=!!options.canvas;this.canvas=options.canvas||document.createElement('canvas');this.canvas.width=WIDTH;this.canvas.height=HEIGHT;
   this.gl=this.canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,preserveDrawingBuffer:!this.direct});
   if(!this.gl)throw Error('WebGL2 unavailable');
   this.resources=[];this.vertices=new Float32Array(CAPACITY*STRIDE);this.ordered=new Float32Array(CAPACITY*STRIDE);
   this.strokeSides=new Float64Array((CAPACITY/6+1)*5);
   this.commands=[];this.count=0;this.frames=0;this.lost=false;this.disposed=false;
   this.coverageCopies=true;
   this.onLost=e=>{e.preventDefault();this.lost=true;};this.onRestore=()=>this.dispose();
   this.canvas.addEventListener('webglcontextlost',this.onLost);this.canvas.addEventListener('webglcontextrestored',this.onRestore);
   try{this.initialize();}catch(error){this.dispose();throw error;}
  }
  own(kind,value){this.resources.push([kind,value]);return value;}
  initialize(){
   const gl=this.gl;
   const sources=[`#version 300 es
   precision highp float;
   layout(location=0) in vec2 position;layout(location=1) in vec4 tint;layout(location=2) in float edge;layout(location=3) in float copies;
   layout(location=4) in vec2 surface;
   uniform vec3 lens;uniform mat3 textureBasis;
   out vec4 C;out float E;out vec2 P;out float N;out vec3 V;out float K;out vec2 T;out float H;
   void main(){C=tint;E=edge;P=position;N=copies;K=surface.y;
   V=vec3(position*max(48.,lens.x+surface.x)/lens.x/lens.y,surface.x);
   H=lens.x/max(48.,lens.x+surface.x);T=(textureBasis*(V-vec3(0,0,lens.z))).xy*H;
   gl_Position=vec4(position*vec2(1./200.,-1./110.),0,1);}`,
   `#version 300 es
   precision highp float;in vec4 C;in float E;in vec2 P;in float N;in vec3 V;in float K;in vec2 T;in float H;
   uniform vec4 music;uniform vec3 textureState;out vec4 color;
   void main(){float aa=max(fwidth(E),.04);
   float coverage=1.-smoothstep(1.-aa,1.,abs(E));
   float margin=(1.-smoothstep(184.,196.,abs(P.x)))*(1.-smoothstep(97.,106.,abs(P.y)));
   float alpha=C.a*coverage*margin;
   if(N>1.)alpha=1.-pow(max(0.,1.-alpha),1./N);
   vec3 tint=C.rgb;
   if(K>.5){
    vec3 normal=cross(dFdx(V),dFdy(V));normal/=max(length(normal),.00001);
    normal*=normal.z<0.?-1.:1.;
    vec3 light=normalize(vec3(-.38+music.y*.12,-.48,.82));
    float diffuse=abs(dot(normal,light));
    float reflection=pow(max(0.,dot(reflect(-light,normal),vec3(0,0,1))),18.);
    float rim=pow(1.-abs(normal.z),3.);
    // Analytic light on real facets. No blur, feedback, noise or bloom pass.
    tint=tint*(.48+diffuse*.5)+vec3(.88,.95,1.)*(reflection*(.07+music.z*.14)*(1.-textureState.x*.75)+rim*.04);
    // Rational interpolation keeps the material fixed inside tilted facets,
    // while contour coverage and clip-space geometry retain their crisp edges.
    vec2 model=T/max(.01,H);
    float tooth=.5+.5*sin(model.x*.7+model.y*.18-textureState.z);
    float ridges=smoothstep(.62,.82,tooth);
    tint*=mix(1.,.85+.2*ridges,textureState.y*.7+textureState.x*.3);
   }
   color=vec4(clamp(tint,0.,1.)*alpha,alpha);}`];
   const shaders=[];
   try{
    for(let i=0;i<2;i++){
     const shader=gl.createShader(i===0?gl.VERTEX_SHADER:gl.FRAGMENT_SHADER);shaders.push(shader);
     gl.shaderSource(shader,sources[i]);gl.compileShader(shader);
     if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
    }
    this.program=this.own('Program',gl.createProgram());for(const shader of shaders)gl.attachShader(this.program,shader);
    gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
   this.materialState=gl.getUniformLocation(this.program,'music');
   this.lensState=gl.getUniformLocation(this.program,'lens');
   this.textureState=gl.getUniformLocation(this.program,'textureState');
   this.textureBasis=gl.getUniformLocation(this.program,'textureBasis');
   }finally{for(const shader of shaders)gl.deleteShader(shader);}
   this.vao=this.own('VertexArray',gl.createVertexArray());gl.bindVertexArray(this.vao);
   this.buffer=this.own('Buffer',gl.createBuffer());gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
   gl.bufferData(gl.ARRAY_BUFFER,this.vertices.byteLength,gl.DYNAMIC_DRAW);
   for(const [location,size,offset] of [[0,2,0],[1,4,2],[2,1,6],[3,1,7],[4,2,8]]){
    gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,STRIDE*4,offset*4);
   }
   gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
   gl.clearColor(0,0,0,0);
  }
  vertex(p,c,alpha,edge,copies=1,material=0){
   this.vertexValues(p[0],p[1],p[2]||0,c,alpha,edge,copies,material);
  }
  vertexValues(x,y,z,c,alpha,edge,copies=1,material=0){
   if(this.count>=CAPACITY)throw Error('Stage geometry capacity exceeded');
   let i=this.count++*STRIDE;
   this.vertices[i++]=x;this.vertices[i++]=y;
   this.vertices[i++]=c[0];this.vertices[i++]=c[1];this.vertices[i++]=c[2];
   this.vertices[i++]=alpha;this.vertices[i++]=edge;this.vertices[i++]=copies;
   this.vertices[i++]=z;this.vertices[i]=material;
  }
  batch(start,z,kind=1){
   if(this.count>start)this.commands.push({start,end:this.count,z,kind});
  }
  line(a,b,c,width,alpha){
   if(alpha<.002)return;const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
   if(length<.001)return;
   const start=this.count;
   const nx=-dy/length*width,ny=dx/length*width;
   const p=[a[0]-nx,a[1]-ny,a[2]||0],q=[a[0]+nx,a[1]+ny,a[2]||0],r=[b[0]-nx,b[1]-ny,b[2]||0],s=[b[0]+nx,b[1]+ny,b[2]||0];
   this.vertex(p,c,alpha,-1);this.vertex(q,c,alpha,1);this.vertex(r,c,alpha,-1);
   this.vertex(r,c,alpha,-1);this.vertex(q,c,alpha,1);this.vertex(s,c,alpha,1);
   this.batch(start,((a[2]||0)+(b[2]||0))/2);
  }
  stroke(points,colors,widths,alphas,key,copies=1){
   // Continuous mitered strip: adjoining segments share the exact same edge.
   // This avoids pinholes, square joins and bright overlap nodes on curved paths.
   const n=points.length,closed=n>2&&Math.hypot(points[0][0]-points[n-1][0],points[0][1]-points[n-1][1])<1e-5;
   const sides=this.strokeSides;if(n*5>sides.length)throw Error('Stage contour capacity exceeded');
   for(let i=0;i<n;i++){
    const p=points[i],prev=points[i===0?(closed?n-2:0):i-1],next=points[i===n-1?(closed?1:n-1):i+1];
    let ax=p[0]-prev[0],ay=p[1]-prev[1],bx=next[0]-p[0],by=next[1]-p[1];
    const al=Math.sqrt(ax*ax+ay*ay),bl=Math.sqrt(bx*bx+by*by);
    if(al<1e-6){ax=bx;ay=by;}if(bl<1e-6){bx=ax;by=ay;}
    const a=(al<1e-6?bl:al)||1,b=(bl<1e-6?(al<1e-6?bl:al):bl)||1;
    let nx=-ay/a-by/b,ny=ax/a+bx/b;const length=Math.sqrt(nx*nx+ny*ny)||1;nx/=length;ny/=length;
    const dot=Math.max(.5,nx*(-by/b)+ny*(bx/b)),width=widths[i]/dot;
    const k=i*5;sides[k]=p[0]-nx*width;sides[k+1]=p[1]-ny*width;
    sides[k+2]=p[0]+nx*width;sides[k+3]=p[1]+ny*width;sides[k+4]=p[2]||0;
   }
   let start=this.count,z=0;
   for(let i=0;i<n-1;i++){
    const a=i*5,b=(i+1)*5;
    this.vertexValues(sides[a],sides[a+1],sides[a+4],colors[i],alphas[i],-1,copies);
    this.vertexValues(sides[a+2],sides[a+3],sides[a+4],colors[i],alphas[i],1,copies);
    this.vertexValues(sides[b],sides[b+1],sides[b+4],colors[i+1],alphas[i+1],-1,copies);
    this.vertexValues(sides[b],sides[b+1],sides[b+4],colors[i+1],alphas[i+1],-1,copies);
    this.vertexValues(sides[a+2],sides[a+3],sides[a+4],colors[i],alphas[i],1,copies);
    this.vertexValues(sides[b+2],sides[b+3],sides[b+4],colors[i+1],alphas[i+1],1,copies);
    z+=((points[i][2]||0)+(points[i+1][2]||0))/2;
    if(i%8===7||i===n-2){this.batch(start,z/(i%8+1));start=this.count;z=0;}
   }
  }
  face(points,c,alpha,key,copies=1){
   for(let i=1;i<points.length-1;i++){
    const start=this.count,triangle=[points[0],points[i],points[i+1]];
    for(const p of triangle)this.vertex(p,c,alpha,0,copies,1);
    this.batch(start,triangle.reduce((v,p)=>v+(p[2]||0)/3,0),0);
   }
  }
  paint(ctx,world,journey){
   if(this.disposed||this.lost||this.gl.isContextLost())return false;
   this.count=0;this.commands.length=0;const lens=compose(this,world,journey);
   // Transparent facets and contours share one back-to-front order. Far-side
   // lines no longer float over the front of a sculpture. Buffers stay fixed.
   this.commands.sort((a,b)=>b.z-a.z||a.kind-b.kind);let offset=0;
   for(const q of this.commands){const data=this.vertices.subarray(q.start*STRIDE,q.end*STRIDE);this.ordered.set(data,offset);offset+=data.length;}
   const gl=this.gl;gl.viewport(0,0,WIDTH,HEIGHT);gl.clear(gl.COLOR_BUFFER_BIT);
   gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
   gl.uniform3f(this.lensState,lens.focal,lens.framing,lens.pivot);
   gl.uniformMatrix3fv(this.textureBasis,false,lens.basis);
   gl.uniform4f(this.materialState,journey.motion.tonal,journey.motion.balance,journey.motion.high,journey.travel);
   gl.uniform3f(this.textureState,(journey.motion.roughness||0)*journey.motion.body,
    (journey.motion.grain||0)*journey.motion.body,journey.motion.texturePhase||0);
   gl.bufferSubData(gl.ARRAY_BUFFER,0,this.ordered.subarray(0,this.count*STRIDE));gl.drawArrays(gl.TRIANGLES,0,this.count);
   if(ctx)ctx.drawImage(this.canvas,-200,-110,400,220);this.frames++;return true;
  }
  dispose(){
   if(this.disposed)return;this.disposed=true;
   this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.removeEventListener('webglcontextrestored',this.onRestore);
   for(const [kind,resource] of this.resources)this.gl['delete'+kind](resource);this.resources.length=0;
  }
  status(){return {available:!this.disposed&&!this.lost,frames:this.frames,resources:this.resources.length,vertices:this.count,capacity:CAPACITY,resolution:[WIDTH,HEIGHT],direct:this.direct,bloom:false};}
 }
 function fallback(ctx,world,journey){
  ctx.save();ctx.beginPath();ctx.rect(-190,-103,380,206);ctx.clip();ctx.lineCap='round';ctx.lineJoin='round';
  const color=(c,a)=>`rgba(${c.map(v=>Math.round(v*255)).join(',')},${a})`;
  const lens=VisualDepth.camera(journey).lens;
  compose({
   line(a,b,c,width,alpha){ctx.strokeStyle=color(c,alpha);ctx.lineWidth=width*2;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();},
   face(points,c,alpha){ctx.fillStyle=color(VisualDepth.material(points,c,journey,lens),alpha);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();}
  },world,journey);ctx.restore();
 }
 Renderer.fallback=fallback;Renderer.bodyScale=bodyScale;root.VisualStageRenderer=Renderer;
})(globalThis);
