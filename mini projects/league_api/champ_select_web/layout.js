// Scene furniture uses a native 1920x1080 coordinate system.
export const camera={x:960,y:195,r:155};
const card=x=>({x,y:378,w:128,h:414,clip:'polygon(8% 0%,92% 0%,100% 3%,100% 97%,92% 100%,8% 100%,0% 97%,0% 3%)'});
const socket=x=>({x,y:282,w:64,h:64,clip:'polygon(28% 0%,72% 0%,100% 28%,100% 72%,72% 100%,28% 100%,0% 72%,0% 28%)'});
const make=()=>({allies:Array.from({length:5},(_,i)=>card(36+i*142)),enemies:Array.from({length:5},(_,i)=>card(1188+i*142)),allyBans:Array.from({length:5},(_,i)=>socket(106+i*120)),enemyBans:Array.from({length:5},(_,i)=>socket(1270+i*120))});
export const layouts=Object.fromEntries(['bear','turtle','ram','phoenix'].map(id=>[id,make()]));
export function placeSlots(theme,slots){for(const [key,items] of Object.entries(slots))items.forEach((item,i)=>{const p=layouts[theme][key][i];Object.assign(item.style,{left:`${p.x/1920*100}%`,top:`${p.y/1080*100}%`,width:`${p.w/1920*100}%`,height:`${p.h/1080*100}%`});item.dataset.index=String(i);item.style.setProperty('--socket-shape',p.clip);});}
