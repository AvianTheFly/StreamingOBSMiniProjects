// Subscription presentation only. Existing overlay owns music, RAF and cleanup.
import {guestsReady} from './raid_guests.js';
import {ease} from './raid_story.js';
import {SUB_DURATION,subscriberCopy,subscriptionState} from './subscriber_story.js';
import {drawSubscription} from './subscriber_acts.js';
export {SUB_DURATION};
export const subscriberReady=guestsReady;
export class SubscriberParty{
 constructor(stage){this.stage=stage;this.reduced=matchMedia('(prefers-reduced-motion:reduce)');}
 start(item){
  this.stop();this.item=item;this.frozen=false;this.stage.classList.add('supporter','subscriber','subscription-party');
  this.layer=document.createElement('div');this.layer.id='supporterLayer';
  this.canvas=document.createElement('canvas');this.canvas.id='supporterCanvas';this.canvas.width=1920;this.canvas.height=1080;this.c=this.canvas.getContext('2d');this.layer.append(this.canvas);
  this.panel=document.createElement('section');this.panel.id='supporterPanel';const copy=subscriberCopy(item);
  for(const [tag,id,text]of [['span','supporterKicker',copy.kicker],['strong','supporterName',copy.name],['span','supporterDetail',copy.detail]]){const node=document.createElement(tag);node.id=id;node.textContent=text;this.panel.append(node);}
  this.layer.append(this.panel);this.stage.append(this.layer);this.fit();
  this.observer=new ResizeObserver(()=>this.fit());this.observer.observe(this.stage);
  const layer=this.layer;document.fonts.ready.then(()=>{if(this.layer===layer)this.fit();});
 }
 fit(){const node=this.panel?.querySelector('#supporterName');if(!node)return;node.style.removeProperty('font-size');let size=parseFloat(getComputedStyle(node).fontSize);while(node.scrollWidth>node.clientWidth&&size>8){node.style.fontSize=--size+'px';}}
 update(seconds){
  if(!this.item)return;const end=SUB_DURATION;
  if(seconds<0||seconds>=end){this.c.clearRect(0,0,1920,1080);this.panel.style.opacity='0';return;}
  const t=this.reduced.matches?3.95:seconds,fade=this.reduced.matches?1:ease(seconds/.25)*ease((end-seconds)/.4);
  this.panel.style.opacity=String(fade);this.panel.style.transform=this.reduced.matches?'none':`translateY(${-18*(1-ease(seconds/.35))}px)`;
  if(this.reduced.matches&&this.frozen)return;
  this.c.clearRect(0,0,1920,1080);const c=this.c,s=subscriptionState(t,this.item);
  this.canvas.dataset.intensity=String(s.level);this.canvas.dataset.guests=String(s.guestCount);
  c.save();c.beginPath();c.rect(0,0,1920,1080);c.rect(240,170,1440,670);c.clip('evenodd');c.globalAlpha=fade;
  drawSubscription(c,t,s,this.item);c.restore();this.frozen=this.reduced.matches;
 }
 stop(){this.observer?.disconnect();this.c?.clearRect(0,0,1920,1080);this.layer?.remove();this.layer=null;this.item=null;this.stage.classList.remove('supporter','subscriber','subscription-party');}
}
