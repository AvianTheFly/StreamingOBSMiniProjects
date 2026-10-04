// The back-wall projector: three original continuously moving visual programs.
import {ellipse,glow,hash,TAU} from './paint.js';
import {FractalGalaxy} from './fractal-galaxy.js';
import {paintPanel} from './surfaces.js';
export class Projection {
  constructor(screens){this.screens=screens;this.galaxy=new FractalGalaxy();this.canvas=document.createElement('canvas');this.canvas.width=960;this.canvas.height=360;this.c=this.canvas.getContext('2d');}
  render(c,t,config,colors) {
    if(this.screens?.paint(c,'main'))return;
    const choice=this.screens?.choice('main',config)||config.background;
    const p=this.c;p.fillStyle='#050716';p.fillRect(0,0,960,360);p.save();p.translate(480,180);p.scale(1.5,1.5);
    if(choice==='liquid') this.liquid(p,t,colors);
    else if(choice==='spirit') this.spirit(p,t,colors);
    else this.galaxy.draw(p,t,colors);
    p.restore();
    // This inset matches the empty screen in the original environment plate.
    paintPanel(c,this.canvas,'main');
  }
  cosmos(c,t,colors) {
    glow(c,Math.sin(t*.14)*180,Math.cos(t*.18)*80,260,130,colors[1]+'66');
    glow(c,Math.cos(t*.11)*220,-Math.sin(t*.2)*70,230,100,colors[0]+'44');
    for(let i=0;i<80;i++){
      const z=(hash(i+200)+t*.02)%1,x=(hash(i)-.5)*620*(1+z*.1),y=(hash(i+80)-.5)*230;
      ellipse(c,x,y,.5+z*1.8,.5+z*1.8,`rgba(211,245,255,${.25+z*.6})`);
    }
    c.save();c.translate(Math.sin(t*.18)*35,Math.cos(t*.12)*12);c.rotate(t*.065);
    for(let i=11;i>=0;i--){const r=24+i*9+Math.sin(t*.55+i*.4)*4;c.beginPath();c.ellipse(0,0,r,r*.56,.8+Math.sin(t*.13)*.3,0,TAU);c.strokeStyle=colors[i%3]+'88';c.lineWidth=1+i*.15;c.stroke();}
    glow(c,0,0,29,29,'#ffd1ffcc');ellipse(c,0,0,10,10,'#ffedfe');c.restore();
    c.strokeStyle='#f1d4ff66';c.lineWidth=1;
    const x=((t*14)%800)-400;c.beginPath();c.moveTo(x,85);c.lineTo(x+34,75);c.stroke();
  }
  liquid(c,t,colors) {
    for(let i=0;i<24;i++) {
      const f=i/24;c.beginPath();
      for(let x=-330;x<=330;x+=10){const y=Math.sin(x*.011+t*.43+f*TAU)*55+Math.sin(x*.02-t*.23+f*9)*30+(f-.5)*130;x===-330?c.moveTo(x,y):c.lineTo(x,y);}
      c.strokeStyle=colors[i%4]+(i%3===0?'bb':'55');c.lineWidth=6;c.stroke();
    }
    glow(c,0,0,160,90,colors[2]+'33');
  }
  spirit(c,t,colors) {
    glow(c,0,0,200,110,colors[2]+'55');
    for(let ring=0;ring<5;ring++){
      const r=28+ring*25;c.save();c.rotate(t*.13*(ring%2?1:-1));
      for(let k=0;k<8;k++){c.save();c.rotate(k*TAU/8);c.translate(r,0);c.rotate(t*.1);c.strokeStyle=colors[(ring+k)%4]+'cc';c.lineWidth=1.5;c.beginPath();c.moveTo(0,-12);c.lineTo(10,0);c.lineTo(0,12);c.lineTo(-10,0);c.closePath();c.stroke();c.restore();}c.restore();
    }
  }
}
