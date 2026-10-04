// Finite enlarged anatomy/contact review. No OBS I/O or runtime resource owner.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const {serve}=require('./spirit_fixture.cjs');
const out=process.env.SPIRIT_OUTPUT||'C:/StreamingMedia/Transitions/udyr-spirits-v11';
(async()=>{const fixture=await serve(),browser=await chromium.launch({headless:true,channel:'chrome'});
 try{const page=await browser.newPage();await page.goto(fixture.url);await page.waitForFunction(()=>!!window.spiritPreview);
 for(const variant of [0,1])for(const kind of ['turn','attack']){
 const result=await page.evaluate(async({variant,kind})=>{
  const {Character}=await import('./characters.js'),{acting}=await import('./rigs/bear/motion.js'),{anatomy}=await import('./rigs/bear/calibration.js');
  const actor=await new Character().load('bear'),canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1440;const c=canvas.getContext('2d');
  const times=kind==='turn'?[1.50,1.60,1.65,1.70,1.76,1.82,1.88,1.94,2.00]:[1.90,2.08,2.18,2.25,2.32,2.60,2.75,3.18,3.28];
  for(let i=0;i<times.length;i++){const x=i%3*600,y=Math.floor(i/3)*480,t=times[i];c.save();c.beginPath();c.rect(x,y,600,440);c.clip();c.fillStyle='#22303c';c.fillRect(x,y,600,440);
   c.strokeStyle='#647b89';c.beginPath();c.moveTo(x,y+416);c.lineTo(x+600,y+416);c.stroke();
   actor.draw(c,{x:x+300,y:y+416,size:510,t,variant});c.restore();
   c.fillStyle='#dfeef4';c.font='16px Segoe UI';c.fillText(kind+' / '+t.toFixed(2)+'s',x+10,y+464);
  }actor.dispose();return canvas.toDataURL().split(',')[1];
 },{variant,kind});fs.mkdirSync(path.join(out,'review'),{recursive:true});fs.writeFileSync(path.join(out,'review',`bear-${variant}-${kind}-close.png`),Buffer.from(result,'base64'));
 } }finally{await browser.close();fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
