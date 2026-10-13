const {chromium}=require('playwright'),sharp=require('sharp'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const out=path.resolve('output/lobby-distinct-v4');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));
for(const id of ['aurora-camp','sanctuary','forge','phoenix-observatory']){
 for(const media of [0,1]){await page.goto(`http://127.0.0.1:7420/lobby-motion/index.html?world=${id}&preview=1&broadcast=1&screen=${media}&paused=1&auto=0&at=30`);await page.locator('canvas[data-ready=true]').waitFor();await page.screenshot({path:path.join(out,`${id}-broadcast-${media}.png`)});}
 await page.goto(`http://127.0.0.1:7420/lobby-motion/index.html?world=${id}&paused=1&auto=0`);await page.locator('canvas[data-ready=true]').waitFor();
 report.push(await page.evaluate(async id=>{const {habitatDesigns}=await import('./habitat-designs.js'),{cameraForeground}=await import('./camera-occlusion.js'),d=habitatDesigns[id],c=document.querySelector('canvas').getContext('2d');
 const chat=c.getImageData(...d.chat).data;if(chat.some((v,i)=>i%4===3&&v))throw Error('Chat obstructed');
 const [x,y,w,h]=d.camera;const upper=c.getImageData(x,y,w,Math.min(...d.cameraEdge.map(p=>p[1]))-y-2).data;if(upper.some((v,i)=>i%4===3&&v))throw Error('Host face obstructed');
 const lower=c.getImageData(x,y+h-8,w,8).data;if(lower.some((v,i)=>i%4===3&&v!==255))throw Error('Torso cutoff exposed');
 const custom=document.createElement('canvas');custom.width=1920;custom.height=1080;cameraForeground(custom.getContext('2d'),document.querySelector('canvas'),id,[20,30,100,100]);if(custom.getContext('2d').getImageData(0,0,1920,1080).data.some(v=>v))throw Error('Custom camera overridden');
 return {id,chatClear:true,faceClear:true,torsoOccluded:true,customPlacementPreserved:true};},id));
}
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'broadcast-qa.json'),JSON.stringify({report,errors},null,2));
const grid=[];for(const [i,id] of ['aurora-camp','sanctuary','forge','phoenix-observatory'].entries())grid.push({input:await sharp(path.join(out,id+'-broadcast-0.png')).resize(960,540).toBuffer(),left:i%2*960,top:Math.floor(i/2)*540});await sharp({create:{width:1920,height:1080,channels:3,background:'#111'}}).composite(grid).png().toFile(path.join(out,'broadcast-four.png'));console.log('Broadcast composition: four clear faces/chats, four occluded torso edges, saved custom placement respected.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
