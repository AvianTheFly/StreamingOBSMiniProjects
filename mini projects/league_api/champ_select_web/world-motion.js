import {paintSecrets} from './spirit-secrets.js';
import {paintWorld} from './world-art.js';
import {paintEvents} from './world-events.js';
import {WorldAssets} from './world-assets.js';
import {DraftCues} from './draft-cues.js';
import {supportedTheme} from './scene-map.js';
import {layouts} from './layout.js';
import {paintResponses} from './vfx-timing.js';

// One clock/canvas for moving artwork, environment reactions and small residents.
export function createWorldMotion(stage) {
  const canvas=stage.querySelector('.world-motion'),c=canvas.getContext('2d');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),observer=new DraftCues(),assets=new WorldAssets();
  let visible=false,shown=false,frame=0,last=0,time=0,theme='bear',generation=null,cues=[],disposed=false,secretEpoch=0,secretPreview=0;
  function paint() {
    c.setTransform(canvas.width/1920,0,0,canvas.height/1080,0,0);
    c.clearRect(0,0,1920,1080);
    paintWorld(c,time,theme,cues);paintSecrets(c,time,theme,cues,assets,time-secretEpoch);paintEvents(c,time,theme,cues,assets);paintResponses(stage,cues,time);
    // Cut protected engraved role/name plates after every scenic and impact pass.
    for(const key of ['allies','enemies'])for(const p of layouts[theme][key]){c.clearRect(p.x+5,p.y+4,p.w-10,37);c.clearRect(p.x+6,p.y+327,p.w-12,73);}
  }
  function ensureAssets() {
    if(visible&&shown&&!disposed&&assets.theme!==theme) {
      stage.classList.remove('art-ready');
      assets.load(theme).then(()=>{
        if(!disposed&&visible&&shown&&assets.theme===theme) {
          stage.classList.toggle('art-ready',assets.ready);paint();
        }
      });
    }
  }
  function tick(now) {
    frame=0;if(!visible||!shown||disposed||reduced.matches)return;
    if(now-last>=1000/30) {
      time+=last?(now-last)/1000:0;last=now;
      cues=cues.filter(cue=>time-cue.at<4.2);paint();
    }
    frame=requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);frame=0;last=0;
    stage.classList.toggle('motion-paused',!visible||!shown||reduced.matches);
    if(visible&&shown&&!disposed) {ensureAssets();paint();if(!reduced.matches)frame=requestAnimationFrame(tick);}
  }
  function resize() {
    canvas.width=Math.max(1,Math.min(1920,innerWidth));
    canvas.height=Math.max(1,Math.min(1080,Math.round(canvas.width*innerHeight/innerWidth)));
    if(visible&&shown)paint();
  }
  function update(state) {
    const next=supportedTheme(state.theme);
    if(next!==theme||generation!==state.generation||!state.visible){cues=[];secretEpoch=time;}
    theme=next;generation=state.generation;
    canvas.style.maskImage=canvas.style.webkitMaskImage=`url('/champ-select/masks/${theme}.svg')`;
    const emitted=observer.observe({...state,theme});
    if(visible&&shown&&!reduced.matches)cues.push(...emitted.map(e=>({...e,at:time})));
    cues=cues.slice(-20);
    const nextShown=!!state.visible;
    if(shown!==nextShown){shown=nextShown;if(!shown){assets.dispose();stage.classList.remove('art-ready');}sync();}
    else ensureAssets();
    const draft=state.draft||{};
    stage.classList.toggle('draft-urgent',shown&&Number.isFinite(draft.seconds)&&draft.seconds<=10&&draft.seconds>0);
    if(reduced.matches&&visible&&shown)paint();
    return visible&&shown&&!reduced.matches?emitted:[];
  }
  const onReduced=()=>{cues=[];sync();};
  reduced.addEventListener('change',onReduced);window.addEventListener('resize',resize);resize();
  return {update,previewSecret(){secretEpoch=time-8-(secretPreview++%3)*36;},setVisible(value) {
    visible=value;
    if(!value){cues=[];observer.reset();assets.dispose();stage.classList.remove('art-ready');}sync();
  },dispose() {
    disposed=true;cancelAnimationFrame(frame);frame=0;cues=[];observer.reset();assets.dispose();
    reduced.removeEventListener('change',onReduced);window.removeEventListener('resize',resize);
    c.clearRect(0,0,1920,1080);
  }};
}

