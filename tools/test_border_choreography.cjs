// Regressions for awkward contact, direction, resets and repeated-act endings.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://choreography.test/**',r=>{const parts=new URL(r.request().url()).pathname.split('/').filter(Boolean);if(!parts.length)return r.fulfill({contentType:'text/html',body:'<body></body>'});const [family,name]=parts;if(parts.length!==2||!['sound','league'].includes(family)||!/^[\w.-]+$/.test(name))return r.fulfill({status:404});const folder=name==='subtle.js'?'lib/browser_effects/web':family==='sound'?'lib/browser_effects/web':'mini projects/league_api/production/web';return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,folder,name))});});
 await page.goto('http://choreography.test/');
 const report=await page.evaluate(async()=>{
  const R=await import('/sound/rave.js'),L=await import('/league/event-relics.js');await R.artReady;
  const check=(v,label)=>{if(!v)throw Error(label);},near=(a,b)=>Math.abs(a-b)<1e-6;
  for(let p=.57;p<=1;p+=.001){const m=R.roseCourierMotion(p);check(near(m.hand.x,m.rose.x-Math.sin(m.rose.a)*11)&&near(m.hand.y,m.rose.y+Math.cos(m.rose.a)*11),'Rose grip loses its stem');}
  for(let p=.73;p<=1;p+=.001){const m=R.cupidArrowMotion(p);check(m.caught&&near(m.tip.x,m.target.x)&&near(m.tip.y,m.target.y),'Cupid reacts before arrow contact or resets');}
  for(let p=.78;p<=1;p+=.001){const m=R.coffinHatMotion(p);check(near(m.x,0)&&near(m.y,-56),'Hat misses its wearer or flies again');}
  const fish=R.toothlessFishMotion(.6);check(fish.scale>0&&near(fish.x,fish.mouth.x)&&near(fish.y,fish.mouth.y),'Fish disappears before reaching the mouth');
  check(near(R.paperTurnMotion(.25).xScale,0)&&near(R.paperTurnMotion(.75).xScale,0),'Turn mirrors a broad silhouette abruptly');
  let prior=R.paperTurnMotion(0).xScale;for(let q=.001;q<=1;q+=.001){const m=R.paperTurnMotion(q);check(m.angle===0&&Math.abs(m.xScale-prior)<.007,'A planted turn tumbles or snaps');prior=m.xScale;}
  let height=88;for(let p=0;p<=1;p+=.001){const m=L.energyGaugeMotion(p);check(m.height<=height+1e-6&&m.height>=0,'Spent energy increases');height=m.height;}check(near(height,0),'Energy gauge refills at its ending');
  for(let p=.6;p<=1;p+=.001){const m=L.levelStepMotion(p);check(m.landed&&near(m.y+24*.75,m.platform),'Level-up friend hovers above its stair');}
  for(let j=0;j<8;j++){let windows=0,visible=false;for(let p=0;p<=1.2;p+=.001){const m=L.storyParticleProgress(p,j);if(m.visible&&!visible)windows++;visible=m.visible;}check(windows===1,'Finite particles recycle '+j);}
  let last;for(let u=0;u<=1;u+=.001){const m=L.objectiveStarRoute(u);check(m.x<240||m.x>1680||m.y<170||m.y>840,'The stolen star cuts through gameplay');if(last)check(Math.hypot(m.x-last.x,m.y-last.y)<3,'Stolen star teleports');last=m;}
  const start=L.objectiveStarRoute(0),end=L.objectiveStarRoute(1);check(near(start.x,96)&&near(start.y,591)&&near(end.x,1740)&&near(end.y,427),'Theft misses box or hand');
  check(L.storySettledTime(9,10)===L.storySettledTime(10,10)&&L.storySettledTime(14,Infinity)===14,'Finite decoration replays or persistent ambience freezes');
  for(let p=.75;p<=1;p+=.001){check(near(L.doubleFistMotion(p).reach,0),'Fist bump misses the other hand');for(let j=0;j<3;j++){const m=L.tripleStarMotion(p,j);const lowestVertex=Math.max(...Array.from({length:10},(_,n)=>Math.sin(-Math.PI/2+n*Math.PI/5)*(n%2?m.radius*.46:m.radius)));check(near(m.foot,lowestVertex)&&near(m.y+lowestVertex,m.support),'Triple reward floats above its rack');}}
  const cv=document.createElement('canvas');cv.width=1920;cv.height=1080;const c=cv.getContext('2d');
  const final=[];for(const key of ['double_kill','triple_kill','quadra_kill','pentakill','ace']){const draw=q=>{c.clearRect(0,0,1920,1080);L.eventRelics(c,{key,elapsed:q*3,duration:3});return cv.toDataURL();};const a=draw(.87),b=draw(.97);check(a===b,'Counted act repeats after its payoff '+key);final.push(a);}
  check(new Set(final).size===5,'Counted shows are palette/count variants of one design');
  return ['rose stem grip','Cupid self-hit','hat landing','visible fish contact','continuous planted turns','depleting energy','stair landing','single particle births','perimeter theft without jumps','fist contact and reward landing','five unique held combo endings'];
 });assert.deepEqual(errors,[]);console.log('PASS: '+report.join('; '));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
