// Pixel regression for immediate persistent cuts and performer visibility.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {serve}=require('./spirit_fixture.cjs');
const out=process.env.SPIRIT_OUTPUT||'C:/StreamingMedia/Transitions/udyr-spirits-v18-bear-tears';
(async()=>{const fixture=await serve(),browser=await chromium.launch({headless:true,channel:'chrome'});
 try{const page=await browser.newPage();await page.goto(fixture.url);await page.waitForFunction(()=>!!window.spiritPreview);
 const proof=await page.evaluate(async()=>{
  const {SpiritTransition}=await import('./renderer.js'),bear=await import('./bear.js'),{transform}=await import('./motion.js');
  const check=(ok,why)=>{if(!ok)throw Error(why);},proof={};
  const pixels=c=>c.getContext('2d').getImageData(0,0,1920,1080).data;
  for(const clip of ['bear','bear-alt']){
   const s=await new SpiritTransition(document.createElement('canvas')).load(clip);
   const mask=t=>{s.b.clearRect(0,0,1920,1080);bear.coverage(s,t);return new Uint8ClampedArray(pixels(s.cover));};
   const area=d=>{let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>16)n++;return n;};
   check(area(mask(bear.swipes[0].at-.01))===0,'Cover precedes first claw');
   const strikes=[];
   for(const swipe of bear.swipes){const before=mask(swipe.at-.01),during=mask(swipe.at+.07),after=mask(swipe.at+.40);
    const growth=area(during)-area(before);check(growth>12000,`${clip}: swipe did not visibly rip the screen immediately (${growth})`);
    let lost=0;for(let i=3;i<before.length;i+=4)if(before[i]===255&&after[i]<250)lost++;
    check(lost===0,'Earlier tears disappear when another claw strikes');strikes.push({at:swipe.at,before:area(before),during:area(during),settled:area(after),lostPixels:lost});
   }
   const overlaps=[];
   for(const t of [2.30,2.80,3.25]){
    s.draw(t);const actual=pixels(s.canvas),cover=pixels(s.cover);
    const actor=s.canvas.cloneNode(),c=actor.getContext('2d');c.save();transform(c,'bear',t);bear.foreground({...s,c},t);c.restore();const painted=pixels(actor);
    // Transform the cover separately to locate pixels where it would hide the
    // actor if layer ordering were reversed. Check opaque actor RGB there.
    const mapped=s.canvas.cloneNode(),mc=mapped.getContext('2d');mc.save();transform(mc,'bear',t);mc.drawImage(s.cover,0,0);mc.restore();const underneath=pixels(mapped);
    let overlap=0,mismatch=0;for(let i=0;i<painted.length;i+=4)if(painted[i+3]===255&&underneath[i+3]>250){overlap++;if(Math.max(...[0,1,2].map(j=>Math.abs(actual[i+j]-painted[i+j])))>1)mismatch++;}
    check(overlap>100,`${clip}: no meaningful actor/tear overlap to verify at ${t} (${overlap})`);check(mismatch===0,`${clip}: storm cover hides opaque bear paint at ${t} (${mismatch} pixels)`);
    // Coverage geometry is independent of the browser's changing GPU/CPU
    // raster path; compare the mask separately from textured actor paint.
    const expected=mask(t);s.draw(4.9);s.draw(.5);const again=mask(t);let changed=0;for(let i=3;i<again.length;i+=4)if((again[i]===0&&expected[i]===255)||(again[i]===255&&expected[i]===0))changed++;check(changed===0,`Tears depend on scrub history (${changed} interior mask pixels)`);
    overlaps.push({time:t,opaqueBearOverTear:overlap,coveredBearPixels:mismatch,scrubbedMaskDifferences:changed});
   }
   s.draw(3.85);let holes=0;for(let i=3,d=pixels(s.canvas);i<d.length;i+=4)if(d[i]!==255)holes++;check(holes===0,'Final plate does not cover every pixel');
   proof[clip]={strikes,overlaps,fullCoverHoles:holes};s.dispose();
  }return proof;
 });
 for(const clip of Object.keys(proof))assert.equal(proof[clip].fullCoverHoles,0);
 fs.writeFileSync(out+'/bear-tears-validation.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
 // Finite visual contact sheet, with a checker background so early rips read.
 for(const clip of ['bear','bear-alt'])for(const t of [2.18,2.30,2.68,2.80,3.18,3.25,3.5,3.85]){
  const png=await page.evaluate(async({clip,t})=>{const {SpiritTransition}=await import('./renderer.js');const s=await new SpiritTransition(document.createElement('canvas')).load(clip);s.draw(t);const png=s.canvas.toDataURL().split(',')[1];s.dispose();return png;},{clip,t});
  fs.writeFileSync(`${out}/${clip}-tear-${t}.png`,Buffer.from(png,'base64'));
 }
 console.log('Immediate cuts, permanent accumulated coverage, visible foreground bear, deterministic scrubbing and full final plate passed.');
 }finally{await browser.close();fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
