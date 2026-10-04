// Natural-word matching is separate from Twitch tag parsing and DOM rendering.
// A match must cover whole words. Links/mentions and native emotes stay intact.
const protectedToken=/^(?:https?:\/\/|www\.|@|!|#)/i;
const edgeStart=/^[^\p{L}\p{N}_]+/u,edgeEnd=/[^\p{L}\p{N}_]+$/u;
const folded=value=>value.toLocaleLowerCase().replace(/\s+/g,' ').trim();
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key)?object[key]:undefined;

export function compileStickers(replacements,{natural=true,limit=6}={}){
 const phrases=new Map();
 for(const [alias,url] of Object.entries(replacements||{})){
  const key=folded(alias),words=key.split(' ');
  if(!phrases.has(words[0]))phrases.set(words[0],[]);
  phrases.get(words[0]).push({key,words,url});
 }
 for(const entries of phrases.values())entries.sort((a,b)=>b.words.length-a.words.length);
 return {replacements:replacements||{},phrases,natural,remaining:limit};
}

export function stickerFragments(value,emotes,rules,safeImage){
 const tokens=value.split(/(\s+)/),out=[];
 for(let at=0;at<tokens.length;at++){
  const token=tokens[at];if(!token)continue;
  const exact=own(rules.replacements,token),emote=own(emotes,token);
  if(protectedToken.test(token)){out.push({text:token});continue;}
  const exactPart=()=>{
   if(safeImage(exact)&&rules.remaining>0){out.push({url:exact,alt:token,provider:'Custom'});rules.remaining--;}
   else if(emote&&safeImage(emote.url))out.push({...emote,alt:token});
   else out.push({text:token});
  };
  if(!rules.natural||!token.trim()||rules.remaining<=0){exactPart();continue;}
  const lead=token.match(edgeStart)?.[0]||'',core=token.slice(lead.length).replace(edgeEnd,'');
  let match=null;
  for(const entry of rules.phrases.get(folded(core))||[]){
   // Exact native codes keep provider metadata (including zero-width layers).
   if(entry.words.length===1&&emote&&safeImage(emote.url)&&!safeImage(exact))continue;
   const end=at+(entry.words.length-1)*2;
   if(end>=tokens.length)continue;
   const chosen=tokens.slice(at,end+1);
   // Interior words retain their punctuation: "let, him cook" is not a phrase.
   if(chosen.filter((_,i)=>i%2===0).some(t=>protectedToken.test(t)))continue;
   const last=tokens[end],tail=last.match(edgeEnd)?.[0]||'';
   const candidate=chosen.join('').slice(lead.length);
   const phrase=tail?candidate.slice(0,-tail.length):candidate;
   if(folded(phrase)===entry.key&&safeImage(entry.url)){match={entry,end,lead,tail,phrase};break;}
  }
  if(match){if(match.lead)out.push({text:match.lead});out.push({url:match.entry.url,alt:match.phrase,provider:'Custom'});if(match.tail)out.push({text:match.tail});at=match.end;rules.remaining--;}
  else exactPart();
 }
 return out;
}
