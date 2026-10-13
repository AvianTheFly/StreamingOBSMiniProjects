// Native packaging for the user-requested four unique layouts. The authored
// rectangular camera opening is a compositing contract, not generated artwork.
const sharp=require('sharp'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..','mini projects','scene_voice_switcher'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const designs=JSON.parse(fs.readFileSync(path.join(root,'habitat-layouts.json'))),report=[];
 for(const d of Object.values(designs)){
  if(d.source==='AuroraCampLobby')continue;
  const plate=path.join(root,'web','art',d.art+'.png'),output=path.join(root,'web','art',d.art+'-foreground.png'),width=1920,height=1080;
  const rgb=await sharp(plate).resize(width,height,{fit:'fill'}).removeAlpha().raw().toBuffer(),alpha=Buffer.alloc(width*height,255);
  const [x,y,w,h]=d.camera;for(let row=y;row<y+h;row++)alpha.fill(0,row*width+x,row*width+x+w);
  await sharp(rgb,{raw:{width,height,channels:3}}).joinChannel(alpha,{raw:{width,height,channels:1}}).png().toFile(output);
  assert(alpha.equals(await sharp(output).extractChannel('alpha').raw().toBuffer()));assert(rgb.equals(await sharp(output).removeAlpha().raw().toBuffer()));
  report.push({source:d.source,plate,output,camera:d.camera,width,height,plateSha256:sha(fs.readFileSync(plate)),rgbSha256:sha(rgb),alphaSha256:sha(alpha)});
 }
 fs.writeFileSync(path.join(root,'web','art','distinct-layer-provenance.json'),JSON.stringify(report,null,2));
 console.log('Packaged three native layers for independent camera placements; first-pass masks remain untouched.');
})().catch(e=>{console.error(e);process.exitCode=1;});
