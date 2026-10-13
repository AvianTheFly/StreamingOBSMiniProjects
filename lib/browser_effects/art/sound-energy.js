// Cue-owned peripheral theatre. All entrances, impacts and jokes reconstruct
// from the supplied audio time. No particle state, timers or audio processing.
// [prop, setup, payoff, contact fraction (or original seconds), accent]
export const SOUND_ENERGY=Object.freeze({
 disco:['shoe','THE FLOOR IS YOURS','RENT: ONE MOONWALK',.56,'#55e1ff'],
 coffin:['hat','HANDLE WITH STYLE','DEAD SERIOUS FOOTWORK',.64,'#e4b8ff'],
 mash:['pastry','MAGIC? OPTIONAL.','PROTEIN: CREAM PUFF',.63,'#ffcf56'],
 crabs:['shell','THE BEACH HAS A DJ','CLAWS FOR APPLAUSE',.72,'#64efda'],
 muffins:['pastry','BAKERY OPEN MIC','THAT ESCALATED QUICKLY',{seconds:6.24},'#ffca68'],
 balloons:['fish','ONE MORE DANCE','FISH > CHOREOGRAPHY',.63,'#a8f37a'],
 arena:['belt','CHAMPION DETECTED','CAMERA: I LOST HIM',.62,'#ffcf60'],
 rats:['shoe','BOOTS ON THE FLOOR','SOLE SURVIVOR',.68,'#e5a8ff'],
 raccoon:['record','PEDRO HAS THE AUX','RECORD: SLIGHTLY CHEWED',.65,'#80f2c9'],
 shades:['glasses','AURA INSPECTION','SOURCE: TRUST ME BRO',.71,'#79c6ff'],
 racing:['wheel','BRAKES ARE A SUGGESTION','GPS: GOOD LUCK',.57,'#ff7193'],
 equalizer:['toast','MOM LEFT THE KITCHEN','BREAKFAST HAS A DROPSHOT',.77,'#ffdc79'],
 nyan:['pixel','CAT.EXE IS FLYING','CRUMBS AT MACH MEOW',.67,'#ffa4e2'],
 sparkles:['star','JAW LOADING...','JAW HAS LEFT THE CHAT',{seconds:1.01267},'#85eeff'],
 arcade:['crown','VICTORY CALCULATING','CROWN FITS. EGO DOES NOT.',.7,'#86f2ba'],
 approval:['check','CHECKING THE PLAY','CERTIFIED: SOMEHOW',{seconds:.16267},'#adf38b'],
 lizard:['popcorn','DO NOT PRESS','CINEMA HAS BEEN ACTIVATED',{seconds:.11267},'#ffd97d'],
 gary:['fish','A VERY SERIOUS MEETING','MINUTES: MEOW',{seconds:.03},'#ffa5d8'],
 quack:['duck','CLOSING QUACK.EXE','TASK FAILED SUCCESSFULLY',{seconds:.17267},'#ffdf6c'],
 bonk:['mallet','THOUGHT DETECTED','THOUGHT REMOVED',{seconds:.06},'#ffb09d'],
 piuw:['orbit','TINY LASER. BIG PLANS.','AIM: MOSTLY VIBES',.48,'#c99aff'],
 hooray:['star','SMALL WIN DETECTED','CELEBRATION BUDGET: YES',.36,'#ffd36b'],
 'mom-frog':['lily','MOM IS LISTENING','MOM IS NOT IMPRESSED',.55,'#a8e784'],
 romance:['rose','SPECIAL DELIVERY','SIGNED FOR: BLUSHING',.64,'#ffa1c8'],
 rizz:['rose','CHARM FOR SALE','RECEIPT: ONE BLUSH',.68,'#d1b2ff'],
 weeknd:['record','MIDNIGHT SERENADE','EVEN THE MOON IS BLUSHING',.69,'#afa7ff'],
 love:['cone','MIC CHECK: SWEET','LOVE AT FIRST BITE',.67,'#ffb2d6'],
 catlove:['paw','MOONLIT CAT DUET','TWO CATS. ZERO RENT.',.7,'#d3b5ff'],
 falling:['arrow','CUPID HAS ENTERED','FRIENDLY FIRE: ROMANCE',.68,'#ffacdd'],
 oops:['acorn','JUST ONE SMALL PROBLEM','THE PROBLEM BROUGHT FRIENDS',.72,'#c4b1ff'],
 intro:['battery','SYSTEM REBOOTING','WE ARE SO BACK',.57,'#b4ef84'],
 charge:['battery','ENERGY: 1%','PERSONALITY: 100%',.48,'#9ff2bd'],
 payment:['coin','TRANSACTION PENDING','PAID IN GOOD VIBES',.5,'#8ce9db'],
 'ding-two':['bell','ONE GOOD IDEA','BRAIN CELL: PROMOTED',.4,'#a8deff'],
 cash:['coin','PROFIT CALCULATING','STONKS: EMOTIONALLY',.45,'#ffda79'],
 chill:['cup','EVERYTHING IS HAPPENING','HE HAS A BEVERAGE',.55,'#aadbd1'],
 fail:['tissue','PLAN A HAS COLLAPSED','PLAN B: TINY VIOLIN',.47,'#b0c8ff'],
 disgust:['filter','TASTE TEST COMPLETE','REFUND MY TASTE BUDS',.48,'#bfe390'],
 refusal:['stop','REQUEST RECEIVED','ABSOLUTELY NOT',.45,'#ffb289'],
 scratch:['record','WAIT A SECOND','NARRATOR: IT GOT WORSE',.43,'#b7ddff'],
 downer:['balloon','HYPE LEVEL: HIGH','HYPE HAS A SLOW LEAK',.51,'#b0bbef'],
 bruh:['brick','PROCESSING THAT PLAY','BRAIN: BUFFERING',.4,'#d8b7ff'],
 revulsion:['filter','BROTHER...','QUALITY CONTROL WALKED OUT',.52,'#b7e4a5'],
 awww:['heart','EVERYONE LEAN IN','COLLECTIVE DAMAGE: EMOTIONAL',.53,'#ffb5df'],
 airburst:['fan','WHO ORDERED THAT?','AIR QUALITY: PERSONAL',.36,'#c6e28a'],
 fracture:['bone','STRETCH GOAL','WARRANTY JUST EXPIRED',.43,'#ffe3b2'],
 boom:['orbit','VERY NORMAL MOMENT','BASS HAS ENTERED THE ROOM',.33,'#c2aaff'],
 swear:['bleep','COMMENTARY INCOMING','SUBTITLES: [REDACTED]',.4,'#ffc2b8'],
 later:['clock','THIS WILL BE QUICK','TIME: DISAGREES',.64,'#b8e5d9'],
 tantrum:['shoe','FULL SPEED. ZERO PLAN.','ALL THAT FOR ONE MISCLICK',.7,'#ffc76d'],
 kitchen:['toast','STATUS: PROBABLY FINE','UPDATE: EXTRA CRISPY',.54,'#ffce8a'],
 meltdown:['phone','PLEASE HOLD','CUSTOMER SERVICE: NO',.58,'#d9f28c'],
 rewind:['clue','THE CLUE WAS RIGHT THERE','FORESIGHT: 0/20',.405,'#ffe2a0'],
 violin:['violin','WORLD SMALLEST CONCERT','TICKET PRICE: ONE TEAR',.65,'#e6b4de'],
 spill:['cup','JUST A LITTLE MISCLICK','SPECIAL THANKS: GRAVITY',.38,'#ffdcac'],
 heartbreak:['heart','ONE LOST FIGHT','A WHOLE MUSIC VIDEO',.67,'#dfb7f6'],
 rescue:['shield','ALLY: 1 HP','PLOT ARMOR: ACTIVATED',.55,'#ffe09a'],
 confusion:['orbit','EXPLAIN THAT PLAY','ALIENS ALSO HAVE QUESTIONS',.62,'#b5f1b1'],
 smart:['bulb','CALCULATING BIG BRAIN','ONE BRAIN CELL. OVERTIME.',.6,'#ffe394'],
 newt:['clock','NOOTIFICATION RECEIVED','TIME FLIES. PENGUIN DOES NOT.',.6,'#ace1ff'],
 prowler:['ward','STEALTH MODE','WARD: HELLO THERE',.61,'#d3a6f7'],
 isolation:['mute','SEVEN PINGS TOO MANY','INNER PEACE: UNMUTED',{seconds:.76},'#c9eab6'],
});

export function soundEnergyMoment(key,t,d,e={}){
 const spec=SOUND_ENERGY[key];if(!spec)return null;
 const timing=CULTURE_TIMING[key],point=spec[3];
 let hit=typeof point==='object'?point.seconds:point*d;
 // Dance captions land on the measured clip grid; contact/lyric cues stay exact.
 if(typeof point==='number'&&timing?.bpm&&timing.confidence>.25){
  const period=60/timing.bpm;hit=(timing.offset||0)+Math.round((hit-(timing.offset||0))/period)*period;
 }
 hit=Math.max(0,Math.min(d*.9,hit));
 return{spec,hit,payoff:t>=hit,age:t-hit,beat:(t-(timing?.offset||0))*(timing?.bpm||e.bpm||120)/60};
}

function soundEnergyProp(I,kind,x,y,s,a,q){
 const {local,line,shape,disc,box,ring,curve,sparkle}=I,col=I.e.energyColor||'#ffcf7d',ink='#25324c',paper='#fff4d3';
 local(x,y,s,a,()=>{
  switch(kind){
  case 'shoe':box(-18,-26,22,35,5,col,ink);box(-20,4,47,17,7,paper,ink);for(let j=0;j<3;j++)line([[-16,-20+j*7],[1,-20+j*7]],ink,2);break;
  case 'hat':box(-18,-27,36,30,6,ink,paper);box(-31,0,62,9,4,col,ink);line([[-18,-5],[18,-5]],col,6);break;
  case 'pastry':for(const xx of [-18,0,18])disc(xx,-2,16,16,paper,ink);box(-24,2,48,22,8,col,ink);line([[-20,8],[20,8]],paper,4);break;
  case 'toast':case 'acorn':shape([[-25,25],[-25,-10],[-18,-27],[0,-33],[18,-27],[25,-10],[25,25]],col,ink,3);box(-16,-12,32,30,5,paper);break;
  case 'shell':case 'lily':for(let j=0;j<5;j++){const a=-Math.PI+j*Math.PI/4;disc(Math.cos(a)*14,Math.sin(a)*15,13,19,col,ink);}disc(0,9,24,8,paper,ink);break;
  case 'fish':disc(3,0,25,14,col,ink,3);shape([[-20,0],[-38,-19],[-38,19]],paper,ink);disc(16,-3,3,4,ink);break;
  case 'belt':box(-41,-11,82,22,7,ink,col);box(-18,-24,36,48,8,col,ink);sparkle(0,0,14,paper);break;
  case 'record':case 'wheel':ring(0,0,28,28,ink,9);ring(0,0,23,23,col,3);disc(0,0,9,9,paper,ink);for(let j=0;j<3;j++){const a=j*TAU/3+q*TAU;line([[Math.cos(a)*10,Math.sin(a)*10],[Math.cos(a)*23,Math.sin(a)*23]],col,3);}break;
  case 'glasses':for(const xx of [-19,19])box(xx-15,-12,30,24,7,ink,col);line([[-5,-5],[5,-5]],paper,4);line([[-30,-8],[-18,3]],paper,2);break;
  case 'pixel':case 'brick':box(-26,-24,52,48,2,col,ink);for(const xx of [-10,10])box(xx-3,-8,6,9,0,ink);line([[-11,10],[11,10]],ink,3);break;
  case 'crown':shape([[-28,19],[-34,-22],[-16,-7],[0,-31],[16,-7],[34,-22],[28,19]],col,ink,3);box(-27,14,54,10,3,paper,ink);break;
  case 'check':line([[-24,-1],[-5,20],[30,-23]],ink,13);line([[-24,-1],[-5,20],[30,-23]],col,8);break;
  case 'popcorn':box(-20,-4,40,31,4,col,ink);for(const xx of [-10,8])line([[xx,2],[xx,24]],paper,5);for(const xx of [-17,0,17])disc(xx,-10,12,12,paper,ink);break;
  case 'duck':disc(-3,10,28,17,col,ink);disc(14,-15,16,17,col,ink);shape([[26,-14],[44,-7],[25,-4]],'#ff9e69',ink);disc(18,-18,3,3,ink);break;
  case 'mallet':line([[0,1],[0,37]],paper,9);box(-31,-23,62,29,6,col,ink);line([[-22,-17],[22,-17]],paper,3);break;
  case 'orbit':case 'ward':ring(0,0,35,12,col,5);disc(0,-4,14,18,ink,paper,2);disc(q<.5?-31:31,0,7,7,paper,ink);break;
  case 'rose':case 'heart':case 'paw':line([[0,8],[0,32]],'#a1e7b2',5);for(let j=0;j<5;j++){const a=j*TAU/5;disc(Math.cos(a)*10,Math.sin(a)*10,13,11,col,ink);}disc(0,0,9,9,paper,ink);break;
  case 'cone':shape([[-22,2],[22,2],[0,36]],col,ink);disc(0,-9,26,23,paper,ink);disc(0,-31,6,6,col,ink);break;
  case 'arrow':line([[-35,0],[23,0]],paper,5);shape([[20,-15],[39,0],[20,15]],col,ink);line([[-25,0],[-37,-15]],col,5);break;
  case 'battery':box(-31,-18,62,36,5,ink,paper);box(32,-8,7,16,3,paper);box(-25,-12,Math.max(2,50*q),24,2,col);break;
  case 'coin':disc(0,0,29,29,col,ink,3);ring(0,0,22,22,paper,2);line([[0,-15],[0,15]],ink,3);curve(u=>[Math.sin(u*TAU)*10,-12+u*24],ink,4);break;
  case 'bell':shape([[-8,-25],[-23,-9],[-27,18],[-34,23],[34,23],[27,18],[23,-9],[8,-25]],col,ink);disc(0,30,6,6,paper,ink);break;
  case 'cup':box(-23,-23,46,47,7,paper,ink);ring(31,-3,13,16,col,5);curve(u=>[-5+Math.sin(u*TAU)*7,-29-u*27],col,3);break;
  case 'tissue':box(-29,-1,58,30,5,col,ink);shape([[-17,-2],[-23,-25],[0,-41],[23,-25],[17,-2]],paper,ink);break;
  case 'filter':case 'fan':for(let j=0;j<3;j++){const a=j*TAU/3+q*TAU;disc(Math.cos(a)*17,Math.sin(a)*17,14,11,col,ink);}disc(0,0,8,8,paper,ink);break;
  case 'stop':case 'bleep':box(-35,-20,70,40,10,col,ink);line([[-21,0],[21,0]],paper,7);break;
  case 'balloon':disc(0,-4,23,29,col,ink);curve(u=>[Math.sin(u*8)*8,26+u*37],paper,2);break;
  case 'bone':line([[-23,17],[23,-17]],paper,16);for(const s of [-1,1])for(const yy of [-5,5])disc(s*23,s*-17+yy,10,10,paper,ink);break;
  case 'clock':disc(0,0,29,29,paper,ink,4);line([[0,-18],[0,0],[17,10]],col,5);disc(0,0,4,4,ink);break;
  case 'phone':box(-24,-28,48,56,12,ink,col);curve(u=>[-17+u*34,-4+Math.sin(u*Math.PI)*11],col,10);break;
  case 'clue':ring(-6,-6,23,23,paper,7);line([[10,10],[33,34]],col,10);break;
  case 'violin':disc(0,1,12,22,col,ink);disc(0,16,18,16,col,ink);line([[0,-35],[0,25]],paper,4);line([[-24,18],[26,-12]],paper,3);break;
  case 'shield':shape([[-29,-29],[29,-29],[25,18],[0,39],[-25,18]],col,ink,3);line([[-16,0],[0,15],[19,-13]],paper,5);break;
  case 'bulb':disc(0,-9,26,27,col,ink);box(-11,13,22,17,4,paper,ink);line([[-6,-9],[0,4],[7,-9]],paper,3);break;
  case 'mute':shape([[-27,-9],[-14,-9],[3,-25],[3,25],[-14,9],[-27,9]],col,ink);line([[15,-13],[33,13]],paper,6);line([[33,-13],[15,13]],paper,6);break;
  default:sparkle(0,0,29,col,q*.8);sparkle(0,0,13,paper);
  }
 });
}

export function soundEnergy(c,t,d,e={},foreground=false){
 const key=e.scene||e.style||e.renderer||'muffins',m=soundEnergyMoment(key,t,d,e);if(!m)return;
 const [kind,setup,payoff,,col]=m.spec,I=cultureInk(c,t,d,{...e,energyColor:col}),{p,line,disc,box,ring,local,word,curve,burst}=I;
 const arrival=smooth(t/Math.min(.08,d*.08)),departure=smooth((d-t)/Math.min(.055,d*.07));
 c.save();c.globalAlpha*=arrival*departure;
 if(foreground){
  // One readable joke at a time. The second line appears only after its action.
  const title=m.payoff?payoff:setup,show=m.payoff?smooth(m.age/Math.min(.055,d*.05)):1;
  const y=m.payoff?903:139;
  c.save();c.globalAlpha*=show;word(title,960,y,col,26,'"Trebuchet MS"');c.restore();
  if(m.age>=0&&m.age<.24)for(const side of [0,1])burst(side?1885:35,side?734:312,m.age/.24,col,7,63);
 }else{
  // Wide scenic rails fill the empty side lanes; main character silhouettes sit
  // in front. Their oscillation follows measured cadence and original envelope.
  const pulse=.5+.5*Math.sin(m.beat*TAU),seed=Array.from(key).reduce((n,s)=>n+s.charCodeAt(0),0);
  for(const side of [0,1]){
   const x=side?1890:30;
   curve(u=>[x+Math.sin(u*13+m.beat*.7)*12,211+u*601],col,22,.13);
   curve(u=>[x+Math.sin(u*13+m.beat*.7)*12,211+u*601],col,3,.72);
   for(let j=0;j<7;j++){
    const y=243+j*82,beat=.5+.5*Math.sin(m.beat*TAU-j*.7);
    line([[side?1916:4,y],[side?1886-beat*23:34+beat*23,y-12]],col,4,.5+beat*.4);
    disc(x,y,4+beat*3,4+beat*3,'#fff3d2');
   }
   for(let j=0;j<3;j++){
    const delay=(j+side)*Math.min(.045,d*.03),on=smooth((t-delay)/Math.min(.09,d*.1));
    const y=276+j*207+(seed%5)*7,rotate=Math.sin(m.beat*TAU+j)*.22;
    local(x,y,on,0,()=>soundEnergyProp(I,kind,side?-18:18,Math.sin(m.beat*TAU+j)*13,.72,rotate,p));
   }
  }
  // Different lengths and asymmetrical clusters leave space around each cast.
  for(const bottom of [0,1]){
   const y=bottom?1055:23;
   curve(u=>[332+u*1256,y+Math.sin(u*TAU*3+m.beat*.65)*8],col,9,.25);
   for(let j=0;j<5;j++){
    const x=385+j*277+(seed%7)*3,q=.5+.5*Math.sin(m.beat*TAU-j);
    ring(x,y,16+q*9,7+q*4,col,2,.6);
    if(j%2===seed%2)soundEnergyProp(I,kind,x,bottom?1004:68,.86,Math.sin(m.beat*TAU+j)*.17,p);
   }
  }
  // Audio-envelope bars make quiet/loud changes legible without a new DSP loop.
  for(let j=0;j<18;j++){
   const height=8+(12+I.sound*20)*(.5+.5*Math.sin(m.beat*Math.PI+j*.72));
   box(713+j*28,1065-height,15,height,3,j%3?col:'#fff4d3');
  }
 }
 c.restore();
}
