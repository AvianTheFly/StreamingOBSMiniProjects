// Overlay-only word substitutions, before sticker matching and after native offsets.
export function textFragments(value, replacements={}, emotes={}) {
 const out=[];
 const words=new Map(Object.entries(replacements).map(([word,text])=>[word.toLowerCase(),text]));
 for(const token of value.split(/(\s+)/)) {
  if(/^(?:https?:\/\/|www\.|@|!|#)/i.test(token)||Object.hasOwn(emotes,token)) {
   out.push({text:token});continue;
  }
  let at=0;
  for(const match of token.matchAll(/[\p{L}\p{N}_]+/gu)) {
   const replacement=words.get(match[0].toLowerCase());
   if(typeof replacement!=='string')continue;
   if(match.index>at)out.push({text:token.slice(at,match.index)});
   out.push({text:replacement,replaced:true});at=match.index+match[0].length;
  }
  if(at<token.length)out.push({text:token.slice(at)});
 }
 // Retain phrases across tokens for the existing sticker matcher.
 return out.reduce((parts,part)=>{
  const last=parts.at(-1);
  if(last&&!last.replaced&&!part.replaced)last.text+=part.text;
  else parts.push(part);
  return parts;
 },[]);
}
