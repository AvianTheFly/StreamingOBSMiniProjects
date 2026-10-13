// Display labels only; saved titles and filenames are preserved.
export const clipTitle=clip=>clip?.title||clip?.name||'Missing clip';
export function displayTitle(clip){
  if(!clip)return 'Missing clip';
  if(clip.title&&clip.title!==clip.name)return clip.title;
  const name=clipTitle(clip),match=name.match(/^(?:Replay\s+)?(\d{4}-\d{2}-\d{2})[ _](\d{2})-(\d{2})-(\d{2})/i);
  if(!match)return name.replace(/\.(mp4|mkv|mov|webm)$/i,'');
  const date=new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}`);
  if(!Number.isFinite(date.getTime()))return name;
  return `${date.toLocaleDateString(undefined,{month:'short',day:'numeric'})} · ${date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}${/trimmed/i.test(name)?' · Trimmed':''}`;
}
