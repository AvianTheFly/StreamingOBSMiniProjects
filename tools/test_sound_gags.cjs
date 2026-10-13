// Read-only contact/staging review of the real compiled renderer. No Hub actions.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),web=path.join(root,'lib/browser_effects/web'),out=path.join(root,'output/sound-culture');
const effects=JSON.parse(fs.readFileSync(path.join(root,'mini projects/soundboard/browser_effects.json')));
const contexts=JSON.parse(fs.readFileSync(path.join(out,'media-context.json')));
const subjects=[
 ['JOHN CENA',[25,604,195,230]],['I shouldve seen that coming',[0,328,239,245]],
 ['woops',[5,318,228,332]],['im cooked',[3,322,232,305]],
 ['leave me alone',[1700,474,220,201]],['prowler',[14,650,211,176]],
 ['you saved me',[1700,415,220,258]],['mac-quack',[1730,571,190,199]],
 ['gary_meow',[4,240,234,225]],['mom frog',[15,251,222,228]],
 ['crab rave',[360,976,1200,103]],['hype up music',[1730,260,190,405]],
 ['what just happened',[1715,400,205,300]],['piuw',[1720,594,200,201]]
].map(([name,crop])=>({name,crop,effect:effects[name],duration:contexts.find(r=>r.name===name).duration}));
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://gags.test/**',r=>{const name=new URL(r.request().url()).pathname.slice(1);if(!name)return r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#162134;color:#e6e9eb;font:17px Segoe UI"></body>'});if(!['rave.js','subtle.js','renderers.js','borders.js','muffins.js'].includes(name))return r.fulfill({status:404});return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(web,name))});});
 await page.goto('http://gags.test/');
 const report=await page.evaluate(async subjects=>{
  const R=await import('/rave.js'),{makeRenderer}=await import('/renderers.js'),fail=(check,msg)=>{if(!check)throw Error(msg);},near=(a,b)=>Math.abs(a-b)<.0001;
  for(let j=0;j<7;j++){const cross=R.cultureCrabMotion(0,j).crossing,m=R.cultureCrabMotion(cross,j);fail(near(m.x,m.ballX),'Ball misses crab '+j);fail(m.y+44*.55+3<1059-16*.85,'Crab foot clips ball '+j);}
  for(let p=.77;p<1;p+=.01){const m=R.cultureToastMotion(p);fail(near(m.toast.x,m.hand.x)&&near(m.toast.y+23*.8,m.hand.y),'Toast floats through/above catch');}
  const trip=R.cultureDetectiveMotion(.4);fail(near(trip.foot.x,trip.peel.x)&&near(trip.foot.y,trip.peel.y),'Trip has no shoe/peel contact');
  for(let p=0;p<1;p+=.005){const m=R.cultureSpillMotion(p),bottom=m.y+1.05*(Math.abs(Math.sin(m.a))*29+Math.abs(Math.cos(m.a))*31);fail(bottom<=m.surface+.001,'Mug penetrates surface');if(m.landed)fail(near(bottom,m.surface),'Mug hovers after impact');}
  const click=R.cultureMuteMotion(R.SOUND_LINEUPS.mute/5.04);fail(near(click.cursor.x,click.target.x)&&near(click.cursor.y,click.target.y),'Mute click misses control');const before=R.cultureMuteMotion((R.SOUND_LINEUPS.mute-.001)/5.04);fail(!before.clicked&&before.release===0,'Gamer relaxes before click');
  const hit=R.cultureRescueBlockMotion(.72);fail(near(hit.bolt.x,hit.fist.x)&&near(hit.bolt.y,hit.fist.y),'Hero deflects before contact');
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const c=canvas.getContext('2d',{willReadFrequently:true}),frames=[];
  for(const row of subjects){const show=makeRenderer(canvas,row.effect);await show.ready;const shots=[];
   for(const q of [.2,.48,.72,.91]){show.draw(q*row.duration,row.duration,row.effect);fail(!c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v),'Gameplay covered by '+row.name);
    const thumb=document.createElement('canvas');thumb.width=480;thumb.height=270;const tc=thumb.getContext('2d');tc.fillStyle='#162134';tc.fillRect(0,0,480,270);tc.drawImage(canvas,0,0,480,270);
    const detail=document.createElement('canvas');detail.width=360;detail.height=300;const dc=detail.getContext('2d');dc.fillStyle='#162134';dc.fillRect(0,0,360,300);const [x,y,w,h]=row.crop,s=Math.min(360/w,300/h);dc.drawImage(canvas,x,y,w,h,(360-w*s)/2,(300-h*s)/2,w*s,h*s);
    shots.push({q,image:thumb.toDataURL(),detail:detail.toDataURL()});
   }
   show.clear();frames.push({name:row.name,shots});
  }
  return {contacts:['7 crab jumps','toast catch','shoe on peel','cup landing','cursor click','projectile deflection'],frames};
 },subjects);
 for(let i=0;i<report.frames.length;i+=2){const group=report.frames.slice(i,i+2);await page.evaluate(rows=>{document.body.innerHTML=rows.map(r=>`<section style="padding:16px"><h2>${r.name}</h2><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${r.shots.map(s=>`<div><p>${Math.round(s.q*100)}% of sound</p><img style="width:100%" src="${s.image}"><img style="width:100%" src="${s.detail}"></div>`).join('')}</div></section>`).join('');},group);await page.screenshot({path:path.join(out,'gag-details-'+i+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'gag-contacts.json'),JSON.stringify({contacts:report.contacts,subjects:subjects.map(r=>r.name),frames:report.frames.length*4},null,2));
 console.log('14 staged gags: 56 clear-center frames, 7 jump clearances, prop catches, trip contact, floor landing, cursor contact and projectile contact passed.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
