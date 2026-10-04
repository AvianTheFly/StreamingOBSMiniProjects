import {esc} from '../utils.js';
let root=null,epoch=0,timer=null,data=null,selected=null,dirty=false;
const endpoint='/api/twitch-commands';
async function request(path=endpoint,body){
 const r=await fetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const value=await r.json();if(!r.ok)throw Error(value.error||'Request failed');return value;
}
export async function mount(container){
 root=container;const token=++epoch;dirty=false;selected=null;
 root.innerHTML=`<div class="page-header"><div><div class="desk-eyebrow">Four spirits. Your chat.</div><h1 class="page-title">Chat commands</h1><p class="page-subtitle">Your links, League answers and community jokes. Replies come from your Twitch account.</p></div></div>
 <section class="card" style="margin-bottom:16px;padding:18px"><p id="tcStatus" role="status">Loading commands…</p><p id="tcDelivery"></p><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><label><input type="checkbox" id="tcEnabled" disabled> Enable chat replies</label><a class="btn" href="http://127.0.0.1:7443" target="_blank" rel="noopener">Connect Twitch ↗</a><button class="btn" id="tcReload">Reload commands</button></div><p style="color:var(--muted)">Connect Twitch opens the Hub’s existing authorization. Allow chat replies there once. No Nightbot or StreamElements account needed.</p></section>
 <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:18px;align-items:start"><section class="card" style="padding:18px"><div style="display:flex;gap:8px"><input type="search" class="input" id="tcSearch" placeholder="Search commands or aliases" aria-label="Search commands"><button class="btn" id="tcNew" disabled>New command</button></div><p id="tcCounts"></p><div id="tcList" style="max-height:570px;overflow:auto"></div></section>
 <section class="card" style="padding:18px"><h2 id="tcEditorTitle">Choose a command</h2><form id="tcForm" hidden><label>Command<input id="tcName" class="input" required maxlength="33" placeholder="!discord"></label><label>Aliases (space separated)<input id="tcAliases" class="input" placeholder="!disc !dc"></label><label>Response type<select id="tcKind" class="input"><option value="text">Your reply text</option><option value="index">Command list with pages</option><option value="time">Current Eastern time</option><option value="8ball">Four-spirit 8-ball</option></select></label><label>Reply<textarea id="tcResponse" class="input" rows="5" maxlength="400"></textarea></label><label>Category<input id="tcCategory" class="input" maxlength="60"></label><div style="display:flex;gap:12px;flex-wrap:wrap"><label>Cooldown (seconds)<input id="tcCooldown" class="input" type="number" min="5" max="3600" value="30"></label><label>Who can use it?<select id="tcPermission" class="input"><option value="everyone">Everyone</option><option value="moderator">Moderators and you</option><option value="owner">Only you</option></select></label></div><label><input type="checkbox" id="tcRowEnabled"> Command enabled</label><p id="tcNote" style="color:var(--muted)"></p><button class="btn btn-primary" type="submit">Save command</button><p id="tcSave" role="status"></p></form></section></div>
 <section class="card" style="padding:18px;margin-top:18px"><h2>Try a command privately</h2><p style="color:var(--muted)">Preview uses saved commands and never posts to Twitch.</p><form id="tcPreviewForm" style="display:flex;gap:8px;flex-wrap:wrap"><input id="tcPreviewText" class="input" placeholder="!discord" aria-label="Command to preview" maxlength="500"><button class="btn">Preview reply</button></form><p id="tcPreview" role="status"></p></section>`;
 container.insertAdjacentHTML('afterbegin',`<style>#tcForm{display:grid;gap:14px}#tcForm[hidden]{display:none}#tcForm label{display:flex;flex-direction:column;gap:6px}#tcForm label:has(input[type=checkbox]){flex-direction:row;align-items:center}#tcEnabled,#tcRowEnabled{width:auto;margin:0 6px 0 0}#tcList .btn{background:#252e38;color:#dde5e9;border:1px solid #424e5b}#tcForm textarea{resize:vertical}#tcForm .input{width:100%}#tcList small{color:var(--muted)}</style>`);
 const $=id=>container.querySelector('#'+id);
 let writing=false,previewSequence=0;
 const message=value=>{$('tcStatus').textContent=value;};
 function renderList(){
  if(!data)return;const query=$('tcSearch').value.trim().toLowerCase(),enabled=data.commands.filter(c=>c.enabled);
  $('tcCounts').textContent=`${enabled.length} enabled groups · ${enabled.reduce((n,c)=>n+1+c.aliases.length,0)} command names · ${data.commands.length-enabled.length} awaiting details or disabled`;
  $('tcList').innerHTML=data.commands.filter(c=>`${c.command} ${c.aliases.join(' ')} ${c.category||''}`.toLowerCase().includes(query)).map(c=>`<button type="button" class="btn" data-command="${esc(c.command)}" style="display:block;width:100%;text-align:left;margin-bottom:8px;white-space:normal"><strong>${esc(c.command)}</strong> · ${c.enabled?'Enabled':'Disabled'}<br><small>${esc(c.aliases.join(' '))}</small></button>`).join('')||'<p>No matching commands.</p>';
  $('tcList').querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>select(data.commands.find(c=>c.command===button.dataset.command))));
 }
 function select(row){
  if(writing)return;
  if(dirty&&!window.confirm('Discard unsaved command edits?'))return;
  selected=row?.command||null;dirty=false;$('tcForm').hidden=false;$('tcEditorTitle').textContent=selected||'New command';
  $('tcName').value=selected||'';$('tcAliases').value=row?.aliases.join(' ')||'';$('tcResponse').value=row?.response||'';$('tcKind').value=row?.kind||'text';$('tcCategory').value=row?.category||'Custom';$('tcCooldown').value=row?.cooldown||30;$('tcPermission').value=row?.permission||'everyone';$('tcRowEnabled').checked=row?.enabled??true;$('tcNote').textContent=row?.note||'';$('tcSave').textContent='';
 }
 const updateDelivery=chat=>{$('tcDelivery').textContent=`${chat?.delivery?.message||'Chat connection unavailable'}${chat?.delivery?.last?' · '+chat.delivery.last.message:''}`;};
 async function load(){
  try{const value=await request();if(token!==epoch)return;data=value;$('tcEnabled').checked=data.enabled;$('tcEnabled').disabled=false;$('tcNew').disabled=false;renderList();message('Your command catalog is ready.');updateDelivery(value.chat);}
  catch(error){if(token===epoch)message(error.message);}
 }
 $('tcSearch').addEventListener('input',renderList);$('tcNew').addEventListener('click',()=>select(null));$('tcForm').addEventListener('input',()=>dirty=true);
 $('tcReload').addEventListener('click',async()=>{if(dirty&&!window.confirm('Discard unsaved command edits?'))return;dirty=false;selected=null;$('tcForm').hidden=true;await load();});
 $('tcEnabled').addEventListener('change',async()=>{
  const checkbox=$('tcEnabled');checkbox.disabled=true;
  try{const value=await request(endpoint+'/settings',{revision:data.revision,enabled:checkbox.checked});if(token!==epoch)return;data={...data,...value};renderList();message(data.enabled?'Chat replies enabled.':'Chat replies disabled.');}
  catch(error){if(token===epoch){checkbox.checked=data.enabled;message(error.message);}}
  finally{if(token===epoch)checkbox.disabled=false;}
 });
 $('tcForm').addEventListener('submit',async event=>{
  event.preventDefault();if(writing)return;writing=true;const fields=[...$('tcForm').querySelectorAll('input,select,textarea,button')];fields.forEach(field=>field.disabled=true);
  try{const value=await request(endpoint+'/settings',{revision:data.revision,original:selected,command:{command:$('tcName').value.trim().toLowerCase(),aliases:$('tcAliases').value.toLowerCase().split(/[\s,]+/).filter(Boolean),response:$('tcResponse').value.trim(),kind:$('tcKind').value,category:$('tcCategory').value.trim(),cooldown:Number($('tcCooldown').value),permission:$('tcPermission').value,enabled:$('tcRowEnabled').checked}});if(token!==epoch)return;data={...data,...value};dirty=false;selected=$('tcName').value.trim().toLowerCase();renderList();$('tcSave').textContent='Saved. Aliases now use this same reply.';}
  catch(error){if(token===epoch)$('tcSave').textContent=error.message;}
  finally{writing=false;if(token===epoch)fields.forEach(field=>field.disabled=false);}
 });
 $('tcPreviewForm').addEventListener('submit',async event=>{event.preventDefault();const sequence=++previewSequence;try{const value=await request(endpoint+'/preview',{text:$('tcPreviewText').value});if(token===epoch&&sequence===previewSequence)$('tcPreview').textContent=value.response||'No enabled public command matches this input.';}catch(error){if(token===epoch&&sequence===previewSequence)$('tcPreview').textContent=error.message;}});
 await load();if(token!==epoch)return;
 let polling=false;timer=setInterval(async()=>{if(polling)return;polling=true;try{const value=await request();if(token===epoch)updateDelivery(value.chat);}catch{}finally{polling=false;}},5000);
}
export function beforeLeave(){return !dirty||window.confirm('Leave without saving command edits?');}
export function unmount(){++epoch;clearInterval(timer);timer=null;root=null;data=null;dirty=false;}
