// Private catalog preview and enable switch; lifetime/polling stays in its parent.
export function jokePanel(container,request){
 const section=document.createElement('section');section.className='card';section.style.cssText='padding:18px;margin-top:18px';
 section.innerHTML='<h2>🃏 Automatic jokes</h2><label><input type="checkbox" id="tjEnabled" disabled> Post a joke every 20–40 minutes while streaming</label><p id="tjStatus" role="status">Loading joke rotation…</p><p style="color:var(--muted)">The 🃏 marker and softer overlay text distinguish jokes from command reminders. The rotation remembers used jokes across Hub restarts. Previewing this list never sends a message.</p><details><summary id="tjSummary">Read the joke list</summary><ol id="tjList" style="max-height:420px;overflow:auto;line-height:1.6;padding-right:12px"></ol></details>';
 container.append(section);
 const checkbox=section.querySelector('#tjEnabled'),status=section.querySelector('#tjStatus'),list=section.querySelector('#tjList');
 let state=null,busy=false,revision=null;
 function update(value){
  if(!section.isConnected||!value||busy)return;
  state=value;checkbox.checked=value.enabled;checkbox.disabled=false;
  status.textContent=value.message+(value.next_in_seconds!==null?' · Next in about '+Math.ceil(value.next_in_seconds/60)+' min':'');
  section.querySelector('#tjSummary').textContent='Read all '+value.count+' jokes';
  if(revision!==value.revision){revision=value.revision;list.replaceChildren(...value.catalog.map(row=>{const li=document.createElement('li');li.textContent=row.text;return li;}));}
 }
 checkbox.addEventListener('change',async()=>{
  if(!state||busy)return;busy=true;checkbox.disabled=true;
  try{const value=await request('/api/twitch-commands/jokes',{revision:state.revision,enabled:checkbox.checked});busy=false;update(value);}
  catch(error){busy=false;if(section.isConnected){checkbox.checked=state.enabled;checkbox.disabled=false;status.textContent=error.message;}}
 });
 return update;
}
