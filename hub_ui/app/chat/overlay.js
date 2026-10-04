import {parseLine,fragments,readableColor,safeImage} from './protocol.js';
import {watchReadability} from './readability.js';
const preview=new URLSearchParams(location.search).has('preview');
const lobby=new URLSearchParams(location.search).has('lobby');
const messages=document.querySelector('#messages'),notice=document.querySelector('#notice');
let settings={},emotes={},badges={},packAliases={},previewMessage=null,socket=null,reconnect=null,roomId='',generation=0,failures=0,stopped=false;
const state=value=>{document.querySelector('#connection').textContent=value;};
if(!lobby)watchReadability(messages,()=>settings,{preview});
function apply(value){
 if(lobby)value={...value,theme:'minimal',font_size:Math.max(18,Math.min(24,Math.round(innerWidth/14))),emote_size:32,text_opacity:100,hover_opacity:100,fade_seconds:0,max_messages:12,show_header:false,line_height:130};
 settings=value;document.body.dataset.theme=value.theme;document.body.dataset.lobby=String(lobby);document.body.classList.toggle('no-motion',!value.motion);document.body.classList.toggle('with-header',value.show_header);const css=document.documentElement.style;css.setProperty('--accent',value.accent);css.setProperty('--card-alpha',value.opacity/100);css.setProperty('--font-size',value.font_size+'px');css.setProperty('--emote-size',value.emote_size+'px');css.setProperty('--font',JSON.stringify(value.font));css.setProperty('--message-gap',(value.message_gap??5)+'px');css.setProperty('--line-height',(value.line_height??135)/100);document.querySelector('#channel').textContent=value.channel.toUpperCase();trim();}
function trim(){
 document.documentElement.style.setProperty('--text-alpha',(settings.text_opacity??68)/100);document.documentElement.style.setProperty('--hover-alpha',(settings.hover_opacity??94)/100);
 while(messages.children.length>settings.max_messages)messages.firstElementChild.remove();
 if(lobby){
  const gap=settings.message_gap??5,budget=messages.clientHeight-8;
  let height=[...messages.children].reduce((sum,row)=>sum+row.offsetHeight+gap,0)-gap;
  while(messages.children.length>1&&height>budget){height-=messages.firstElementChild.offsetHeight+gap;messages.firstElementChild.remove();}
 }
}
function image(fragment){const img=document.createElement('img');img.className='emote';img.src=fragment.url;img.alt=fragment.alt;img.title=fragment.alt+(fragment.provider?' · '+fragment.provider:'');img.loading='eager';img.onerror=()=>img.replaceWith(document.createTextNode(fragment.alt));return img;}
function remove(row){if(row.classList.contains('leaving'))return;row.classList.add('leaving');setTimeout(()=>row.remove(),700);}
export function render({tags={},text='',prefix='',id}){
 const login=prefix.split('!')[0].toLowerCase();if(settings.hide_bots&&settings.hidden_users.includes(login))return;
 const row=document.createElement('article');row.className='message';row.dataset.id=tags.id||id||'';row.dataset.user=tags['user-id']||'';row.dataset.login=login;row.dataset.time=Date.now();row.style.setProperty('--user-color',readableColor(tags.color));
 const name=document.createElement('span');name.className='name';
 if(settings.badges)for(const badge of (tags.badges||'').split(',')){if(badges[badge]&&safeImage(badges[badge])){const img=document.createElement('img');img.src=badges[badge];img.alt=badge.split('/')[0];img.className='badge';name.append(img);}else{const role={broadcaster:'♛',moderator:'◆',vip:'✦',subscriber:'★'}[badge.split('/')[0]];if(role){const span=document.createElement('span');span.className='role';span.textContent=role;span.title=badge.split('/')[0];name.append(span);}}}
 name.append(document.createTextNode(tags['display-name']||login||'Chat'));row.append(name);
 const body=document.createElement('span');body.className='body';const parts=fragments(text,tags,emotes,{...packAliases,...settings.replacements},{natural:settings.natural_stickers??true,limit:settings.max_stickers??6});let stack=null;
 for(const part of parts){if('text' in part){body.append(document.createTextNode(part.text));if(part.text.trim())stack=null;}else{const img=image(part);if(part.zero_width&&stack){img.classList.add('zero');stack.append(img);}else{stack=document.createElement('span');stack.className='emote-stack';stack.append(img);body.append(stack);}}}
 if(parts.some(p=>p.url)&&parts.every(p=>p.url||!p.text.trim()))row.classList.add('emote-only');
 if(text.toLowerCase().includes('@'+settings.channel))row.classList.add('mention');
 row.append(body);messages.append(row);trim();
}
async function loadCatalog(){const current=generation;try{const r=await fetch('/api/chat/catalog?id='+roomId);if(!r.ok)return;const data=await r.json();if(current!==generation)return;emotes=data.emotes;badges=data.badges;packAliases=data.pack?.aliases||{};parent.postMessage({chatCatalog:data.providers,chatEmotes:emotes,chatAliases:packAliases},location.origin);if(preview)samples();}catch{}}
function connect(){
 clearTimeout(reconnect);const current=++generation;roomId='';emotes={};badges={};packAliases={};messages.replaceChildren();if(socket)socket.close();socket=null;
 if(!settings.channel){notice.textContent='Set your Twitch channel in Hub → Chat Overlay.';state('SET CHANNEL');return;}
 notice.textContent='';state('CONNECTING');loadCatalog();
 const ws=new WebSocket('wss://irc-ws.chat.twitch.tv:443');socket=ws;
 ws.onopen=()=>{if(current!==generation)return ws.close();for(const command of ['CAP REQ :twitch.tv/tags twitch.tv/commands','PASS SCHMOOPIIE','NICK justinfan'+Math.floor(Math.random()*900000+100000),'JOIN #'+settings.channel])ws.send(command+'\r\n');};
 ws.onmessage=event=>{if(current!==generation)return;for(const line of event.data.split('\r\n')){if(!line)continue;const message=parseLine(line);if(message.command==='PING')ws.send('PONG :'+message.text+'\r\n');if(message.command==='RECONNECT')ws.close();if(message.command==='NOTICE'){notice.textContent=message.text.slice(0,180);state('NOTICE');}if(message.command==='ROOMSTATE'){failures=0;state('LIVE');notice.textContent='';const id=message.tags['room-id'];if(id&&id!==roomId){roomId=id;loadCatalog();}}if(message.command==='PRIVMSG')render(message);if(message.command==='CLEARMSG')for(const row of messages.children)if(row.dataset.id===message.tags['target-msg-id'])row.remove();if(message.command==='CLEARCHAT'){if(!message.text)messages.replaceChildren();else for(const row of [...messages.children])if(row.dataset.user===message.tags['target-user-id']||row.dataset.login===message.text.toLowerCase())row.remove();}}};
 ws.onclose=()=>{if(current!==generation||stopped)return;state('RECONNECTING');notice.textContent='Chat disconnected · reconnecting…';reconnect=setTimeout(connect,Math.min(30000,1000*2**Math.min(failures++,5)));};ws.onerror=()=>ws.close();
}
function samples(){messages.replaceChildren();if(previewMessage!==null){render({prefix:'sticker_test!demo',tags:{'display-name':'Sticker test',color:'#76e4cf'},text:previewMessage});state('PREVIEW');return;}const asset='/viewer_assets/botlaneBear-chat.png';const demoEmotes={...emotes,BotLane:{url:asset,provider:'Custom'}};emotes=demoEmotes;const chaos=!!emotes.RaveTime;[
 {name:'Mika',color:'#76e4cf',badges:'moderator/1',text:chaos?'that timing was unreal RaveTime':'that timing was unreal ✨'},
 {name:'River',color:'#c4a1ff',badges:'subscriber/12',text:chaos?'one more game? catRAVE':'one more game? 👀'},
 {name:'BearEnjoyer',color:'#ffbf78',text:chaos?'BabyRave PartyKirby':'BotLane BotLane'},
 {name:'Luna',color:'#ffa3ca',badges:'vip/1',text:chaos?'ready for the next fight borpaSpin':'cleanest bot lane on Twitch'},
 {name:'Pixel',color:'#88c6ff',text:'Kappa',emotes:'25:0-4'},
 {name:'Nox',color:'#ffcf8a',text:'great timing on that last engage'},
 ].forEach((m,i)=>render({prefix:m.name.toLowerCase()+'!demo',text:m.text,id:'demo'+i,tags:{'display-name':m.name,color:m.color,badges:m.badges||'',emotes:m.emotes||''}}));state('PREVIEW');}
window.addEventListener('message',event=>{if(event.origin!==location.origin)return;if(event.data.chatSettings){apply(event.data.chatSettings);if(preview)samples();}if(event.data.chatSample&&preview){previewMessage=null;samples();}if(preview&&typeof event.data.chatTest==='string'){previewMessage=event.data.chatTest.slice(0,500);samples();}});
setInterval(()=>{if(preview)return;for(const row of messages.children)if(settings.fade_seconds&&Date.now()-Number(row.dataset.time)>settings.fade_seconds*1000)remove(row);},1000);
async function refresh(){try{const r=await fetch('/api/chat/settings');if(!r.ok)throw Error();const next=await r.json(),channelChanged=next.channel!==settings.channel;apply(next);if(preview){if(!messages.children.length)samples();}else if(channelChanged||!socket)connect();}catch{state('HUB OFFLINE');}}
await refresh();if(preview)loadCatalog();else setInterval(refresh,3000);setInterval(()=>{if(!preview)loadCatalog();},300000);
window.addEventListener('beforeunload',()=>{stopped=true;clearTimeout(reconnect);socket?.close();});
