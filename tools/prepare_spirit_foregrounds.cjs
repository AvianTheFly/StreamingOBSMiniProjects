// Publication only: apply the existing OBS occlusion alpha to the generated art.
// Painting is authored with imagegen; original personal/source assets are retained.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'../mini projects/scene_voice_switcher');
(async()=>{
 const out=path.join(root,'art/udyr-refresh');fs.mkdirSync(out,{recursive:true});
 for(const [name,painting] of [['sanctuary','ionian-open-v1'],['phoenix-observatory','cryophoenix-open-v1'],['forge','forge-open-v1']]){
  const mask=await sharp(path.join(root,`art/${name}-foreground-cutout.png`)).extractChannel('alpha').raw().toBuffer({resolveWithObject:true});
  const {width,height}=mask.info;
  await sharp(path.join(root,`web/art/${painting}.png`)).resize(width,height,{fit:'fill'}).removeAlpha().joinChannel(mask.data,{raw:{width,height,channels:1}}).png().toFile(path.join(out,`${name}-foreground.png`));
 }
 console.log('Published three foreground plates using unchanged original occlusion alpha.');
})().catch(e=>{console.error(e);process.exitCode=1;});
