// Finite performances for the painted cast. Resource ownership stays in PaintedWorld.
import {ellipse,smooth,TAU} from './shared/world-motion.js';
import {burst,pizza,toast,ring,body} from './chaos-ink.js';
import {star} from './reef-ink.js';
const hop=a=>Math.abs(Math.sin(a*5));
const ease=(a,start,end)=>smooth(Math.max(0,Math.min(1,(a-start)/(end-start))));
const actor=(c,art,slot,x,y,h,a=0,flip=false)=>art.drawVisitor(c,slot,x,y,h,a,flip);
function glitter(c,x,y,a,col='#ffe095'){
 for(let i=0;i<12;i++){const q=(a*.25+i/12)%1;star(c,x+Math.sin(i*7)*q*105,y-q*115,3+q*3,col,a+i);}
}
function ribbon(c,x,y,a,col='#9aefdf'){
 c.save();c.strokeStyle=col;c.lineWidth=3;c.globalAlpha*=.55;c.beginPath();
 for(let i=0;i<35;i++){const px=x-i*4,py=y+Math.sin(a*4-i*.3)*8;i?c.lineTo(px,py):c.moveTo(px,py);}c.stroke();c.restore();
}
function parcel(c,x,y,a){body(c,x,y,33,29,'#cd9c6c',Math.sin(a)*.1);c.strokeStyle='#ffdeb0';c.lineWidth=4;c.beginPath();c.moveTo(x,y-14);c.lineTo(x,y+14);c.stroke();}
function confetti(c,x,y,a,col='#fac68d'){
 for(let i=0;i<20;i++){const q=(a*.19+i*.071)%1;c.save();c.globalAlpha*=1-q;c.translate(x+Math.sin(i*9)*q*150,y-90+q*120);c.rotate(a+i);c.fillStyle=i%2?col:'#ace8dc';c.fillRect(-3,-5,6,10);c.restore();}
}
const performances={
 arcade:[
  ['raccoon-heist','Token heist on wheels','A raccoon skates off with the jackpot. The jackpot pursues it.',(c,a,e,art)=>{
   const q=ease(a,0,11),x=300+q*505;actor(c,art,0,x,851-hop(a)*5,181,Math.sin(a*2)*.07);actor(c,art,2,x-115,854-hop(a+.6)*9,102,.07);
   ribbon(c,x-90,809,a);
  }],
  ['joystick-solo','Joystick main character moment','A joystick creature discovers rhythm and immediately overcommits.',(c,a,e,art)=>{
   const x=1690,y=852-hop(a)*29;ring(c,x,852,a,'#f58cdb');actor(c,art,1,x,y,189,Math.sin(a*3)*.17);glitter(c,x,y-80,a,'#efabe9');
  }],
  ['coin-boss','The final microtransaction','The smallest coin demands an absurd boss introduction.',(c,a,e,art)=>{
   const h=120+ease(a,1,4)*65;actor(c,art,2,729,850-hop(a)*7,h,Math.sin(a*2)*.06);burst(c,729,796,a,'#ffe797',16);
  }],
  ['cable-portal','USB summoning ritual','A joystick opens a portal and pulls out a pizza instead of a controller.',(c,a,e,art)=>{
   actor(c,art,1,418,855,167,Math.sin(a)*.09);ring(c,620,827,a,'#e991da');if(a>2)pizza(c,620,812-ease(a,2,5)*55,Math.sin(a)*.25);glitter(c,620,824,a);
  }],
  ['podium-throw','Emotional support second place','A raccoon celebrates silver like it has won the entire internet.',(c,a,e,art)=>{
   body(c,1610,825,155,45,'#809da9');actor(c,art,0,1610,803-hop(a)*17,164,Math.sin(a*4)*.08);confetti(c,1610,717,a,'#ff9eda');
  }],
  ['coin-conga','Exact change conga','Three tiny coins dance with very serious boss energy.',(c,a,e,art)=>{
   for(let i=0;i<3;i++){const x=513+i*104+Math.sin(a*.7)*72;actor(c,art,2,x,1050-hop(a+i*.5)*12,107,Math.sin(a*3+i)*.12);}
  }]
 ],
 tavern:[
  ['dragon-snacks','The snack hoard has aggro','A tiny wizard dragon guards its snacks with raid-boss confidence.',(c,a,e,art)=>{
   const x=438+Math.sin(a*.6)*48;actor(c,art,0,x,1002-hop(a)*8,203,Math.sin(a*2)*.05);glitter(c,x,887,a);
  }],
  ['mimic-chase','The furniture is hungry','A heroic tankard flees the tavern’s suspiciously mobile chest.',(c,a,e,art)=>{
   const x=270+ease(a,0,11)*480;actor(c,art,1,x-70,1003-hop(a)*5,155,Math.sin(a*3)*.09);actor(c,art,2,x+100,1000-hop(a+.8)*12,119,.08);
  }],
  ['tankard-choir','The tankards found voice chat','Three mugs synchronize approximately zero of their dance moves.',(c,a,e,art)=>{
   for(let i=0;i<3;i++)actor(c,art,2,1390+i*129,1006-hop(a+i*.7)*18,130,Math.sin(a*3+i)*.14);confetti(c,1520,915,a);
  }],
  ['dragon-miscast','Summon legendary breakfast','The wizard dragon casts a dramatic spell and receives toast.',(c,a,e,art)=>{
   actor(c,art,0,1480,1000+Math.sin(a*2)*6,190,Math.sin(a)*.06);ring(c,1728,985,a,'#dca2eb');if(a>2)toast(c,1728,960-ease(a,2,4)*67,a);burst(c,1728,922,a,'#f7ce8e');
  }],
  ['mimic-inspection','Loot quality inspector','A mimic auditions to be a chest. Nobody is convinced.',(c,a,e,art)=>{
   actor(c,art,1,630,999,178,Math.sin(a*1.4)*.08);for(let i=0;i<4;i++){const q=(a*.25+i*.25)%1;ellipse(c,640+Math.sin(i*7)*q*65,860-q*100,5,7,'#f6d37d');}
  }],
  ['last-call','One more dungeon','A triumphant tankard calls for a dungeon run. The dragon brings provisions.',(c,a,e,art)=>{
   actor(c,art,2,990,1065-hop(a)*9,115,Math.sin(a*3)*.08);actor(c,art,0,1195,1067-hop(a+.8)*4,128);
  }]
 ],
 forge:[
  ['goblin-bonk','The balance department','A goblin commits to an enormous bonk and calls it a minor adjustment.',(c,a,e,art)=>{
   const hit=Math.max(0,Math.sin(a*3));actor(c,art,0,401,860-hit*8,199,-.12+hit*.24);body(c,547,849,Math.max(14,70-a*5),8,'#bfced0');if(hit>.65)burst(c,543,838,a,'#ffc574',18);
  }],
  ['duck-knights','Raid party of extremely small tanks','Three armored ducks take the workbench much too seriously.',(c,a,e,art)=>{
   for(let i=0;i<3;i++)actor(c,art,1,1370+i*135+Math.sin(a*.5)*34,873-hop(a+i)*8,137,Math.sin(a*3+i)*.07);
  }],
  ['anvil-audit','The sword failed inspection','An anvil robot displays its finest broken sword with unearned confidence.',(c,a,e,art)=>{
   actor(c,art,2,698,855-hop(a)*3,179,Math.sin(a*2)*.06);glitter(c,698,752,a,'#9feaf3');
  }],
  ['duck-levelup','Apprentice to final boss','An armored duck levels up. Its attack remains honk.',(c,a,e,art)=>{
   const h=140+ease(a,2,5)*55;ring(c,1510,884,a,'#ffba76');actor(c,art,1,1510,875-hop(a)*13,h,Math.sin(a*2)*.05);glitter(c,1510,766,a);
  }],
  ['anvil-moonwalk','Heavy metal movement tech','An anvil learns the world’s least efficient speedrun shortcut.',(c,a,e,art)=>{
   const x=1340+ease(a,0,11)*420;actor(c,art,2,x,1053-hop(a)*4,126,-.06,true);ribbon(c,x-30,1040,a);
  }],
  ['goblin-delivery','Patch delivery service','A goblin races a parcel across the floor. It is another nerf.',(c,a,e,art)=>{
   const x=300+ease(a,0,12)*590;actor(c,art,0,x,1060-hop(a)*11,124,.12);parcel(c,x+69,1031,a);
  }]
 ],
 future:[
  ['toaster-launch','Breakfast has achieved orbit','A toaster launches breakfast with space-program enthusiasm.',(c,a,e,art)=>{
   actor(c,art,0,497,841-hop(a)*7,174,Math.sin(a*3)*.07);const q=ease(a,2,7);if(a>2){toast(c,574+q*107,742-Math.sin(q*Math.PI)*130,a);ribbon(c,559+q*107,752-Math.sin(q*Math.PI)*130,a);}
  }],
  ['snail-speedrun','Any percent eventually','A space snail starts a speedrun, takes a nap, and calls it routing.',(c,a,e,art)=>{
   const x=1730+a*4;actor(c,art,2,x,1042,157,Math.sin(a)*.02);ribbon(c,x-40,1032,a,'#beabea');
  }],
  ['pizza-convoy','The squad ordered delivery','Three pizza UFOs arrive in formation and all claim to be the leader.',(c,a,e,art)=>{
   for(let i=0;i<3;i++)actor(c,art,1,1020+i*154+Math.sin(a*.6)*20,283+Math.sin(a*1.4+i)*12,113,Math.sin(a+i)*.05);
  }],
  ['takeaway-abduction','Reverse alien abduction','A delivery UFO beams a pizza down. Then decides to keep it.',(c,a,e,art)=>{
   const x=1360,y=753+Math.sin(a)*8;actor(c,art,1,x,y,164);const q=a<6?ease(a,1,5):1-ease(a,6,10);c.save();c.globalAlpha*=.16;c.fillStyle='#9efae1';c.beginPath();c.moveTo(x,y-20);c.lineTo(x-65,y+103);c.lineTo(x+65,y+103);c.fill();c.restore();pizza(c,x,y+q*87,Math.sin(a)*.1);
  }],
  ['snail-finish','Slow and suspicious wins','A space snail crosses a tiny finish line and celebrates like a champion.',(c,a,e,art)=>{
   const x=480+ease(a,0,8)*210;actor(c,art,2,x,844,151);c.strokeStyle='#e4dfc5';c.lineWidth=3;c.beginPath();c.moveTo(650,819);c.lineTo(650,840);c.stroke();for(let i=0;i<6;i++){c.fillStyle=i%2?'#25334c':'#fff1cf';c.fillRect(650+i*8,811,8,8);}if(a>6)confetti(c,x,751,a);
  }],
  ['toaster-disco','Zero gravity breakfast club','Two toasters discover that physics is optional on this server.',(c,a,e,art)=>{
   for(let i=0;i<2;i++){const x=960+i*209;actor(c,art,0,x,1059-hop(a+i*.8)*10,121,Math.sin(a*3+i)*.13);ring(c,x,1060,a+i,'#c6a8ff');}
  }]
 ],
 'sky-harbor':[
  ['pigeon-mail','Your loot has been misdelivered','A very confident pigeon delivers a parcel to the wrong cloud.',(c,a,e,art)=>{
   const x=320+ease(a,0,10)*360;actor(c,art,0,x,1010-hop(a)*10,178,Math.sin(a*2)*.06);parcel(c,x+72,979,a);
  }],
  ['pizza-drop','Airborne snack drop','A pizza airship delivers a slice with unnecessarily dramatic air support.',(c,a,e,art)=>{
   const x=1160+Math.sin(a*.5)*85,y=282+Math.sin(a)*8;actor(c,art,1,x,y,164);if(a>2)pizza(c,x,y+17+ease(a,2,6)*75,Math.sin(a)*.13);
  }],
  ['luggage-escape','Carry on has other plans','A flying suitcase abandons its passenger and chases a better holiday.',(c,a,e,art)=>{
   const x=1390+ease(a,0,11)*345;actor(c,art,2,x,1016-Math.sin(a*.8)*20,157,Math.sin(a*2)*.08);ribbon(c,x-65,958,a);
  }],
  ['air-traffic','Traffic jam at cloud nine','Pizza airships queue up, then all try to overtake at once.',(c,a,e,art)=>{
   for(let i=0;i<3;i++){const x=967+i*152+Math.sin(a*.7+i*.35)*25;actor(c,art,1,x,295+Math.sin(a*1.5+i)*22,115,Math.sin(a+i)*.04);}
  }],
  ['pigeon-ranked','Competitive postal service','Two aviator pigeons race for absolutely no useful reason.',(c,a,e,art)=>{
   const x=430+ease(a,0,11)*700;actor(c,art,0,x,1061-hop(a)*9,126,.12);actor(c,art,0,x-140,1061-hop(a+.6)*8,108,.16);
  }],
  ['luggage-loot','Baggage claim is a boss fight','A suitcase proudly reveals its loot: another, smaller suitcase.',(c,a,e,art)=>{
   actor(c,art,2,1530,1022,172,Math.sin(a*2)*.09);if(a>3)actor(c,art,2,1720,1018-hop(a)*12,89,Math.sin(a*3)*.13);glitter(c,1620,927,a);
  }]
 ]
};
export function paintedCameos(id){
 const rows=performances[id]||[];
 const slots={arcade:[[0,2],[1],[2],[1],[0],[2]],tavern:[[0],[1,2],[2],[0],[1],[0,2]],forge:[[0],[1],[2],[1],[2],[0]],future:[[0],[2],[1],[1],[2],[0]],'sky-harbor':[[0],[1],[2],[1],[0],[2]]}[id]||[];
 return {cues:rows.map(([id,label,description],i)=>({id,label,description,life:13+(i%2),weight:1.2,impact:.85,residentSlots:slots[i]})),artists:Object.fromEntries(rows.map(([id,,,draw])=>[id,draw]))};
}
