import {supportedTheme} from './scene-map.js';
// Interactive, local-only rehearsal. These controls never call live APIs or save.
export function installDemo(render,stage,motion,names) {
  stage.classList.add('demo');
  const params=new URLSearchParams(location.search);
  let theme=supportedTheme(params.get('theme')),generation=0,serial=0,state;
  let pageShown=true,sourceShown=true;
  const sync=()=>motion.setVisible(pageShown&&sourceShown&&!document.hidden);
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('obsSourceVisibleChanged',e=>{sourceShown=e.detail?.visible!==false;sync();});
  window.addEventListener('pagehide',()=>{pageShown=false;sync();});
  window.addEventListener('pageshow',()=>{pageShown=true;sync();});sync();
  const roles=['TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY'];
  const aliases=['Gromp','Krugs','Murk Wolf','Raptors','Scuttle Crab'];
  const roster=[[266,'Aatrox'],[103,'Ahri'],[84,'Akali'],[22,'Ashe'],[412,'Thresh'],[157,'Yasuo'],[64,'Lee Sin'],[51,'Caitlyn'],[43,'Karma'],[107,'Rengar']];
  const playerLabel=i=>i<5?aliases[i]:`Opponent ${i-4}`;
  const slot=(i,locked)=>({championId:roster[i][0],name:roster[i][1],locked,role:roles[i%5],label:playerLabel(i),
    image:`/champ-select/icons/${roster[i][0]}.png`,portrait:`/champ-select/portraits/${roster[i][0]}.jpg`});
  const banIds=[238,555,777,119,412,234,107,121,81,11];
  function conversation(){
    const senders=['Gromp','Krugs','Murk Wolf','YOU'];
    const bodies=['I can cover top after the first clear.','Save the last pick for support?',
      'We have plenty of engage. I’ll bring exhaust and play around bot lane.','Ready when you are!'];
    state.chat=Array.from({length:10},(_,i)=>({id:String(++serial),sender:senders[i%4],body:bodies[i%4]}));
  }
  function fresh() {
    state={visible:true,theme,generation:++generation,chat:[],draft:{phase:'PICK',localSlot:1,seconds:24,
      allies:Array.from({length:5},(_,i)=>i<3?slot(i,i<2):{championId:0,role:roles[i],label:playerLabel(i)}),
      enemies:Array.from({length:5},(_,i)=>i<3?slot(i+5,i<2):{championId:0,role:roles[i],label:playerLabel(i+5)}),
      allyBans:[],enemyBans:[]}};
    if(params.get('chat')==='1')conversation();
    render(state);
  }
  const panel=document.createElement('nav');panel.className='demo-controls';panel.setAttribute('aria-label','Draft rehearsal');
  function button(label,action){const b=document.createElement('button');b.textContent=label;b.type='button';b.addEventListener('click',action);panel.append(b);return b;}
  const select=document.createElement('select');select.setAttribute('aria-label','Preview world');
  for(const [id,name] of Object.entries(names)){const option=document.createElement('option');option.value=id;option.textContent=name;select.append(option);}
  select.value=theme;select.addEventListener('change',()=>{theme=select.value;fresh();});panel.append(select);
  button('Lock pick',()=>{
    for(const [side,offset] of [['allies',0],['enemies',5]]){
      const i=state.draft[side].findIndex(p=>!p.locked);if(i<0)continue;
      state.draft[side][i]=slot(i+offset,true);render(state);return;
    }
  });
  button('Ban',()=>{
    for(const [side,offset] of [['allyBans',0],['enemyBans',5]]){
      const i=state.draft[side].length;if(i===5)continue;
      const id=banIds[offset+i];state.draft[side].push({championId:id,locked:true,image:`/champ-select/icons/${id}.png`});render(state);return;
    }
  });
  button('Chat',()=>{state.chat.push({id:String(++serial),sender:['Gromp','Krugs','Murk Wolf','YOU'][serial%4],body:['Ready when you are.','Let’s lock this in.','We have a strong front line.'][serial%3]});state.chat=state.chat.slice(-10);render(state);});
  button('Busy chat',()=>{conversation();render(state);});
  button('Team ready',()=>{state.draft.phase='FINALIZATION';state.draft.seconds=5;render(state);});
  button('Hidden detail',()=>motion.previewSecret());
  button('New draft',fresh);
  if(params.get('clean')!=='1')document.body.append(panel);
  fresh();
}
