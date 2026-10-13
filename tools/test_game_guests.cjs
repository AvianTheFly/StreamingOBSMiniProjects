/* Review actual new artists, contact phases, lifecycle and fitted scene placement. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {chromium}=require('playwright');
const out=path.resolve('output/lobby-goal-audit');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:7420/lobby-motion/index.html?world=reef&preview=1&paused=1&auto=0');await page.locator('canvas[data-ready=true]').waitFor();
  const rows=await page.evaluate(async()=>{
   const {worlds,loadWorld}=await import('./worlds.js'),{guestPlaces}=await import('./game-guests.js'),{climberState}=await import('./game-guest-stunts.js');
   const {GameGuestSprites}=await import('./game-guest-sprites.js'),{AmbientClock}=await import('./shared/world-motion.js');
   const lengths=[];for(const age of [2.2,3,4,5,6,7]){const s=climberState(age,[68,-123]);if(!s.contact||s.target[0]!==68||s.target[1]!==-123)throw Error('Hammer drifted during contact');lengths.push(Math.hypot(s.target[0]-s.hand[0],s.target[1]-s.hand[1]));}if(Math.max(...lengths)-Math.min(...lengths)>1e-8)throw Error('Hammer handle telescoped during a push');
   const early=new GameGuestSprites(['kirby','goose']);const loading=early.load();early.dispose();await loading.catch(()=>{});if(early.frames.size||early.images.size)throw Error('Late load retained disposed sprites');
   const results=[];
   for(const w of worlds){const world=await loadWorld(w.id),art=await world.createMotion().load();
    const clock=new AmbientClock(world.cues,71),seen=new Set();for(let window=0;window<30;window++)for(const event of clock.plan(window))if(event.kind.startsWith('game-'))seen.add(event.kind);clock.dispose();
    if(!guestPlaces[w.id].every(p=>seen.has('game-'+p.character)))throw Error(w.id+' omitted a guest from automatic scheduling');
    const cv=document.createElement('canvas');cv.width=1920;cv.height=1080;const c=cv.getContext('2d',{willReadFrequently:true});
    art.draw(c,1,[],world.scene.holes);for(const hole of world.scene.holes)c.clearRect(...hole);const first=c.getImageData(0,0,1920,1080).data;
    c.clearRect(0,0,1920,1080);art.draw(c,3,[],world.scene.holes);for(const hole of world.scene.holes)c.clearRect(...hole);const second=c.getImageData(0,0,1920,1080).data;let moving=0;
    for(let i=0;i<first.length;i+=4)if(Math.abs(first[i]-second[i])+Math.abs(first[i+1]-second[i+1])+Math.abs(first[i+2]-second[i+2])+Math.abs(first[i+3]-second[i+3])>18)moving++;
    if(moving<100)throw Error(w.id+' background stopped moving');
    for(const p of guestPlaces[w.id]){
     const id='game-'+p.character,frames=[];let text=0;c.fillText=()=>text++;
     for(const age of [1,3,5,7,9]){
      c.clearRect(0,0,1920,1080);world.artists[id](c,age,{seed:71},art);const before=c.getImageData(0,0,1920,1080).data;
      let raw=0;for(let i=3;i<before.length;i+=4)raw+=before[i]>32;
      for(const rect of world.scene.holes)c.clearRect(...rect);
      const data=c.getImageData(0,0,1920,1080).data;let visible=0;for(let i=3;i<data.length;i+=4)visible+=data[i]>32;
      frames.push({age,raw,visible});
     }
     results.push({world:w.id,id,place:p,frames,text,backgroundMotion:moving});
    }
    art.dispose();if(art.guests.frames.size||art.guests.images.size||art.base.width!==1)throw Error('World resources survived disposal');
   }return results;
  });
  for(const row of rows){assert.equal(row.text,0);assert(row.frames.some(f=>f.visible>350),row.world+'/'+row.id+' unreadable');assert(row.frames.every(f=>!f.raw||f.visible/f.raw>.72),row.world+'/'+row.id+' clipped by a live area');}
  const sheets=[];
  for(const [i,row] of rows.entries()){
   await page.goto('http://127.0.0.1:7420/lobby-motion/index.html?world='+row.world+'&preview=1&paused=1&auto=0&at=30&cue='+row.id+'&age=5');await page.locator('canvas[data-ready=true]').waitFor();
   const buffer=await page.screenshot();const left=Math.max(0,Math.min(1420,Math.round(row.place.x-230))),top=Math.max(0,Math.min(780,Math.round(row.place.y-200)));
   const crop=await sharp(buffer).extract({left,top,width:500,height:300}).toBuffer();
   sheets.push({input:crop,left:i%4*500,top:Math.floor(i/4)*330});
   sheets.push({input:Buffer.from('<svg width="500" height="30"><text x="10" y="21" fill="white" font-size="16">'+row.world+' / '+row.id+'</text></svg>'),left:i%4*500,top:Math.floor(i/4)*330+300});
  }
  await sharp({create:{width:2000,height:Math.ceil(rows.length/4)*330,channels:3,background:'#181c24'}}).composite(sheets).png().toFile(path.join(out,'game-guests-contact-sheet.png'));
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'game-guests-qa.json'),JSON.stringify({rows,errors,contact:true,lateDisposal:true},null,2));console.log('Verified '+rows.length+' staged visits, hammer contact, transparent captions, and normal/late cleanup.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
