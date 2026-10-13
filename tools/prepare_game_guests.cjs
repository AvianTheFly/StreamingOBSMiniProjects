// Finite sprite preparation: isolate each atlas cell's connected character.
// Keep the original generated atlas; never touch personal settings or OBS.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..','mini projects/scene_voice_switcher/web');
(async()=>{
 const manifest={},hashes={};
 for(const [file,names] of [['game-guests-v1.png',['kirby','boo','crewmate','creeper']],['game-stunts-v1.png',['goose','climber','hornet','salvager']]]){
 const input=fs.readFileSync(path.join(root,'art',file));hashes[file]=crypto.createHash('sha256').update(input).digest('hex');
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let row=0;row<4;row++)for(let col=0;col<3;col++){
  const x0=Math.round(col*info.width/3),y0=Math.round(row*info.height/4),w=Math.round((col+1)*info.width/3)-x0,h=Math.round((row+1)*info.height/4)-y0;
  const labels=new Uint32Array(w*h),queue=new Uint32Array(w*h);let serial=0,best=null;
  const alpha=p=>data[((Math.floor(p/w)+y0)*info.width+p%w+x0)*4+3];
  for(let start=0;start<w*h;start++){
   if(labels[start]||alpha(start)<32)continue;
   const id=++serial;let head=0,tail=1,left=w,top=h,right=0,bottom=0;queue[0]=start;labels[start]=id;
   while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    for(const n of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(n>=0&&!labels[n]&&alpha(n)>=32){labels[n]=id;queue[tail++]=n;}}
   if(!best||tail>best.count)best={id,count:tail,left,top,right,bottom};
  }
  if(!best||best.count<w*h*.1)throw Error('Missing character: '+names[row]+'/'+col);
  const bw=best.right-best.left+1,bh=best.bottom-best.top+1,output=Buffer.alloc(bw*bh*4);
  for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){
   const p=(y+best.top)*w+x+best.left;if(labels[p]!==best.id)continue;
   const src=((y+y0+best.top)*info.width+x+x0+best.left)*4;data.copy(output,(y*bw+x)*4,src,src+4);
  }
  const filename=`game-${names[row]}-${col}.png`,dir=path.join(root,'art/prepared');fs.mkdirSync(dir,{recursive:true});
  await sharp(output,{raw:{width:bw,height:bh,channels:4}}).png().toFile(path.join(dir,filename));
  (manifest[names[row]]??=[]).push({url:'./art/prepared/'+filename,width:bw,height:bh});
 }
 }
 fs.writeFileSync(path.join(root,'game-guest-assets.js'),'// Prepared by tools/prepare_game_guests.cjs; original source sheets stay intact.\nexport const atlasHashes='+JSON.stringify(hashes)+';\nexport const guestAssets='+JSON.stringify(manifest,null,2)+';\n');
 console.log('Prepared 24 character poses with isolated alpha.');
})().catch(e=>{console.error(e);process.exitCode=1;});
