// Independent finite accents. Admission never cancels an accepted animation.
import {confetti,bubbles,meteors} from './party-particles.js';
import {visitor,vinyl,ducks} from './party-props.js';
import {bloom,wave} from './party-bloom.js';
import {balloons,lanterns,jellyfish} from './party-floaters.js';
import {robot,moon,portal} from './party-guests.js';
import {planes,fireflies,pinball,fireworks} from './party-sparks.js';
const artists={confetti,bubbles,meteors,visitor,vinyl,ducks,bloom,wave,balloons,lanterns,jellyfish,robot,moon,portal,planes,fireflies,pinball,fireworks};
export class Celebration {
  constructor(){this.catalog=[];this.instances=[];this.seen=new Map();this.serial=0;this.waveSerial=0;this.disposed=false;}
  async load(){const response=await fetch('/api/spirit-lobby/actions');if(!response.ok)throw new Error('Party controls unavailable');this.catalog=(await response.json()).actions;}
  prune(t){this.instances=this.instances.filter(e=>t<e.ends);for(const [id,at] of this.seen)if(t-at>120)this.seen.delete(id);}
  trigger(t,kind='confetti',id=crypto.randomUUID(),options={}){
    this.prune(t);const spec=this.catalog.find(e=>e.id===kind);
    if(this.disposed||!spec||!artists[kind])return {ok:false,reason:'Unknown action'};
    if(this.seen.has(id))return {ok:true,duplicate:true};
    if(this.instances.length>=24||this.instances.reduce((sum,e)=>sum+e.weight,0)+spec.weight>1600)return {ok:false,reason:'The room is full of accents. Try again as they finish.'};
    const serial=++this.serial,waveStart=kind==='wave'?Math.max(t,...this.instances.filter(e=>e.kind==='wave').map(e=>e.waveEnd)):t;
    this.instances.push({...spec,kind,id,serial:options.seed===undefined?serial:Math.floor(Math.abs(options.seed)),seed:options.seed??serial*137.61,ambient:!!options.ambient,wallStarted:options.wallStarted,started:t,ends:Math.max(t+spec.life,kind==='wave'?waveStart+.7:0),waveStart,waveEnd:waveStart+.7,waveIndex:kind==='wave'?++this.waveSerial:0});
    this.seen.set(id,t);if(this.seen.size>1024)this.seen.delete(this.seen.keys().next().value);return {ok:true};
  }
  waveTime(t){const e=this.instances.find(e=>e.kind==='wave'&&t>=e.waveStart&&t<e.waveEnd);return e?(e.waveIndex%2?1.2:3.1)+t-e.waveStart:t;}
  draw(c,t,colors,stage='front'){
    for(const e of this.instances){const age=t-e.started;if(e.stage!==stage||age<0||age>=e.life)continue;
      c.save();c.globalAlpha*=Math.min(1,age*6,(e.life-age)*2);artists[e.kind](c,age,colors,e);c.restore();
    }
  }
  clear(){this.instances=[];}
  dispose(){this.disposed=true;this.clear();this.seen.clear();}
}
