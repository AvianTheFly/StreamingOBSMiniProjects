/* Finite, silent showreel of the five painted casts, using the actual scene renderer. */
'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out='C:/StreamingMedia/LivingLobbies/cast-2026-10-04/review';
const shots=[['arcade','raccoon-heist','joystick-solo'],['tavern','mimic-chase','dragon-miscast'],['forge','goblin-bonk','duck-knights'],['future','pizza-convoy','toaster-launch'],['sky-harbor','air-traffic','pigeon-mail']];
async function main(){
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:path.join(out,'raw'),size:{width:1280,height:720}}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));const report=[];
  for(const [world,first,second] of shots){
   await page.goto(`http://127.0.0.1:7420/lobby-motion/index.html?world=${world}&preview=1&auto=0&at=2&cue=${first}`);await page.locator('canvas[data-ready=true]').waitFor();
   await page.waitForTimeout(5000);await page.screenshot({path:path.join(out,world+'.png')});
   await page.waitForTimeout(2000);await page.evaluate(cue=>window.postMessage({type:'living-lobby',cue,id:crypto.randomUUID()},location.origin),second);
   await page.waitForTimeout(9000);report.push({world,first,second,paintMs:await page.locator('canvas').getAttribute('data-paint-ms')});console.log(world+' recorded');
  }
  const video=page.video();await context.close();await video.saveAs(path.join(out,'painted-cast-tour.webm'));
  fs.writeFileSync(path.join(out,'showreel.json'),JSON.stringify({shots:report,errors},null,2));if(errors.length)throw new Error(errors.join('\n'));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
