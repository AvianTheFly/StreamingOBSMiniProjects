// Four small prepainted side veils: no particles, filters, media or cast-time builds.
const COLORS={q:'#59caff',w:'#77dca1',e:'#e9bb68',r:'#e77966'};
export class StanceAccent {
  constructor(){this.tiles=new Map();this.prepare();}
  prepare(){
    if(this.tiles.size)return;
    for(const [key,color] of Object.entries(COLORS)){
      const tile=document.createElement('canvas');tile.width=32;tile.height=560;
      const c=tile.getContext('2d'),g=c.createLinearGradient(0,0,32,0);
      g.addColorStop(0,color);g.addColorStop(.24,color+'80');g.addColorStop(1,color+'00');
      c.fillStyle=g;c.fillRect(0,0,32,560);
      c.strokeStyle=color;c.lineWidth=1;
      // Claw currents, shell scallops, curled horn wisps and feather traces.
      for(let j=0;j<3;j++){
        c.beginPath();const y=105+j*120;
        if(key==='q'){c.moveTo(2,y+65);c.bezierCurveTo(27,y+30,4,y-20,19,y-55);}
        if(key==='w'){c.ellipse(-9,y,27,48,0,-Math.PI/2,Math.PI/2);}
        if(key==='e'){c.moveTo(2,y+40);c.bezierCurveTo(34,y+12,27,y-37,9,y-22);}
        if(key==='r'){c.moveTo(1,y+55);c.quadraticCurveTo(29,y-18,13,y-48);}
        c.stroke();
      }
      c.globalCompositeOperation='destination-in';
      const fade=c.createLinearGradient(0,0,0,560);
      fade.addColorStop(0,'#0000');fade.addColorStop(.22,'#000');
      fade.addColorStop(.78,'#000');fade.addColorStop(1,'#0000');
      c.fillStyle=fade;c.fillRect(0,0,32,560);
      this.tiles.set(key,tile);
    }
  }
  draw(c,cue){
    if(!cue||!this.tiles.has(cue.key))return;
    const p=cue.elapsed/cue.duration;if(!(p>0&&p<1))return;
    c.save();c.globalAlpha*=.065*Math.sin(Math.PI*p)**2;
    const tile=this.tiles.get(cue.key);
    c.drawImage(tile,0,260);c.translate(1920,0);c.scale(-1,1);c.drawImage(tile,0,260);
    c.restore();
  }
  dispose(){for(const tile of this.tiles.values()){tile.width=tile.height=0;}this.tiles.clear();}
}
