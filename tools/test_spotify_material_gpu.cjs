// Read actual shader pixels at one physical point on a facet. Turning the view
// may change its lighting, but must not move a grain crest into a trough.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://material.test/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api/state')return route.fulfill({json:{playing:false}});
   const file=url.pathname==='/overlay'?'overlay.html':url.pathname.slice(1);
   return route.fulfill({body:fs.readFileSync(path.resolve('mini projects/spotify/web',file)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('http://material.test/overlay');
  const result=await page.evaluate(()=>{
   const r=new VisualStageRenderer(),gl=r.gl,triangle=[[100,30,0],[-70,40,60],[20,-55,-30]],weights=[.2,.3,.5],ratios=[];
   const model=triangle.map(p=>[p[0]*(280+p[2])/280,p[1]*(280+p[2])/280,p[2]]);
   const center=[0,1,2].map(k=>weights.reduce((sum,b,i)=>sum+b*model[i][k],0));
   const authored=[center[0]*280/(280+center[2]),center[1]*280/(280+center[2]),center[2]];
   try{
    for(const yaw of [-.65,0,.65])for(const tilt of [-.4,0,.4])for(const roll of [-.15,0,.15]){
     const view=VisualDepth.camera({space:{yaw,tilt,roll}}),lens=view.lens,target=view(authored);
     r.count=0;r.commands.length=0;r.face(triangle.map(view),[.4,.5,.6],1);
     gl.viewport(0,0,1200,660);gl.useProgram(r.program);gl.bindVertexArray(r.vao);gl.bindBuffer(gl.ARRAY_BUFFER,r.buffer);
     gl.uniform3f(r.lensState,lens.focal,lens.framing,lens.pivot);gl.uniformMatrix3fv(r.textureBasis,false,lens.basis);
     gl.uniform4f(r.materialState,0,0,0,0);gl.bufferSubData(gl.ARRAY_BUFFER,0,r.vertices.subarray(0,r.count*10));
     const pixel=new Uint8Array(4),read=(grain,phase)=>{
      gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform3f(r.textureState,0,grain,phase);gl.drawArrays(gl.TRIANGLES,0,r.count);
      gl.readPixels(Math.floor(600+target[0]*3),Math.floor(330-target[1]*3),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      return pixel[2];
     };
     const base=read(0,0);if(base<20)throw Error('Expected interior facet pixel');
     ratios.push({crest:read(1,0)/base,trough:read(1,Math.PI)/base,error:gl.getError()});
    }
    return {ratios,resources:r.status().resources};
   }finally{r.dispose();}
  });
  assert.deepEqual(errors,[]);assert.equal(result.resources,3);
  for(const r of result.ratios){assert.equal(r.error,0);assert(r.crest>1.015&&r.crest<1.055&&r.trough>.87&&r.trough<.92,JSON.stringify(r));}
  console.log(JSON.stringify({passed:true,physicalMaterialPoint:true,views:result.ratios.length,resources:result.resources}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
