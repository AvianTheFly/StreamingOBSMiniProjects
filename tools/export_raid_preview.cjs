// Deterministic film of the production renderer at the music's exact timestamps.
// No recording drift, repeated audio input, live event, or saved setting writes.
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
module.exports=async function exportRaid({browser,base,out,web,theme='crab',volume=.22}){
 const score=JSON.parse(fs.readFileSync(path.join(web,'raid_score.json'),'utf8'))[theme];
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 const output=path.join(out,'raid-preview.mp4');
 const encoder=spawn(process.env.FFMPEG_PATH||'F:/ffmpeg/bin/ffmpeg.exe',[
  '-v','error','-y','-f','image2pipe','-framerate','30','-i','pipe:0',
  '-i',path.join(web,'media',score.audio),'-map','0:v','-map','1:a',
  '-af',`volume=${volume}`,'-t',String(score.duration),'-c:v','libx264','-preset','fast',
  '-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',output
 ],{windowsHide:true,stdio:['pipe','ignore','pipe']});
 let diagnostics='';encoder.stderr.on('data',d=>{diagnostics+=d;});
 const done=new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('close',code=>code===0?resolve():reject(Error(diagnostics)));});
 // Observe early encoder failures while frames are being produced.
 done.catch(()=>{});
 try{
  await page.goto(base+'/overlay?preview');
  await page.evaluate(async theme=>{
   const {partyReady}=await import('/raid_party.js');await partyReady;
   const {RaidSequence}=await import('/raid_sequence.js');
   document.body.style.background='#19252e';const stage=document.getElementById('stage');stage.style.transition='none';stage.className='on';
   window.film=new RaidSequence(stage);film.start({id:'music-review',theme,name:'CaptainGoodVibes',count:420});
  },theme);
  for(let frame=0;frame<Math.ceil(score.duration*30);frame++){
   await page.evaluate(t=>film.update(t,{volume:0,muted:true}),frame/30);
   const pixels=await page.screenshot({type:'jpeg',quality:90});
   if(!encoder.stdin.write(pixels))await new Promise((resolve,reject)=>{const drain=()=>{cleanup();resolve();},fail=e=>{cleanup();reject(e);},cleanup=()=>{encoder.stdin.off('drain',drain);encoder.stdin.off('error',fail);};encoder.stdin.once('drain',drain);encoder.stdin.once('error',fail);});
  }
  encoder.stdin.end();await done;
  console.log(JSON.stringify({musicPreview:output,duration:score.duration,theme,volume,singlePass:true}));
 }finally{if(encoder.exitCode===null)encoder.kill();await page.close();}
};
