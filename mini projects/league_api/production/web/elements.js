import { stoneBorder, terrain } from './terrain.js';
import { corners, glow, ease, particles, rails, crest } from './primitives.js';

// Hextech is etched glass and travelling charge: all motion derives from the
// owning scene's elapsed time, so pause/seek need no extra animation lifetime.
function hexPath(x,y,r,angle=0){
  return Array.from({length:7},(_,i)=>[x+Math.cos(angle+i*Math.PI/3)*r,y+Math.sin(angle+i*Math.PI/3)*r]);
}
const hexEase=value=>{const p=Math.max(0,Math.min(1,value));return p*p*(3-2*p);};
function strokePath(c,points,color,width,alpha){
  c.save();c.globalAlpha*=alpha;c.strokeStyle=color;c.lineWidth=width;
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();
}
export function hextechChargeSamples(points,t,speed,phase){
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  const total=lengths.reduce((a,b)=>a+b,0);
  const closed=Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<.001;
  const tail=Math.min(145,total*.39);
  const point=distance=>{
    if(!closed&&(distance<0||distance>total))return null;
    let q=closed?((distance%total)+total)%total:distance;
    for(let i=0;i<lengths.length;i++){
      if(q<=lengths[i]){const f=q/lengths[i];return[points[i][0]+(points[i+1][0]-points[i][0])*f,points[i][1]+(points[i+1][1]-points[i][1])*f];}
      q-=lengths[i];
    }return points.at(-1);
  };
  // Open circuits let the entire tail leave before the next head enters.
  // Never connect the end of an open route back to its beginning.
  const period=closed?total:total+tail+60,head=((t*speed+phase)%period+period)%period;
  const segments=[];
  for(let i=0;i<22;i++){
    const f=i/22,a=point(head-tail*(1-f)),b=point(head-tail*(1-(i+1)/22));
    if(a&&b)segments.push({points:[a,b],alpha:f*f*.8});
  }
  return{segments,head:point(head),headAlpha:closed?1:hexEase(head/22)*hexEase((total-head)/22)};
}
function charge(c,points,t,speed,phase,color,alpha=1){
  const samples=hextechChargeSamples(points,t,speed,phase);
  c.save();c.globalAlpha*=alpha*.14;c.strokeStyle=color;c.lineWidth=8;
  c.beginPath();for(const segment of samples.segments){c.moveTo(...segment.points[0]);c.lineTo(...segment.points[1]);}c.stroke();c.restore();
  for(const segment of samples.segments)strokePath(c,segment.points,color,3.1,alpha*segment.alpha);
  if(!samples.head)return;
  const [x,y]=samples.head;c.save();c.globalAlpha*=alpha*samples.headAlpha;
  glow(c,x,y,21,color,.55);c.fillStyle='#e6fbff';c.beginPath();c.arc(x,y,2.3,0,Math.PI*2);c.fill();c.restore();
}
function dragonSigil(c,x,y,t,mirror){
  c.save();c.translate(x,y);c.scale(mirror,1);
  // Small angular dragon engraving, with split wing membranes and a crystal eye.
  const head=[[-25,15],[-14,-3],[-28,-27],[-5,-16],[13,-30],[10,-7],[34,2],[19,13],[7,13],[-4,30],[-18,23],[-25,15]];
  const wing=[[-24,15],[-44,-5],[-94,-29],[-79,1],[-64,-6],[-54,20],[-43,8],[-24,15]];
  c.fillStyle='#264054';c.globalAlpha*=.72;c.beginPath();head.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));c.fill();
  strokePath(c,head,'#9ab7d8',1.1,.65);strokePath(c,wing,'#6ba0cc',1.3,.58);
  strokePath(c,[[-24,15],[-79,1],[-94,-29]],'#94dfe9',.8,.3);
  charge(c,head,t,82,0,'#b695ff',.9);charge(c,wing,t,115,140,'#66e8fa',.7);
  glow(c,9,2,10,'#b29aff',.5);c.fillStyle='#e2ffff';c.beginPath();c.moveTo(3,1);c.lineTo(12,-1);c.lineTo(8,5);c.closePath();c.fill();
  c.restore();
}
function hextechFiligree(c,t,strength=1){
  c.save();c.globalAlpha*=strength;
  // Fine branching scale-work stays in narrow side margins. Unequal branches
  // and broken etched arcs keep the frame from reading as a tiled HUD panel.
  for(const side of [0,1]){
    c.save();if(side){c.translate(1920,0);c.scale(-1,1);}
    for(let i=0;i<5;i++){
      const y=194+i*119+(side?31:0),x=16+(i%3)*11;
      const branch=[[x,y],[x+22,y+22],[x+22,y+51],[x+57,y+86],[x+89,y+86]];
      strokePath(c,branch,'#8fb0db',.7,.32);
      charge(c,branch,t,82+i*13,i*42+side*68,'#9defff',.58);
      const facet=hexPath(x+57,y+61,18+(i%2)*4,Math.PI/6);
      strokePath(c,facet,'#a19fdf',.9,.38);
      strokePath(c,[facet[1],facet[3],facet[5],facet[1]],'#bce6f2',.6,.21);
      c.save();c.globalAlpha*=.38+.18*Math.sin(t*1.2+i);
      c.fillStyle='#92e7ff';c.beginPath();c.arc(x+89,y+86,1.4,0,Math.PI*2);c.fill();c.restore();
      for(let tick=0;tick<3;tick++)strokePath(c,[[x+2,y+58+tick*7],[x+10,y+66+tick*7]],'#b7a5e9',.8,.32);
    }
    c.restore();
  }
  // Crown-like broken circuit arcs flank the wings, with tiny diamond inlays.
  for(const mirror of [-1,1]){
    c.save();c.translate(960,23);c.scale(mirror,1);
    const rail=[[343,5],[377,5],[397,25],[446,25],[470,1],[531,1],[550,20],[590,20]];
    strokePath(c,rail,'#a2bbd9',.9,.36);charge(c,rail,t,132,mirror<0?90:0,'#b69dff',.64);
    for(let i=0;i<4;i++){
      const x=375+i*57,y=55+(i%2)*9;
      strokePath(c,[[x-4,y],[x,y-7],[x+4,y],[x,y+7],[x-4,y]],'#a6e1fa',.8,.38);
      strokePath(c,[[x,y+10],[x+13,y+23],[x+30,y+23]],'#8d9dd2',.6,.26);
    }c.restore();
  }
  c.restore();
}
export function hextechAtmosphere(c,t,capture=false){
  c.save();c.lineCap='round';c.lineJoin='round';
  // Sparse, deliberately asymmetric cells: oversized hero hexes and smaller
  // satellite facets, with no screen-wide opaque panel or centre artwork.
  const cells=[[54,337,48,.18],[62,610,62,-.12],[1885,400,60,.12],[1863,696,43,-.24],
    [715,35,39,0],[1228,39,50,.13],[354,1055,48,.12],[1475,1057,37,-.1]];
  cells.forEach(([x,y,r,a],i)=>{
    const path=hexPath(x,y,r,a),drift=Math.sin(t*.48+i)*2.4;
    c.save();c.translate(0,drift);
    const glass=c.createLinearGradient(x-r,y-r,x+r,y+r);glass.addColorStop(0,'#69dfff18');glass.addColorStop(.55,'#8e8eef03');glass.addColorStop(1,'#866dff15');
    c.fillStyle=glass;c.beginPath();path.forEach(([a,b],j)=>j?c.lineTo(a,b):c.moveTo(a,b));c.fill();
    strokePath(c,path,'#b2c6ef',1.8,.64);
    strokePath(c,hexPath(x,y,r-7,a),'#81e5fa',1.1,.38);
    charge(c,path,t,65+i*8,i*103,i%2?'#bb9bff':'#78edff',capture?.96:.65);
    if(i<4){
      const inner=hexPath(x,y,13,a+t*.16);strokePath(c,inner,'#bfafff',1.4,.58);
      charge(c,inner,t,32,i*21,'#bca6ff',.55);
      strokePath(c,[[x-r*.65,y],[x-18,y],[x-11,y-9]],'#86cadd',.8,.25);
    }c.restore();
  });
  const routes=[[[10,202],[26,218],[26,295],[55,324],[55,393],[18,430],[18,544],[42,568]],
    [[1910,211],[1889,232],[1889,338],[1863,364],[1863,450],[1901,488],[1901,618],[1879,641]],
    [[552,12],[594,12],[620,38],[678,38],[704,12],[830,12],[856,38],[924,38]],
    [[1060,1068],[1139,1068],[1166,1041],[1250,1041],[1277,1068],[1360,1068]]];
  routes.forEach((route,i)=>{strokePath(c,route,'#739bbf',.8,.19);charge(c,route,t,155+i*27,i*117,i%2?'#b695ff':'#6be7ff',capture?.78:.46);});
  hextechFiligree(c,t,capture?.95:.72);
  // Soft refraction bands travel beneath the engraving, adding body to the
  // frame without darkening gameplay or turning the entire edge into a flash.
  for(const side of [0,1]){
    c.save();if(side){c.translate(1920,0);c.scale(-1,1);}
    const wash=c.createLinearGradient(0,0,113,0);
    wash.addColorStop(0,'#648be830');wash.addColorStop(.28,'#78dffc15');wash.addColorStop(1,'#78dffc00');
    c.fillStyle=wash;c.fillRect(0,180,113,620);
    const y=485+Math.sin(t*.8+side*2.3)*226;
    const shimmer=c.createRadialGradient(15,y,0,15,y,109);
    shimmer.addColorStop(0,'#93ecff35');shimmer.addColorStop(.45,'#9488ee17');shimmer.addColorStop(1,'#9488ee00');
    c.fillStyle=shimmer;c.fillRect(0,y-109,124,218);c.restore();
  }
  // Dragon is a small circuit-etched relic, not a mascot covering the playfield.
  dragonSigil(c,465,72,t,1);dragonSigil(c,1457,70,t+1.8,-1);
  // Passing refractions expose facets one at a time, without flashing the frame.
  for(let i=0;i<6;i++){
    const travel=((t*(37+i*3)+i*149)%570)/570,y=215+travel*570,x=i%2?1906:12;
    c.save();c.globalAlpha*=.26*Math.sin(Math.PI*travel)**2;glow(c,x,y,44,i%2?'#ba9dff':'#65e0fa',.45);c.restore();
  }
  c.restore();
}
export function hextechSurge(c,t,duration){
  const progress=t/duration,entrance=hexEase(t/.65),exit=hexEase((duration-t)/.65);
  c.save();c.globalAlpha*=Math.max(0,entrance*exit);c.lineJoin='round';c.lineCap='round';
  // A faceted dragon reactor opens its wings, then discharges down the sides.
  const spread=.76+.24*hexEase(t/1.1);
  for(const mirror of [-1,1]){
    c.save();c.translate(960,83);c.scale(mirror*spread,1);
    const wing=[[30,5],[73,-22],[166,-52],[298,-59],[239,-20],[265,5],[174,-4],[195,31],[105,12],[129,51],[57,22],[30,5]];
    const glass=c.createLinearGradient(25,-50,240,55);glass.addColorStop(0,'#a1eaff66');glass.addColorStop(.5,'#756cd930');glass.addColorStop(1,'#68e5ff0c');
    c.fillStyle=glass;c.beginPath();wing.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.fill();
    strokePath(c,wing,'#c3f0ff',1.9,.82);
    for(const rib of [[[30,5],[166,-52],[174,-4]],[[30,5],[239,-20],[195,31]],[[30,5],[105,12],[129,51]]]){
      strokePath(c,rib,'#c3b2ff',1,.4);charge(c,rib,t,195,0,'#8cf3ff',.95);
    }
    charge(c,wing,t,360,0,'#ae9aff',1);
    c.restore();
  }
  c.save();c.translate(960,81);
  const jewel=[[0,-45],[25,-13],[17,21],[0,45],[-17,21],[-25,-13],[0,-45]];
  glow(c,0,0,70,'#8e7cff',.48);glow(c,0,0,36,'#8dedff',.5);
  const crystal=c.createLinearGradient(-25,-45,25,45);crystal.addColorStop(0,'#aeefff9c');crystal.addColorStop(.44,'#7773dd66');crystal.addColorStop(.58,'#c8efffa6');crystal.addColorStop(1,'#4368bd28');
  c.fillStyle=crystal;c.beginPath();jewel.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.fill();
  c.fillStyle='#ddfaff45';c.beginPath();c.moveTo(0,-45);c.lineTo(-5,-5);c.lineTo(-25,-13);c.closePath();c.fill();
  strokePath(c,jewel,'#d9f9ff',2,.9);
  strokePath(c,[[0,-45],[-5,-5],[17,21],[0,45],[-5,-5],[-25,-13]],'#9ad8ef',1.2,.7);
  charge(c,hexPath(0,0,55,Math.PI/6),t,135,0,'#cab4ff',.95);
  c.restore();
  for(const mirror of [-1,1]){
    c.save();if(mirror<0){c.translate(1920,0);c.scale(-1,1);}
    const bolt=[[17,151],[45,179],[45,255],[91,301],[91,403],[28,466],[28,568],[91,631],[91,748],[18,821]];
    strokePath(c,bolt,'#809dde',1.3,.32);
    charge(c,bolt,t,410,0,'#88f1ff',1);
    // Faceted scales awaken in succession as the discharge passes.
    for(let i=0;i<6;i++){
      const energy=Math.exp(-(((progress-.18-i*.105)/.10)**2));
      c.save();c.globalAlpha*=energy;
      const y=242+i*94,x=47+(i%2)*24;
      glow(c,x,y,56,'#a387ff',.45);
      strokePath(c,hexPath(x,y,34+i%3*7,Math.PI/6),'#aeefff',2.5,.88);
      strokePath(c,hexPath(x,y,23,Math.PI/6),'#ad91ff',1.2,.7);
      // The charge forks into three smaller scales rather than lighting one tile.
      for(let k=0;k<3;k++){
        const sx=x+41+k*18,sy=y+(k-1)*25;
        strokePath(c,[[x+20,y],[sx-10,sy],[sx,sy]],'#b5e9ff',.9,.55);
        strokePath(c,hexPath(sx,sy,9+k*2,Math.PI/6),'#b3a7f0',1,.65);
      }c.restore();
    }c.restore();
  }c.restore();
}
export function wings(c, e, color, power) {
  corners(c, e.elapsed, (c, index, t) => {
    glow(c, 0, 0, 115, color, 0.7);
    c.fillStyle = color;
    for (let i = 0; i < 7; i++) {
      const r = 35 + i * 10;
      c.save();
      c.rotate(-0.8 + i * 0.17 + Math.sin(t * 2) * 0.08);
      c.beginPath();
      c.moveTo(8, 10);
      c.quadraticCurveTo(r * 0.4, -26, r + 12, -12);
      c.quadraticCurveTo(r * 0.8, 13, 8, 10);
      c.fill();
      c.restore();
    }
    c.fillStyle = '#fff8df';
    c.beginPath();
    c.moveTo(-8, 12);
    c.lineTo(0, -20);
    c.lineTo(9, 12);
    c.closePath();
    c.fill();
  });
  particles(c, color, e.elapsed, e.duration, power, 'star');
  rails(c, color, e.elapsed, power);
}
export function elemental(c, e, color, options, power) {
  const p = e.elapsed / e.duration;
  if (e.theme === 'earth') {
    stoneBorder(c, options.edge_width, 1, Math.max(0, (p - 0.12) / 0.88));
    corners(c, e.elapsed, (c) => glow(c, 0, 0, 100, color, 0.7));
    particles(c, color, e.elapsed, e.duration, power * 1.4);
    return;
  }
  c.save();
  c.globalAlpha *= 0.9;
  terrain(c, e.theme, e.elapsed, { ...options, edge_width: Math.min(84, options.edge_width + 18) });
  c.restore();
  if (e.theme === 'elder') {
    wings(c, e, color, power * 1.5);
    return;
  }
  corners(c, e.elapsed, (c, index, t) => {
    glow(c, 0, 0, 125, color, 0.75);
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 3;
    if (e.theme === 'fire') {
      for (let i = 0; i < 5; i++) {
        c.save();
        c.rotate(-0.75 + i * 0.33);
        c.beginPath();
        c.moveTo(-8, 30);
        c.bezierCurveTo(-30, -5, 20, -25 + Math.sin(t * 3 + i) * 8, 8, -75 - i * 7);
        c.bezierCurveTo(48, -30, 36, 16, 8, 30);
        const flame = c.createLinearGradient(0, 30, 0, -100);
        flame.addColorStop(0, '#fff4c2');
        flame.addColorStop(0.35, '#ffb14c');
        flame.addColorStop(1, '#ed493000');
        c.fillStyle = flame;
        c.fill();
        c.restore();
      }
    } else if (e.theme === 'water') {
      for (let i = 0; i < 3; i++) {
        c.save();
        c.rotate(t * 0.16 + i * 0.45);
        c.beginPath();
        c.moveTo(-40, 35);
        c.bezierCurveTo(-82, -70, 90, -85, 38, -5);
        c.bezierCurveTo(62, -43, 18, -38, 13, -6);
        c.stroke();
        c.restore();
      }
    } else if (e.theme === 'air') {
      for (let i = 0; i < 4; i++) {
        c.save();
        c.rotate(t * 0.6 + i * 0.6);
        c.beginPath();
        c.ellipse(0, 0, 55 + i * 6, 17 + i * 4, 0.7, 0.2, Math.PI * 1.7);
        c.stroke();
        c.restore();
      }
    } else if (e.theme === 'hextech') {
      crest(c, color, t, 3);
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(20 + i * 13, 35);
        c.lineTo(38 + i * 13, 50);
        c.lineTo(100, 50 + i * 8);
        c.stroke();
        glow(c, 100, 50 + i * 8, 9, color, 0.8);
      }
    } else if (e.theme === 'chemtech') {
      for (let i = 0; i < 8; i++) {
        const a = i * 0.9 + t * 0.3,
          x = Math.cos(a) * 45,
          y = Math.sin(a) * 35;
        c.beginPath();
        c.arc(x, y, 9 + (i % 3) * 3, 0, 7);
        c.stroke();
        glow(c, x, y, 20, color, 0.45);
      }
      c.beginPath();
      c.moveTo(-12, 15);
      c.lineTo(0, -26);
      c.lineTo(18, 18);
      c.closePath();
      c.fill();
    } else crest(c, color, t, 3);
  });
  particles(
    c,
    color,
    e.elapsed,
    e.duration,
    power * 1.3,
    e.theme === 'water' || e.theme === 'chemtech' ? 'bubble' : 'star',
  );
  rails(c, color, e.elapsed, power);
}
