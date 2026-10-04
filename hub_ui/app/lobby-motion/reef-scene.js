// Turtle Reef landmarks come from the existing 1672x941 painting in HD space.
import {PaintedPatch,ellipse,glow,hash,TAU} from './shared/world-motion.js';
export const scene={id:'reef',source:'ReefLobby',label:'Turtle Reef',holes:[[872,260,586,285],[140,320,390,550],[1596,213,246,487]]};
export function oceanClip(c){
  c.beginPath();
  for(const polygon of [ [[389,0],[816,0],[761,280],[739,631],[304,693]], [[851,0],[1433,0],[1494,220],[1447,252],[1176,111],[1073,219],[812,249]], [[1494,285],[1537,505],[1509,690],[1453,737],[831,735],[791,594],[1477,565]] ]){
    c.moveTo(...polygon[0]);for(const p of polygon.slice(1))c.lineTo(...p);c.closePath();
  }c.clip();
}
export class ReefMotion {
  constructor(){this.patches=[];this.ready=false;}
  async load(){
    const image=new Image();image.src='/api/projects/scene_voice_switcher/artwork?source=ReefLobby';await image.decode();
    this.base=document.createElement('canvas');this.base.width=1920;this.base.height=1080;this.base.getContext('2d').drawImage(image,0,0,1920,1080);
    this.patches=[new PaintedPatch(this.base,[384,110,270,158]),new PaintedPatch(this.base,[1266,76,174,116]),new PaintedPatch(this.base,[1760,789,160,250]),new PaintedPatch(this.base,[1140,547,126,116]),new PaintedPatch(this.base,[276,245,65,107]),new PaintedPatch(this.base,[1224,658,205,84])];this.ready=true;return this;
  }
  draw(c,t,events=[]){
    const envelope=(u,v)=>Math.sin(u*Math.PI)**2*Math.sin(v*Math.PI)**2;
    for(let i=0;i<2;i++)this.patches[i].draw(c,(u,v)=>{const edge=envelope(u,v),flipper=Math.exp(-((u-.63)**2/.07+(v-.68)**2/.055));return [Math.sin(t*.7+i)*3*edge,Math.sin(t*.85+i)*2*edge+Math.sin(t*1.8+i)*8*flipper*edge];});
    this.patches[2].draw(c,(u,v)=>[Math.sin(t*1.1+v*2)*6*(1-v)*envelope(u,v),Math.sin(t*.9+u*3)*1.3*envelope(u,v)]);
    this.patches[3].draw(c,(u,v)=>[Math.sin(t*1.3+v*3)*4*envelope(u,v),Math.sin(t*.7+u*2)*1.5*envelope(u,v)]);
    this.patches[4].draw(c,(u,v)=>[Math.sin(t*.8)*3*v*envelope(u,v),Math.cos(t*.8)*.7*envelope(u,v)]);
    const chest=events.find(e=>e.kind==='treasure'),age=chest?t-chest.started:-1,open=age<0?0:Math.sin(Math.min(1,age/8)*Math.PI);
    if(open>0)this.patches[5].draw(c,(u,v)=>[open*2*envelope(u,v),-open*12*(1-v)*envelope(u,v)]);
    c.save();oceanClip(c);c.globalCompositeOperation='screen';
    // Water highlights move above and between the dome's physical beams/panels.
    c.lineWidth=1.1;for(let row=0;row<10;row++){c.strokeStyle='#78edee'+(row%3===0?'22':'12');c.beginPath();for(let k=0;k<=32;k++){const x=300+k*40,y=85+row*64+Math.sin(k*.55+t*.55+row)*13+Math.sin(t*.35+row)*9;c.lineTo(x,y);}c.stroke();}
    for(let i=0;i<32;i++){const x=330+hash(i+6)*1200+Math.sin(t*.4+i)*8,y=735-((t*(9+hash(i)*13)+hash(i+25)*750)%800),r=1+hash(i+75)*2.2;c.strokeStyle='#c1fbfa44';c.lineWidth=.7;c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();}
    c.restore();
    for(const [x,y,r] of [[303,292,42],[682,765,31],[942,681,38],[1540,821,42]])glow(c,x,y,r,'#ffc36d',.07+.035*Math.sin(t*3.3+x)+.018*Math.sin(t*7.1));
    // The warm tea belongs inside the dome, so steam rises only over its cup.
    c.save();for(let i=0;i<3;i++){c.strokeStyle='#f0e4cd'+(i===1?'36':'24');c.lineWidth=1.5;c.beginPath();for(let j=0;j<=22;j++){const q=j/22;c.lineTo(1385+i*12+Math.sin(q*8-t*1.5+i)*8*q,807-q*79);}c.stroke();}c.restore();
  }
  dispose(){for(const patch of this.patches)patch.dispose();this.patches=[];if(this.base)this.base.width=this.base.height=1;this.ready=false;}
}
