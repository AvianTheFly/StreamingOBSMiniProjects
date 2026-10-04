// Heavy cracked plates detach with depth, edge light and falling stone chips.
import {clamp,smooth} from '../math.js';
import {polygon,line} from '../fx.js';
import {dust} from '../atmosphere.js';
export function reveal(s,t){const elapsed=t-s.timing.coveredUntil,c=s.b,sc=s.scratch.getContext('2d');
 sc.clearRect(0,0,1920,1080);sc.drawImage(s.cover,0,0);c.clearRect(0,0,1920,1080);
 for(const cell of s.mesh){const delay=cell.delay+Math.hypot(cell.x-960,cell.y-540)/1400*.14,d=Math.max(0,elapsed-delay),alpha=1-smooth(.55,1.04,d);if(alpha<=0)continue;
 const scale=1-d*.13,dx=(cell.x-960)*d*.72,dy=(cell.y-540)*d*.43+d*d*820;
 c.save();c.globalAlpha=alpha;c.translate(cell.x+dx,cell.y+dy);c.rotate(cell.spin*d*.75);c.scale(scale,scale);c.translate(-cell.x,-cell.y);
 polygon(c,cell.points);c.fillStyle='#070807';c.shadowColor='#020507';c.shadowBlur=13;c.shadowOffsetY=9;c.fill();c.shadowBlur=0;c.shadowOffsetY=0;c.clip();c.drawImage(s.scratch,0,0);
 c.strokeStyle='#e8cf98';c.lineWidth=2;c.stroke();c.restore();
 if(d>.06&&d<1)for(let k=0;k<2;k++){const x=cell.x+dx+k*11,age=d-.05;c.save();c.globalAlpha=alpha*.6;c.translate(x,cell.y+dy+age*140);c.rotate(cell.spin+age*3);c.fillStyle=k?'#b9a37e':'#403b32';c.fillRect(-3,-2,6,4);c.restore();}
 }dust(s.c,s.field,elapsed,960,540,'#d4bc8f',1.8);
}
