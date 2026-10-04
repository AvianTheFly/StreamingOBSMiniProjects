/* Precise contour sculpture: cut ribbon surfaces and antialiased light paths.
 * No bloom, feedback or blurred history. No clocks or audio capture live here.
 * Render to a private canvas so a lost/unavailable WebGL context can fall back
 * to the existing Canvas material without replacing the visible canvas.
 */
(function(root){
 'use strict';
 const ROWS=9,COLS=129,STRIDE=10,WIDTH=1200,HEIGHT=660;
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const vertex=`#version 300 es
 precision highp float;
 layout(location=0) in vec3 position;
 layout(location=1) in vec3 normal;
 layout(location=2) in vec4 material;
 out vec3 N;out vec4 M;out vec3 P;
 void main(){P=position;N=normal;M=material;
  gl_Position=vec4(position.xy*vec2(1.0/200.0,1.0/110.0),position.z/220.0,1.0);}
 `;
 const material=`#version 300 es
 precision highp float;
 in vec3 N;in vec4 M;in vec3 P;out vec4 color;
 uniform vec4 music;uniform vec3 phases;uniform float hue;uniform float body;
 vec3 palette(float h){vec3 p=abs(fract(vec3(h)+vec3(0.0,.666667,.333333))*6.0-3.0);
  return mix(vec3(1.0),clamp(p-1.0,0.0,1.0),.84);}
 void main(){
  vec3 n=normalize(N);if(n.z<0.0)n=-n;
  float rim=pow(1.0-abs(n.z),3.0);
  vec3 l=normalize(vec3(cos(phases.x*.45)*.5,sin(phases.y*.38)*.55,1.0));
  vec3 l2=normalize(vec3(sin(phases.z*.26)*.8,-.6,.5));
  float spec=pow(max(dot(n,normalize(l+vec3(0,0,1))),0.0),38.0);
  float film=hue+dot(n,l2)*.025;
  vec3 pigment=palette(film);
  float fold=.32+.68*abs(dot(n,l));
  float light=M.w;
  // Cut a real transparent gap between ribbons. The negative space keeps each
  // contour legible through crossings and prevents a translucent soap-bubble look.
  float lane=fract(M.y*8.0),aa=max(fwidth(lane),.008);
  float cut=smoothstep(.10-aa,.10+aa,lane)*(1.0-smoothstep(.80-aa,.80+aa,lane));
  float opacity=clamp(M.z*(1.1+body*.3),0.0,.78)*cut;
  vec3 ink=vec3(.022,.037,.050);
  vec3 radiance=mix(ink,pigment,.14+fold*.26+light*.18);
  radiance+=vec3(.73,.9,1.0)*spec*(.35+light*.7+music.y*.25)+pigment*rim*.2;
  opacity*=1.0-smoothstep(95.0,97.0,length(P.xy));
  color=vec4(radiance*opacity,opacity);
 }`;
 const ribbonVertex=`#version 300 es
 precision highp float;
 layout(location=0) in vec3 position;
 layout(location=1) in vec3 tint;
 layout(location=2) in vec2 edge;
 out vec3 C;out vec2 E;
 void main(){C=tint;E=edge;gl_Position=vec4(position.xy/vec2(200,110),position.z/220.0,1);}`;
 const ribbonFragment=`#version 300 es
 precision highp float;in vec3 C;in vec2 E;out vec4 color;
 void main(){float aa=max(fwidth(E.x),.08);
  float alpha=(1.0-smoothstep(1.0-aa,1.0,abs(E.x)))*E.y;
  color=vec4(C*alpha,alpha);}`;
 const quadVertex=`#version 300 es
 precision highp float;out vec2 uv;
 void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.0-1.0,0,1);}`;
 const compositeFragment=`#version 300 es
 precision highp float;in vec2 uv;out vec4 color;
 uniform sampler2D image;
 void main(){
  vec4 s=texture(image,uv);
  vec3 emitted=s.rgb;
  float alpha=clamp(s.a,0.0,1.0);
  if(alpha<.001){color=vec4(0);return;}
  vec3 linear=emitted/alpha;
  // Filmic shoulder keeps kick accents colored rather than clipping to white.
  vec3 mapped=1.0-exp(-linear*1.32);
  color=vec4(pow(mapped,vec3(.82))*alpha,alpha);
 }`;
 function rgb(h){
  return [0,2/3,1/3].map(offset=>.16+.84*clamp(Math.abs(((h+offset)%1+1)%1*6-3)-1));
 }
 class Radiance{
  constructor(){
   this.canvas=document.createElement('canvas');this.canvas.width=WIDTH;this.canvas.height=HEIGHT;
   this.gl=this.canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,preserveDrawingBuffer:true});
   if(!this.gl)throw Error('WebGL2 unavailable');
   this.resources=[];this.lost=false;this.disposed=false;this.frames=0;
   this.onLost=e=>{e.preventDefault();this.lost=true;};
   // A restored context invalidates every old handle. Recreate on the next paint.
   this.onRestored=()=>{this.dispose();};
   this.canvas.addEventListener('webglcontextlost',this.onLost);
   this.canvas.addEventListener('webglcontextrestored',this.onRestored);
   try{this.initialize();}catch(error){this.dispose();throw error;}
  }
  own(kind,value){this.resources.push([kind,value]);return value;}
  program(vs,fs){
   const gl=this.gl,compile=(type,source)=>{
    const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error);}
    return s;
   };
   const v=compile(gl.VERTEX_SHADER,vs);let f,p;
   try{f=compile(gl.FRAGMENT_SHADER,fs);p=this.own('Program',gl.createProgram());
    gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;
   }finally{gl.deleteShader(v);if(f)gl.deleteShader(f);}
  }
  target(width,height){
   const gl=this.gl,texture=this.own('Texture',gl.createTexture()),framebuffer=this.own('Framebuffer',gl.createFramebuffer());
   gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete visualizer framebuffer');
   return {width,height,texture,framebuffer};
  }
  initialize(){
   const gl=this.gl;
   this.material=this.program(vertex,material);this.ribbon=this.program(ribbonVertex,ribbonFragment);
   this.composite=this.program(quadVertex,compositeFragment);
   this.uniforms=new Map();
   this.vertices=new Float32Array(ROWS*COLS*STRIDE);
   const indices=new Uint16Array((ROWS-1)*(COLS-1)*6);let j=0;
   for(let r=0;r<ROWS-1;r++)for(let i=0;i<COLS-1;i++){
    const a=r*COLS+i,b=a+COLS;indices.set([a,b,a+1,a+1,b,b+1],j);j+=6;
   }
   this.meshVAO=this.own('VertexArray',gl.createVertexArray());gl.bindVertexArray(this.meshVAO);
   this.meshBuffer=this.own('Buffer',gl.createBuffer());gl.bindBuffer(gl.ARRAY_BUFFER,this.meshBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.vertices.byteLength,gl.DYNAMIC_DRAW);
   this.indices=indices;this.patches=Array.from({length:128},(_,i)=>({row:Math.floor(i/16),start:i%16*8,depth:0}));
   this.element=this.own('Buffer',gl.createBuffer());gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.element);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.DYNAMIC_DRAW);this.indexCount=indices.length;
   for(const [location,size,offset] of [[0,3,0],[1,3,3],[2,4,6]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,40,offset*4);}
   // Fixed capacity covers every strand, rim, and five-segment particle trail.
   this.ribbons=new Float32Array(22000*8);this.ribbonCount=0;
   this.ribbonVAO=this.own('VertexArray',gl.createVertexArray());gl.bindVertexArray(this.ribbonVAO);
   this.ribbonBuffer=this.own('Buffer',gl.createBuffer());gl.bindBuffer(gl.ARRAY_BUFFER,this.ribbonBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.ribbons.byteLength,gl.DYNAMIC_DRAW);
   for(const [location,size,offset] of [[0,3,0],[1,3,3],[2,2,6]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,32,offset*4);}
   this.quadVAO=this.own('VertexArray',gl.createVertexArray());
   this.scene=this.target(WIDTH,HEIGHT);
   gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
  }
  uniform(program,name){
   let map=this.uniforms.get(program);if(!map){map=new Map();this.uniforms.set(program,map);}
   if(!map.has(name))map.set(name,this.gl.getUniformLocation(program,name));return map.get(name);
  }
  bind(target){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,target?.framebuffer||null);gl.viewport(0,0,target?.width||WIDTH,target?.height||HEIGHT);}
  texture(program,name,target,unit){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,target.texture);gl.uniform1i(this.uniform(program,name),unit);}
  segment(a,b,width,tint,alpha,depth=0){
   if(alpha<.003)return;
   const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
   if(length<.001||length>35)return; // Never draw a wrapped/open trajectory seam.
   const nx=-dy/length*width,ny=dx/length*width;
   for(const [p,side] of [[a,-1],[a,1],[b,-1],[b,-1],[a,1],[b,1]]){
    const offset=this.ribbonCount++*8;
    if(offset+8>this.ribbons.length)throw Error('Visualizer ribbon budget exceeded');
    this.ribbons.set([p[0]+nx*side,p[1]+ny*side,p[2]??depth,...tint,side,alpha],offset);
   }
  }
  upload(world,edge){
   const energy=world.f.energy**.3,hue=world.hue/360,scale=1.3;this.ribbonCount=0;
   // Depth-sort a fixed 128 patches so translucent crossing folds read correctly.
   for(const p of this.patches){const a=world.strands[p.row],b=world.strands[p.row+1],s=p.start;
    p.depth=(a[s][2]+a[s+8][2]+b[s][2]+b[s+8][2])*.25;}
   this.patches.sort((a,b)=>b.depth-a.depth);let k=0;
   for(const p of this.patches)for(let i=p.start;i<p.start+8;i++){
    const a=p.row*COLS+i,b=a+COLS;this.indices.set([a,b,a+1,a+1,b,b+1],k);k+=6;
   }
   for(let row=0;row<ROWS;row++){
    const line=world.strands[row],level=world.levels[row]**.32*energy;
    for(let i=0;i<COLS;i++){
     const p=line[i],before=line[Math.max(0,i-1)],after=line[Math.min(COLS-1,i+1)];
     const upper=world.strands[Math.max(0,row-1)][i],lower=world.strands[Math.min(ROWS-1,row+1)][i];
     const ax=after[0]-before[0],ay=after[1]-before[1],az=after[2]-before[2];
     const bx=lower[0]-upper[0],by=lower[1]-upper[1],bz=lower[2]-upper[2];
     const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,length=Math.hypot(nx,ny,nz)||1;
     const u=i/(COLS-1),light=world.lightAt(row,u),offset=(row*COLS+i)*STRIDE;
     this.vertices.set([p[0]*scale,p[1]*scale,p[2],nx/length,ny/length,nz/length,u,row/8,level,light],offset);
     if(i<COLS-1&&level>.015){
      const b=line[i+1],accent=world.attacks[row]*light;
      const tint=row===0?[1,.43+accent*.22,.19]:rgb(hue+(row-4)*.004).map(v=>v*.75+.24);
      const depth=clamp(.82-p[2]/110,.35,1);
      const alpha=clamp(level*(1.2+light*1.6)+accent*.2)*depth;
      this.segment([p[0]*scale,p[1]*scale,p[2]],[b[0]*scale,b[1]*scale,b[2]],.48+light*.13,tint,alpha);
     }
    }
   }
   // Two open waveform arcs frame the sculpture without enclosing it in a blob.
   for(let i=0;i<edge.length;i++){
    if(i%128<20||i%128>108)continue;
    const row=Math.floor(i/edge.length*9)%9,u=i/edge.length,light=world.lightAt(row,u),level=Math.sqrt(world.levels[row]);
    const tint=rgb(hue).map(v=>v*.6+.3),alpha=energy*(.24+level*light*.4);
    this.segment(edge[i],edge[(i+1)%edge.length],.3,tint,alpha,-70);
   }
   const weight=.16+world.style[2]*.25;
   for(let index=0;index<world.particles.length;index+=6){
    const p=world.particles[index];
    const light=world.lightAt(p.row,p.u),strength=Math.sqrt(world.levels[p.row])*weight*(.22+light*.8)*energy;
    if(light<.65||strength<.035)continue;const tint=[.78,.92,1];
    this.segment([p.x*scale-.6,p.y*scale],[p.x*scale+.6,p.y*scale],.35,tint,strength,-80);
   }
   const gl=this.gl;
   gl.bindBuffer(gl.ARRAY_BUFFER,this.meshBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.vertices);
   gl.bindBuffer(gl.ARRAY_BUFFER,this.ribbonBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.ribbons.subarray(0,this.ribbonCount*8));
   gl.bindVertexArray(this.meshVAO);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.element);gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER,0,this.indices);
  }
  paint(ctx,world,edge){
   if(this.lost||this.disposed||this.gl.isContextLost())return false;
   const gl=this.gl;this.upload(world,edge);this.bind(this.scene);gl.clear(gl.COLOR_BUFFER_BIT);
   gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(this.material);gl.bindVertexArray(this.meshVAO);
   gl.uniform4f(this.uniform(this.material,'music'),world.performance.presence,world.performance.impact,world.f.treble,world.f.width);
   gl.uniform3fv(this.uniform(this.material,'phases'),world.phase);
   gl.uniform1f(this.uniform(this.material,'hue'),world.hue/360);
   gl.uniform1f(this.uniform(this.material,'body'),world.style[1]);
   gl.drawElements(gl.TRIANGLES,this.indexCount,gl.UNSIGNED_SHORT,0);
   gl.blendFunc(gl.ONE,gl.ONE);gl.useProgram(this.ribbon);gl.bindVertexArray(this.ribbonVAO);gl.drawArrays(gl.TRIANGLES,0,this.ribbonCount);
   gl.disable(gl.BLEND);gl.bindVertexArray(this.quadVAO);
   this.bind(null);gl.useProgram(this.composite);this.texture(this.composite,'image',this.scene,0);gl.drawArrays(gl.TRIANGLES,0,3);
   ctx.drawImage(this.canvas,-200,-110,400,220);this.frames++;return true;
  }
  dispose(){
   if(this.disposed)return;this.disposed=true;
   this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.removeEventListener('webglcontextrestored',this.onRestored);
   for(const [kind,resource] of this.resources)this.gl['delete'+kind](resource);this.resources.length=0;
  }
  status(){return {available:!this.disposed&&!this.lost,frames:this.frames,resources:this.resources.length,
   meshVertices:this.vertices.length/STRIDE,ribbonCapacity:this.ribbons.length/8,resolution:[WIDTH,HEIGHT],bloom:false};}
 }
 root.ReactiveRadiance=Radiance;
})(globalThis);
