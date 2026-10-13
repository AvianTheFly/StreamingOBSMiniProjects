// Desk lifecycle: observe public snapshots, assemble focused presentation components.
import {api} from '../api.js';
import {state} from '../state.js';
import {deskView} from './desk-view.js';
import {mountDeskSections} from './desk-sections.js';
import {mountDeskSession} from './desk-session.js';
import {mountDeskSounds} from './desk-sounds.js';
import {mountDeskReplays} from './desk-replays.js';
let dispose=null;
let leave=()=>true;
export function mount(root){
  root.innerHTML=deskView();let disposed=false,timer=null,inFlight=false,coordination=null,lobbyData=null,replayStage=null,replayQueue=null,lobbyReadAt=0;
  const replays=mountDeskReplays(root,refresh),sections=mountDeskSections(root,refresh,replays.open),session=mountDeskSession(root,refresh),sounds=mountDeskSounds(root);
  leave=replays.beforeLeave;
  function update(){if(disposed)return;const projects=state.get('projects'),connected=state.get('connected'),context={projects,connected,coordination,lobbyData,replayStage,replayQueue};sections.update(context);session.update(context);replays.update(context);const spotify=projects.find(p=>p.name==='spotify');root.querySelector('#deskSpotify').title=spotify?.current_activity||'Spotify follows its own playback across all stages';root.querySelector('#deskSounds').disabled=!connected;}
  const watches=[state.watch('projects',update),state.watch('connected',update)];
  async function poll(){
    if(disposed||inFlight)return;clearTimeout(timer);
    if(document.hidden){timer=setTimeout(poll,4000);return;}inFlight=true;
    try{
      const results=await Promise.allSettled([api.getCoordination(),api.getReplayStage(),api.getReplayQueue()]);if(disposed)return;
      coordination=results[0].status==='fulfilled'?results[0].value:null;replayStage=results[1].status==='fulfilled'?results[1].value:null;
      replayQueue=results[2].status==='fulfilled'?results[2].value:null;
      if(coordination?.scenes?.observing&&(!lobbyData||lobbyData.program_scene!==coordination.scenes.scene||Date.now()-lobbyReadAt>10000)){
        try{const data=await api.getLobbies();if(!disposed){lobbyData=data;lobbyReadAt=Date.now();}}catch{}
      }
    }finally{inFlight=false;if(!disposed){update();timer=setTimeout(poll,3000);}}
  }
  async function refresh(){lobbyReadAt=0;poll();try{const data=await api.getStatus();if(!disposed&&Array.isArray(data.projects))state.set({projects:data.projects});}catch{}}
  update();poll();dispose=()=>{disposed=true;clearTimeout(timer);watches.forEach(fn=>fn());sections.dispose();session.dispose();sounds.dispose();replays.dispose();leave=()=>true;};
}
export function beforeLeave(){return leave();}
export function unmount(){dispose?.();dispose=null;}
export function onEvent(){}
