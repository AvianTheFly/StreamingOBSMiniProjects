// Disposable browser fixture. --live checks the Hub using GET requests only.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const app=path.resolve(__dirname,'../hub_ui/app'),output=path.resolve(__dirname,'../output/twitch-command-pack');
const config={channel:'test_channel',enabled:true,revision:'one',commands:[{command:'!discord',aliases:['!dc'],enabled:true,response:'Fixture Discord link',category:'Links',cooldown:30,permission:'everyone',kind:'text',note:''},{command:'!schedule',aliases:['!when'],enabled:false,response:'',category:'Awaiting details',cooldown:30,permission:'everyone',kind:'text',note:'Enter your schedule.'}],chat:{delivery:{message:'Fixture replies ready'}}};
async function main(){
 if(process.argv.includes('--live')){
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
   const errors=[],page=await browser.newPage({viewport:{width:1440,height:1000}});
   page.on('pageerror',e=>errors.push(e.message));
   await page.route(url=>new URL(url).pathname!=='/api/events',r=>r.request().method()==='GET'?r.continue():r.abort());
   await page.goto('http://127.0.0.1:7420/#projects/twitch_commands',{waitUntil:'domcontentloaded'});
   await page.getByText('Your command catalog is ready.',{exact:true}).waitFor();
   assert.match(await page.locator('#tcDelivery').innerText(),/Ready.*replies from @udyrisabotlaner/);
   assert.equal(await page.locator('#tcEnabled').isChecked(),true);
   await page.locator('[data-command="!opgg"]').click();
   assert.match(await page.locator('#tcResponse').inputValue(),/op\.gg\/lol\/summoners\/na\/UdyrIsABotLaner-Inter/);
   await page.screenshot({path:path.join(output,'live-custom-command-editor.png'),fullPage:true});
   assert.deepEqual(errors,[]);console.log('Live command editor: full Hub routing, catalog, authorization and personalized OP.GG response passed (read only).');
  }finally{await browser.close();}
  return;
 }
 const writes=[],errors=[];let current=structuredClone(config);
 const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/api/twitch-commands')){
   let value=current;
   if(req.method==='POST'){
    let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);writes.push({pathname,data});
    if(pathname.endsWith('/preview'))value={response:'Fixture preview only'};
    else{assert.equal(data.revision,current.revision);if('enabled'in data)current.enabled=data.enabled;if(data.command){const i=current.commands.findIndex(c=>c.command===data.original);if(i>=0)current.commands[i]={...current.commands[i],...data.command};else current.commands.push(data.command);}current.revision+='x';value=current;}
   }
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
  }
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<link rel="stylesheet" href="/css/main.css"><link rel="stylesheet" href="/css/workspace.css"><main id="page" style="margin:0;padding:24px"></main><script type="module">import {mount} from "/js/pages/twitch-commands.js";mount(document.querySelector("main"));</script>');return;}
  const file=path.resolve(app,'.'+pathname);if(!file.startsWith(app+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByRole('button',{name:'!discord · Enabled !dc',exact:true}).click();
  await page.locator('#tcResponse').fill('Updated fixture response');await page.getByRole('button',{name:'Save command',exact:true}).click();
  await page.getByText('Saved. Aliases now use this same reply.').waitFor();assert.equal(current.commands[0].response,'Updated fixture response');assert.deepEqual(current.commands[0].aliases,['!dc']);
  await page.locator('#tcPreviewText').fill('!dc');await page.getByRole('button',{name:'Preview reply'}).click();await page.getByText('Fixture preview only').waitFor();assert.equal(writes.filter(w=>w.pathname.endsWith('/settings')).length,1);
  await page.locator('#tcSearch').fill('when');assert.equal(await page.locator('[data-command]').count(),1);
  await page.locator('#tcSearch').fill('');await page.locator('#tcEnabled').uncheck();await page.getByText('Chat replies disabled.',{exact:true}).waitFor();assert.equal(current.enabled,false);
  await page.getByRole('button',{name:'New command',exact:true}).click();await page.locator('#tcName').fill('!hello');await page.locator('#tcResponse').fill('<img src=x onerror=alert(1)>');await page.getByRole('button',{name:'Save command',exact:true}).click();await page.getByText('Saved. Aliases now use this same reply.').waitFor();assert.equal(current.commands.length,3);
  await page.screenshot({path:path.join(output,'custom-command-editor-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(output,'custom-command-editor-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('Command UI: search, save, aliases, private preview, disabled switch, escaped text and mobile layout passed.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
