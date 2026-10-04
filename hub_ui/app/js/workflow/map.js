// Native SVG atlas renderer. Owns pointer/focus feedback and a disposable camera.
import { esc } from '../utils.js';
import { icon } from '../catalog.js';
import { Camera } from './camera.js';
function wrap(text,max=31,limit=2){const rows=[];let line='';for(const word of String(text||'').split(' ')){if((line+' '+word).trim().length>max&&line){rows.push(line);line=word;}else line=(line+' '+word).trim();}if(line)rows.push(line);return rows.slice(0,limit);}
function route(a,b,all=[]){
  const dx=b.x-a.x,dy=b.y-a.y;
  if(Math.abs(dx)<a.w*.8){const downward=dy>=0,x=a.x+a.w/2,tx=b.x+b.w/2,y=a.y+(downward?a.h:0),ty=b.y+(downward?0:b.h),m=(y+ty)/2;return `M${x},${y} C${x},${m} ${tx},${m} ${tx},${ty}`;}
  const right=dx>0,x=a.x+(right?a.w:0),tx=b.x+(right?0:b.w),y=a.y+a.h/2,ty=b.y+b.h/2,m=(x+tx)/2;
  const blocked=all.filter(n=>n!==a&&n!==b&&n.x>Math.min(x,tx)&&n.x+n.w<Math.max(x,tx)&&n.y<Math.max(y,ty)&&n.y+n.h>Math.min(y,ty));
  if(blocked.length){const above=(y+ty)/2<Math.max(...blocked.map(n=>n.y+n.h/2)),lane=above?Math.min(a.y,b.y,...blocked.map(n=>n.y))-28:Math.max(a.y+a.h,b.y+b.h,...blocked.map(n=>n.y+n.h))+28,offset=right?30:-30;
    return `M${x},${y} Q${x+offset},${y} ${x+offset},${y+(above?-24:24)} L${x+offset},${lane} L${tx-offset},${lane} L${tx-offset},${ty+(above?-24:24)} Q${tx-offset},${ty} ${tx},${ty}`;
  }
  return `M${x},${y} C${m},${y} ${m},${ty} ${tx},${ty}`;
}
export class StreamMap {
  constructor(host,onSelect,onConnection,onScale){
    host.innerHTML='<svg class="wf-svg wf-atlas" tabindex="0" role="group" aria-label="Connected stream map. Open an area to explore inside. Drag to pan, scroll or use plus and minus to zoom. Zero fits the map."><defs><marker id="wf-map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="#89aaa7"/></marker></defs><g class="wf-map-world"></g></svg>';
    this.svg=host.querySelector('svg');this.world=host.querySelector('.wf-map-world');this.select=onSelect;this.connection=onConnection;
    this.camera=new Camera(this.svg,this.world,onScale);this.abort=new AbortController();const opts={signal:this.abort.signal};
    this.svg.addEventListener('pointerdown',e=>{this.lastEdge=e.target.closest('[data-connection]')?.dataset.connection;},opts);
    this.svg.addEventListener('click',e=>{const id=e.target.closest('[data-node]')?.dataset.node||this.camera.lastNode,edge=e.target.closest('[data-connection]')?.dataset.connection??this.lastEdge;this.camera.lastNode=null;this.lastEdge=null;if(this.camera.suppressClick){this.camera.suppressClick=false;return;}if(id)this.open(id);else if(edge!==undefined&&edge!==null)this.connection(this.model.edges[Number(edge)]);},opts);
    this.svg.addEventListener('keydown',e=>{const node=e.target.closest('[data-node]'),edge=e.target.closest('[data-connection]');if((node||edge)&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(node)this.open(node.dataset.node);else this.connection(this.model.edges[Number(edge.dataset.connection)]);}},opts);
    this.svg.addEventListener('pointermove',e=>{if(!this.camera.drag)this.highlight(e.target.closest('[data-node]')?.dataset.node||null);},opts);
    this.svg.addEventListener('pointerleave',()=>this.highlight(null),opts);
    this.svg.addEventListener('focusin',e=>this.highlight(e.target.closest('[data-node]')?.dataset.node||null),opts);
    this.svg.addEventListener('focusout',()=>this.highlight(null),opts);
  }
  open(id){const node=this.model.nodes.find(n=>n.id===id);if(node)this.select(node);}
  render(model,fit=true){
    this.model=model;const nodes=new Map(model.nodes.map(n=>[n.id,n]));
    const links=model.edges.map((edge,i)=>{const a=nodes.get(edge.from),b=nodes.get(edge.to);if(!a||!b)return '';const d=route(a,b,model.nodes),title=edge.containment?'Explore inside':`${a.label} ↔ ${b.label}: ${edge.facts?.length||0} mapped connections`;
      return `<g class="wf-map-link ${edge.containment?'wf-contains':''} ${edge.dashed?'wf-dashed':''}" ${edge.containment?'':`data-connection="${i}" tabindex="0" role="button" aria-label="${esc(title)}. Inspect connection"`}><title>${esc(title)}</title><path class="wf-link-hit" d="${d}"/><path class="wf-link-ink" d="${d}" ${model.root||edge.containment||edge.boundary?'':'marker-end="url(#wf-map-arrow)"'}/></g>`;
    }).join('');
    const cards=model.nodes.map(node=>`<g class="wf-map-node ${node.context?'wf-map-context':''} ${node.external?'wf-map-external':''} ${node.resource?'wf-map-resource':''} ${node.outcome?'wf-outcome-'+node.outcome.status:''} ${node.compact?'wf-map-compact':''} ${node.selected?'selected':''}" data-node="${esc(node.id)}" transform="translate(${node.x} ${node.y})" tabindex="0" role="button" aria-label="${esc(node.label)}. ${esc(node.description)}. ${node.owner?'Inspect participant':node.resource?'Inspect shared resource':node.context?'Inspect context':'Open map'}" style="--map-color:${node.color}">
      <title>${esc(node.label)} — ${esc(node.description)}${node.flow?.verification==='review'?' — Source changed; explanation needs review':''}</title><rect class="wf-map-card" width="${node.w}" height="${node.h}" rx="22"/>
      ${node.flow?.verification==='review'?`<circle cx="${node.w-48}" cy="${node.compact?15:35}" r="3" fill="#ddb582"><title>Source changed; explanation needs review</title></circle>`:''}
      <rect class="wf-map-icon-back" x="19" y="19" width="38" height="38" rx="12"/>
      <g class="wf-map-icon" transform="translate(28 28)">${icon(node.icon).replace('<svg ','<svg width="20" height="20" ')}</g>
      ${!node.context?`<text class="wf-map-enter" x="${node.w-24}" y="43" text-anchor="end">${node.owner?'···':'↗'}</text>`:''}
      ${wrap(node.label,Math.floor((node.w-(node.compact?100:40))/8.5)).map((row,i)=>`<text class="wf-map-title" x="${node.compact?76:20}" y="${node.compact?37+i*22:83+i*22}">${esc(row)}</text>`).join('')}
      ${wrap(node.description,Math.floor((node.w-(node.compact?100:40))/6.5),2).map((row,i)=>`<text class="wf-map-description" x="${node.compact?76:20}" y="${node.compact?62+(wrap(node.label,Math.floor((node.w-100)/8.5)).length-1)*22+i*17:wrap(node.label,Math.floor((node.w-40)/8.5)).length>1?128+i*17:108+i*17}">${esc(row)}</text>`).join('')}
      ${node.sub?`<text class="wf-map-sub" x="20" y="${node.h-18}">${esc(wrap(node.sub,37,1)[0])}</text>`:''}
      <circle class="wf-map-port" cx="0" cy="${node.h/2}" r="4"/><circle class="wf-map-port" cx="${node.w}" cy="${node.h/2}" r="4"/>
    </g>`).join('');
    const headings=(model.headings||[]).map(h=>`<text class="wf-map-heading" x="${h.x}" y="${h.y}">${esc(h.label)}</text>`).join('');
    this.world.innerHTML=headings+links+cards;this.highlight(null);this.camera.setModel(model);if(fit)this.camera.fit();else this.camera.apply();
  }
  highlight(id){const connected=new Set([id]);this.model?.edges.forEach(edge=>{if(edge.from===id)connected.add(edge.to);if(edge.to===id)connected.add(edge.from);});
    this.world.classList.toggle('wf-map-focusing',!!id);
    this.world.querySelectorAll('[data-node]').forEach(node=>node.classList.toggle('wf-map-neighbor',connected.has(node.dataset.node)));
    this.world.querySelectorAll('[data-connection]').forEach(link=>{const edge=this.model.edges[Number(link.dataset.connection)];if(edge)link.classList.toggle('wf-map-connected',edge.from===id||edge.to===id);});
  }
  dispose(){this.abort.abort();this.camera.dispose();}
}
