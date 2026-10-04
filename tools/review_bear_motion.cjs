// Dense finite review of the bear's gait, turn and grounded attacks.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const {serve}=require('./spirit_fixture.cjs');
(async()=>{const fixture=await serve(),browser=await chromium.launch({headless:true,channel:'chrome'});
 try{const page=await browser.newPage();await page.goto(fixture.url);await page.waitForFunction(()=>!!window.spiritPreview);
 for(const clip of ['bear','bear-alt']){const png=await page.evaluate(async clip=>{
 const {SpiritTransition}=await import('./renderer.js'),s=await new SpiritTransition(document.createElement('canvas')).load(clip);
 const times=[.4,.52,.64,.76,.88,1,1.1,1.2,1.3,1.5,1.7,1.94,2.03,2.1,2.18,2.22,2.26,2.30,2.36,2.44,2.5,2.60,2.68,2.72,2.78,2.86,2.94,3.06,3.18,3.22,3.28,3.44];
 const sheet=document.createElement('canvas');sheet.width=1600;sheet.height=1600;const c=sheet.getContext('2d');
 for(let i=0;i<times.length;i++){const x=i%4*400,y=Math.floor(i/4)*200;s.draw(times[i]);c.fillStyle='#203041';c.fillRect(x,y,400,175);c.drawImage(s.canvas,x,y,400,175);c.fillStyle='#d9e5ec';c.font='13px Segoe UI';c.fillText(clip+' / '+times[i].toFixed(2)+' s',x+8,y+192);}s.dispose();return sheet.toDataURL().split(',')[1];
 },clip);const dest='C:/StreamingMedia/Transitions/udyr-spirits-v11/review';fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,clip+'-dense.png'),Buffer.from(png,'base64'));}
 }finally{await browser.close();fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
