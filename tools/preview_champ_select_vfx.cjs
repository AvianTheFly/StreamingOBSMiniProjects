// Read-only live-HTTP rehearsal recording. Never posts state or changes OBS scenes.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const output=path.resolve(__dirname,'../output/champ-select-vfx');
(async()=>{
 fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:output,size:{width:1600,height:900}}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const theme of ['bear','turtle','ram','phoenix']){
   await page.goto(`http://127.0.0.1:7431/champ-select?demo=1&theme=${theme}`);await page.locator('#stage.art-ready').waitFor();await page.evaluate(()=>document.fonts.ready);await page.locator('.demo-controls').evaluate(e=>e.style.opacity='0');
   await page.waitForTimeout(500);await page.getByRole('button',{name:'Lock pick',exact:true}).click();await page.waitForTimeout(3300);
   await page.getByRole('button',{name:'Chat',exact:true}).click();await page.waitForTimeout(1800);
   await page.getByRole('button',{name:'Ban',exact:true}).click();await page.waitForTimeout(1600);
   await page.getByRole('button',{name:'Team ready',exact:true}).click();await page.waitForTimeout(2900);
  }
  if(errors.length)throw Error(errors.join('\n'));await context.close();await page.video().saveAs(path.join(output,'spirit-vfx-preview.webm'));console.log('Four-world live HTTP rehearsal recorded without browser errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
