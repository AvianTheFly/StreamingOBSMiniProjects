// Finite isolated browser review: no live service, key presses or OBS writes.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/udyr-stance-loops');
const web=path.join(root,'mini projects/league_api/production/web');
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(req.url.split('?')[0]);
  if(name==='/'){res.setHeader('Content-Type','text/html');return res.end('<body style="margin:0;background:#17212d"><div id="stage"></div><canvas id="c" width="1920" height="1080"></canvas></body>');}
  if(name==='/subtle.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(root,'lib/browser_effects/web/subtle.js')));}
  const file=path.resolve(web,'.'+name);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(file));
});
(async()=>{let browser;await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  await page.goto('http://127.0.0.1:'+server.address().port);
  const result=await page.evaluate(async()=>{
    const {StanceAccent}=await import('/stance-accent.js');
    const canvas=document.querySelector('canvas'),c=canvas.getContext('2d',{willReadFrequently:true});
    const accent=new StanceAccent(),tiles=[...accent.tiles.values()];
    const counts=[],check=(v,m)=>{if(!v)throw Error(m);};
    for(const key of 'qwer'){
      c.clearRect(0,0,1920,1080);accent.draw(c,{key,elapsed:.6,duration:1.2});
      const pixels=c.getImageData(0,0,1920,1080).data;let painted=0,maxAlpha=0;
      for(let y=0;y<1080;y++)for(let x=0;x<1920;x++){
        const a=pixels[(y*1920+x)*4+3];maxAlpha=Math.max(maxAlpha,a);if(a)painted++;
        if(x>=32&&x<1888)check(a===0,'Accent escapes narrow side strips');
      }
      check(maxAlpha<=17&&maxAlpha>=12,'Opacity must stay extremely subtle');
      check(painted>1000&&painted<35840,'Bounded side coverage');counts.push({key,painted,maxAlpha});
      for(const elapsed of [0,1.2,2]){c.clearRect(0,0,1920,1080);accent.draw(c,{key,elapsed,duration:1.2});check(!c.getImageData(0,0,1920,1080).data.some((v,i)=>i%4===3&&v),'Expired cue remains visible');}
    }
    let created=0;const original=document.createElement.bind(document);
    document.createElement=(...args)=>{if(args[0]==='canvas')created++;return original(...args);};
    const cue={key:'q',elapsed:.6,duration:1.2},began=performance.now();
    for(let i=0;i<2000;i++){c.clearRect(0,260,32,560);c.clearRect(1888,260,32,560);cue.key='qwer'[i%4];accent.draw(c,cue);}
    const meanMs=(performance.now()-began)/2000;
    check(created===0,'Cast-time canvas allocation');check(tiles.every((t,i)=>t===[...accent.tiles.values()][i]),'Unbounded cache');
    c.clearRect(0,0,1920,1080);accent.draw(c,{key:'q',elapsed:.6,duration:1.2});
    const bytes=tiles.reduce((n,t)=>n+t.width*t.height*4,0);
    window.accent=accent;return {counts,cacheBytes:bytes,meanDrawMs:meanMs,castTimeCanvases:created};
  });
  fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'subtle-border.png')});
  await page.evaluate(()=>{window.accent.dispose();if(window.accent.tiles.size)throw Error('Cache not released');});
  await page.evaluate(async()=>{await import('/overlay.js');window.leagueProduction.update({enabled:true,opacity:1,stance:{key:'w',elapsed:0,duration:1.2}});});
  await page.waitForFunction(()=>document.querySelector('#production-effects').getContext('2d').getImageData(0,400,32,100).data.some((v,i)=>i%4===3&&v),{timeout:3000});
  await page.evaluate(()=>window.leagueProduction.update({enabled:true,opacity:1,stance:{key:'w',elapsed:2,duration:1.2}}));
  await page.waitForFunction(()=>!document.querySelector('#production-effects').getContext('2d').getImageData(0,400,32,100).data.some((v,i)=>i%4===3&&v),{timeout:3000});
  result.standaloneAccentStartsAndExpires=true;
  fs.writeFileSync(path.join(out,'border-review.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(browser)await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
