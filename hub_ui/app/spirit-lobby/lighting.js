// Authored light paths and mirror geometry. Lights move smoothly; the energy
// control changes density and opacity rather than adding frame-wide flashes.
import {TAU,ellipse,glow,hash,clamp} from './paint.js';
export class Lighting {
  constructor(){
    this.tiles=[];
    for(let j=0;j<15;j++)for(let i=0;i<30;i++){
      const lat0=-Math.PI/2+j*Math.PI/15+.008,lat1=lat0+Math.PI/15-.016,lon=i*TAU/30;
      this.tiles.push([[lat0,lon+.008],[lat0,lon+TAU/30-.008],[lat1,lon+TAU/30-.008],[lat1,lon+.008]]);
    }
  }
  ball(c,x,y,r,t,colors) {
    c.save();c.strokeStyle='#bec3d2';c.lineWidth=2;c.beginPath();c.moveTo(x,0);c.lineTo(x,y-r);c.stroke();
    glow(c,x,y,r*1.35,r*1.35,colors[1]+'33');ellipse(c,x,y,r,r,'#141828');
    const yaw=t*.3,tilt=.2;
    const point=([lat,lon])=>{lon+=yaw;const a=Math.cos(lat)*Math.sin(lon),b=Math.sin(lat),z=Math.cos(lat)*Math.cos(lon);return [a,b*Math.cos(tilt)-z*Math.sin(tilt),b*Math.sin(tilt)+z*Math.cos(tilt)];};
    for(const tile of this.tiles){
      const pts=tile.map(point),z=pts.reduce((n,p)=>n+p[2],0)/4;if(z<=0)continue;
      const nx=pts.reduce((n,p)=>n+p[0],0)/4,ny=pts.reduce((n,p)=>n+p[1],0)/4;
      const light=clamp(nx*-.4+ny*-.55+z*.65),spec=Math.pow(clamp(nx*-.2+ny*-.65+z*.72),18);
      const reflected=Math.pow(.5+.5*Math.sin(nx*16+ny*21+yaw*2),12);
      const hue=(255+nx*85+Math.sin(t*.3+ny)*55)%360;
      c.fillStyle=`hsl(${hue} ${12+reflected*25}% ${17+light*43+spec*25+reflected*27}%)`;
      c.beginPath();pts.forEach((p,i)=>i?c.lineTo(x+p[0]*r,y+p[1]*r):c.moveTo(x+p[0]*r,y+p[1]*r));c.closePath();c.fill();
    }
    glow(c,x-r*.36,y-r*.55,19,19,'#f5f1ffdd');
    for(let i=0;i<4;i++){
      const a=t*.26+i*1.5,px=x+Math.sin(a)*r*.7,py=y+Math.cos(a*1.3)*r*.6;
      const brightness=Math.pow(.5+.5*Math.sin(t*.8+i*2),5);
      c.save();c.globalAlpha=brightness;c.strokeStyle='#e9f8ff';c.lineWidth=1;c.beginPath();c.moveTo(px-7,py);c.lineTo(px+7,py);c.moveTo(px,py-7);c.lineTo(px,py+7);c.stroke();glow(c,px,py,7,7,'#fff6ffbb');c.restore();
    }
    c.restore();
  }
  room(c,t,energy,colors) {
    c.save();c.globalCompositeOperation='screen';
    glow(c,370+Math.sin(t*.12)*170,310,570,450,colors[0]+'16',.4+energy);
    glow(c,1520+Math.cos(t*.13)*170,320,600,430,colors[1]+'16',.4+energy);
    for(let i=0;i<12;i++){
      const y=690+hash(i+10)*330,x=960+Math.sin(t*.15+i*.65)*(210+(y-690)*2.2);
      c.save();c.globalAlpha=.1+energy*.16;ellipse(c,x,y,9+(y-690)*.025,3+(y-690)*.009,colors[i%4]);c.restore();
    }
    for(let i=0;i<6;i++){
      const left=i%2===0,ox=left?498:1422,oy=755,col=colors[i%4],angle=Math.sin(t*.27+i*.8)*.7+(left?-.5:.5),length=940;
      c.save();c.translate(ox,oy);c.rotate(angle);const g=c.createLinearGradient(0,0,0,-length);g.addColorStop(0,col+'33');g.addColorStop(1,col+'00');
      c.globalAlpha=.18+energy*.28;c.fillStyle=g;c.beginPath();c.moveTo(-5,0);c.lineTo(-65,-length);c.lineTo(65,-length);c.lineTo(5,0);c.closePath();c.fill();c.restore();
    }
    c.restore();
  }
  front(c,t,energy,colors) {
    c.save();c.globalCompositeOperation='screen';
    // A fan of narrow beams is anchored to physical fixtures at either side.
    for(let side=0;side<2;side++)for(let i=0;i<8;i++){
      const ox=side?1445:475,oy=906,tx=ox+(side?-1:1)*(340+Math.sin(t*.18+i*.2)*340)+Math.sin(t*.23+i)*140;
      const ty=150+i*13,col=colors[(i+side)%4];c.globalAlpha=energy*.10;
      c.beginPath();c.moveTo(ox,oy);c.lineTo(tx,ty);c.strokeStyle=col;c.lineWidth=.7+(i%3)*.35;c.stroke();
    }
    c.globalAlpha=1;
    for(let i=0;i<16;i++){
      const x=hash(i)*1920,y=hash(i+150)*1000+Math.sin(t*.5+i)*12,alpha=.07+(1+Math.sin(t*.8+i))*.08;
      c.globalAlpha=alpha;ellipse(c,x,y,1+hash(i+70)*2,1+hash(i+70)*2,colors[i%4]);
    }
    c.restore();
  }
}
