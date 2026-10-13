// Five feature-owned comic casts. Each finite visit has its own setup and payoff.
import {ellipse,TAU} from './shared/world-motion.js';
import {duck,hammer,crystal} from './world-ink.js';
import {plane,blimp,bird} from './travel-ink.js';
import {star} from './reef-ink.js';
import {body,face,feet,burst,controller,chest,toast,salt,pizza,ring} from './chaos-ink.js';
import {paintedCameos} from './lobby-cameos.js';
const bounce=a=>Math.abs(Math.sin(a*5));
function spoon(c,x,y,a){c.save();c.translate(x,y);c.rotate(Math.sin(a*2)*.4);body(c,0,9,11,73,'#d5ac55');ellipse(c,0,-30,18,24,'#ffe2a0');ellipse(c,0,-31,12,17,'#b89351');c.restore();}
function honk(c,x,y,a,s=2){duck(c,x,y,s,a,true);if(a>3){burst(c,x,y-35,a,'#ffdb9c',8);}}
function loot(c,x,y,a){chest(c,x,y+Math.sin(a*5)*4,a,a>2);if(a>2){for(let i=0;i<5;i++){const q=(a*.3+i*.2)%1;star(c,x+Math.sin(i*2)*q*80,y-q*95,8,'#ffd777',a+i);}spoon(c,x+60,y-35,a);}}
function respawn(c,x,y,a){ring(c,x,y+20,a);if(a>1.5){const q=Math.min(1,(a-1.5)/1.2);c.save();c.globalAlpha*=q;toast(c,x,y-(1-q)*45,a);c.restore();}}
function delivery(c,x,y,a){ellipse(c,x,y,66,20,'#7fa1aa');ellipse(c,x,y-9,42,24,'#8de0e7');face(c,x,y-14,a);for(let i=0;i<6;i++)ellipse(c,x-52+i*21,y+5,4,3,['#ffe08d','#ed95c9','#8ff3dc'][i%3]);if(a>2)pizza(c,x,y+45,Math.sin(a)*.15);}
const sets={
 arcade:[
  ['coin','Jackpot with legs','A coin celebrates a jackpot, then runs away with the payout.',(c,a)=>{const x=430+a*36,y=817-bounce(a)*7;feet(c,x,y+28,a);ellipse(c,x,y,27,32,'#e9b350');face(c,x,y-4,a);if(a>3)burst(c,x,y,a);}],
  ['pixels','Retro invasion','Pixel invaders form a wave, panic, and flee the wrong way.',(c,a)=>{const speed=a<4?a*28:112-(a-4)*43;for(let i=0;i<4;i++){const x=953+speed+i*68,y=280+Math.sin(a*4+i)*12;body(c,x,y,34,25,['#df89cc','#7adecf','#e6c269','#a4b0e4'][i],Math.sin(a*3)*.1);face(c,x,y,a);}}],
  ['gamer','Controller rage quit','A controller throws a tantrum, then admits it queued another game.',(c,a)=>{const x=682,y=790-bounce(a)*26;controller(c,x,y,a,a<5);feet(c,x,y+30,a);if(a<5)burst(c,x,y,a,'#ff9c7f');}],
  ['joystick','Accidental final boss','A spare joystick declares itself the final boss and immediately wobbles.',(c,a)=>{const x=932,y=826;body(c,x,y,78,27,'#8c7eb6');c.strokeStyle='#cbebed';c.lineWidth=9;c.beginPath();c.moveTo(x,y-9);c.lineTo(x+Math.sin(a*5)*22,y-62);c.stroke();ellipse(c,x+Math.sin(a*5)*22,y-65,17,17,'#e59ecd');}],
  ['marbles','Combo snacks','A trail of bonus orbs levels up into a pizza slice.',(c,a)=>{for(let i=0;i<5;i++)star(c,260+Math.cos(a+i)*56,780+Math.sin(a+i)*30,9,'#f0c76d',a+i);if(a>3)pizza(c,260,782,a*.15);}],
  ['prize','The claw has opinions','The prize claw drops a champion duck, then wants it back.',(c,a)=>{const x=824,y=650+Math.max(0,Math.min(a,4,10-a))*27; c.strokeStyle='#b5dbe3';c.lineWidth=3;c.beginPath();c.moveTo(x,594);c.lineTo(x,y-26);for(const s of [-1,1]){c.moveTo(x,y-26);c.lineTo(x+s*22,y-7);c.lineTo(x+s*12,y+4);}c.stroke();honk(c,x,y+29,a,1.4);}],
  ['salt','Salt shaker victory lap','A very salty shaker discovers a flower and calms down.',(c,a)=>{const x=1340+Math.sin(a*.55)*75,y=839-bounce(a)*4;salt(c,x,y,a);if(a>4){star(c,x+42,y-40,12,'#bdedaf',a);}}],
  ['speedrun','Any% wrong direction','A speedrunning toast sprints across the counter, realizes its mistake and reverses.',(c,a)=>{const x=450+(a<5?a*72:360-(a-5)*54),y=828-bounce(a)*8;toast(c,x,y,a);}]
 ],
 tavern:[
  ['sneeze','Dragon critical sneeze','The painted loot dragon sneezes a few sparks and a snack onto the counter.',(c,a)=>{const x=471,y=879;burst(c,x,y,a,'#ffd099',18);if(a>3)pizza(c,x+75,y+7,Math.sin(a)*.2);}],
  ['mug','Tankard buff parade','A tankard gains confidence, then chooses another round.',(c,a)=>{const x=1400+Math.sin(a*.45)*66,y=989-bounce(a)*5;feet(c,x,y+23,a);body(c,x,y,52,62,'#a7774d');ellipse(c,x,y-30,27,8,'#fff0c4');face(c,x,y,a);}],
  ['hat','Wizard hat miscast','The wizard casts a mighty spell that summons toast.',(c,a)=>{const x=1664,y=915;ring(c,x,y,a,'#d09ee7');if(a>2)toast(c,x,y-22,a);}],
  ['quill','Legendary spoon duel','A golden spoon prepares for battle with absolutely nothing.',(c,a)=>{const x=649,y=970;spoon(c,x,y-10,a);burst(c,x,y-25,a);}],
  ['dice','RNG cheese dice','Cheese dice roll a critical success and attract an imaginary mouse.',(c,a)=>{for(let i=0;i<2;i++){const x=715+i*62,y=992-bounce(a+i)*27;body(c,x,y,40,40,'#edc468',Math.sin(a*4+i)*.3);for(let j=0;j<3;j++)ellipse(c,x-9+j*9,y-8+(j%2)*15,4,4,'#aa743e');}}],
  ['coins','Mimic loot audit','A friendly mimic swallows the loot, then spits out a spoon.',(c,a)=>loot(c,380,978,a)],
  ['respawn','Back from the wipe','A tiny adventurer returns through a checkpoint after a questionable raid.',(c,a)=>respawn(c,1030,1008,a)],
  ['quest','Side quest avalanche','A little map by the stools traces a route to a slice of pizza.',(c,a)=>{body(c,645,762,162,75,'#d9b97e',Math.sin(a)*.05);c.strokeStyle='#957242';c.lineWidth=2;c.setLineDash([3,5]);c.beginPath();c.moveTo(590,770);c.quadraticCurveTo(620,735,653,767);c.stroke();c.setLineDash([]);if(a>3)pizza(c,681,760,-.2);}]
 ],
 forge:[
  ['hammer','Balance team bonk','The balance hammer hits a tiny sword and makes it even tinier.',(c,a)=>{hammer(c,1420,788,-.8+Math.max(0,Math.sin(a*3))*1.5,1.8);body(c,1443,848,Math.max(12,70-a*5),9,'#b8d3d7');burst(c,1443,848,a,'#faca84');}],
  ['duck','Apprentice gets promoted','The duck apprentice marches across the workbench and declares itself a raid boss.',(c,a)=>{const x=1430+Math.sin(a*.5)*120,y=882-bounce(a)*5;honk(c,x,y,a,2);}],
  ['runes','Hotfix rollercoaster','A balance rune cycles through buffs, nerfs and a mysterious feature.',(c,a)=>{const x=945,y=282;ring(c,x,y,a,'#f4ad62');star(c,x,y-2,24,'#9ee8e1',a);} ],
  ['crystals','XP piñata','Crystals burst into experience stars after an exaggerated level-up.',(c,a)=>{for(let i=0;i<5;i++)crystal(c,297+Math.cos(a+i)*53,831+Math.sin(a+i)*27,20,'#8de2ec',a);if(a>3)burst(c,297,814,a,'#b0ffff',20);}],
  ['moth','Debug swarm','Tiny bug-shaped embers circle the warm forge vent.',(c,a)=>{for(let i=0;i<6;i++){const x=447+Math.cos(a*.8+i)*72,y=210+Math.sin(a*1.4+i)*28;ellipse(c,x,y,7,9,'#ffcb70');for(const s of [-1,1])ellipse(c,x+s*8,y-3,5,3,'#a6e9e2');}}],
  ['forged','Legendary honk reveal','Sparks reveal the forge’s most powerful weapon: a rubber duck.',(c,a)=>{burst(c,1535,875,a,'#ffc98d',22);if(a>2)honk(c,1535,859,a,2.5);}],
  ['hotfix','Emergency snack patch','An emergency patch turns a hot controller into a pizza delivery.',(c,a)=>{controller(c,598,818,a,a<4);if(a>4)pizza(c,598,776,Math.sin(a)*.2);}],
  ['loot','Chest quality assurance','A loot chest politely eats the quality-assurance spoon.',(c,a)=>loot(c,713,843,a)]
 ],
 future:[
  ['coffee','Pizza UFO delivery','An overly cheerful UFO materializes a slice as matchmaking drags on.',(c,a)=>delivery(c,1330+Math.sin(a*.5)*45,774+Math.sin(a)*9,a)],
  ['bot','Rubber-band robot','A little maintenance robot walks forward, lags backwards, then accepts its fate.',(c,a)=>{const jump=Math.floor(a*2)%4===3?-52:0,x=540+a*19+jump,y=808-bounce(a)*3;feet(c,x,y+30,a);body(c,x,y,61,61,'#72bdc5');face(c,x,y,a);}],
  ['toast','AFK breakfast','Headset toast tries to nap while the queue keeps calling.',(c,a)=>{const x=1278,y=257+Math.sin(a)*8;toast(c,x,y,a);}],
  ['astronaut','One small honk','A duck astronaut lands with unnecessary ceremony.',(c,a)=>{const x=1818,y=987-Math.max(0,3-a)*50;duck(c,x,y,2,a);c.strokeStyle='#acf6ec';c.lineWidth=2;c.beginPath();c.arc(x+14,y-45,39,0,TAU);c.stroke();}],
  ['marbles','Queue orbit','Little planets orbit a snack because it is apparently the center of the universe.',(c,a)=>{const x=714,y=813;for(let i=0;i<4;i++)ellipse(c,x+Math.cos(a+i*1.57)*76,y+Math.sin(a+i*1.57)*24,12,12,['#ce9de4','#9de2cc','#e8ad76','#acbbe8'][i]);pizza(c,x,y,a*.1);}],
  ['comet','Comet has missed queue','A comet overshoots the lobby, brakes and goes back.',(c,a)=>{const x=950+(a<5?a*63:315-(a-5)*32),y=304;star(c,x,y,19,'#ffcb88',a);burst(c,x-25,y,a,'#c9c1ff',8);}],
  ['ready','Ready-check drama','A ready-check robot changes its mind at the last possible moment.',(c,a)=>{const x=1020,y=967;body(c,x,y,95,39,'#a17fc5',a>5?.07:0);face(c,x,y,a,a>5);c.strokeStyle='#9de5dd';c.lineWidth=3;c.beginPath();c.moveTo(x+38,y);c.lineTo(x+59,y+7);c.lineTo(x+64,y+14-Math.max(0,Math.sin(a*2))*8);c.stroke();ellipse(c,x+65,y+18,8,3,a<5?'#9de5dd':'#e0b879');}],
  ['wormhole','The portal ordered takeaway','A pizza disappears into a wormhole and returns with a friend.',(c,a)=>{ring(c,1420,823,a,'#ce9af2');pizza(c,1420+Math.sin(a*2)*24,800,Math.sin(a)*.2);if(a>4)pizza(c,1474,790,-.3);}]
 ],
 'sky-harbor':[
  ['airship','Express pizza airship','A tiny pizza airship takes the scenic route to your imaginary squad.',(c,a)=>{const x=867+a*35,y=275+Math.sin(a)*12;blimp(c,x,y,1.1,a);pizza(c,x,y-30,.2);}],
  ['paper','Paper dragon detour','A paper dragon airplane gets distracted by its own flight path.',(c,a)=>{const x=915+a*32,y=380+Math.sin(a*1.3)*40;plane(c,x,y,1.7,Math.cos(a)*.3);}],
  ['pilot','Pigeon promotion','An aviator duck gets promoted to head of questionable deliveries.',(c,a)=>{const x=590+a*28,y=969-bounce(a)*6;duck(c,x,y,2,a,true);}],
  ['teaballoon','Tea with high ping','A delivery balloon drops tea and then apologizes for the ping.',(c,a)=>{const x=1304,y=283+Math.sin(a)*20;ellipse(c,x,y-35,26,35,'#eab575');c.strokeStyle='#dbb994';c.lineWidth=2;c.beginPath();c.moveTo(x,y);c.lineTo(x,y+38);c.stroke();body(c,x,y+49,36,28,'#c9dbcd');}],
  ['swallows','Air traffic union','Birds form a queue, then unanimously choose lunch.',(c,a)=>{for(let i=0;i<4;i++)bird(c,871+a*39-i*42,242+Math.sin(a+i)*12,20,a+i);}],
  ['compass','Directional plunger','A plunger replaces the compass needle and remains confidently wrong.',(c,a)=>{const x=975,y=981;c.save();c.translate(x,y);c.rotate(Math.sin(a)*.8);body(c,0,-15,9,67,'#b49059');ellipse(c,0,-51,28,14,'#d27165');c.restore();}],
  ['lag','Rubber-band luggage','A mimic suitcase lags backwards and blames the wind.',(c,a)=>{const x=1420+(Math.floor(a*2)%3===2?-40:0)+Math.sin(a)*20;chest(c,x,975,a,a>4);}],
  ['boarding','Loot priority boarding','A loot token gets priority boarding while its spoon is left behind.',(c,a)=>{const x=744,y=980-bounce(a)*8;ellipse(c,x,y,30,36,'#e8bd73');face(c,x,y,a);feet(c,x,y+36,a);spoon(c,x+59,y+20,a);}]
 ]
};
export function chaosCast(id){const rows=sets[id],painted=paintedCameos(id);return {cues:[...rows.map(([id,label,description],i)=>({id,label,description,life:11+(i%3),weight:i<6?1:1.15,impact:i===5?.95:.65})),...painted.cues],artists:{...Object.fromEntries(rows.map(([id,,,draw])=>[id,draw])),...painted.artists}};}
