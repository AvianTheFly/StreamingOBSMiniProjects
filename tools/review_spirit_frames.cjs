// Finite authoring review: pose sequence over synthetic before/after scenes.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const {serve}=require('./spirit_fixture.cjs');
(async()=>{
 const fixture=await serve(),browser=await chromium.launch({headless:true,channel:'chrome'});
 const output=process.env.SPIRIT_REVIEW||'C:/StreamingMedia/Transitions/udyr-spirits-v10/review';fs.mkdirSync(output,{recursive:true});
 try{
  const page=await browser.newPage();await page.goto(fixture.url);await page.waitForFunction(()=>!!window.spiritPreview);
  for(const id of ['bear','turtle','ram','phoenix']){
   const png=await page.evaluate(async id=>{
    const {SpiritTransition}=await import('./renderer.js'),s=await new SpiritTransition(document.createElement('canvas')).load(id);
    const times=[.42,.74,1,1.35,1.7,2.05,2.18,2.3,2.8,3.14,3.5,3.65,4,4.4,5,6.2];
    const sheet=document.createElement('canvas');sheet.width=1600;sheet.height=1000;const c=sheet.getContext('2d');
    times.forEach((t,i)=>{
     const x=i%4*400,y=Math.floor(i/4)*250;s.draw(t);
     c.fillStyle=t<s.timing.cut?'#203041':'#492638';c.fillRect(x,y,400,225);
     c.drawImage(s.canvas,x,y,400,225);
     c.fillStyle='#111820';c.fillRect(x,y+225,400,25);c.fillStyle='#d9e5ec';c.font='13px Segoe UI';c.fillText(id+' / '+t.toFixed(2)+' s',x+10,y+243);
    });s.dispose();return sheet.toDataURL().split(',')[1];
   },id);
   fs.writeFileSync(path.join(output,id+'-motion.png'),Buffer.from(png,'base64'));console.log(id+' motion review saved');
  }
 }finally{await browser.close();fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

