// Finite dense/close anatomy and impact review for both turtle performances.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const {serve}=require('./spirit_fixture.cjs');
const output=process.env.SPIRIT_REVIEW||'C:/StreamingMedia/Transitions/udyr-spirits-v15-turtle-gait/review';
(async()=>{fs.mkdirSync(output,{recursive:true});const f=await serve(),b=await chromium.launch({headless:true,channel:'chrome'});
 try{const p=await b.newPage();p.on('pageerror',e=>console.error(e));await p.goto(f.url);await p.waitForFunction(()=>!!window.spiritPreview);
 for(const clip of ['turtle','turtle-alt'])for(const mode of ['dense','actor']){
  const data=await p.evaluate(async({clip,mode})=>{
   const {SpiritTransition}=await import('./renderer.js'),{arrival}=await import('./turtle.js');
   const s=await new SpiritTransition(document.createElement('canvas')).load(clip);
   const times=mode==='dense'?[.10,.25,.4,.55,.70,.84,.90,.92,1.00,1.15,1.30,1.50,1.70,1.91,1.94,2.02,2.30,2.60,2.84,3.03,3.15,3.40,3.52,3.59,3.62,3.68,3.77,3.85,4.05,4.30,4.85,5.70]:[.92,1.15,1.3,1.5,1.7,1.94,2.2,2.5,2.84,3.07,3.4,3.62];
   const cols=4,w=mode==='dense'?400:500,h=mode==='dense'?250:450;
   const sheet=document.createElement('canvas');sheet.width=w*cols;sheet.height=h*Math.ceil(times.length/cols);const c=sheet.getContext('2d');
   times.forEach((t,i)=>{const x=i%cols*w,y=Math.floor(i/cols)*h;c.fillStyle='#203041';c.fillRect(x,y,w,h);
    if(mode==='dense'){s.draw(t);c.drawImage(s.canvas,x,y,w,h-25);}
    else {const a=arrival(t,s.variant);c.save();c.beginPath();c.rect(x,y,w,h-25);c.clip();s.character.draw(c,{...a,x:x+w*.49,y:y+h-55,size:370});c.restore();}
    c.fillStyle='#0c1319';c.fillRect(x,y+h-25,w,25);c.fillStyle='#d5e4e2';c.font='14px Segoe UI';c.fillText(clip+' / '+t.toFixed(2)+' s',x+10,y+h-7);
   });s.dispose();return sheet.toDataURL().split(',')[1];
  },{clip,mode});fs.writeFileSync(path.join(output,clip+'-'+mode+'.png'),Buffer.from(data,'base64'));console.log(clip+' '+mode+' reviewed');
 }
 }finally{await b.close();f.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
