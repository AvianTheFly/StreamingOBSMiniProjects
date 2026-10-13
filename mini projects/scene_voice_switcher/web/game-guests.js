// Feature-owned guest casting and contacts with the actual 1920x1080 paintings.
// Defaults are small background visits; the pot climber earns a few front cameos.
import {GameGuestSprites} from './game-guest-sprites.js';
import {quietActs} from './game-guest-acts.js';
import {stuntActs} from './game-guest-stunts.js';
import {habitatPlaces} from './habitat-blocking.js';
import {habitatAct,habitatResponse} from './habitat-acts.js';
const guest=(character,x,y,height,label,options={})=>({character,x,y,height,label,...options});
export const guestPlaces={
 reef:[guest('kirby',1100,728,52,'Kirby discovers bubble tea',{prop:'tea'}),guest('creeper',585,728,51,'Creeper mistakes coral for cover'),guest('goose',900,913,51,'Knife goose inspects the tea service'),guest('climber',728,1050,59,'Getting Over the reef counter',{front:true,ledge:[72,-94]})],
 sanctuary:[guest('kirby',820,793,49,'Kirby samples shrine tea',{prop:'tea'}),guest('boo',1410,295,46,'Boo hides behind the shrine ledge'),guest('hornet',680,793,49,'Hornet takes a silk shortcut')],
 'storm-coast':[guest('crewmate',760,786,52,'Crewmate repairs the storm lights'),guest('boo',1270,405,43,'Boo is nervous about thunder'),guest('goose',520,842,49,'Knife goose slides the lighthouse cup'),guest('climber',830,1024,57,'Getting Over the coastal counter',{front:true,ledge:[70,-125]})],
 'phoenix-observatory':[guest('kirby',1140,344,48,'Kirby swallows a shooting star'),guest('hornet',625,803,48,'Hornet threads the observatory'),guest('climber',620,1050,57,'Getting Over astronomy',{front:true,ledge:[74,-110]})],
 'spirit-rail':[guest('crewmate',865,753,47,'Crewmate checks the platform circuit'),guest('goose',1050,747,46,'Knife goose catches the wrong train'),guest('climber',590,946,56,'Getting Over the station steps',{front:true,ledge:[65,-134]})],
 'aurora-camp':[guest('kirby',1153,783,51,'Kirby steals a toasted marshmallow',{prop:'marshmallow'}),guest('creeper',1426,884,50,'Creeper startles itself at camp'),guest('goose',727,932,50,'Knife goose raids the camping mugs')],
 arcade:[guest('kirby',750,158,37,'Kirby eats the bonus star'),guest('crewmate',1436,770,43,'Crewmate repairs the arcade cabinet'),guest('salvager',720,824,47,'Salvage robot fumbles the arcade prize')],
 tavern:[guest('boo',897,822,45,'Boo fails to scare the bartender'),guest('goose',586,831,47,'Knife goose visits the tavern'),guest('climber',1440,1035,54,'Getting Over last orders',{front:true,ledge:[66,-93]})],
 forge:[guest('creeper',825,790,47,'Creeper auditions as a forge ornament'),guest('crewmate',662,793,45,'Crewmate attempts a hotfix'),guest('climber',476,954,57,'Getting Over the balance anvil',{front:true,ledge:[68,-123]})],
 future:[guest('crewmate',1390,717,44,'Crewmate does one actual task'),guest('kirby',1085,315,40,'Kirby takes a star out of orbit'),guest('salvager',728,815,47,'Salvage robot handles fragile cargo')],
 'sky-harbor':[guest('kirby',1260,308,41,'Kirby samples first-class snacks'),guest('boo',909,790,43,'Boo is shy at boarding'),guest('goose',641,789,47,'Knife goose clears airport security')]
};
const acts={...quietActs,...stuntActs};
const descriptions={kirby:'A snack slides off the painted ledge into Kirby’s mouth, then returns as a star.',boo:'Boo peeks over a ledge, laughs, hides its face, and sinks back behind the furniture.',crewmate:'A crewmate climbs from a little vent, fixes a light and ducks back inside.',creeper:'A suspicious planter reveals a Creeper, which hops and sheds harmless green confetti.',goose:'A knife-carrying goose crouches beside a cup, nudges it along the shelf and makes a quick escape.',climber:'The pot climber plants his hammer on a furniture edge, nearly makes the climb and slips back down.',hornet:'Hornet attaches a fine silk line, leaps across the ledge and lands with her cloak trailing.',salvager:'A salvage robot collects a tiny cup, drops it, panics and gathers it again.'};
class GuestMotion {
 constructor(inner,places,extra=[]){this.inner=inner;this.guests=new GameGuestSprites(places.map(p=>p.character).concat(extra));this.disposed=false;}
 get base(){return this.inner.base;}get patches(){return this.inner.patches;}get residents(){return this.inner.residents;}
 async load(){
  const result=await Promise.allSettled([this.inner.load(),this.guests.load()]);
  const failed=result.find(r=>r.status==='rejected');
  if(this.disposed){this.dispose();return this;}
  if(failed){this.dispose();throw failed.reason;}
  return this;
 }
 draw(...args){if(!this.disposed)this.inner.draw(...args);}
 drawVisitor(...args){this.inner.drawVisitor?.(...args);}
 dispose(){this.disposed=true;this.inner.dispose();this.guests.dispose();}
}
export function withGameGuests(id,world){
 const places=habitatPlaces[id]||guestPlaces[id],cues=places.map(p=>({id:'game-'+p.character,label:p.label,description:p.role?p.label:descriptions[p.character],life:12,weight:p.front?.28:1.15,impact:p.front?.65:.38,depth:p.front?'foreground':'background',habitatZone:p.zone,habitatStory:!!p.role}));
 const artists=Object.fromEntries(places.map(p=>['game-'+p.character,(c,a,e,art)=>{c.save();c.translate(p.x,p.y);c.scale(p.height/64,p.height/64);try{(p.role?habitatAct:acts[p.character])(c,a,e,art,p);}finally{c.restore();}if(p.role)habitatResponse(c,a,p);}]));
 return {...world,cues:[...world.cues,...cues],artists:{...world.artists,...artists},createMotion:()=>new GuestMotion(world.createMotion(),places,world.scene.adaptiveScreen?['climber','goose']:[])};
}
