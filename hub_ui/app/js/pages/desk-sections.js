// Stage browsing and contextual cues. Feature APIs retain playback and scene ownership.
import {api} from '../api.js';
import {runWithFeedback} from '../action-feedback.js';
import {paintStageMap,observedStage,STAGES} from './desk-stage-map.js';
import {mountStageAppearance} from './desk-appearance.js';
import {mountQueueControls} from './desk-queue.js';
export function mountDeskSections(root,refresh,openWorkspace=()=>true){
  const get=id=>root.querySelector('#'+id);
  let disposed=false,context={},catalog={},starting={},appearance={},current=null,shown='starting',browsed=false,afterparty=[],cueKey='';
  let endingChoice='Spirit Afterparty',lobbyChoice=null,startingChoice=null,draftChoice=null,viewRevision=0;
  const queueControls=mountQueueControls(root,refresh);
  const chooser=mountStageAppearance(root,(stage,id,result,item)=>{
    if(stage==='loading')appearance=result;
    if(stage==='starting')startingChoice=id;
    if(stage==='draft')draftChoice=id;
    if(stage==='lobby'){lobbyChoice=id;context.lobbyData={...context.lobbyData,selection:{mode:'fixed',source:id}};}
    if(stage==='ending')endingChoice=id;
    paint();refresh();
  });
  function enable(button,value){button.dataset.available=String(!!value);if(!button.hasAttribute('aria-busy'))button.disabled=!value;}
  async function perform(button,request,message){const result=await runWithFeedback(button,request,message);if(!disposed){paint();refresh();}return result;}
  function browse(stage){if(!openWorkspace(stage))return;viewRevision++;browsed=true;shown=stage;paint();}
  root.querySelectorAll('[data-stage-tile]').forEach(b=>b.onclick=()=>browse(b.dataset.stageTile));
  get('deskBackToCurrent').onclick=()=>{if(current&&!openWorkspace(current))return;viewRevision++;browsed=false;if(current)shown=current;paint();};
  get('deskChangeImage').onclick=e=>chooser.open(shown,e.currentTarget,{...context,lobbyChoice,endingChoice});
  async function showStage(stage,button){
    if(!openWorkspace(stage))return;
    const revision=++viewRevision;
    const feature=context.projects?.find(p=>p.name==='league_api'),league=feature?.workflow;
    const action=stage==='loading'?'show_loading':'show_draft';
    // Older running Hubs already expose deliberate scene selection. New feature
    // actions take effect on the next normal restart, without interrupting a stream.
    const leagueRequest=()=>feature?.actions?.some(a=>a.key===action)?api.runProjectAction('league_api',action):api.switchScene(stage==='loading'?league.loading_scene:league.champion_scene);
    const request=stage==='cinematics'?()=>api.startingScreenAction('cinematic'):stage==='starting'?()=>api.startingScreenAction('start'):['loading','draft'].includes(stage)?leagueRequest:()=>api.selectStreamStage(stage,stage==='ending'?endingChoice:stage==='lobby'?lobbyChoice:null);
    const result=await perform(button,request,'Stage requested');
    if(result&&!disposed&&revision===viewRevision){shown=stage;browsed=false;paint();}
  }
  get('deskShowStage').onclick=()=>showStage(shown,get('deskShowStage'));
  get('deskNextRoutes').onclick=e=>{const button=e.target.closest('[data-next-stage]');if(button&&!button.disabled)showStage(button.dataset.nextStage,button);};
  get('deskAuto').onclick=()=>perform(get('deskAuto'),()=>api.runProjectAction('scene_voice_switcher',context.coordination?.scenes?.automatic_holds?.length?'follow_scenes':'hold_scene'),'Scene routing updated');
  function paintCues(ready,league){
    const source=context.lobbyData?.current_lobby,world=(catalog.locations||[]).find(w=>w.source===source);
    const actions=source==='Spirit Afterparty'?afterparty:world?.effects?.actions||[];
    const replay=context.projects?.find(p=>p.name==='instant_replay');
    const key=JSON.stringify([shown,current,source,actions,starting.opening_catalog?.available,context.projects?.find(p=>p.name==='starting_soon')?.workflow?.opening,replay?.is_active,context.replayStage?.active]);
    if(key!==cueKey){
      cueKey=key;const host=get('deskStageCues');host.replaceChildren();
      const cue=(label,request,kind,html)=>{const b=document.createElement('button');b.className='btn btn-secondary stage-cue';b.dataset.cue=kind;if(html)b.innerHTML=html;else b.textContent=label;b.onclick=()=>perform(b,request,label+' requested');host.append(b);};
      if(shown==='cinematics'&&context.projects?.find(p=>p.name==='starting_soon')?.workflow?.opening)cue('Skip to lobby',()=>api.startingScreenAction('skip-intro'),'skip-cinematic');
      if(shown==='starting'&&starting.opening_catalog?.available)cue('▶ Play intro',()=>api.startingScreenAction('intro'),'intro');
      if((shown==='lobby'||shown==='ending')&&shown===current)actions.forEach(a=>cue(a.label,()=>source==='Spirit Afterparty'?api.afterpartyAction(a.id):api.lobbyEffect(source,a.id),'effect'));
      if(shown==='loading')cue('Mastery clip',()=>api.playProjectAsset('tik_tok','loading screen mastery'),'mastery','<img src="/assets/loading-mastery.jpg" alt=""><span>▶ Mastery clip</span>');
      if(shown==='game'){
        cue('↶ Replay last 15s',()=>api.runProjectAction('instant_replay','quick_replay'),'replay');
        if(replay?.is_active||context.replayStage?.active)cue('Return to game',()=>api.runProjectAction('instant_replay','revert'),'return');
      }
    }
    root.querySelectorAll('[data-cue]').forEach(b=>{
      const kind=b.dataset.cue;
      let allowed=ready&&shown===current;
      if(kind==='intro')allowed&&=!context.projects?.find(p=>p.name==='starting_soon')?.workflow?.opening;
      if(kind==='replay')allowed&&=context.coordination?.replay_buffer?.active===true&&!replay?.is_active&&!context.replayStage?.active&&!context.replayStage?.pending&&!['saving','queued','trimming'].includes(context.replayStage?.capture?.status);
      enable(b,allowed);
    });
  }
  function paint(){
    if(disposed)return;
    const league=context.projects?.find(p=>p.name==='league_api')?.workflow||{},ready=context.connected&&context.coordination?.scenes?.observing;
    const worlds=context.lobbyData?.locations?.length?context.lobbyData.locations:catalog.locations||[];
    const selection=context.lobbyData?.selection||catalog.selection;
    const selectedLobby=lobbyChoice||(selection?.mode==='fixed'?selection.source:context.lobbyData?.current_lobby);
    const world=worlds.find(w=>w.source===selectedLobby)||worlds.find(w=>w.rotation!==false),ending=worlds.find(w=>w.source===endingChoice)||world;
    const file=startingChoice||context.projects?.find(p=>p.name==='starting_soon')?.workflow?.artwork_file||starting.artwork?.[starting.artwork_index||0];
    const theme=draftChoice||league.draft_theme||'astral',draftArt='http://127.0.0.1:7431/champ-select/backgrounds/'+(theme==='random'?'astral':theme)+'.jpg';
    const image=appearance.images?.find(i=>i.id===appearance.selected),queued=league.connected&&(league.stage?.queue||['Matchmaking','ReadyCheck'].includes(league.phase));
    const pictures={cinematics:'/assets/sanctuary-cinematic.png',starting:file?'/starting-soon/art/'+encodeURIComponent(file):'',lobby:world?.art_url||'',ending:ending?.art_url||'',draft:draftArt,loading:image?.image_url||'/api/league-stage/art/sanctuary',game:''};
    const names={cinematics:'Sanctuary - Ram impact - 40 seconds',starting:starting.artwork_catalog?.find(a=>a.file===file)?.title,lobby:(world?.label||'Lobby')+(queued?' · in queue':''),ending:ending?.label,draft:theme==='random'?'Rotating themes':theme,loading:image?.title||'Spirit sanctuary',game:'Your configured game scene'};
    paintStageMap(root,{shown,current,context,pictures,names});
    get('deskChangeImage').hidden=['game','cinematics'].includes(shown);get('deskChangeImage').textContent=['lobby','ending'].includes(shown)?'Change lobby':'Change image';
    enable(get('deskChangeImage'),context.connected);
    const draftNeedsSwitch=shown==='draft'&&context.coordination?.scenes?.scene!==league.champion_scene;
    const temporary=!!context.coordination?.scenes?.temporary_owner;
    get('deskShowStage').hidden=current===shown&&!temporary&&!draftNeedsSwitch&&!(shown==='lobby'&&lobbyChoice&&lobbyChoice!==context.lobbyData?.current_lobby)&&!(shown==='ending'&&endingChoice!==context.lobbyData?.current_lobby);
    get('deskShowStage').textContent=shown==='cinematics'?'Play on stream':'Show on stream';
    let showReady=ready;
    if(shown==='cinematics')showReady&&=!!starting.opening_catalog?.cinematic?.available&&!context.projects?.find(p=>p.name==='starting_soon')?.workflow?.opening;
    if(shown==='loading')showReady&&=!!league.loading_scene;
    if(shown==='draft')showReady&&=!!context.projects?.find(p=>p.name==='league_api')&&!!league.champion_scene;
    if(['lobby','ending','game'].includes(shown))showReady&&=!!context.lobbyData;
    enable(get('deskShowStage'),showReady);
    get('deskShowStage').title=shown==='loading'&&!showReady?'Loading scene is not configured':'';
    enable(get('deskAuto'),ready);
    get('deskBackToCurrent').hidden=!current||shown===current;
    get('deskBackToCurrent').textContent='↩ On stream: '+(STAGES.find(s=>s[0]===current)?.[1]||'');
    get('deskSceneNotice').textContent=!ready?'OBS unavailable · browsing only':!current?'On stream: '+context.coordination.scenes.scene:'';
    paintCues(ready,league);
    queueControls.update(context,shown);
  }
  function update(next){context=next;const observed=observedStage(context,current);if(observed!==current){current=observed;if(current&&!browsed){shown=current;openWorkspace(shown);}}paint();}
  Promise.allSettled([api.getLobbyCatalog(),api.getStartingScreen(),api.getStageAppearance(),api.getAfterpartyActions()]).then(results=>{
    if(disposed)return;[catalog,starting,appearance]=results.slice(0,3).map(r=>r.status==='fulfilled'?r.value:{});afterparty=results[3].status==='fulfilled'?results[3].value.actions||[]:[];paint();
  });
  return {update,dispose(){disposed=true;chooser.dispose();queueControls.dispose();}};
}
