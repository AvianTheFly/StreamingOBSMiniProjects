/* Actual pixel and lifetime checks for the transparent painted resident caches. */
'use strict';
const {chromium}=require('playwright'),fs=require('node:fs');
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),report=[];
 try{
  await page.goto('http://127.0.0.1:7420/lobby-motion/index.html?world=arcade&paused=1&auto=0');await page.locator('canvas[data-ready=true]').waitFor();
  for(const id of ['arcade','tavern','forge','future','sky-harbor']){
   const result=await page.evaluate(async id=>{
    const {loadWorld}=await import('./worlds.js'),world=await loadWorld(id),art=await world.createMotion().load(),residents=art.residents;
    const cast=residents.sprites.map((sprite,i)=>{const data=sprite.getContext('2d').getImageData(0,0,sprite.width,sprite.height).data;let clear=0,opaque=0;for(let j=3;j<data.length;j+=4){clear+=data[j]===0;opaque+=data[j]>245;}return {bounds:residents.bounds[i],clear:clear/(data.length/4),opaque:opaque/(data.length/4)};});
    const surface=document.createElement('canvas');surface.width=1920;surface.height=1080;const c=surface.getContext('2d',{willReadFrequently:true});
    residents.draw(c,1,[]);const a=c.getImageData(0,0,1920,1080).data;c.clearRect(0,0,1920,1080);residents.draw(c,3,[]);const b=c.getImageData(0,0,1920,1080).data;let motion=0;for(let i=3;i<a.length;i+=4)if(Math.abs(a[i]-b[i])>20)motion++;
    const slots=[],original=residents.sprite;residents.sprite=(c,slot)=>slots.push(slot);const cue=world.cues.find(c=>c.residentSlots?.length===2);if(cue)residents.draw(c,5,[{...cue,started:0}]);else residents.draw(c,5,[{...world.cues.find(c=>c.residentSlots),started:0}]);residents.sprite=original;
    const excluded=(cue||world.cues.find(c=>c.residentSlots)).residentSlots.every(s=>!slots.includes(s));
    const references=[...residents.sprites];art.dispose();const released=residents.sprites.length===0&&residents.bounds.length===0&&references.every(s=>s.width===1&&s.height===1);
    // A world closed during decode must never retain a late-arriving sprite cache.
    const late=world.createMotion(),loading=late.load();late.dispose();await loading;late.dispose();const lateReleased=late.residents.sprites.length===0&&late.base.width===1;
    return {id,cast,motion,excluded,released,lateReleased,cues:world.cues.length};
   },id);
   if(result.cast.length!==3||result.cast.some(s=>s.clear<.15||s.opaque<.15)||result.motion<1000||!result.excluded||!result.released||!result.lateReleased||result.cues!==14)throw new Error(JSON.stringify(result));
   report.push(result);
  }
  // The studio's one pause command freezes room motion and finite visitors together.
  await page.goto('http://127.0.0.1:7420/lobby-motion/studio.html?world=arcade');const frame=page.frameLocator('#preview');await frame.locator('canvas[data-ready=true]').waitFor();await page.locator('[data-cue=raccoon-heist]').click();await page.locator('#pause').click();await frame.locator('canvas[data-paused=true]').waitFor();const before=await frame.locator('canvas').screenshot();await page.waitForTimeout(500);const after=await frame.locator('canvas').screenshot();if(!before.equals(after))throw new Error('Paused cast moved');
  fs.writeFileSync('C:/StreamingMedia/LivingLobbies/catalog/review/residents-qa.json',JSON.stringify({worlds:report,pause:true},null,2));console.log(JSON.stringify({worlds:report,pause:true}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
