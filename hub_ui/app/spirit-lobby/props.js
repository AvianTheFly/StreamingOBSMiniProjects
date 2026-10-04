// The speaker cabinets, glowing meters, moving heads, turntables and signwork.
import {round,ellipse,glow,shadow,neon,TAU,hash} from './paint.js';
import {TextScreens} from './text-screens.js';
export class Props {
  constructor(screens){this.screens=screens;this.text=new TextScreens();}
  async load(){this.booth=new Image();this.booth.src=new URL('art/booth-clean.webp',import.meta.url).href;await this.booth.decode();return this;}
  speaker(c,x,t,side,energy,colors) {
    const y=540,w=130,h=292,beat=.5+.5*Math.sin(t*TAU*.72+side*.3);
    shadow(c,x+65,y+h+8,96,19);
    const edge=c.createLinearGradient(x,0,x+w,0);edge.addColorStop(0,'#293046');edge.addColorStop(.15,'#0a0d18');edge.addColorStop(.9,'#10111c');edge.addColorStop(1,'#4c3358');
    round(c,x+12,y+3,w,h,13,edge,'#a4b4cf66',1.5);
    round(c,x,y,w,h,13,'#11141e','#424754',2);
    // Perforations retain the cabinet's material even beneath glowing rings.
    c.save();c.globalAlpha=.30;for(let yy=y+8;yy<y+h;yy+=6)for(let xx=x+8;xx<x+w-5;xx+=6)ellipse(c,xx,yy,.7,.7,'#b4bad1');c.restore();
    for(const [dy,r] of [[52,29],[166,48]]){
      const col=colors[(side+Math.floor(t/12))%4];ellipse(c,x+65,y+dy,r+4,r+4,'#03040a');
      const g=c.createRadialGradient(x+57,y+dy-9,3,x+65,y+dy,r);g.addColorStop(0,'#6b6b82');g.addColorStop(.36,'#121522');g.addColorStop(.7,'#464452');g.addColorStop(1,'#070b15');ellipse(c,x+65,y+dy,r,r,g);
      c.save();c.shadowColor=col;c.shadowBlur=15;c.strokeStyle=col;c.lineWidth=2.7;c.globalAlpha=.7+beat*.3;c.beginPath();c.arc(x+65,y+dy,r-2+beat*energy*.7,0,TAU);c.stroke();c.restore();ellipse(c,x+65,y+dy,r*.23,r*.23,'#060816');
    }
    round(c,x+37,y+236,56,17,7,'#02030a','#574763',1);
    for(let i=0;i<12;i++){const col=colors[(i+side)%4],height=8+(1+Math.sin(t*2.7+i*.61+side))*8*energy;round(c,x+8+i*9.5,y+h-7-height,5,height,2,col,null);}
    // A separate translucent light tower has its own evolving color bands.
    const tx=x+(side?-51:148);round(c,tx,y+47,36,252,9,'#1b2235','#bcc7df66',1);
    for(let i=0;i<20;i++){
      const a=.18+(1+Math.sin(t*1.5-i*.5+side))*.32,col=colors[(i+Math.floor(t*.08)+side)%4];c.save();c.globalAlpha=a;round(c,tx+5,y+53+i*11.7,26,8,3,col);c.restore();
    }
    glow(c,tx+18,y+268,56,75,colors[side]+'44');
  }
  fixtures(c,t,colors) {
    for(const [x,phase] of [[475,0],[1445,1]]){
      shadow(c,x,919,56,11);round(c,x-40,892,80,24,10,'#111625','#586077',1);
      c.save();c.translate(x,888);c.rotate(Math.sin(t*.27+phase)*.28);round(c,-21,-28,42,37,8,'#272938','#787388',1);ellipse(c,0,-16,15,10,colors[phase]+'dd');glow(c,0,-16,23,14,colors[phase]+'55');c.restore();
    }
  }
  desk(c,t,config,colors) {
    shadow(c,960,881,380,30);
    // Keep the original brass, jade and moss console in front of the camera.
    c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(this.booth,594,650,732,305);c.restore();
    if(!this.screens?.paint(c,'booth'))this.text.draw(c,'booth',config.title,config.subtitle,colors[0]);
    // Animated records and meters inhabit the photographed/rendered deck top.
    for(const x of [765,1150]){
      c.save();c.translate(x,737);c.scale(1,.28);c.rotate(t*(x<900?.65:-.55));c.strokeStyle=colors[x<900?0:1]+'88';c.lineWidth=2;c.beginPath();c.arc(0,0,45,.3,2.4);c.stroke();c.beginPath();c.moveTo(6,0);c.lineTo(32,0);c.stroke();c.restore();
    }
    for(let i=0;i<10;i++){const h=3+(1+Math.sin(t*2.7+i))*9*config.energy;round(c,912+i*10,743-h,5,h,1,colors[i%4]+'aa');}
    glow(c,960,878,300,28,colors[0]+'22');
  }
  signs(c,t,config,colors) {
    if(!this.screens?.paint(c,'left'))this.text.draw(c,'left',config.leftTitle,config.leftSubtitle,colors[1]);
    if(!this.screens?.paint(c,'right'))this.text.draw(c,'right',config.rightTitle,config.rightSubtitle,colors[0]);
  }
  oddities(c,t,colors) {
    // Orbiting glass bubbles and a curious little neon moon above the floor.
    for(let i=0;i<5;i++){
      const x=94+hash(i+42)*300,y=615+Math.sin(t*.35+i*1.7)*38+i*22,r=8+hash(i+7)*10;
      c.save();c.globalAlpha=.24;c.strokeStyle=colors[i%4];c.lineWidth=1.3;c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();ellipse(c,x-r*.3,y-r*.3,2,2,'#fff');c.restore();
    }
    c.save();c.translate(1510+Math.sin(t*.3)*13,618+Math.cos(t*.4)*10);c.rotate(Math.sin(t*.3)*.2);
    glow(c,0,0,36,36,colors[3]+'44');c.strokeStyle=colors[3];c.lineWidth=2;c.beginPath();c.arc(0,0,21,-.8,2.4);c.stroke();c.restore();
  }
}
