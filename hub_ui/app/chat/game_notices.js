// Local game discoveries share the Hub event stream and ordinary chat lifetime.
export function renderNotice(messages, notice, trim) {
 const row=document.createElement('article');row.className='message game-notice';
 row.dataset.id=notice.id;row.dataset.time=Date.now();
 const title=document.createElement('span');title.className='name';title.textContent=notice.title;row.append(title);
 const body=document.createElement('span');body.className='body';
 for(const text of notice.lines){const line=document.createElement('span');line.className='discovery-line';line.textContent=text;body.append(line);}
 row.append(body);messages.append(row);trim();
}

export function watchGameNotices(onNotice, {preview=false}={}) {
 if(preview)return ()=>{};
 let source=null,stopped=false;const seen=new Set();
 function close(){source?.close();source=null;}
 function sync(){
  if(stopped||document.hidden){close();return;}
  if(source)return;
  const stream=new EventSource('/api/events?events=hub_event');source=stream;
  stream.onmessage=event=>{
   if(stopped||document.hidden||source!==stream)return;
   try{
    const message=JSON.parse(event.data),notice=message.payload?.data;
    if(message.type!=='hub_event'||message.payload?.event!=='chat.overlay.notice'||notice?.kind!=='six-seven')return;
    const age=Date.now()/1000-notice.created_at;
    if(typeof notice.id!=='string'||!notice.id||seen.has(notice.id)||!Number.isFinite(age)||age< -2||age>8)return;
    if(typeof notice.title!=='string'||notice.title.length>60||!Array.isArray(notice.lines)||!notice.lines.length||notice.lines.length>3||notice.lines.some(line=>typeof line!=='string'||line.length>180))return;
    seen.add(notice.id);if(seen.size>128)seen.delete(seen.values().next().value);
    onNotice(notice);
   }catch{}
  };
 }
 function dispose(){stopped=true;close();seen.clear();document.removeEventListener('visibilitychange',sync);window.removeEventListener('pagehide',close);window.removeEventListener('pageshow',sync);}
 document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',close);window.addEventListener('pageshow',sync);sync();
 return dispose;
}
