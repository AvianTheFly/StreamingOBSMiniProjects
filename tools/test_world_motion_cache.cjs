// Finite isolated comparison with the pre-cache renderer; no live OBS commands.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();
  await page.route('http://mesh.test/**',route=>{
   const name=new URL(route.request().url()).pathname;
   const file=name==='/new.js'?'lib/browser_effects/web/world-motion.js':name==='/old.js'?'tools/world_motion_reference.mjs':null;
   return route.fulfill(file?{contentType:'text/javascript',body:fs.readFileSync(path.join(root,file))}:{contentType:'text/html',body:'<!doctype html><body></body>'});
  });
  await page.goto('http://mesh.test/');
  const report=await page.evaluate(async()=>{
   const Old=(await import('/old.js')).PaintedPatch,New=(await import('/new.js')).PaintedPatch;
   const canvas=()=>{const c=document.createElement('canvas');c.width=400;c.height=300;return c;};
   const source=canvas(),s=source.getContext('2d');
   for(let y=0;y<300;y+=7)for(let x=0;x<400;x+=9){s.fillStyle=`rgba(${x%256},${y%256},${(x+y)%256},${.2+(x%5)/6})`;s.fillRect(x,y,8,6);}
   let frames=0;const times=[0,.03,1,7,30,2,0,1000];
   for(const [rect,cols,rows] of [[[10,20,270,158],8,6],[[.5,3.25,179,113],3,4],[[0,0,60,80],1,1]]){
    const a=new Old(source,rect,cols,rows),b=new New(source,rect,cols,rows),ac=canvas(),bc=canvas(),ca=ac.getContext('2d',{willReadFrequently:true}),cb=bc.getContext('2d',{willReadFrequently:true});
    const projected=b.projected,triangles=b.triangles,targets=b.projected.slice();
    for(const t of times){
     const deform=(u,v)=>[Math.sin(t+u*3)*v*8,Math.cos(t*.7+v*4)*u*5];
     ca.clearRect(0,0,400,300);cb.clearRect(0,0,400,300);a.draw(ca,deform);b.draw(cb,deform);
     const aa=ca.getImageData(0,0,400,300).data,bb=cb.getImageData(0,0,400,300).data;
     if(!aa.every((v,i)=>v===bb[i]))throw Error('Pixel mismatch at '+t);
     if(b.projected!==projected||b.triangles!==triangles||targets.some((v,i)=>v!==b.projected[i]))throw Error('Mesh buffers replaced');
     frames++;
    }
    b.dispose();b.dispose();if(b.vertices.length||b.projected.length||b.triangles.length||b.image.width!==1)throw Error('Retained patch resources');a.dispose();
   }
   // Isolate geometry CPU from GPU rasterization; paired alternating order.
   const noop=()=>{},context={save:noop,restore:noop,translate:noop,beginPath:noop,lineTo:noop,closePath:noop,clip:noop,transform:noop,drawImage:noop};
   const a=new Old(source,[0,0,270,158]),b=new New(source,[0,0,270,158]),deform=(u,v)=>[u*2,v*3];
   function sample(patch,n){const start=performance.now();for(let i=0;i<n;i++)patch.draw(context,deform);return performance.now()-start;}
   sample(a,2000);sample(b,2000);const old=[],fresh=[];
   for(let i=0;i<9;i++){if(i%2){fresh.push(sample(b,4000));old.push(sample(a,4000));}else{old.push(sample(a,4000));fresh.push(sample(b,4000));}}
   a.dispose();b.dispose();const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
   return {pixelIdenticalFrames:frames,oldGeometryMs:median(old),newGeometryMs:median(fresh),buffersReused:true,cleanup:true};
  });
  assert.equal(report.pixelIdenticalFrames,24);console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
