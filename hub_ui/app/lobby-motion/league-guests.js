// League casting is feature policy; all visits use the existing document clock.
import {GameGuestSprites} from './game-guest-sprites.js';
import {leagueAssets} from './league-guest-assets.js';
import {leagueActs} from './league-acts.js';
const u=(x,y,height,stance)=>({character:'udyr',x,y,height,stance});
const g=(character,x,y,height)=>({character,x,y,height});
export const leaguePlaces={
 reef:[u(805,748,55,'mantle'),g('poro',1150,729,36),g('scuttle',620,728,34)],
 forge:[u(810,708,53,'stampede'),g('poro',910,710,33),g('teemo',1130,735,36)],
 sanctuary:[u(1200,889,49,'claw'),g('poro',1060,889,32),g('scuttle',1290,908,32)],
 'sky-harbor':[u(800,789,54,'storm'),g('poro',938,790,36),g('teemo',1238,308,35)],
 'storm-coast':[u(665,786,56,'mantle'),g('poro',1460,944,36),g('scuttle',490,842,35)],
 'phoenix-observatory':[u(1520,681,49,'storm'),g('poro',1740,702,32),g('scuttle',1590,966,31)],
 'spirit-rail':[u(775,753,54,'stampede'),g('poro',965,754,35),g('teemo',570,754,34)],
 tavern:[u(725,822,56,'claw'),g('poro',1110,975,36),g('teemo',875,822,42)],
 future:[u(825,815,55,'claw'),g('poro',1400,718,35),g('scuttle',1085,315,32)],
 arcade:[u(830,824,54,'stampede'),g('poro',1436,770,35),g('teemo',750,158,32)],
 'aurora-camp':[u(715,857,52,'mantle'),g('poro',1420,959,34),g('scuttle',1270,1020,32)]
};
const stanceLabels={claw:'Wilding Claw: ring the practice bell',mantle:'Iron Mantle: protect the poro',stampede:'Blazing Stampede: stubborn training post',storm:'Wingborne Storm: one very cold drink'};
class LeagueMotion {
 constructor(inner,places){this.inner=inner;this.league=new GameGuestSprites(places.map(p=>p.character).concat(places.some(p=>p.stance==='mantle')?['poro']:[]),leagueAssets);this.disposed=false;}
 get base(){return this.inner.base;}get patches(){return this.inner.patches;}get residents(){return this.inner.residents;}get guests(){return this.inner.guests;}
 async load(){const results=await Promise.allSettled([this.inner.load(),this.league.load()]);const failure=results.find(r=>r.status==='rejected');if(this.disposed){this.dispose();return this;}if(failure){this.dispose();throw failure.reason;}return this;}
 draw(...args){if(!this.disposed)this.inner.draw(...args);}
 drawVisitor(...args){this.inner.drawVisitor?.(...args);}
 dispose(){this.disposed=true;this.inner.dispose();this.league.dispose();}
}
export function withLeagueGuests(id,world){
 const places=leaguePlaces[id];
 const labels={poro:'Poro steals the last biscuit',scuttle:'Rift Scuttler claims a tiny vision shrine',teemo:'Teemo leaves a suspicious mushroom'};
 const cues=places.map(p=>({id:'league-'+p.character,label:p.stance?stanceLabels[p.stance]:labels[p.character],description:p.stance?'Udyr channels an animal spirit for a small practical task.':labels[p.character],life:14,weight:1.4,impact:.4,depth:'background'}));
 const artists=Object.fromEntries(places.map(p=>['league-'+p.character,(c,a,e,art)=>{c.save();c.translate(p.x,p.y);c.scale(p.height/64,p.height/64);try{leagueActs[p.character](c,a,e,art,p);}finally{c.restore();}}]));
 return {...world,cues:[...world.cues,...cues],artists:{...world.artists,...artists},createMotion:()=>new LeagueMotion(world.createMotion(),places)};
}
