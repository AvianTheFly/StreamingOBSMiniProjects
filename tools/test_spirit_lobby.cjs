/* Finite offline browser QA. Serves only the authored overlay and the public

 * painted-surface mesh; never contacts OBS or changes live Hub settings. */

'use strict';

const fs=require('node:fs'),path=require('node:path'),http=require('node:http');

const {chromium}=require('playwright');
const {spawn,execFileSync}=require('node:child_process');

const root=path.resolve(__dirname,'..'),app=path.join(root,'hub_ui','app'),out=process.env.SPIRIT_LOBBY_REVIEW_DIR||'C:/StreamingMedia/SpiritLobby/2026-10-03/review';

const assert=(condition,message)=>{if(!condition)throw new Error(message);};

async function main(){

  fs.mkdirSync(out,{recursive:true});

  const fixtureRoot=fs.mkdtempSync(path.join(out,'fixture-'));
  const python=execFileSync('py',['-3.11','-c','import sys;print(sys.executable)'],{encoding:'utf8'}).trim();
  const fixture=spawn(python,['-B','-X','utf8',path.join(__dirname,'spirit_lobby_fixture.py'),'--root',fixtureRoot],{cwd:root,windowsHide:true});
  let fixtureError='';fixture.stderr.on('data',chunk=>fixtureError+=chunk);
  const port=await new Promise((resolve,reject)=>{
    let data='';const timeout=setTimeout(()=>{fixture.kill();reject(new Error('Fixture startup timed out: '+fixtureError));},10000);
    fixture.stdout.on('data',chunk=>{data+=chunk;const line=data.split('\n')[0];if(/^\d+\r?$/.test(line)){clearTimeout(timeout);resolve(Number(line));}});
    fixture.once('exit',()=>{clearTimeout(timeout);reject(new Error('Fixture exited: '+fixtureError));});
  });
  let browser;

  try{

    browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-background-networking']});

    const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1}),errors=[],requests=[];

    page.on('request',r=>requests.push(r.url()));

    page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});

    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});

    const origin=`http://127.0.0.1:${port}`,base=origin+'/spirit-lobby/';

    async function ready(){try{await page.locator('canvas[data-ready="true"]').waitFor();}catch(e){throw new Error(errors.join('\n')||e.message);}}

    const frames=[];

    for(const [at,pose] of [[.15,'sit'],[.45,'stand'],[.75,'sit'],[1.05,'stand'],[1.55,'wave'],[2.05,'sit'],[2.35,'stand'],[2.65,'sit'],[2.95,'stand'],[3.5,'wave'],[3.95,'sit']]){

      await page.goto(base+'index.html?paused=1&at='+at);await ready();

      assert(await page.locator('canvas').getAttribute('data-penguin')===pose,'Classic penguin sequence broke at '+at);

      assert(await page.locator('canvas').getAttribute('data-penguin-count')==='2','Two penguins must flank the camera');

    }

    assert(!requests.some(r=>/actors\.js|turtle-rig|phoenix-rig|ram-charge/.test(r)),'Removed animal spirit art still loads');

    const opacity=await page.evaluate(async()=>{

      const {Penguin}=await import('./penguin.js'),actor=await new Penguin().load();

      const output=document.createElement('canvas');output.width=1000;output.height=1000;

      const c=output.getContext('2d',{willReadFrequently:true}),samples=[];

      for(const at of [.15,.45,.75,1.05,2.05,2.35,2.65,2.95,...Array.from({length:26},(_,i)=>1.2+(i+.5)*.7/26)]){

        c.clearRect(0,0,1000,1000);actor.draw(c,at,{x:500,y:800});

        samples.push(c.getImageData(500,610,1,1).data[3],c.getImageData(500,675,1,1).data[3]);

      }return samples;

    });

    assert(opacity.every(a=>a>=172&&a<=174),'Translucency must be uniform across the complete penguin, without layered holes');
    const seam=await page.evaluate(async()=>{
      const {Penguin,penguinPose,penguinBlend}=await import('./penguin.js'),actor=await new Penguin().load(),canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1000;const c=canvas.getContext('2d',{willReadFrequently:true});
      actor.draw(c,0,{x:500,y:800});const first=c.getImageData(0,0,1000,1000).data;c.clearRect(0,0,1000,1000);actor.draw(c,3.8,{x:500,y:800});const last=c.getImageData(0,0,1000,1000).data;
      let difference=0,maximum=0,changed=0,alphaDifference=0,premultDifference=0;for(let i=0;i<first.length;i++){const d=Math.abs(first[i]-last[i]);difference+=d;maximum=Math.max(maximum,d);if(d)changed++;}
      for(let i=0;i<first.length;i+=4){alphaDifference=Math.max(alphaDifference,Math.abs(first[i+3]-last[i+3]));for(let ch=0;ch<3;ch++)premultDifference=Math.max(premultDifference,Math.abs(first[i+ch]*first[i+3]-last[i+ch]*last[i+3])/255);}
      return {difference,maximum,changed,alphaDifference,premultDifference,tail:penguinBlend(3.799),hands:[penguinPose(1.55).step,penguinPose(3.5).step]};
    });
    // Chrome can quantize offscreen antialiasing by one alpha / two premultiplied RGB levels.
    assert(seam.alphaDifference<=1&&seam.premultDifference<=2&&seam.tail.mix>.99&&seam.tail.next.name==='sit'&&seam.hands.join(',')==='4,9','Penguin colors/pose must match at the exact loop boundary with alternate wave slots');

    for(const at of [2,7,24,36]){

      await page.goto(base+'index.html?paused=1&quality=high&at='+at);await ready();

      const file=`lobby-${at}s.png`;await page.screenshot({path:path.join(out,file)});frames.push(file);

    }

    await page.goto(base+'index.html?layer=foreground&paused=1&quality=high');await ready();

    const alpha=await page.evaluate(()=>{const c=document.querySelector('canvas').getContext('2d');return [c.getImageData(960,520,1,1).data[3],c.getImageData(960,825,1,1).data[3]];});

    assert(alpha[0]===0&&alpha[1]>240,'Camera must remain visible above the opaque foreground booth');

    assert(requests.some(r=>/clubhouse/.test(r))&&requests.some(r=>/booth/.test(r)),'Original room and booth must be retained');

    await page.goto(base+'index.html?quality=standard');await ready();

    assert(await page.locator('canvas').evaluate(c=>c.width===1920&&c.height===1080),'Default rendering must use native full HD');

    const before=await page.locator('canvas').getAttribute('data-time');

    await page.waitForFunction(t=>Number(document.querySelector('canvas').dataset.time)>Number(t)+.6,before);

    const moving=await page.locator('canvas').getAttribute('data-time');

    await page.keyboard.press('w');await page.keyboard.press('p');await page.keyboard.press('Space');

    await page.screenshot({path:path.join(out,'live-accents.png')});

    await page.goto(base+'studio.html');await page.frameLocator('#preview').locator('canvas[data-ready="true"]').waitFor();

    await page.getByLabel('Use it for').selectOption('break');

    await page.getByLabel('The sign',{exact:true}).fill('COME BACK SOON');

    await page.getByLabel('Colors').selectOption('sunset');await page.getByLabel('On the big screen').selectOption('liquid');

    assert((await page.locator('#open').getAttribute('href')).includes('COME+BACK+SOON'),'Full preview did not encode title');
    assert(!(await page.locator('#url').inputValue()).includes('background=')&&!(await page.locator('#url').inputValue()).includes('title='),'OBS links must follow shared display choices');

    assert((await page.locator('#open').getAttribute('href')).includes('background=liquid'),'Full-screen link did not follow controls');

    await page.getByRole('button',{name:'Pause motion',exact:true}).click();

    const frame=page.frames().find(f=>f.url().includes('index.html'));

    await frame.waitForFunction(()=>document.querySelector('canvas').dataset.paused==='true');

    const paused1=await frame.locator('canvas').getAttribute('data-time');

    await page.waitForTimeout(200);

    assert(await frame.locator('canvas').getAttribute('data-time')===paused1,'Pause left a running animation loop');

    await page.getByRole('button',{name:'Resume motion',exact:true}).click();

    await frame.waitForFunction(t=>Number(document.querySelector('canvas').dataset.time)>Number(t)+.2,paused1);

    await page.screenshot({path:path.join(out,'studio-desktop.png'),fullPage:true});

    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'studio-mobile.png'),fullPage:true});

    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Studio overflows mobile viewport');

    // Exercise real HTTP imports with a disposable catalog, including OBS-style
    // automatic selections and silent video cleanup. No personal media is changed.
    await page.setViewportSize({width:1920,height:1080});
    await page.locator('#screen-upload').setInputFiles(path.join(app,'spirit-lobby','art','clubhouse-clean.webp'));
    await page.getByRole('status').filter({hasText:'Added and previewing'}).waitFor();
    const imported=await page.getByLabel('On the big screen').inputValue();
    await page.locator('#screen-target').selectOption('left');await page.locator('#screen-assets').getByRole('button',{name:'Use on selected screen'}).click();
    assert(await page.locator('[name=leftScreen]').inputValue()===imported,'Wall displays must accept library media');await page.locator('#screen-target').selectOption('main');
    assert(/^[a-f0-9]{32}$/.test(imported),'Imported artwork did not enter the shared library');
    const previewFrame=page.frames().find(f=>f.url().includes('index.html'));
    await previewFrame.waitForFunction(id=>{const c=document.querySelector('canvas');return c.dataset.screen===id&&c.dataset.screenReady==='true';},imported);
    await page.getByRole('button',{name:'Apply screens to OBS',exact:true}).click();
    await page.locator('#screen-status').filter({hasText:'Saved.'}).waitFor();
    const follower=await browser.newPage({viewport:{width:1920,height:1080}});
    await follower.goto(await page.locator('#url').inputValue());
    await follower.locator('canvas[data-ready="true"]').waitFor();
    await follower.waitForFunction(id=>document.querySelector('canvas').dataset.screen===id&&document.querySelector('canvas').dataset.screenReady==='true',imported);
    await follower.close();
    await page.locator('#screen-assets').getByRole('button',{name:'Remove from library'}).click();
    await page.locator('#screen-status').filter({hasText:'Original and imported files were preserved'}).waitFor();
    assert(fs.readdirSync(fixtureRoot).some(name=>name===imported+'.webp'),'Removing an entry deleted its media copy');
    const videoAsset=path.join(out,'spirit-afterparty-preview.mp4');
    if(fs.existsSync(videoAsset)){
      await page.locator('#screen-upload').setInputFiles(videoAsset);
      await page.locator('#screen-status').filter({hasText:'Added and previewing'}).waitFor();
      const videoId=await page.getByLabel('On the big screen').inputValue();
      await previewFrame.waitForFunction(id=>document.querySelector('canvas').dataset.screen===id&&document.querySelector('canvas').dataset.screenReady==='true',videoId);
      const media=await previewFrame.evaluate(async id=>{
        const {ScreenContent}=await import('./screen-content.js'),{readConfig}=await import('./config.js');const owner=await new ScreenContent().load(),config=readConfig('?layer=background&background='+id);owner.tick(config);
        await new Promise(resolve=>owner.slots.get('main').media.addEventListener('loadeddata',resolve,{once:true}));owner.tick(config);const slot=owner.slots.get('main');
        const flags={muted:slot.media.muted,loop:slot.media.loop};owner.suspend(true);flags.paused=slot.media.paused;owner.dispose();flags.released=owner.slots.size===0;return flags;
      },videoId);
      assert(media.muted&&media.loop&&media.paused&&media.released,'Custom video must be silent, repeat and release its resources');
      await page.locator('#screen-assets').getByRole('button',{name:'Remove from library'}).click();
      await page.locator('#screen-status').filter({hasText:'Original and imported files were preserved'}).waitFor();
    }
    await page.getByLabel('On the big screen').selectOption('cosmos');
    await page.getByRole('button',{name:'Apply screens to OBS',exact:true}).click();
    await page.locator('#screen-status').filter({hasText:'Saved.'}).waitFor();
    const journey=await page.evaluate(async()=>{
      const {FractalGalaxy}=await import('./fractal-galaxy.js'),galaxy=new FractalGalaxy(),canvas=document.createElement('canvas');canvas.width=640;canvas.height=236;const c=canvas.getContext('2d',{willReadFrequently:true}),colors=['#63fff0','#ed69ff','#a88aff','#ffc86a'];
      function frame(t){c.setTransform(1,0,0,1,0,0);c.fillStyle='#050716';c.fillRect(0,0,640,236);c.translate(320,118);galaxy.draw(c,t,colors);return c.getImageData(0,0,640,236).data;}
      const a=frame(0),b=frame(36);let changes=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1])changes++;
      for(let t=0;t<=3600;t+=60)frame(t);return {changes,cache:galaxy.cache.size};
    });
    assert(journey.changes>1000&&journey.cache<=8,'Galaxy must reveal new systems over time with bounded texture memory');
    assert(errors.length===0,errors.join('\n'));

    const videoContext=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:720}}});

    const videoPage=await videoContext.newPage();videoPage.on('pageerror',e=>errors.push(e.stack||e.message));await videoPage.goto(base+'index.html?at=20&title=GOOD+NIGHT&subtitle=THANKS+FOR+HANGING+OUT');

    await videoPage.locator('canvas[data-ready="true"]').waitFor();

    await videoPage.waitForFunction(()=>Number(document.querySelector('canvas').dataset.time)>=42);

    const paintMs=await videoPage.locator('canvas').getAttribute('data-paint-ms');

    assert(errors.length===0,errors.join('\n'));

    const video=videoPage.video();await videoContext.close();await video.saveAs(path.join(out,'spirit-afterparty-preview.webm'));

    const report={frames,errors,animated:{before,moving},controls:true,pause:true,mobile:true,screenLibrary:true,seamlessPenguins:true,alternateHands:true,journey,paintMs};

    fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

  }finally{if(browser)await browser.close();fixture.kill();if(fixtureRoot.startsWith(path.resolve(out)+path.sep)&&path.basename(fixtureRoot).startsWith('fixture-'))fs.rmSync(fixtureRoot,{recursive:true,force:true});}

}


main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
