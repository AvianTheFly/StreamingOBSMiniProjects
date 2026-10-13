// Finite derived-art publisher. Extract with the actual browser pixel algorithm;
// original sheets, personal data, live events, audio and OBS remain untouched.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),web=path.join(root,'mini projects/scene_voice_switcher/web');
const ids=['arcade','tavern','forge','future','sky-harbor'];
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();
  await page.route('http://prepare.test/**',route=>{
   const name=new URL(route.request().url()).pathname;
   if(name==='/')return route.fulfill({contentType:'text/html',body:'<body></body>'});
   const file=name.startsWith('/shared/')?path.join(root,'lib/browser_effects/web',name.slice(8)):path.join(web,name);
   if(!file.startsWith(web+path.sep)&&!file.startsWith(path.join(root,'lib/browser_effects/web')+path.sep))return route.fulfill({status:404});
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':'image/png'});
  });
  await page.goto('http://prepare.test/');
  const manifest={};
  for(const id of ids){
   const parts=await page.evaluate(async id=>{
    const {LobbyResidents}=await import('/lobby-residents.js');
    const cast=new LobbyResidents(id);await cast.load({prepared:false});
    try{return cast.sprites.map((s,i)=>({bounds:cast.bounds[i],png:s.toDataURL('image/png').split(',')[1]}));}
    finally{cast.dispose();}
   },id);
   const source=fs.readFileSync(path.join(web,'art',id+'-cast-v1.png'));
   manifest[id]={sha256:crypto.createHash('sha256').update(source).digest('hex'),parts:[]};
   for(let i=0;i<parts.length;i++){
    const filename=`${id}-resident-${i}.png`,dir=path.join(web,'art/prepared');fs.mkdirSync(dir,{recursive:true});
    const target=path.join(dir,filename),tmp=target+'.tmp';fs.writeFileSync(tmp,Buffer.from(parts[i].png,'base64'));fs.renameSync(tmp,target);
    manifest[id].parts.push({bounds:parts[i].bounds,url:'./art/prepared/'+filename});
   }
  }
  const target=path.join(web,'resident-parts.js');
  fs.writeFileSync(target+'.tmp','// Derived by tools/prepare_lobby_cast.cjs; source fingerprints gate reuse.\nexport const preparedResidents='+JSON.stringify(manifest,null,2)+';\n');
  fs.renameSync(target+'.tmp',target);
  console.log(JSON.stringify({preparedWorlds:ids,parts:15}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
