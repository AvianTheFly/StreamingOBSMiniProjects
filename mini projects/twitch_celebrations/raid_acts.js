// Character-specific setups and payoffs. Each performer belongs to one finite act.
import {drawGuest} from './raid_cast.js';
import {drawPenguin} from './raid_penguins.js';
import {ease,lerp,arc,clamp} from './raid_story.js';
import {COLORS,path,ellipse,polygon,star,record,burst} from './raid_effects.js';
import {prankRecord} from './raid_crossovers.js';
import {raidScore,musicAt} from './raid_music.js';
function fish(c,x,y,r){c.save();c.translate(x,y);c.rotate(r);ellipse(c,0,0,20,10,'#ffc560');polygon(c,[[15,0],[30,-13],[29,12]],'#ff8e8a');ellipse(c,-10,-2,3,3,'#273045');c.restore();}
function note(c,x,y,s,color){c.save();c.translate(x,y);c.scale(s,s);ellipse(c,0,0,7,5,color);path(c,[[6,0],[6,-24],[19,-18]],color,4);c.restore();}
function crown(c,x,y,s){c.save();c.translate(x,y);c.scale(s,s);polygon(c,[[-26,8],[-30,-15],[-12,-4],[0,-25],[12,-4],[30,-15],[26,8]],'#ffdc6d');path(c,[[-25,9],[25,9]],'#ff85b9',4);c.restore();}
function cannon(c,x,y,p){c.save();c.translate(x,y);c.rotate(-.19-arc((p-.48)/.15)*.12);polygon(c,[[-26,20],[-32,-63],[23,-63],[29,20]],'#a681ff');ellipse(c,-4,-63,28,9,'#263950');path(c,[[-26,-12],[25,-12]],'#5ef7df',8);ellipse(c,-23,26,15,15,'#24364d');ellipse(c,25,26,15,15,'#24364d');ellipse(c,-23,26,5,5,'#ffd865');ellipse(c,25,26,5,5,'#ffd865');c.restore();}
function crabScene(c,g,t,seed){
 cannon(c,110,798,g.p);path(c,[[60,740],[45,718],[55,675],[70,655]],'#fff0bb',3);
 if(g.p<.58){c.save();c.globalAlpha*=1-ease((g.p-.44)/.14);path(c,[[30,80],[42,460],[75,g.y-25]],'#ffdc79',4);c.restore();}
 const shot=g.at+1.13;burst(c,104,708,t-shot,'#ffda64',seed%9,42);
 for(let i=0;i<8;i++){const p=(t-shot-i*.028)/.72;if(p<0||p>1)continue;star(c,90+Math.sin(i*2.7)*p*83,710-p*(310+i*33)+p*p*80,8+(i%3)*3,COLORS[i%5],p*5);}
}
function dragonScene(c,g,t,seed){
 const landing=clamp((g.p-.2)/.24);if(landing>0&&landing<1){c.save();c.globalAlpha*=1-landing;for(let n=0;n<3;n++){c.beginPath();c.ellipse(1810,513,40+landing*65+n*10,7+landing*9,0,0,7);c.strokeStyle=COLORS[n];c.lineWidth=3;c.stroke();}c.restore();}
 // The dragon winds up a sneeze, but releases paper butterflies.
 for(let i=0;i<11;i++){const p=(g.age-1.08-i*.035)/.9;if(p<0||p>1)continue;const x=1800+Math.sin(i*2.1)*p*75,y=g.y-50-p*(140+i*10);c.save();c.translate(x,y);c.rotate(-p*.6+i);const wing=6+Math.sin(p*12)*3;ellipse(c,-wing/2,0,wing,5,COLORS[i%5]);ellipse(c,wing/2,0,wing,5,COLORS[(i+1)%5]);path(c,[[0,-5],[0,6]],'#fff1c2',2);c.restore();}
 burst(c,1815,415,t-(g.at+1.23),'#a7ffde',seed%8,16);
}
function penguinScene(c,g){
 const x=g.mirrored?1920-g.x:g.x;
 // A surfboard rides a single curling wake; a fish makes the jump first.
 for(let n=0;n<14;n++){const d=n*22;c.save();c.globalAlpha*=Math.max(0,1-n/15)*.65;ellipse(c,x-d,g.y+55+Math.sin(n)*4,16-n*.7,5,'#59e8f5');c.restore();}
 c.save();c.translate(x,g.y+60);c.rotate(-.13+arc((g.p-.37)/.4)*.24);ellipse(c,0,0,72,9,'#ff6fae');path(c,[[-52,-1],[42,-1]],'#ffe683',4);c.restore();
 const jump=clamp((g.p-.22)/.6);if(g.p>.22&&g.p<.83)fish(c,x+110,g.y-15-arc(jump)*45,-.35+jump*.8);
 if(g.p>.68){const p=ease((g.p-.68)/.16);crown(c,x,g.y-67,p*.7);}
}
function bongoScene(c,g){
 // Notes leave individual drum hits; the last hit hatches a rubber duck.
 const score=raidScore(g.music?.theme),period=60/score.bpm;
 const first=Math.ceil((musicAt(g.music?.theme,g.at+.1)-score.beats[0])/period);
 for(let n=0;n<7;n++){const age=g.music?.seconds===undefined?g.age-n*.24:g.music.seconds-(score.beats[0]+(first+n*.5)*period);if(age<0||age>.7)continue;const x=100+(n%2?1:-1)*(35+age*29),y=g.y-25-age*175;note(c,x,y,1.1+age*.2,COLORS[n%5]);if(age<.18){c.save();c.globalAlpha*=1-age/.18;star(c,n%2?150:70,g.y+43,12+55*age,COLORS[n%5],age);c.restore();}}
 const p=clamp((g.age-1.25)/.75);if(p>0){const y=g.y-65-arc(p)*105,x=150;c.save();c.globalAlpha*=ease((2.4-g.age)/.25);ellipse(c,x,y,21,14,'#ffe16b');ellipse(c,x+11,y-13,12,12,'#ffe16b');ellipse(c,x+15,y-16,2,2,'#29364a');polygon(c,[[x+20,y-13],[x+36,y-9],[x+21,y-5]],'#ff935d');c.restore();}
}
function pedroScene(c,g){
 const p=clamp((g.age-.52)/1.6),flying=g.age>.52&&g.age<2.12;
 if(flying){const {x,y,rotation}=prankRecord(g);record(c,x,y,29,rotation);for(let n=0;n<3;n++){path(c,[[x-4*n,y+36+n*10],[x+6-4*n,y+49+n*10]],COLORS[n],2);}}
 if(g.age>2.1){crown(c,1810,g.y-94,ease((g.age-2.1)/.16)*.75);for(let n=0;n<3;n++)star(c,1760+n*44,g.y-130,7,COLORS[n],g.age);}
}
function nyanScene(c,g){
 const x=g.mirrored?1920-g.x:g.x;
 for(let n=0;n<5;n++){const length=Math.min(350,g.age*300);c.beginPath();for(let j=0;j<=22;j++){const u=j/22,px=x-55-u*length,py=g.y+n*9-18+Math.sin(u*5+g.age*2)*10;j?c.lineTo(px,py):c.moveTo(px,py);}c.strokeStyle=COLORS[n];c.lineWidth=8;c.stroke();}
 // The comet delivers a star parcel that opens behind it once.
 const p=clamp((g.age-.65)/.72);if(g.age>.65){c.save();c.globalAlpha*=ease((1.85-g.age)/.3);c.translate(905,991);c.rotate(-.1);c.fillStyle='#ff9bc9';c.fillRect(-20,-20,40,34);path(c,[[0,-20],[0,14]],'#ffe073',7);polygon(c,[[-23,-20],[-20-30*p,-25-35*p],[20-30*p,-25-35*p],[23,-20]],'#bca3ff');star(c,0,-22-p*65,16*ease(p*3),'#ffe57d',p*.7);c.restore();}
}
function ufoScene(c,g){
 const x=118,y=240-160*ease((g.p-.83)/.17),arrive=ease(g.age/.32);
 c.save();c.globalAlpha*=arrive;const beam=ease((g.p-.12)/.2)*(1-ease((g.p-.8)/.2));
 polygon(c,[[x-26,y+17],[x+26,y+17],[x+87,790],[x-80,790]],`rgba(116,246,220,${beam*.14})`);
 ellipse(c,x,y-9,33,27,'#b2e8f3');ellipse(c,x,y+7,75,21,'#a18bf1');path(c,[[x-57,y+8],[x+57,y+8]],'#e0afff',4);
 for(let n=0;n<5;n++)ellipse(c,x-48+n*24,y+13,5,4,COLORS[n]);
 if(g.p>.55){for(let n=0;n<4;n++){const h=ease((g.p-.55-n*.04)/.22);star(c,x+(n%2?1:-1)*50,y+70+n*26-h*50,5*h,COLORS[n],g.age);}}c.restore();
}
function bananaScene(c,g){
 const x=g.mirrored?1920-g.x:g.x;
 if(g.p<.45)record(c,x-85,1027,28,g.age*5);
 if(g.p>.26&&g.p<.72){for(let n=0;n<4;n++)star(c,x-45+n*28,g.y-80-(n%2)*15,8,COLORS[n],g.age+n);}
 if(g.p>.76)crown(c,x,g.y-79,ease((g.p-.76)/.13)*.8);
}
function frogScene(c,g){
 for(let n=0;n<8;n++){const p=(g.age-.25-n*.11)/1.0;if(p<0||p>1)continue;note(c,1858+Math.sin(n)*21,360-p*190,1.2-p*.4,COLORS[n%5]);}
 // Trumpet notes become flowers up the side, then blossom across the top.
 for(let n=0;n<12;n++){const grow=ease((g.age-.3-n*.09)/.33),x=n<6?1810+(n%2?54:-35):1760-(n-6)*74,y=n<6?780-n*99:75;if(grow<=0)continue;
  path(c,[[x,y+30],[x+8,y+5]],'#7de9ad',3);for(let k=0;k<5;k++){const a=k*1.256+g.age*.2;ellipse(c,x+Math.cos(a)*12*grow,y+Math.sin(a)*12*grow,9*grow,9*grow,COLORS[n%5]);}ellipse(c,x,y,6*grow,6*grow,'#ffe8a0');}
}
function crowdScene(c,g){const x=g.mirrored?1920-g.x:g.x;for(let n=0;n<7;n++){const xx=x-120+n*39,yy=1043-arc(clamp((g.p-n*.035)*1.6))*22;path(c,[[xx,1090],[xx+5,yy],[xx-4,yy-12]],COLORS[n%5],9);}for(let n=0;n<4;n++)star(c,x-85+n*57,g.y-63,6+n%2*3,COLORS[n],g.p*4);}
const scenes={
 'crab-cannon':crabScene,'dragon-confetti-sneeze':dragonScene,'penguin-surf-stunt':penguinScene,
 'bongo-balloon-solo':bongoScene,'pedro-record-toss':pedroScene,'nyan-comet-delivery':nyanScene,
 'cat-ufo-abduction':ufoScene,'banana-record-slip':bananaScene,'frog-flower-fanfare':frogScene,'cat-crowd-surf':crowdScene
};
export function drawAct(c,g,t,seed){
 c.save();c.globalAlpha*=g.fade;
 if(g.mirrored){c.translate(1920,0);c.scale(-1,1);}
 scenes[g.id](c,g,t,seed);
 c.save();c.translate(g.mirrored?1920-g.x:g.x,g.y);c.rotate(g.rotation*(g.mirrored?-1:1));c.scale(g.scale*Math.abs(g.sx),g.scale*g.sy);
 if(g.key==='penguin')drawPenguin(c,g.music?g.music.beat*.48:g.pose);else drawGuest(c,g.key,g.pose,g.key==='pedro'?0:g.p,g.music);
 c.restore();c.restore();
}
