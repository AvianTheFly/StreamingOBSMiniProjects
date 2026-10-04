export const base='/api/starting-soon';
export async function request(path=base,body,signal){
 const r=await fetch(path,{...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),signal});
 const data=await r.json();if(!r.ok||data.ok===false)throw Error(data.error||'Request failed');return data;
}
export function button(text,fn,options={}){const b=document.createElement('button');b.type='button';b.className=options.primary?'ss-button primary':'ss-button';b.textContent=text;b.disabled=!!options.disabled;if(options.title)b.title=options.title;b.onclick=fn;return b;}
export function text(tag,value,className=''){const node=document.createElement(tag);node.textContent=value;node.className=className;return node;}
export function titleOf(ctx,path){return ctx.clips.find(c=>c.path===path)?.title||path.split(/[\\/]/).pop();}
export function clock(ms){const seconds=Math.max(0,Math.floor((Number(ms)||0)/1000));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
export function bind(ctx,id,fn,event='click'){ctx.$(id).addEventListener(event,()=>ctx.perform(fn));}
