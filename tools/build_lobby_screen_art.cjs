// Finite compiler for generated background plates and exact native display frames.
// No OBS, network listeners, user settings or live browser channels.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..');
async function build(){
 const recipePath=path.join(root,'mini projects/scene_voice_switcher/art/screen-refresh/recipe.json');
 const recipe=JSON.parse(fs.readFileSync(recipePath,'utf8'));
 const shared=fs.readFileSync(path.join(root,'lib/browser_effects/web/display-frame.js'),'utf8');
 const sharedUrl='data:text/javascript;base64,'+Buffer.from(shared).toString('base64');
 const local=fs.readFileSync(path.join(root,'mini projects/scene_voice_switcher/web/screen-frame.js'),'utf8').replace('./shared/display-frame.js',sharedUrl);
 const localUrl='data:text/javascript;base64,'+Buffer.from(local).toString('base64');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  await page.setContent('<canvas width="1920" height="1080"></canvas>');
  for(const spec of recipe.assets){
   const bytes=fs.readFileSync(path.join(root,spec.plate));
   const png=await page.evaluate(async({src,id,screen,localUrl})=>{
    const image=new Image();image.src=src;await image.decode();
    const canvas=document.querySelector('canvas'),c=canvas.getContext('2d');
    c.clearRect(0,0,1920,1080);c.drawImage(image,0,0,1920,1080);
    const {screenFrame}=await import(localUrl);screenFrame(c,screen,id);
    return canvas.toDataURL('image/png').split(',')[1];
   },{src:'data:image/png;base64,'+bytes.toString('base64'),id:spec.id,screen:spec.screen,localUrl});
   for(const file of spec.outputs){
    const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});
    const temporary=target+'.screen-tmp';let output=Buffer.from(png,'base64');
    if(target.endsWith('.webp'))output=await sharp(output).webp({lossless:true}).toBuffer();
    fs.writeFileSync(temporary,output);fs.renameSync(temporary,target);
   }
   console.log(spec.id+': '+spec.screen[2]+' x '+spec.screen[3]);
  }
 }finally{await browser.close();}
}
build().catch(e=>{console.error(e);process.exitCode=1;});
