import {ActionLink} from './action-link.js';
// Local preview first; live delivery is an explicit studio toggle.
export class PartyStudio {
  constructor(preview){
    this.preview=preview;this.catalog=[];this.link=new ActionLink();this.status=document.querySelector('#party-status');
    this.key=e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable]'))return;const spec=this.catalog.find(s=>s.key===e.key.toLowerCase());if(spec){e.preventDefault();this.play(spec.id);}};
    this.result=e=>{if(e.origin===location.origin&&e.source===preview.contentWindow&&e.data?.type==='spirit-party-result')this.status.textContent=e.data.ok?`${e.data.count} accents playing together.`:e.data.reason;};
    window.addEventListener('keydown',this.key);window.addEventListener('message',this.result);
    document.querySelector('#party-clear').addEventListener('click',()=>{this.preview.contentWindow.postMessage({type:'spirit-lobby',action:'clear-preview'},location.origin);this.status.textContent='Preview accents cleared.';});
    window.addEventListener('pagehide',()=>this.dispose(),{once:true});
  }
  async load(){
    try{const response=await fetch('/api/spirit-lobby/actions');if(!response.ok)throw new Error();this.catalog=(await response.json()).actions;
      const container=document.querySelector('#party-buttons');for(const spec of this.catalog){const button=document.createElement('button');button.type='button';button.dataset.action=spec.id;button.title=spec.description;button.append(document.createTextNode(spec.label+' '));const key=document.createElement('kbd');key.textContent=spec.key===' '?'Space':spec.key.toUpperCase();button.append(key);button.addEventListener('click',()=>this.play(spec.id));container.append(button);}
      this.status.textContent=`${this.catalog.length} surprises to discover. Buttons add extra animations to the party.`;
    }catch{this.status.textContent='Party controls need the running Hub. Reload after it starts.';}
  }
  async play(action){
    const cue={action,id:crypto.randomUUID()};this.preview.contentWindow.postMessage({type:'spirit-lobby',...cue},location.origin);
    if(document.querySelector('#party-live').checked){const result=await this.link.publish(cue);if(!result.ok)this.status.textContent=result.reason;}
  }
  dispose(){this.link.dispose();window.removeEventListener('keydown',this.key);window.removeEventListener('message',this.result);}
}
