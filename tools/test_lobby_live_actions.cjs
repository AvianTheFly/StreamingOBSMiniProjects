// Real artist renderer and channel lifecycle against disposable local HTTP responses.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const app=path.resolve(__dirname,'../hub_ui/app');
async function main(){
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.links=[];window.EventSource=class{constructor(){window.links.push(this);}close(){this.closed=true;}};});
    await page.route('http://living.test/**',route=>{
      const pathname=new URL(route.request().url()).pathname;
      const file=path.resolve(app,'.'+pathname);
      if(!file.startsWith(app+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});
      return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':file.endsWith('.css')?'text/css':'text/html'});
    });
    await page.goto('http://living.test/lobby-motion/index.html?world=forge&paused=1&auto=0&preview=1');
    await page.locator('canvas[data-ready=true]').waitFor();assert.equal(await page.evaluate(()=>window.links.length),0,'Preview does not subscribe to live controls');
    await page.goto('http://living.test/lobby-motion/index.html?world=forge&paused=1&auto=0');
    await page.locator('canvas[data-ready=true]').waitFor();
    assert.equal(await page.evaluate(()=>window.links.length),1);
    const catalog=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../mini projects/scene_voice_switcher/motion-actions.json'),'utf8'));
    const action=catalog.ForgeLobby.actions[0].id;
    const send=async cue=>page.evaluate(cue=>window.links[0].onmessage({data:JSON.stringify({type:'living_lobby_action',payload:cue})}),cue);
    const events=()=>page.locator('canvas').getAttribute('data-events').then(JSON.parse);
    const cue={world:'forge',source:'ForgeLobby',id:'one',action,issuedAt:Date.now()/1000};
    await send({...cue,world:'sanctuary'});assert.equal((await events()).length,0);
    await send({...cue,issuedAt:Date.now()/1000-6});assert.equal((await events()).length,0);
    await send({...cue,issuedAt:Date.now()/1000+6});assert.equal((await events()).length,0);
    await send({...cue,issuedAt:'bad'});assert.equal((await events()).length,0);
    await send(cue);await send(cue);
    assert.equal((await events()).filter(e=>e.manual).length,1,'Echoes do not repeat the effect');
    assert.equal((await events())[0].kind,action,'The live cue reaches the actual artist');
    const holes=await page.evaluate(()=>{const c=document.querySelector('canvas').getContext('2d');return [[125,304,575,280],[830,450,460,460],[1463,203,317,470]].map(rect=>{const data=c.getImageData(...rect).data;for(let i=3;i<data.length;i+=4)if(data[i])return false;return true;});});
    assert(holes.every(Boolean),'Camera, desktop and chat stay clear');
    await page.evaluate(()=>{window.retainedLink=window.links[0];window.dispatchEvent(new Event('pagehide'));});
    assert(await page.evaluate(()=>window.retainedLink.closed),'Teardown closes the channel');
    assert.deepEqual(errors,[]);
    console.log('Living lobby: real cue delivery, stale/wrong-world/duplicate rejection, clear apertures and channel cleanup passed.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
