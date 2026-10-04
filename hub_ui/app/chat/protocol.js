// Twitch IRC tags and emote offsets are data. Never interpret chat as HTML.
import {compileStickers,stickerFragments} from './stickers.js';
export function parseLine(line){
 const result={tags:{},prefix:'',command:'',params:[],text:''};
 if(line.startsWith('@')){const end=line.indexOf(' ');for(const tag of line.slice(1,end).split(';')){const eq=tag.indexOf('=');const key=eq<0?tag:tag.slice(0,eq);result.tags[key]=(eq<0?'':tag.slice(eq+1)).replace(/\\([s:rn\\])/g,(_,c)=>({s:' ',':':';',r:'\r',n:'\n','\\':'\\'}[c]));}line=line.slice(end+1);}
 if(line.startsWith(':')){const end=line.indexOf(' ');result.prefix=line.slice(1,end);line=line.slice(end+1);}
 const end=line.indexOf(' :');if(end>=0){result.text=line.slice(end+2);line=line.slice(0,end);}
 const parts=line.split(' ');result.command=parts.shift();result.params=parts;return result;
}
export function safeImage(url){return typeof url==='string' && (url.startsWith('https://')||url.startsWith('/viewer_assets/'));}
export function fragments(text,tags,emotes,replacements,options={}){
 const chars=Array.from(text), ranges=[];
 for(const entry of (tags.emotes||'').split('/')){const [id,offsets]=entry.split(':');if(!id||!offsets||!/^\w+$/.test(id))continue;for(const pair of offsets.split(',')){const [start,end]=pair.split('-').map(Number);if(Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end>=start&&end<chars.length)ranges.push({start,end,url:`https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`,alt:chars.slice(start,end+1).join('')});}}
 // Twitch's native GIF/sticker tag: start-end|id|URL (additional fields tolerated).
 for(const gif of (tags.gifs||'').split(',')){const [position,,url]=gif.split('|');const [start,end]=(position||'').split('-').map(Number);if(safeImage(url)&&Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end>=start&&end<chars.length)ranges.push({start,end,url,alt:chars.slice(start,end+1).join('')});}
 ranges.sort((a,b)=>a.start-b.start);let at=0;const out=[];
 const rules=compileStickers(replacements,options);
 const plain=value=>out.push(...stickerFragments(value,emotes,rules,safeImage));
 for(const range of ranges){if(range.start<at)continue;plain(chars.slice(at,range.start).join(''));out.push(range);at=range.end+1;}plain(chars.slice(at).join(''));return out;
}
export function readableColor(value){
 if(!/^#[a-f\d]{6}$/i.test(value||''))return '#a8d8ff';
 let rgb=value.slice(1).match(/../g).map(c=>parseInt(c,16));
 if(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722<135)rgb=rgb.map(c=>Math.round(c*.55+255*.45));
 return '#'+rgb.map(c=>c.toString(16).padStart(2,'0')).join('');
}
