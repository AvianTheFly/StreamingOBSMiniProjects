// One finite item performance, driven by the existing overlay's state poll.
export function purchasePose(seconds) {
  const t = Math.max(0, seconds);
  if (t < .65) {
    const p=t/.65, ease=1-(1-p)**3;
    return {dy:160*(1-ease)-Math.sin(p*Math.PI)*12, angle:(1-ease)*-Math.PI*2,
      scale:.4+.6*ease, opacity:Math.min(1,p*5), label:0};
  }
  if(t<2.05) return {dy:0,angle:0,scale:1,opacity:1,label:Math.min(1,(t-.65)/.15)};
  const p=Math.min(1,(t-2.05)/.75);
  return {dy:175*p*p,angle:.22*p,scale:1-.5*p,opacity:1-p*p,label:Math.max(0,1-p*4)};
}

export class PurchaseShow {
  constructor(stage, {muted=false}={}) {
    this.canvas=document.createElement('canvas');this.canvas.width=1920;this.canvas.height=1080;
    this.canvas.id='item-purchase';this.canvas.style.cssText='position:absolute;inset:0;pointer-events:none';
    stage.append(this.canvas);this.c=this.canvas.getContext('2d');
    this.audio=new Audio('/purchase-assets/ka-ching.wav');this.audio.preload='auto';this.audio.muted=muted;
    this.images=new Map();this.state=null;this.frame=0;this.visible=!document.hidden;this.sourceVisible=true;
    this.heard=new Set();this.lastFrame=0;this.received=0;
  }
  clear() {
    cancelAnimationFrame(this.frame);this.frame=0;this.state=null;
    this.c.clearRect(0,0,1920,1080);this.audio.pause();this.audio.currentTime=0;
  }
  update(next) {
    if(!next || !this.visible) {this.clear();return;}
    if(this.state?.id!==next.id) {
      this.clear();
      if(!this.images.has(next.icon)) {
        const img=new Image();img.src=next.icon;this.images.set(next.icon,img);
        if(this.images.size>32)this.images.delete(this.images.keys().next().value);
      }
      if(!this.heard.has(next.id)) {
        this.heard.add(next.id);if(this.heard.size>128)this.heard.delete(this.heard.values().next().value);
        if(next.elapsed<.8) {this.audio.volume=next.volume??.16;this.audio.play().catch(()=>{});}
      }
    }
    this.state=next;this.received=performance.now();
    if(!this.frame)this.frame=requestAnimationFrame(now=>this.tick(now));
  }
  draw(state, seconds) {
    const c=this.c;c.clearRect(0,0,1920,1080);
    if(seconds>=state.duration)return;
    const pose=purchasePose(seconds),size=state.size??96,img=this.images.get(state.icon);
    c.save();c.translate(state.x??1120,(state.y??880)+pose.dy);c.globalAlpha=pose.opacity;
    c.save();c.rotate(pose.angle);c.scale(pose.scale,pose.scale);
    c.shadowColor='rgba(0,0,0,.65)';c.shadowBlur=12;c.shadowOffsetY=4;
    c.fillStyle='#101e25';c.fillRect(-size/2-2,-size/2-2,size+4,size+4);
    c.shadowBlur=0;c.shadowOffsetY=0;
    if(img?.complete&&img.naturalWidth)c.drawImage(img,-size/2,-size/2,size,size);
    else {c.fillStyle='#e5c681';c.font='bold 14px Segoe UI';c.textAlign='center';c.fillText('ITEM',0,5);}
    c.strokeStyle='#dcc58c';c.lineWidth=1.5;c.strokeRect(-size/2-1,-size/2-1,size+2,size+2);c.restore();
    c.globalAlpha*=pose.label;c.font='600 17px Segoe UI';c.textAlign='center';
    c.lineJoin='round';c.lineWidth=4;c.strokeStyle='#071017';c.fillStyle='#fff5d7';
    c.strokeText(state.name,0,size/2+25,230);c.fillText(state.name,0,size/2+25,230);c.restore();
  }
  tick(now) {
    this.frame=0;
    const s=this.state,age=(now-this.received)/1000;
    if(!s||!this.visible||age>2.5||s.elapsed+age>=s.duration) {this.clear();return;}
    if(now-this.lastFrame>=1000/30) {this.lastFrame=now;this.draw(s,s.elapsed+age);}
    this.frame=requestAnimationFrame(t=>this.tick(t));
  }
  visibility() {this.visible=this.sourceVisible&&!document.hidden;if(!this.visible)this.clear();}
  dispose() {this.clear();this.audio.removeAttribute('src');this.audio.load();this.images.clear();this.canvas.remove();}
}

const stage=document.querySelector('#stage');
if(stage) {
  const show=new PurchaseShow(stage,{muted:new URLSearchParams(location.search).has('monitor')});
  window.leaguePurchases=show;
  document.addEventListener('visibilitychange',()=>show.visibility());
  window.addEventListener('obsSourceVisibleChanged',e=>{show.sourceVisible=e.detail?.visible!==false;show.visibility();});
  window.addEventListener('pagehide',()=>show.dispose(),{once:true});
}
