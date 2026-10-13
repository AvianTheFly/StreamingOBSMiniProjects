// Finite OBS packaging: generated RGB plus the exact existing personal alpha mask.
// No artwork synthesis or mask editing. Originals remain untouched.
const sharp=require('sharp'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const root=path.resolve(__dirname,'..','mini projects','scene_voice_switcher');
(async()=>{
 const report=[];
 for(const [stem,art] of [['forge','forge'],['sanctuary','ionian'],['phoenix-observatory','cryophoenix']]){
  const mask=path.join(root,'art',stem+'-foreground-cutout.png'),plate=path.join(root,'web','art',art+'-habitat-v3.png'),output=path.join(root,'web','art',art+'-habitat-v3-foreground.png');
  const {width,height}=await sharp(mask).metadata(),alpha=await sharp(mask).extractChannel('alpha').raw().toBuffer();
  const rgb=await sharp(plate).resize(width,height,{fit:'fill'}).removeAlpha().raw().toBuffer();
  await sharp(rgb,{raw:{width,height,channels:3}}).joinChannel(alpha,{raw:{width,height,channels:1}}).png().toFile(output);
  assert(alpha.equals(await sharp(output).extractChannel('alpha').raw().toBuffer()));
  assert(rgb.equals(await sharp(output).removeAlpha().raw().toBuffer()));
  report.push({plate,mask,output,width,height,alphaUnchanged:true,plateSha256:sha(fs.readFileSync(plate)),rgbSha256:sha(rgb)});
 }
 fs.writeFileSync(path.join(root,'web','art','habitat-layer-provenance.json'),JSON.stringify(report,null,2));
 console.log('Packaged three native foregrounds with byte-identical original alpha.');
})().catch(e=>{console.error(e);process.exitCode=1;});
