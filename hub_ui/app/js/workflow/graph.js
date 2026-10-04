import { esc } from '../utils.js';
import { COLORS } from './model.js';
import { Camera } from './camera.js';
function lines(text,max=25){const result=[];let current='';for(const word of String(text||'').split(' ')){if((current+' '+word).trim().length>max&&current){result.push(current);current=word;}else current=(current+' '+word).trim();}if(current)result.push(current);return result.slice(0,2);}
function compact(model){
  const summaries=model.nodes.filter(n=>n.compact).map((n,i)=>({...n,x:325,y:64+i*118,w:354,h:72,compact:false}));
  const trigger={...model.nodes.find(n=>n.trigger),x:25,y:Math.max(64,summaries.length*59),w:230,h:90};
  return {nodes:[trigger,...summaries],edges:summaries.map(n=>({from:'trigger',to:n.id,dashed:model.edges.find(e=>e.to===n.id)?.dashed})),
    groups:summaries.map(n=>({x:309,y:n.y-32,w:386,h:112,label:model.groups.find(g=>g.flow?.id===n.flow.id)?.label || '',flow:n.flow})),width:725,height:summaries.length*118+85,overview:true,collapsed:true};
}
export class Graph {
  constructor(host,onSelect,onScale){
    host.innerHTML='<svg class="wf-svg" tabindex="0" role="group" aria-label="Workflow diagram. Drag to pan, scroll to zoom. Plus, minus, arrows and zero also work."><defs><marker id="wf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8295a7"/></marker></defs><g class="wf-world"></g></svg>';
    this.svg=host.querySelector('svg');this.world=host.querySelector('.wf-world');this.onSelect=onSelect;
    this.camera=new Camera(this.svg,this.world,(scale,reason)=>{
      onScale(scale);
      if(reason!=='zoom'||this.levelFrame)return;
      if(this.model?.collapsed&&scale>=1.2){const center=(this.svg.clientHeight/2-this.camera.y)/scale;
        const nearest=this.model.nodes.filter(n=>n.flow).sort((a,b)=>Math.abs(a.y-center)-Math.abs(b.y-center))[0];
        if(nearest)this.levelFrame=requestAnimationFrame(()=>{this.levelFrame=null;this.expand(nearest.flow.id);});
      }else if(!this.forceDetails&&!this.model?.overview&&scale<.48){this.levelFrame=requestAnimationFrame(()=>{this.levelFrame=null;this.render(this.original,true);});}
    });
    this.svg.addEventListener('click',e=>{const captured=this.camera.lastNode;this.camera.lastNode=null;if(this.camera.suppressClick){this.camera.suppressClick=false;return;}const id=e.target.closest('[data-node]')?.dataset.node || captured;if(id)this.select(id);});
    this.svg.addEventListener('keydown',e=>{const n=e.target.closest('[data-node]');if(n&&(e.key==='Enter'||e.key===' ')){e.preventDefault();this.select(n.dataset.node);}});
  }
  select(id){const node=this.model.nodes.find(n=>n.id===id);if(node){if(this.model.collapsed&&node.flow)this.expand(node.flow.id);else this.onSelect(node);}}
  render(model,fit=true){
    if(!this.internalRender){this.original=model;
      const small=!model.overview&&model.nodes.some(n=>n.compact)&&Math.min((this.svg.clientWidth-54)/model.width,(this.svg.clientHeight-50)/model.height)<.68;
      if(small&&!this.forceDetails)model=compact(model);
    }
    this.model=model;const map=new Map(model.nodes.map(n=>[n.id,n]));
    const edges=model.edges.map(e=>{const a=map.get(e.from),b=map.get(e.to);if(!a||!b)return '';const x=a.x+a.w,y=a.y+a.h/2,tx=b.x,ty=b.y+b.h/2,m=(x+tx)/2;
      return `<g class="wf-link ${e.dashed?'wf-dashed':''} ${e.granular?'wf-granular':''} ${e.compact?'wf-summary':''}"><path d="M${x},${y} C${m},${y} ${m},${ty} ${tx-6},${ty}" marker-end="url(#wf-arrow)"/>${e.label?`<text x="${m}" y="${(y+ty)/2-8}" text-anchor="middle">${esc(e.label)}</text>`:''}</g>`;}).join('');
    const groups=model.groups.map(g=>`<g class="wf-group ${g.headerOnly?'wf-header-only':''}"><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="16"/><text x="${g.x+16}" y="${g.y+25}">${esc(g.label)}</text>${g.flow?.verification==='review'?`<text class="wf-review-label" x="${g.x+g.w-14}" y="${g.y+25}" text-anchor="end">Review needed</text>`:''}</g>`).join('');
    const nodes=model.nodes.map(n=>{const color=COLORS[n.kind]||COLORS.action,rows=lines(n.label,Math.floor(n.w/8.2)),titleY=rows.length>1?28:34;
      const caption=n.kind==='gate'?'CONDITION':n.kind==='wait'?'WAIT':n.kind==='output'?'OUTPUT':n.trigger?'WHEN':n.kind==='end'?'RELEASE':'';
      return `<g class="wf-node ${n.granular?'wf-granular':''} ${n.compact?'wf-summary':''} wf-kind-${esc(n.kind)}" data-node="${esc(n.id)}" transform="translate(${n.x} ${n.y})" tabindex="0" role="button" aria-label="${esc(n.label)}. ${esc(n.sub||'')}. Open details" style="--node-color:${color}"><title>${esc(n.label)}${n.sub?' — '+esc(n.sub):''}</title><rect width="${n.w}" height="${n.h}" rx="${n.kind==='gate'?20:11}"/><path class="wf-node-accent" d="M2 18v${n.h-36}"/>${caption?`<text class="wf-node-kind" x="14" y="13">${caption}</text>`:''}${rows.map((row,i)=>`<text class="wf-node-title" x="14" y="${titleY+i*17}">${esc(row)}</text>`).join('')}<text class="wf-node-sub" x="14" y="${n.h-10}">${esc(String(n.sub||'').slice(0,Math.floor(n.w/6.6)))}</text>${n.step&&typeof n.step.configured==='boolean'?`<circle cx="${n.w-15}" cy="13" r="4" fill="${n.step.configured?'#a4d8cb':'#d8a6b9'}"/>`:''}</g>`;}).join('');
    this.world.innerHTML=groups+edges+nodes;
    if(model.overview&&!model.collapsed)this.world.querySelectorAll('.wf-node-title').forEach(text=>text.style.fontSize='18px');
    this.camera.setModel(model);if(fit)this.camera.fit();else this.camera.apply();
  }
  highlight(id){this.world.querySelectorAll('[data-node]').forEach(n=>n.classList.toggle('selected',n.dataset.node===id));}
  expand(flowId){this.internalRender=true;this.render(this.original,false);this.internalRender=false;const group=this.original.groups.find(g=>g.flow?.id===flowId);if(group)this.camera.focus({...group,w:Math.min(this.svg.clientWidth<600?400:750,group.w),h:Math.max(200,group.h)});}
  details(value){this.forceDetails=value;if(value&&this.original?.nodes.some(n=>n.compact))this.expand(this.original.groups[0]?.flow.id);else if(this.original)this.render(this.original,true);}
  dispose(){if(this.levelFrame)cancelAnimationFrame(this.levelFrame);this.camera.dispose();}
}
