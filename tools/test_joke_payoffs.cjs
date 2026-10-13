// Real renderer staging plus causal contact checks. Local files, muted, no Hub.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/thematic-borders/joke-quality');fs.mkdirSync(out,{recursive:true});
const media=JSON.parse(fs.readFileSync(path.join(root,'output/thematic-borders/media-context.json')));
const soundKeys=['coffin','mash','crabs','rats','shades','racing','equalizer','arena','tantrum','meltdown','rewind','violin','spill','isolation','lizard'];
const leagueKeys=['kill','low_hp_kill','ace','dragon_fire','dragon_water','dragon_chemtech','baron','herald','void_grub','objective_steal','turret_destroyed','inhibitor_destroyed','respawn','resource_spent','inventory_added','inventory_removed','cs_milestone','vision_activity','defeat','game_end'];
const crops={kill:[1720,510,200,190],low_hp_kill:[0,310,225,235],ace:[1720,510,200,190],dragon_fire:[1710,410,210,240],dragon_water:[0,315,215,230],dragon_chemtech:[0,220,215,280],herald:[1700,375,220,245],void_grub:[0,540,215,200],objective_steal:[0,515,215,205],respawn:[1700,150,220,260],resource_spent:[0,330,220,235],inventory_added:[0,345,220,220],inventory_removed:[0,345,220,220],vision_activity:[1710,500,210,200],defeat:[0,305,220,265],game_end:[0,335,220,225]};
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://payoffs.test/**',r=>{const parts=new URL(r.request().url()).pathname.split('/').filter(Boolean);if(!parts.length)return r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#182437;color:#eee;font:16px Segoe UI"></body>'});const [family,name]=parts;if(parts.length!==2||!['sound','league'].includes(family)||!/^[\w.-]+$/.test(name))return r.fulfill({status:404});const folder=name==='subtle.js'?'lib/browser_effects/web':family==='sound'?'lib/browser_effects/web':'mini projects/league_api/production/web';return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,folder,name))});});
 await page.goto('http://payoffs.test/');
 const result=await page.evaluate(async({media,soundKeys,leagueKeys,crops})=>{
  const R=await import('/sound/rave.js'),L=await import('/league/event-relics.js'),{makeRenderer}=await import('/sound/renderers.js');await R.artReady;
  const check=(x,msg)=>{if(!x)throw Error(msg);},near=(a,b)=>Math.abs(a-b)<1e-6;
  // Test physical constraints rather than repeating the motion formulas.
  for(let q=0;q<=1;q+=.001){const boot=R.encoreBootMotion(q);check(boot.y+boot.foot<=boot.surface+1e-6,'Encore boot penetrates ticket');if(q<.46)check(boot.stamp===0,'Shoeprint appears before contact');if(q>=.46&&q<=.55)check(near(boot.y+boot.foot,boot.surface),'Stamp misses ticket');const tea=R.encoreTeaMotion(q);check(near(tea.tray+tea.cup,0),'Cup tilts with the tray');const ping=R.encoreSilenceMotion(q);if(ping.fold>0)check(near(ping.x,-28)&&near(ping.y,8),'Ping folds before reaching mute icon');}
  const ball=R.encoreThrowMotion(1);check(ball.landed,'Paper never lands');for(const [x,y] of [[-17,-13],[8,-19],[22,-2],[14,17],[-14,12],[-22,-1]]){const X=ball.x+.5*(x*Math.cos(ball.a)-y*Math.sin(ball.a)),Y=ball.y+.5*(x*Math.sin(ball.a)+y*Math.cos(ball.a));check(X>=34&&X<=63&&Y>=12&&Y<=40,'A rotated paper corner misses the bin');}
  for(let j=0;j<3;j++)for(let q=.78;q<=1;q+=.001){const m=R.encoreToastMotion(q,j);check(m.landed&&near(m.a,0),'Toast stack fails to settle');}
  let births=0,on=false;for(let p=0;p<=1.1;p+=.001){const m=L.emptyDropMotion(p);if(m.visible&&!on)births++;on=m.visible;if(m.visible)check(L.energyGaugeMotion(p).height===0,'Last-drop gag refills the empty canister');}check(births===1,'Last drop repeats');
  check(L.grubHopMotion(.2,2).sleep&&!L.grubHopMotion(.5,2).sleep,'Third grub has no wake reaction');
  for(let j=0;j<3;j++)for(let p=.8;p<=1;p+=.001)check(near(L.grubHopMotion(p,j).y,0),'Grub takes another hop');
  check(L.aceSweepMotion(.65).speck>0&&L.aceSweepMotion(.65).second===0,'Stray confetti must arrive before the return sweep');
  check(L.aceSweepMotion(.83).speck===0&&L.aceSweepMotion(.83).second===1,'Broom never finishes its second sweep');
  const cv=document.createElement('canvas');cv.width=1920;cv.height=1080;const c=cv.getContext('2d',{willReadFrequently:true}),rows=[];
  const cases=[...soundKeys.map(key=>({family:'sound',key,...media.find(r=>(r.effect.scene||r.effect.style)===key)})),...leagueKeys.map(key=>({family:'league',key,duration:3,name:key}))];
  for(const row of cases){const show=row.family==='sound'?makeRenderer(cv,row.effect):null;if(show)await show.ready;const shots=[];
   for(const q of [.38,.55,.65,.73,.81,.93]){c.clearRect(0,0,1920,1080);if(show)show.draw(q*row.duration,row.duration,row.effect);else L.eventRelics(c,{key:row.key,elapsed:q*row.duration,duration:row.duration});check(!c.getImageData(240,170,1440,670).data.some((v,i)=>i%4===3&&v),'Gameplay covered '+row.key);
    const crop=row.family==='sound'?[720,895,260,185]:(crops[row.key]||[850,915,240,165]),detail=document.createElement('canvas');detail.width=240;detail.height=220;const dc=detail.getContext('2d');dc.fillStyle='#182437';dc.fillRect(0,0,240,220);const [x,y,w,h]=crop,s=Math.min(240/w,220/h);dc.drawImage(cv,x,y,w,h,(240-w*s)/2,(220-h*s)/2,w*s,h*s);shots.push({q,image:detail.toDataURL()});
   }
   if(show)show.clear();rows.push({family:row.family,key:row.key,name:row.name,shots});
  }
  return {contacts:['boot presses before print and lifts without penetration','cup stays level on wobbling tray','ping reaches mute icon before folding','paper lands wholly inside bin','three toast slices settle','single final drop after gauge is empty','third grub wakes late and all land','broom returns after the stray speck arrives'],rows};
 },{media,soundKeys,leagueKeys,crops});
 for(let i=0;i<result.rows.length;i+=3){await page.evaluate(rows=>{document.body.innerHTML=rows.map(r=>`<section style="padding:12px"><h2>${r.family}: ${r.name}</h2><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px">${r.shots.map(s=>`<div><p>${Math.round(s.q*100)}%</p><img width="240" src="${s.image}"></div>`).join('')}</div></section>`).join('');},result.rows.slice(i,i+3));await page.screenshot({path:path.join(out,'payoffs-'+i+'.png'),fullPage:true});}
 assert.deepEqual(errors,[]);const fingerprints=Object.fromEntries(['lib/browser_effects/web/rave.js','mini projects/league_api/production/web/event-relics.js'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')]));fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,fingerprints,contacts:result.contacts,cues:result.rows.map(r=>({family:r.family,key:r.key})),frames:result.rows.length*6},null,2));
 console.log('PASS: '+result.rows.length+' new-payoff performances / '+result.rows.length*6+' clear-center frames; '+result.contacts.join('; '));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
