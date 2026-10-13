// Only the configured broadcaster's marked messages get the quiet joke treatment.
export function isJokeMessage(login,text,channel,tags={}){
 return !!channel&&login===channel.toLowerCase()&&text.startsWith('🃏 ')&&
  (!tags['source-room-id']||tags['source-room-id']===tags['room-id']);
}
export function styleJoke(row,name){
 row.classList.add('chat-joke');
 row.dataset.kind='joke';
 const label=document.createElement('span');
 label.className='joke-label';label.textContent='JOKE · ';name.prepend(label);
}
