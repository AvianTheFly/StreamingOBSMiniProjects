// Browser-only fixtures: no live OBS calls or personal settings writes.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),feature=path.join(root,'mini projects/league_api');
async function main(){
  const out=path.join(root,'output/stream-stages');fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let state={queue:true,queue_label:'IN QUEUE',connected:true,loading:true,roster:[],queue_timer:{active:true,running:true,seconds:74,status:'IN QUEUE',roles:['TOP','JUNGLE'],theme:'bear'}};
    await page.route('http://stage.test/**',async route=>{
      const url=new URL(route.request().url());let file;
      if(url.pathname==='/stage/state')return route.fulfill({json:state});
      if(url.pathname==='/stage/art/frost')return route.fulfill({path:path.join(feature,'media/champ-select/frost.jpg'),contentType:'image/jpeg'});
      if(url.pathname==='/shared/visible-poll.js')file=path.join(root,'lib/browser_effects/web/visible-poll.js');
      else if(url.pathname.startsWith('/stage/'))file=path.join(feature,'stage_web',url.pathname.endsWith('.js')||url.pathname.endsWith('.css')?url.pathname.split('/').at(-1):url.pathname==='/stage/queue'?'queue.html':'index.html');
      else if(url.pathname==='/match-art/game_start')file=path.join(feature,'media/match-screens/game-start.png');
      else return route.fulfill({status:404,body:''});
      return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
    });
    await page.goto('http://stage.test/stage/loading?demo=1');
    await page.locator('.player').last().waitFor();
    assert.equal(await page.locator('.player').count(),10);
    await page.screenshot({path:path.join(out,'spirit-loading.png'),animations:'disabled'});
    await page.goto('http://stage.test/stage/queue');
    await page.locator('#queueCard:visible').waitFor();
    await page.screenshot({path:path.join(out,'queue-badge.png'),omitBackground:true,animations:'disabled'});
    state={...state,queue_label:'BANNING',queue_timer:{...state.queue_timer,status:'BANNING'}};await page.getByText('BANNING',{exact:true}).waitFor();
    state={...state,queue:false,queue_timer:{...state.queue_timer,active:false}};await page.locator('#queueCard').waitFor({state:'hidden'});
    await page.goto('http://stage.test/stage/loading');
    await page.locator('#stage:visible').waitFor();
    state={...state,roster:[{team:'allies',name:'Udyr',label:'<img src=x onerror=alert(1)>',role:'JUNGLE'}]};
    await page.getByText('<img src=x onerror=alert(1)>',{exact:true}).waitFor();
    assert.equal(await page.locator('.player-info img').count(),0);
    state={...state,loading:false,playing:true};await page.getByText('MATCH READY',{exact:true}).waitFor();
    assert(await page.locator('#stage').isVisible(),'A held loading scene must never become blank');
    state={...state,appearance:{image_url:'/stage/art/frost'}};
    await page.waitForFunction(()=>document.querySelector('.sanctuary').style.backgroundImage.includes('/stage/art/frost'));
    assert.equal(await page.locator('.player').count(),10,'Replacing artwork retains player information');
    assert.deepEqual(errors,[]);
    console.log('Stream stages: ten slots, safe names, queue/bans exit and gameplay handoff passed.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
