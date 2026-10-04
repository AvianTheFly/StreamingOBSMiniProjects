// Finite painted-anatomy and full-stage review; no live scene changes.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const {serve}=require('./spirit_fixture.cjs');
const out=process.env.SPIRIT_OUTPUT||'C:/StreamingMedia/Transitions/udyr-spirits-v16-phoenix';
(async()=>{const f=await serve(),b=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await b.newPage();await page.goto(f.url);await page.waitForFunction(()=>!!window.spiritPreview);
  fs.mkdirSync(out+'/review',{recursive:true});
  for(const variant of [0,1]){
   const result=await page.evaluate(async variant=>{const {Character}=await import('./characters.js'),{SpiritTransition}=await import('./renderer.js');
    const actor=await new Character().load('phoenix'),canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1800;const c=canvas.getContext('2d');
    const times=[1.40,1.70,1.94,2.20,2.43,2.76,3.02,3.16,3.32];
    times.forEach((t,i)=>{const x=i%3*600,y=Math.floor(i/3)*600;c.save();c.beginPath();c.rect(x,y,600,565);c.clip();c.fillStyle='#192631';c.fillRect(x,y,600,565);
     actor.draw(c,{x:x+300,y:y+250,size:320,t,variant});c.restore();c.fillStyle='#deedf5';c.font='18px Segoe UI';c.fillText(t.toFixed(2)+' s',x+18,y+588);});
    const rig=canvas.toDataURL().split(',')[1];const dims={body:actor.parts.body.map(p=>[p.w,p.h,p.islandPixels]),wings:actor.parts.wings.map(p=>[p.w,p.h,p.islandPixels]),leg:[actor.parts.leg.w,actor.parts.leg.h],tail:[actor.parts.tail.w,actor.parts.tail.h]};actor.dispose();
    const show=await new SpiritTransition(document.createElement('canvas')).load(variant?'phoenix-alt':'phoenix');canvas.height=1200;
    for(const [i,t] of [1.65,2.20,3.16,3.50,4.05,4.85].entries()){show.draw(t);const x=i%3*600,y=Math.floor(i/3)*600;c.fillStyle='#172534';c.fillRect(x,y,600,565);c.drawImage(show.canvas,x,y+85,600,337.5);c.fillStyle='#deedf5';c.fillText(t.toFixed(2)+' s',x+18,y+588);}
    const stage=canvas.toDataURL().split(',')[1];show.dispose();return {rig,stage,dims};
   },variant);
   for(const kind of ['rig','stage'])fs.writeFileSync(path.join(out,'review',`phoenix-${variant}-${kind}.png`),Buffer.from(result[kind],'base64'));
   console.log(JSON.stringify(result.dims));
  }
 }finally{await b.close();f.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
