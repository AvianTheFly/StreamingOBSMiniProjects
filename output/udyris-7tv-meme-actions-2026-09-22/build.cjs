const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('../twitch-party-emotes-2026-09-22/build/node_modules/@napi-rs/canvas');
const {GIFEncoder,quantize,applyPalette}=require('../twitch-party-emotes-2026-09-22/build/node_modules/gifenc');
const root=__dirname;
const specs=[
 {name:'OHNOO',file:'SLEEPY.png',title:'The psychic panic',animal:'Turtle',caption:'OH NOO',color:'#70f8ff',beats:[4,4,4,5,5,5,15,6],story:['Notice','Gulp','Wide eyes','Hands up','Overload','Flail','OH NOO','Dazed'],description:'A turtle spirit sees disaster coming, overloads with cyan energy, then flops into a daze.'},
 {name:'COPIUM',file:'OHNOO.png',title:'A very large sip',animal:'Ram',caption:'COPIUM',color:'#6ab8ff',beats:[4,4,5,5,5,6,15,6],story:['Smug','Uh oh','Find bottle','Stare','Shake','Chug','COPIUM','Recover'],description:'A ram processes the loss, finds a glowing blue bottle, takes a huge sip and rallies.'},
 {name:'YEP',file:'YEP.png',title:'Approved by fire',animal:'Phoenix',caption:'YEP',color:'#ffd35a',beats:[4,4,4,5,4,5,15,6],story:['Cool','Nod','Nod','Shades','Point','Thumbs up','YEP','Swagger'],description:'A phoenix nods, drops its shades, points at chat and seals it with a fiery approval.'},
 {name:'BONK',file:'BONK.png',title:'The bonk finds you',animal:'Bear',caption:'BONK',color:'#ffd86b',beats:[4,4,4,4,5,5,15,6],story:['Strut','Notice','Confused','Incoming','Bonk','Dizzy','BONK','Shrug'],description:'A bear sees a giant foam mallet too late, gets bonked, spins out and shrugs it off.'},
 {name:'SLEEPY',file:'COPIUM.png',title:'Queue nap',animal:'Turtle',caption:'ZZZ',color:'#a3ffe2',beats:[4,4,5,5,5,6,14,6],story:['Ready','Blink','Yawn','Wobble','Pillow','Shell nap','ZZZ','Jolt awake'],description:'A turtle slows down, conjures a star pillow, curls up in its shell, then jolts awake.'},
 {name:'HYPE',file:'HYPE.png',title:'Full send',animal:'Ram',caption:'HYPE',color:'#d072ff',beats:[4,4,4,5,4,5,15,6],story:['Ready','Charge','Glowsticks','Raise','Swing left','Swing right','HYPE','Land'],description:'A thunder ram charges up, breaks out glowsticks, swings them and lands a lightning hype pose.'}
];
function smooth(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
function locate(spec,n){let start=0;for(let p=0;p<8;p++){if(n<start+spec.beats[p])return{pose:p,local:(n-start)/spec.beats[p],start};start+=spec.beats[p];}throw Error('frame');}
function star(ctx,x,y,r,color,rot=0){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.beginPath();for(let i=0;i<8;i++){let a=i*Math.PI/4,rr=i%2?r*.28:r;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.restore();}
function caption(ctx,text,color,k){
 const pop=1+.10*Math.sin(Math.PI*Math.min(1,k*4))*(1-Math.min(1,k*4));
 ctx.save();ctx.translate(56,99);ctx.scale(pop,pop);ctx.font='900 23px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
 const width=ctx.measureText(text).width;ctx.scale(Math.min(1,100/width),1);
 ctx.lineJoin='round';ctx.strokeStyle='#160d25';ctx.lineWidth=6;ctx.strokeText(text,0,0);ctx.strokeStyle='#fff7ee';ctx.lineWidth=2;ctx.strokeText(text,0,0);ctx.fillStyle=color;ctx.fillText(text,0,0);ctx.restore();
}
function draw(spec,tiles,n,size){
 const c=createCanvas(size,size),ctx=c.getContext('2d');ctx.scale(size/112,size/112);
 const {pose,local}=locate(spec,n);const tagged=!!spec.caption;
 const drawSize=tagged?94:106,dx=(112-drawSize)/2,dy=tagged?0:3;
 // Each pose is separately drawn character acting. Inter-pose effects add motion,
 // while the main body is kept stable instead of applying generic bounce presets.
 ctx.drawImage(tiles[pose],dx,dy,drawSize,drawSize);
 if(spec.name==='COOKED'&&pose>=3&&pose<=5){
  const phase=(pose-3+local)/3;
  ctx.lineCap='round';
  for(let j=0;j<3;j++){const a=phase*Math.PI*2+j*2.1;ctx.beginPath();ctx.ellipse(56,65,34+4*j,10+2*j,-.18,a,a+.9);ctx.strokeStyle=['#ff641f','#ffcc28','#fff69e'][j];ctx.lineWidth=3-j*.6;ctx.stroke();}
 }
 if(spec.name==='SHATTER'&&pose===3){ctx.strokeStyle='#b4ffe3';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(56,48,39,-Math.PI/2+local*1.5,-Math.PI/2+local*1.5+1);ctx.stroke();}
 if(spec.name==='SHATTER'&&pose===5){for(let j=0;j<5;j++){let a=-2.8+j*.65,r=26+local*22;star(ctx,56+Math.cos(a)*r,56+Math.sin(a)*r,3,'#baffdf',local*2+j);}}
 if(spec.name==='GOTCHA'&&pose===4){ctx.strokeStyle='#fff1ae';ctx.lineWidth=2;for(let j=0;j<5;j++){let a=-1.7+j*.7;ctx.beginPath();ctx.moveTo(80+Math.cos(a)*8,54+Math.sin(a)*8);ctx.lineTo(80+Math.cos(a)*(13+local*8),54+Math.sin(a)*(13+local*8));ctx.stroke();}}
 if(spec.name==='ITHREW'&&pose===4){ctx.strokeStyle='#72eaff';ctx.lineWidth=1.7;ctx.beginPath();ctx.ellipse(68,83,8+local*16,2+local*2,0,0,Math.PI*2);ctx.stroke();}
 if(spec.name==='RAVE'){
  for(let j=0;j<5;j++){const t=n/48+j*.19,x=8+j*24,y=8+((t*65)%76);star(ctx,x,y,2.4,['#ff60e3','#6cfbff','#ffe16b'][j%3],t*3);}
 }
 if((spec.name==='GG'&&pose>=3&&pose<=6)||(spec.name==='CLUTCH'&&pose===6)){
  for(let j=0;j<5;j++){let p=((n+j*7)%25)/25;star(ctx,6+j*24,8+p*29,2.1,['#ffe89c','#81ffd9','#fc93ee'][j%3],p*3);}
 }
 if(tagged&&((spec.name==='SHATTER'&&pose>=6)||(spec.name!=='SHATTER'&&pose>=5))){
  const payoffStart=spec.beats.slice(0,spec.name==='SHATTER'?6:5).reduce((a,b)=>a+b,0);
  ctx.globalAlpha=pose===7?1-smooth(local):1;
  caption(ctx,spec.caption,spec.color,(n-payoffStart)/12);ctx.globalAlpha=1;
 }
 return c;
}
function writeGIF(frames,size,file){
 const enc=GIFEncoder();
 for(const frame of frames){
  const rgba=frame.getContext('2d').getImageData(0,0,size,size).data;
  // A reserved transparent index keeps the alpha channel independent of color quantization.
  for(let i=0;i<rgba.length;i+=4)if(rgba[i+3]<128){rgba[i]=rgba[i+1]=rgba[i+2]=0;}
  const palette=quantize(rgba,255,{format:'rgb565'}),index=applyPalette(rgba,palette,'rgb565'),transparentIndex=palette.length;
  palette.push([0,0,0]);for(let i=0;i<index.length;i++)if(rgba[i*4+3]<128)index[i]=transparentIndex;
  enc.writeFrame(index,size,size,{palette,transparent:true,transparentIndex,delay:40,repeat:0,dispose:2});
 }
 enc.finish();const data=enc.bytes();fs.writeFileSync(file,data);return data.length;
}
(async()=>{
 for(const dir of ['sources','gif','preview','thumbs','storyboards','small'])fs.mkdirSync(path.join(root,dir),{recursive:true});
 const manifest=[];const board=createCanvas(1120,680),bc=board.getContext('2d');bc.fillStyle='#171321';bc.fillRect(0,0,1120,680);
 for(let si=0;si<specs.length;si++){
  const spec=specs[si],src=path.join(root,'sources',spec.file);const img=await loadImage(src);
  const cw=img.width/4,ch=img.height/2,tiles=[];
  for(let p=0;p<8;p++){const c=createCanvas(cw,ch);c.getContext('2d').drawImage(img,(p%4)*cw,Math.floor(p/4)*ch,cw,ch,0,0,cw,ch);tiles.push(c);}
  const count=spec.beats.reduce((a,b)=>a+b,0);const frames=Array.from({length:count},(_,n)=>draw(spec,tiles,n,112));
  const bytes=writeGIF(frames,112,path.join(root,'gif',spec.name+'.gif'));
  if(bytes>=1000000||count>60)throw Error('Twitch limit exceeded '+spec.name);
  for(const size of [28,56])writeGIF(Array.from({length:count},(_,n)=>draw(spec,tiles,n,size)),size,path.join(root,'small',spec.name+'-'+size+'.gif'));
  writeGIF(Array.from({length:count},(_,n)=>draw(spec,tiles,n,224)),224,path.join(root,'preview',spec.name+'.gif'));
  const heroFrame=spec.beats.slice(0,6).reduce((a,b)=>a+b,0)+3;
  fs.writeFileSync(path.join(root,'thumbs',spec.name+'.png'),frames[heroFrame].toBuffer('image/png'));
  const strip=createCanvas(1024,160),sc=strip.getContext('2d');sc.fillStyle='#242030';sc.fillRect(0,0,1024,160);
  let start=0;for(let p=0;p<8;p++){sc.drawImage(frames[start+Math.floor(spec.beats[p]/2)],p*128+8,4,112,112);sc.fillStyle='#ece5fa';sc.font='12px Arial';sc.textAlign='center';sc.fillText(spec.story[p],p*128+64,139);start+=spec.beats[p];}
  fs.writeFileSync(path.join(root,'storyboards',spec.name+'.png'),strip.toBuffer('image/png'));
  const x=(si%4)*280,y=Math.floor(si/4)*330;bc.fillStyle='#f4efff';bc.font='bold 19px Arial';bc.fillText(spec.name,x+24,y+31);bc.drawImage(frames[heroFrame],x+40,y+44,200,200);bc.drawImage(draw(spec,tiles,heroFrame,28),x+46,y+258);bc.fillStyle='#b5a8cc';bc.font='14px Arial';bc.fillText('28 px chat size',x+88,y+278);
  manifest.push({code:'udyris'+spec.name,name:spec.name,title:spec.title,animal:spec.animal,description:spec.description,file:'gif/'+spec.name+'.gif',thumbnail:'thumbs/'+spec.name+'.png',width:112,height:112,frames:count,drawnPoses:8,durationMs:count*40,bytes});
 }
 fs.writeFileSync(path.join(root,'overview.png'),board.toBuffer('image/png'));
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));
 const cards=manifest.map(m=>`<article><div class="art"><img class="animation" src="preview/${m.name}.gif" data-live="preview/${m.name}.gif" data-still="${m.thumbnail}" alt="${m.description}"></div><div class="details"><span class="tag">${m.animal} spirit</span><h2>${m.name}</h2><p>${m.description}</p><code>${m.code}</code><div class="chat"><img class="animation" src="small/${m.name}-28.gif" data-live="small/${m.name}-28.gif" data-still="${m.thumbnail}" width="28" height="28"> <span>Actual chat size</span></div><details><summary>See the eight acting poses</summary><img class="strip" src="storyboards/${m.name}.png"></details></div></article>`).join('');
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Udyris 7TV meme reactions</title><style>*{box-sizing:border-box}body{margin:0;background:#110e19;color:#f6f1ff;font:16px system-ui,sans-serif}header,main,footer{max-width:1320px;margin:auto;padding:32px}header{padding-top:54px}small,.tag{color:#c393ff;text-transform:uppercase;letter-spacing:.15em;font-size:11px;font-weight:800}h1{font-size:clamp(36px,5vw,60px);margin:10px 0}header p{max-width:750px;color:#c5b8d8;line-height:1.6}.controls{display:flex;gap:12px;margin-top:24px}button,a{color:inherit}button{background:#342442;border:1px solid #71528c;padding:10px 18px;border-radius:8px;cursor:pointer}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;padding-top:0}article{background:#211a2c;border:1px solid #3c2b4d;border-radius:18px;overflow:hidden}.art{display:grid;place-items:center;height:250px;background:radial-gradient(ellipse at center,#32223e,#191321)}.art img{width:224px;height:224px}.details{padding:22px}.details p{color:#c5b8d8;line-height:1.5;min-height:72px;font-size:14px}h2{font-size:26px;margin:5px 0}code{font-size:13px;color:#efd49d}.chat{display:flex;align-items:center;gap:12px;background:#15111c;border-radius:8px;padding:12px;margin-top:20px;min-height:54px}.chat span{font-size:12px;color:#afa0c0}.strip{width:100%;margin-top:14px}summary{font-size:12px;cursor:pointer;color:#c5b8d8;margin-top:20px}footer{color:#a99bbd;font-size:13px}.light .chat{background:#faf8fc;color:#21172b}.light .chat span{color:#625270}@media(max-width:950px){main{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){main{grid-template-columns:1fr}header,main,footer{padding:20px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}</style><header><small>Udyris · 7TV chat reactions</small><h1>Animal spirits lose their composure.</h1><p>Six fast chat reactions in the language of 7TV: panic, copium, approval, slapstick, sleepy queue and total hype.</p><div class="controls"><button id="pause">Pause animations</button><button id="theme">Light chat preview</button></div></header><main>${cards}</main><footer>Original art generated as eight acting poses per emote, then timed and composited into animated GIFs. The names are channel-ready with the <code>udyris</code> prefix. <a href="manifest.json">File details</a></footer><script>let paused=false;function toggle(){paused=!paused;document.querySelectorAll('.animation').forEach(i=>i.src=paused?i.dataset.still:i.dataset.live);document.getElementById('pause').textContent=paused?'Play animations':'Pause animations'}document.getElementById('pause').onclick=toggle;document.getElementById('theme').onclick=()=>{let light=document.body.classList.toggle('light');document.getElementById('theme').textContent=light?'Dark chat preview':'Light chat preview'};if(matchMedia('(prefers-reduced-motion: reduce)').matches)toggle();</script></html>`;
 fs.writeFileSync(path.join(root,'preview.html'),html);console.log(JSON.stringify(manifest,null,2));
})();
