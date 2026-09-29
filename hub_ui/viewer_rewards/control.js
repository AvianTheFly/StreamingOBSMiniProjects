import {EffectShow} from './renderer.js';
const csrf=document.querySelector('meta[name="hub-csrf"]').content;
const show=new EffectShow(document.getElementById('preview'));let enabled=false,built=false;
const status=document.getElementById('status');
async function post(path,body={}){
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-CSRF':csrf},body:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed');return data;
}
async function action(button,fn){button.disabled=true;try{await fn();await update();}catch(e){status.textContent=e.message;}finally{button.disabled=false;}}
function field(parent,label,input){const box=document.createElement('label');box.textContent=label;box.append(input);parent.append(box);return input;}
function input(type,value){const el=document.createElement('input');el.type=type;if(type==='checkbox')el.checked=value;else el.value=value;return el;}
function card(e){
 const el=document.createElement('article');el.className='card';el.dataset.key=e.key;
 const title=document.createElement('h2');title.textContent=e.twitch?.title||e.title;
 const p=document.createElement('p');p.textContent=`${e.twitch?.cost??e.cost} points · silent · ${e.installed?'installed':'not installed'}`;
 const form=document.createElement('div');form.className='fields';
 const active=field(form,'Reward enabled',input('checkbox',e.enabled));
 const duration=field(form,'Seconds',input('number',e.duration/1000));duration.min=.4;duration.max=2;duration.step=.1;
 const label=field(form,'Label',input('text',e.label));label.maxLength=32;
 const color=field(form,'Accent',input('color',e.color));
 const style=document.createElement('select');for(const name of ['pop','oops','cannon','calculated','fear','party']){const op=document.createElement('option');op.value=name;op.textContent=name;style.append(op);}style.value=e.style;field(form,'Animation',style);
 const settings=()=>({enabled:active.checked,duration:Math.round(Number(duration.value)*1000),label:label.value,color:color.value,style:style.value});
 const row=document.createElement('div');row.className='row';
 for(const [text,fn] of [['Preview',()=>show.play({...e,...settings()})],['Test in OBS',()=>post('/api/test',{key:e.key})],['Save',()=>post('/api/configure',{key:e.key,settings:settings()})]]){
  const button=document.createElement('button');button.textContent=text;button.onclick=()=>action(button,fn);row.append(button);
 }el.append(title,p,form,row);return el;
}
async function update(){
 try{
  const r=await fetch('/api/status');if(!r.ok)throw Error();const s=await r.json();enabled=s.enabled;
  status.textContent=`Twitch ${s.connected?'connected':'disconnected'} · OBS ${s.overlay_ready?'ready':'offline'} · Effects ${enabled?'enabled':'paused'} · ${s.installed} rewards\n${s.message}`;
  document.getElementById('enable').textContent=enabled?'Pause effects':'Enable effects';
  const auth=document.getElementById('auth');auth.replaceChildren();if(s.auth){const a=document.createElement('a');a.href=s.auth.url;a.textContent='Authorize Twitch: '+s.auth.code;a.target='_blank';a.rel='noopener';auth.append(a);}
  document.getElementById('recent').textContent=s.recent.map(r=>r.status+' · '+r.id).join('\n')||'No redemptions yet.';
  document.getElementById('last').textContent=s.last_effect?`${s.last_effect.test?'Test':'Live'} ${s.last_effect.key}: ${s.last_effect.status}`:'Ready for a quick effect.';
  if(!built){document.getElementById('cards').replaceChildren(...s.effects.map(card));built=true;}
 }catch{status.textContent='Hub connection unavailable.';}
}
for(const [id,path] of [['connect','/api/connect'],['obs','/api/obs'],['install','/api/install']])document.getElementById(id).onclick=function(){action(this,()=>post(path));};
document.getElementById('enable').onclick=function(){action(this,()=>post('/api/enabled',{enabled:!enabled}));};
update();setInterval(update,4000);
