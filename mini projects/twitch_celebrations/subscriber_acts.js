// Wordless subscription comedy. Shared coin/heart trajectories make each handoff real.
import {drawSprite} from './raid_guests.js';
import {ease,arc,lerp} from './raid_story.js';
import {path,ellipse,polygon,star,burst} from './raid_effects.js';
const palettes={crab:['#ffcc69','#ff83be','#66e7df'],dragon:['#bba2ff','#f9bce7','#78eed1'],cat:['#71e6e7','#ffd370','#ff91b7'],frog:['#b2ef8d','#ffac79','#b3acff']};
export function heart(c,x,y,size,color,angle=0){c.save();c.translate(x,y);c.rotate(angle);c.scale(size/30,size/30);c.beginPath();c.moveTo(0,14);c.bezierCurveTo(-48,-14,-20,-40,0,-17);c.bezierCurveTo(20,-40,48,-14,0,14);c.fillStyle=color;c.fill();c.strokeStyle='#fff1ce';c.lineWidth=1.5;c.stroke();c.restore();}
function coin(c,x,y,r,turn,color){c.save();c.translate(x,y);c.rotate(turn);ellipse(c,0,0,r,r,color);c.strokeStyle='#fff2af';c.lineWidth=3;c.beginPath();c.arc(0,0,r*.78,0,7);c.stroke();heart(c,0,4,r*.36,'#cf884e');c.restore();}
function hat(c,x,y,s=1){c.save();c.translate(x,y);c.scale(s,s);polygon(c,[[-22,0],[-26,-24],[-10,-13],[0,-34],[11,-13],[25,-24],[22,0]],'#ffd276');path(c,[[-22,1],[22,1]],'#ff82b9',5);c.restore();}
function ribbon(c,x,y,p,color){path(c,[[x,y+35*p],[x,y-5]],color,4);for(const side of [-1,1]){c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+side*70*p,y-52*p,x+side*70*p,y+33*p,x,y);c.strokeStyle=color;c.lineWidth=7;c.stroke();}ellipse(c,x,y,7,7,'#fff2c8');}
function machine(c,t,s,colors){
 const kick=arc((t-1.75)/.5),x=1760+Math.sin(kick*8)*kick*5;
 c.save();c.translate(x,960);c.rotate(kick*.035);
 c.fillStyle='#293449';c.strokeStyle=colors[0];c.lineWidth=4;c.beginPath();c.roundRect(-53,-80,106,113,16);c.fill();c.stroke();
 c.fillStyle='#131e2f';c.fillRect(-43,-9,31,14);path(c,[[-34,-3],[-21,-3]],colors[2],3);
 ellipse(c,0,-48,25,25,colors[1]);heart(c,0,-43,17,'#ffe8d0');
 path(c,[[50,-38],[73,-38],[73,-55-kick*16]],colors[0],5);ellipse(c,73,-55-kick*16,8,8,colors[1]);
 path(c,[[-29,35],[-29,50],[30,50],[30,35]],'#829ab1',5);
 // A very dignified machine blows its own lid on the musical payoff.
 if(t>=2.25){const p=ease((t-2.25)/.5);c.save();c.translate(0,-84-arc(p)*86);c.rotate(p*.3);ellipse(c,0,0,60,9,colors[0]);c.restore();}
 c.restore();
 drawSprite(c,'crewmate',t<1.6?0:t<2.25?1:2,1870,1026-kick*14,116,{flip:true,turn:kick*.08});
 if(t>2.25)hat(c,1870,914-arc((t-2.25)/.5)*30,ease((t-2.25)/.3)*.65);
 if(t>1.75&&t<2.25){for(let n=0;n<3;n++)star(c,1715-n*22,929-n*18,5,colors[n],t);}
}
function core(c,t,s,colors,item){
 const arrival=ease(t/.4),out=ease((t-4.4)/.4),robot=item.theme==='cat';
 const courierX=155-170*(1-arrival)-out*180+arc((t-.75)/.5)*26;
 drawSprite(c,robot?'salvager':'goose',t<.75?1:t<1.75?2:0,courierX,1052-arc((t-.75)/.5)*32,robot?106:98,{flip:!robot,turn:-arc((t-.75)/.5)*.18});
 // The courier reaches after its coin and receives a ridiculously small blank receipt.
 if(t>1.25&&t<3){const p=ease((t-1.25)/.5);c.save();c.translate(courierX+34,1004);c.rotate(p*.6);c.fillStyle='#fff0d7';c.fillRect(0,0,14,29*p);path(c,[[3,7],[10,7]],colors[1],2);c.restore();}
 machine(c,t,s,colors);
 drawSprite(c,'kirby',s.kirbyPose,140-150*(1-arrival),957,102,{squash:1+arc((t-3.25)/.5)*.14});
 if(t<.75&&t>=.45)coin(c,180,1020,27+s.level*6,0,colors[0]);
 if(s.coin.visible&&t>=.75)coin(c,s.coin.x,s.coin.y,27+s.level*6,s.coin.rotation,colors[0]);
 if(s.heart.visible)heart(c,s.heart.x,s.heart.y,26+s.level*4,colors[1],Math.sin(t*8)*.1);
 if(s.inhale)for(let n=0;n<3;n++)path(c,[[265,930+n*13],[198,923+n*8],[143,914]],'#fff1c488',2);
 // Kirby burps the thank-you into a heart balloon, tied back to his own foot.
 if(t>=3.75){const x=140+Math.sin(s.balloon*2)*12,y=906-s.balloon*(118+s.level*18);path(c,[[141,950],[126,y+60],[x,y+14]],'#ffdfaf',2);heart(c,x,y,36+s.level*7,colors[1],-.08);}
}
function extras(c,t,s,colors){
 if(s.level>=1&&t>=1.25){const p=ease((t-1.25)/.5);drawSprite(c,'boo',t<2.25?0:t<3.25?1:2,1804,768-70*p,94);if(t>=2.25)hat(c,1804,616-arc((t-2.25)/.5)*45,.65);}
 if(s.level>=2&&t>=2.25){
  const p=ease((t-2.25)/.5),y=590-arc((t-2.75)/1)*24;
  drawSprite(c,'climber',t<2.75?0:t<3.75?1:2,113-155*(1-p),y,120);
  // The cauldron becomes a coin fountain; the climber catches a heart instead.
  for(let n=0;n<5;n++){const q=(t-2.75-n*.065)/1;if(q<0||q>1)continue;coin(c,113+Math.sin(n*2)*arc(q)*70,575-arc(q)*(115+n*12),9,q*8,colors[0]);}
  if(t>=3.75)heart(c,137,476,19,colors[1]);
 }
 if(s.level>=3&&t>=2.75){const p=ease((t-2.75)/.5);drawSprite(c,'hornet',t<3.25?0:t<4.25?1:2,1830+140*(1-p),345,100,{flip:true});heart(c,1790,240,42,colors[1]);ribbon(c,1790,251,ease((t-3.25)/1),colors[2]);}
}
export function drawSubscription(c,t,s,item){
 const colors=palettes[item.theme]||palettes.crab;
 // Two small corner stages; the intensity adds props, never center coverage.
 for(const side of [0,1]){const x=side?1920:0;c.save();c.translate(x,0);c.scale(side?-1:1,1);
  const grow=ease((t-.25)/.5);path(c,[[15,1060],[15,1060-230*grow],[36,1060-248*grow]],colors[2],3);
  path(c,[[15,1054],[330*grow,1054]],colors[0],3);
  for(let n=0;n<3+s.level*2;n++){const p=ease((t-.75-n*.11)/.4);heart(c,33+(n%2)*25,990-n*52,7*p,colors[n%3]);}
  c.restore();}
 path(c,[[210,1041],[1660,1041]],'#ffdd8c40',2);
 core(c,t,s,colors,item);extras(c,t,s,colors);
 // One applause burst on each resolved beat. No brightness pulsing.
 for(const [i,at]of [1.75,2.25,3.75,4.25].entries()){
  burst(c,i%2?1790:145,i>1?775:1000,t-at,colors[i%3],i,s.burstCount);
 }
 if(s.level>=2)for(let n=0;n<6+s.level*2;n++){const p=(t-2.25-n*.025)/2.3;if(p<0||p>1)continue;const x=n%2?1870:48,y=1090-p*(440+n*11);path(c,[[x,y+35],[x+8,y+76]],colors[n%3],1);heart(c,x+Math.sin(p*4+n)*17,y,12,colors[n%3]);}
}
