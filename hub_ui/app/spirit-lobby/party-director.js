// Procedural party rhythm. No interval, worker, broadcast or saved global state.
// A shared wall clock gives both OBS layers the same authored surprises.
import {hash} from './paint.js';
const moods={gentle:{pace:1.55,fullness:.8},lively:{pace:1,fullness:1.1},wild:{pace:.72,fullness:1.45}};
export class PartyDirector {
  constructor(effects){this.effects=effects;this.plans=new Map();this.attempts=new Map();this.disposed=false;}
  plan(window,mode,speed=1){
    const key=mode+':'+speed+':'+window;if(this.plans.has(key))return this.plans.get(key);
    const mood=moods[mode]||moods.lively,all=this.effects.catalog.filter(e=>e.autoWeight>0),events=[],recent=[];let cursor=0,step=0;
    if(!all.length)return events;
    // Each minute gets different party weather. Soft pressure stretches gaps
    // and favors small accents; it never enforces a visible minimum or maximum.
    while(cursor<60&&step<80){
      const seed=window*171.71+step*43.13,weather=.85+hash(window+39)*.55;
      const pressure=events.reduce((sum,e)=>sum+(cursor-e.offset<e.spec.life?e.spec.impact||.5:0),0);
      cursor+=(.65+Math.pow(hash(seed+1),1.2)*3.9)*mood.pace*weather*(1+Math.max(0,pressure-mood.fullness)*.48);
      if(cursor>=60)break;
      const choices=all.map(spec=>({spec,weight:spec.autoWeight*(recent.includes(spec.id)?.14:1)*Math.exp(-Math.max(0,pressure-.9)*(spec.impact||.5))})),total=choices.reduce((s,e)=>s+e.weight,0);let pick=hash(seed+2)*total,selected=choices.at(-1).spec;
      for(const choice of choices){pick-=choice.weight;if(pick<=0){selected=choice.spec;break;}}
      const offset=cursor,id=`ambient:${mode}:${speed}:${window}:${step}`,event={id,kind:selected.id,at:(window*60+offset)/speed,offset,seed:seed+7,spec:selected};events.push(event);recent.push(selected.id);if(recent.length>5)recent.shift();step++;
      // Sometimes a small companion enters with the big moment, sometimes not.
      if(hash(seed+3)<.18&&selected.impact>.7){const companion=all.filter(e=>e.impact<.5&&!recent.includes(e.id));if(companion.length){const spec=companion[Math.floor(hash(seed+4)*companion.length)];events.push({id:id+':friend',kind:spec.id,at:event.at+.5/speed,offset:offset+.5,seed:seed+91,spec});recent.push(spec.id);if(recent.length>5)recent.shift();}}
    }
    this.plans.set(key,events);if(this.plans.size>4)this.plans.delete(this.plans.keys().next().value);return events;
  }
  tick(t,mode,wall=Date.now()/1000,speed=1){
    if(this.disposed)return;
    // Keep ambient ages synchronized despite different paint costs in the two
    // layers. Manual animations retain their own uninterrupted scene clock.
    for(const e of this.effects.instances)if(e.ambient){e.started=t-(wall-e.wallStarted)*speed;e.ends=e.started+e.life;}
    this.effects.prune(t);for(const [id,at] of this.attempts)if(wall-at>25)this.attempts.delete(id);
    if(!moods[mode])return;const window=Math.floor(wall*speed/60),candidates=[...this.plan(window-1,mode,speed),...this.plan(window,mode,speed)];
    for(const event of candidates){const age=(wall-event.at)*speed;if(age<0||age>=event.spec.life||this.attempts.has(event.id)||this.effects.seen.has(event.id))continue;
      this.attempts.set(event.id,wall);if(this.attempts.size>256)this.attempts.delete(this.attempts.keys().next().value);
      const manual=this.effects.instances.filter(e=>!e.ambient).reduce((sum,e)=>sum+(e.impact||.5),0);
      if(hash(event.seed+12)<1-Math.exp(-manual*.28))continue;
      const result=this.effects.trigger(t-age,event.kind,event.id,{seed:event.seed,ambient:true,wallStarted:event.at});
      if(!result.ok)continue;
    }
  }
  dispose(){this.disposed=true;this.plans.clear();this.attempts.clear();}
}
