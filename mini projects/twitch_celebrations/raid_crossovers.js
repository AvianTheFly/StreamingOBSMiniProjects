// Connected comic scenes using the user's existing three-pose lobby characters.
// Every state is a pure function of the raid clock, so late joins and cleanup agree.
import {clamp,ease,lerp,arc} from './raid_story.js';
import {COLORS,path,ellipse,polygon,star,record,burst} from './raid_effects.js';
import {drawSprite} from './raid_guests.js';
export const CROSSOVERS=[
 {id:'overqualified-repair',at:.15,end:2.18,cast:['crewmate']},
 {id:'stolen-snack-domino',at:1.25,end:3.58,cast:['kirby','goose']},
 {id:'silk-saves-the-pot',at:3,end:5.25,cast:['climber','hornet']},
 {id:'ghost-dj-hat',at:3.9,end:5.62,cast:['boo']},
 {id:'confetti-courier',at:5.48,end:7.92,cast:['creeper','salvager']}
];
export const activeCrossovers=t=>CROSSOVERS.filter(s=>t>=s.at&&t<s.end);
const phase=(t,a,b)=>ease((t-a)/(b-a));
function hat(c,x,y,s=1){c.save();c.translate(x,y);c.scale(s,s);polygon(c,[[-15,0],[0,-34],[16,0]],'#ff76bb');path(c,[[-9,-10],[9,-10]],'#ffd86e',5);ellipse(c,0,-34,5,5,'#73ffe2');c.restore();}
function cup(c,x,y,scale=1,turn=0){c.save();c.translate(x,y);c.rotate(turn);c.scale(scale,scale);polygon(c,[[-13,-17],[13,-17],[9,9],[-9,9]],'#ffd973');path(c,[[-14,-12],[-24,-12],[-22,0],[-10,3]],'#ffe9a1',4);path(c,[[14,-12],[24,-12],[22,0],[10,3]],'#ffe9a1',4);path(c,[[0,8],[0,17],[-13,17],[13,17]],'#dba755',5);c.restore();}
function cake(c,x,y,turn=0,scale=1){c.save();c.translate(x,y);c.rotate(turn);c.scale(scale,scale);polygon(c,[[-17,0],[-12,19],[11,19],[17,0]],'#b381ef');ellipse(c,0,-2,18,9,'#fff0bf');ellipse(c,-9,-7,8,7,'#ffadd7');ellipse(c,6,-9,11,7,'#ffadd7');ellipse(c,0,-17,4,4,'#ff596f');c.restore();}
function sparks(c,x,y,p){if(p<0||p>1)return;c.save();c.globalAlpha*=1-p;for(let n=0;n<5;n++)star(c,x+Math.cos(n*1.26)*(8+p*25),y+Math.sin(n*1.26)*(8+p*25),3,COLORS[n],p);c.restore();}
function repair(c,a){
 const enter=phase(a,0,.3),fired=a>=.98,jump=arc((a-.98)/.6),x=lerp(247,177,enter)+jump*24,y=900-jump*38;
 path(c,[[130,844],[86,842],[110,810]],'#a9e7e4',3);
 c.fillStyle='#344064';c.fillRect(114,830,30,29);ellipse(c,128,842,6,6,fired?'#a9ff84':'#ff9c7d');
 drawSprite(c,'crewmate',fired?2:a>.3?1:0,x,y,94,{flip:true,turn:jump*.2});
 // Repairing the fuse powers the existing crab cannon at exactly 1.13 s.
 if(a>.35&&a<.98){const p=(a-.35)/.63;ellipse(c,lerp(128,110,p),lerp(842,810,p),4,4,'#ffeb8f');}
 sparks(c,128,842,(a-.98)/.55);
 if(a>.98){const p=phase(a,.98,1.62);hat(c,lerp(108,x,p),lerp(700,y-94,p)-arc(p)*52,.7);}
 // One loose bolt shoots up, tumbles, then drops harmlessly out of the edge.
 if(a>1&&a<1.9){const p=(a-1)/.9;c.save();c.translate(193+arc(p)*19,810-p*115+p*p*170);c.rotate(p*12);path(c,[[-6,0],[6,0]],'#bff9ee',4);path(c,[[5,-4],[5,4]],'#bff9ee',3);c.restore();}
}
export function snackState(a){
 const inhale=phase(a,.55,1.15),spit=phase(a,1.55,2.1);
 return {inhale,spit,kirbyPose:a<.55?0:a<1.15?1:a<1.55?2:0,
  food:{x:lerp(180,107,inhale),y:lerp(329,235,inhale)-arc(inhale)*20},
  star:{x:107+arc(spit)*54,y:lerp(235,496,spit)},
  gooseX:144+phase(a,1.2,2.05)*62,gooseY:366-arc((a-.92)/.68)*34};
}
function snack(c,a){
 const s=snackState(a),enter=phase(a,0,.28),leave=phase(a,2.08,2.33);
 path(c,[[48,282],[154,282]],'#a688df',5);path(c,[[85,367],[219,367]],'#67d9d6',5);
 drawSprite(c,'kirby',s.kirbyPose,101-95*(1-enter),278,96,{squash:1+arc((a-1.15)/.4)*.1});
 drawSprite(c,'goose',a<.45?0:a<1.18?1:2,s.gooseX+leave*90,s.gooseY,77,{flip:a<1.18,turn:a>1.18?-.15:0});
 if(a<1.15)cake(c,s.food.x,s.food.y,-s.inhale*1.2,1-s.inhale*.7);
 if(a>.55&&a<1.15)for(let n=0;n<3;n++)path(c,[[194,311+n*12],[155,296+n*8],[109,237]],'#fff0c477',2);
 if(a>=1.55&&a<2.16){star(c,s.star.x,s.star.y,10,'#ffe585',a*4);for(let n=0;n<3;n++)ellipse(c,s.star.x-n*6,s.star.y-n*9,2,2,COLORS[n]);}
 // Kirby spits the stolen snack as the star that strikes Bongo's drum.
 sparks(c,100,496,(a-2.1)/.23);
 if(a>1.45){const p=phase(a,1.45,1.8);polygon(c,[[s.gooseX+15,s.gooseY-41],[s.gooseX+36,s.gooseY-36],[s.gooseX+21,s.gooseY-19-9*p]],'#b38bf0');}
}
export function rescueState(a){
 const head={x:1886,y:320},push=phase(a,.35,1.1),slip=phase(a,1.2,1.67),save=phase(a,1.7,2.12),angle=2.23+push*1.15;
 const grip={x:head.x+Math.cos(angle)*98,y:head.y+Math.sin(angle)*98};
 const x=grip.x-45-slip*10,y=lerp(grip.y+60,552,slip)-save*162;
 const pose=a<.2?0:a<1.2?1:2;
 const hand=pose===1?{x:x+45,y:y-60}:pose===2?{x:x+24,y:y-94}:{x,y:y-67};
 return {x,y,pose,hand,head:a>=.35&&a<1.2?head:{x:hand.x+Math.cos(.24+slip*.7)*98,y:hand.y+Math.sin(.24+slip*.7)*98},contact:a>=.35&&a<1.2,
  hornet:{x:lerp(1885,1840,phase(a,1.25,1.7)),y:255-arc((a-1.25)/.85)*48},rope:a>1.48,slip,save};
}
function rescue(c,a){
 const s=rescueState(a),arrival=phase(a,0,.22);
 path(c,[[1838,323],[1910,323]],'#c7a6ef',6);path(c,[[1847,330],[1905,330]],'#65789b',4);
 drawSprite(c,'climber',s.pose,s.x+130*(1-arrival),s.y,115);
 const hand={x:s.hand.x+130*(1-arrival),y:s.hand.y};
 path(c,[[hand.x,hand.y],[s.head.x,s.head.y]],'#b18550',6);path(c,[[hand.x,hand.y],[s.head.x,s.head.y]],'#f4d491',2);
 c.save();c.translate(s.head.x,s.head.y);c.rotate(s.contact?0:Math.atan2(s.head.y-hand.y,s.head.x-hand.x)+Math.PI/2);c.fillStyle='#bdc9d3';c.fillRect(-13,-6,26,12);c.restore();
 if(a>.3){drawSprite(c,'hornet',a<1.2?0:a>1.9?2:1,s.hornet.x,s.hornet.y,99,{flip:true});}
 if(s.rope){c.beginPath();c.moveTo(s.hornet.x-13,s.hornet.y-30);c.quadraticCurveTo(s.x-10,lerp(400,s.y-12,1-s.save),s.x,s.y-13);c.strokeStyle='#e6faff';c.lineWidth=2.5;c.stroke();ellipse(c,s.x,s.y-13,10,5,'#dcf7ed80');}
 if(a>1.88){const p=phase(a,1.88,2.12);path(c,[[s.x-25,s.y-8],[s.x-25,s.y-65*p]],'#e2f0f7',2);polygon(c,[[s.x-24,s.y-65*p],[s.x+8,s.y-54*p],[s.x-24,s.y-42*p]],'#ffcf71');sparks(c,s.x,s.y-112,(a-1.88)/.35);}
}
// Shared physical record path: Pedro's toss lands on Boo's head as a DJ hat.
export function prankRecord(g){
 const p=clamp((g.age-.52)/1.6),divert=phase(p,.55,1);
 return {x:lerp(1806,1733,divert)+Math.sin(p*Math.PI)*53,y:lerp(g.y-60,558,divert)-arc(p)*265,rotation:p*14};
}
function ghost(c,a){
 const up=phase(a,0,.42),catchTime=1,shy=a>=catchTime;
 const x=lerp(1798,1733,up),y=lerp(759,640,up);
 drawSprite(c,'boo',shy?2:a>.27?1:0,x,y,79,{turn:arc((a-.42)/.5)*-.12});
 if(shy){c.save();c.translate(x,558);c.rotate(-.15);c.scale(1,.42);record(c,0,0,35,a*.8);c.restore();}
 if(a>.55&&a<1.02){for(let n=0;n<3;n++)star(c,1698+n*19,546+(n%2)*12,5,COLORS[n],a);}
}
export function courierState(a){
 const launch=.74,flight=1.02,p=clamp((a-launch)/flight);
 return {p,cup:{x:lerp(232,1710,p),y:lerp(989,995,p)-arc(p)*102},flying:a>=launch&&a<launch+flight,
  creeperPose:a<.35?0:a<launch?1:2,robotPose:a<launch?0:a<launch+flight?2:1};
}
function courier(c,a,t,seed){
 const s=courierState(a),enter=phase(a,0,.28),pop=arc((a-.74)/.46);
 drawSprite(c,'creeper',s.creeperPose,231-160*(1-enter),1045-pop*34,110,{turn:pop*.16});
 drawSprite(c,'salvager',s.robotPose,1710+180*(1-enter),1040-arc((a-1.6)/.4)*18,113,{turn:s.flying?-.12:0});
 // Anticipation is a party blower, not a strobing Minecraft explosion.
 if(a>.35&&a<.74){path(c,[[245,989],[270+phase(a,.35,.74)*22,989]],'#7bf4c8',7);}
 if(a<.74)cup(c,272,1005,.6);
 if(s.flying){cup(c,s.cup.x,s.cup.y,.65,s.p*8);for(let n=0;n<5;n++)star(c,s.cup.x-15-n*12,s.cup.y+12+n%2*8,3,COLORS[n],s.p);}
 burst(c,242,989,a-.74,'#b2fb69',seed%8,32);
 if(a>1.76){hat(c,1710,927,.75*phase(a,1.76,1.94));sparks(c,1710,957,(a-1.76)/.45);}
}
const artists={'overqualified-repair':repair,'stolen-snack-domino':snack,'silk-saves-the-pot':rescue,'ghost-dj-hat':ghost,'confetti-courier':courier};
export function drawCrossovers(c,t,theme,seed){
 const shows=activeCrossovers(t);c.save();if(theme==='dragon'||theme==='frog'){c.translate(1920,0);c.scale(-1,1);}
 for(const show of shows){c.save();c.globalAlpha*=phase(t,show.at,show.at+.18)*(1-phase(t,show.end-.2,show.end));artists[show.id](c,t-show.at,t,seed);c.restore();}
 c.restore();return shows;
}
