// Local command previews and chat preferences; previewing never sends a message.
import {esc} from '../utils.js';
import {toast} from '../toast.js';

export function createChat(root,request,refresh){
 const $=id=>root.querySelector('#'+id);let previews=[],loaded=false,dirty=false;
 const section=document.createElement('section');section.className='card';section.style.marginBottom='18px';
 section.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div class="card-title">💬 Twitch stat replies</div><span id="lsReplyStatus" role="status" style="color:var(--muted);font-size:13px"></span></div>
 <p>Quick answers in chat, with a short stat card on your stream. Type <code>!stats</code> for the command guide.</p>
 <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap"><label style="flex:1;min-width:200px">Preview a command<select id="lsReplyCommand" class="input" style="width:100%;margin-top:6px" aria-label="Preview a stat command"></select></label><button id="lsCopyCommand" class="btn">Copy command</button></div>
 <div style="margin:16px 0;padding:16px;border:1px solid var(--line);border-left:3px solid #a970ff;border-radius:10px;overflow-wrap:anywhere"><div id="lsReplyScope" style="color:#bf94ff;font-size:12px;margin-bottom:8px">↳ Reply to viewer</div><div id="lsReplyPreview" aria-live="polite" style="line-height:1.65"></div></div>
 <p style="color:var(--muted);font-size:13px">Trusted helpers also get a brief confirmation: ✅ Cannon miss +1 · This game: 3 · Undo: !statundo</p>
 <details><summary>Chat reply settings</summary><label style="display:block;margin:14px 0"><input id="lsChatReplies" type="checkbox" style="width:auto;margin-right:8px"> Reply to accepted stat requests and helper reports</label><button id="lsSaveReplies" class="btn">Save chat settings</button><a class="btn" href="http://127.0.0.1:7443/" target="_blank" rel="noopener" style="margin-left:8px">Connect Twitch ↗</a><p style="color:var(--muted);font-size:13px">Replies use your connected broadcaster account. Reconnect once to grant chat writing if needed. Stat requests share the viewer cooldown; helper reports share the observation cooldown.</p></details>`;
 $('lsCards').before(section);
 function preview(){const item=previews.find(p=>p.topic===$('lsReplyCommand').value);$('lsReplyPreview').textContent=item?.text||'Your reply preview will appear here.';$('lsReplyScope').textContent='↳ Reply to viewer · '+(item?.scope||'Current saved session');$('lsCopyCommand').disabled=!item;}
 $('lsReplyCommand').onchange=preview;
 $('lsChatReplies').onchange=()=>{dirty=true;};
 $('lsCopyCommand').onclick=async()=>{try{const item=previews.find(p=>p.topic===$('lsReplyCommand').value);if(item){await navigator.clipboard.writeText(item.command);toast.success('Command copied');}}catch{toast.error('Select the command and copy it manually.');}};
 $('lsSaveReplies').onclick=async()=>{try{await request('/api/league-stats/settings',{chat_replies:$('lsChatReplies').checked});dirty=false;toast.success('Chat settings saved');await refresh();}catch(e){toast.error(e.message);}};
 return {element:section,render(s){
  previews=s.reply_previews||[];const selected=$('lsReplyCommand').value;
  const html=previews.map(p=>`<option value="${esc(p.topic)}">${esc(p.command)} — ${esc(p.label)}</option>`).join('');
  if($('lsReplyCommand').innerHTML!==html){$('lsReplyCommand').innerHTML=html;if(previews.some(p=>p.topic===selected))$('lsReplyCommand').value=selected;}
  if(!loaded||!dirty){$('lsChatReplies').checked=s.settings.chat_replies!==false;loaded=true;}
  const delivery=s.chat?.delivery;$('lsReplyStatus').textContent=s.settings.chat_replies===false?'Replies paused':delivery?.message||'Checking Twitch connection…';
  if(delivery?.last?.sent===false)$('lsReplyStatus').textContent+=' · '+delivery.last.message;
  preview();
 }};
}
