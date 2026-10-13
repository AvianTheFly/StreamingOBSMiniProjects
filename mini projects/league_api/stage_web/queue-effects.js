// Feature-owned catalogue of bounded spirit acts. Pure canvas drawing only.
import {PERFORMANCE_NAMES,paintPerformance} from './queue-performances.js';
export const EFFECT_NAMES={
  bear:['Gathering sparks','Thunder cuts','Shock rings','Storm core','Guardian constellation','Polar aurora','Lightning rain','Thunder comet',...PERFORMANCE_NAMES.bear],
  turtle:['Orbiting seeds','Shield bloom','Water caustics','Spirit lotus','Bubble garden','Living shell','Tidal spiral','Crystal sanctuary',...PERFORMANCE_NAMES.turtle],
  ram:['Horn charge','Earthbreaker','Rising shards','Orbiting stones','Forge sigil','Amber geyser','Spirit stampede','Seismic waves',...PERFORMANCE_NAMES.ram],
  phoenix:['Feather gathering','Wing awakening','Feather storm','Falling star feathers','Frost blossom','Eye of the storm','Skyfire sweep','Aurora wings',...PERFORMANCE_NAMES.phoenix]
};
function polygon(c,x,y,r,sides,turn,color,a,fill=false){
  c.globalAlpha=a;c.strokeStyle=c.fillStyle=color;c.lineWidth=1.3;c.beginPath();
  for(let k=0;k<=sides;k++){const angle=k*Math.PI*2/sides+turn,px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r;k?c.lineTo(px,py):c.moveTo(px,py);}fill?c.fill():c.stroke();
}
function feather(c,x,y,length,turn,color,a){
  c.save();c.translate(x,y);c.rotate(turn);c.globalAlpha=a;c.fillStyle=color;
  c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-length*.3,-length*.4,0,-length);c.quadraticCurveTo(length*.3,-length*.4,0,0);c.fill();
  stroke(c,[[0,0],[0,-length*.9]],'#e8ecff',a*.7,.7);c.restore();
}
function bearExtra(c,id,p,a,t,color){
  if(id===3){ // A magnetic storm core with branching, rotating spokes.
    radial(c,530,82,57,color,a*.55);ring(c,530,82,17+Math.sin(t)*3,17,color,a*.6,2);
    for(let i=0;i<9;i++){
      const angle=i*TAU/9+t*.17,r=53+Math.sin(t*1.4+i)*10;
      const points=[[530+Math.cos(angle)*18,82+Math.sin(angle)*12],[530+Math.cos(angle+.12)*r*.55,82+Math.sin(angle+.12)*r*.4],[530+Math.cos(angle-.08)*r*.68,82+Math.sin(angle-.08)*r*.4],[530+Math.cos(angle)*r,82+Math.sin(angle)*r*.65]];
      stroke(c,points,color,a*.25,5);stroke(c,points,'#d6f5ff',a*.85,1.1);
    }
  }else if(id===4){ // A bear face resolves from a field of star nodes.
    const points=[[479,63],[489,49],[509,60],[532,57],[553,60],[573,49],[583,63],[576,94],[554,111],[532,120],[509,111],[485,94],[479,63]];
    stroke(c,points,color,a*.6,1.4);stroke(c,[[509,83],[518,87],[510,91]],'#dcf7ff',a*.85,2);stroke(c,[[554,83],[545,87],[553,91]],'#dcf7ff',a*.85,2);
    stroke(c,[[523,99],[532,106],[541,99],[523,99]],color,a*.8);
    points.forEach(([x,y],i)=>{mote(c,x,y,'#effbff',a*(.45+.4*Math.sin(t*.5+i)**2),1.8);radial(c,x,y,8,color,a*.3);});
  }else if(id===5){ // Long polar curtains fold across the guardian.
    for(let i=0;i<12;i++){
      const x=446+i*13,sway=Math.sin(t*.5+i*.35)*15;
      c.globalAlpha=a*(.07+(i%3)*.025);c.fillStyle=i%3?'#85dce9':'#c0dcff';c.beginPath();
      c.moveTo(x,30);c.bezierCurveTo(x+42,57+sway,x-19,85,x+12,128);c.lineTo(x+24,128);c.bezierCurveTo(x-4,88,x+53,58+sway,x+9,30);c.fill();
    }
  }else if(id===6){ // Rain trails light up before landing in tiny shock pools.
    for(let i=0;i<24;i++){
      const q=(p*1.6+i*.137)%1,x=452+(i*43)%162-q*14,y=29+q*96;
      stroke(c,[[x+4,y-15],[x,y]],i%4?'#7ed6ff':'#e4f8ff',a*Math.sin(q*Math.PI)*.65,i%4?1:2);
      if(q>.72)ring(c,x,119,(q-.72)*38,(q-.72)*10,color,a*(1-q)*1.7);
    }
  }else{ // A comet crosses the card's open area and leaves a charged wake.
    const x=445+p*160,y=101-Math.sin(p*Math.PI)*38;
    for(let i=20;i>=0;i--){const q=Math.max(0,p-i*.014);mote(c,445+q*160,101-Math.sin(q*Math.PI)*38,color,a*(1-i/21)*.55,1+(1-i/21)*3);}
    radial(c,x,y,23,color,a*.7);mote(c,x,y,'#f1fcff',a*.95,3);
    for(let i=0;i<4;i++)ring(c,x-17-i*12,y+8,8+i*5,4+i*3,color,a*.2);
  }
}
function turtleExtra(c,id,p,a,t,color){
  if(id===3){ // A translucent lotus opens one tier at a time.
    for(let layer=0;layer<2;layer++)for(let i=0;i<8;i++){
      const angle=i*TAU/8+layer*.4+t*.045,length=(27+layer*19)*(.65+Math.sin(p*Math.PI)*.35);
      feather(c,529,89,length,angle,layer?color:'#dcffee',a*(layer?.28:.4));
    }radial(c,529,89,20,'#caffed',a*.6);
  }else if(id===4){ // Bubbles rise in a garden of curling stems.
    for(let i=0;i<16;i++){
      const q=(p*.9+i*.173)%1,x=453+(i*41)%151+Math.sin(t*.4+i)*7,y=130-q*100,r=3+(i%4)*2;
      ring(c,x,y,r,r,color,a*Math.sin(q*Math.PI)*.65);mote(c,x-r*.3,y-r*.4,'#e0fff2',a*Math.sin(q*Math.PI)*.6,1);
    }
    for(let i=0;i<5;i++){c.globalAlpha=a*.27;c.strokeStyle=color;c.lineWidth=1.5;c.beginPath();c.moveTo(473+i*25,130);c.bezierCurveTo(453+i*25,98,497+i*25,104,479+i*25,81);c.stroke();}
  }else if(id===5){ // Hex cells light in a travelling shield wave.
    for(let row=0;row<4;row++)for(let col=0;col<6;col++){
      const x=446+col*29+(row%2)*14.5,y=42+row*25,shine=(.5+.5*Math.cos(col*.9+row*.7-t*.9))**3;
      polygon(c,x,y,16,6,Math.PI/6,color,a*(.12+shine*.55));polygon(c,x,y,12,6,Math.PI/6,color,a*shine*.2,true);
    }
  }else if(id===6){ // Two opposing tides spiral around a quiet centre.
    for(let arm=0;arm<3;arm++){
      const points=[];for(let i=0;i<=50;i++){const angle=i*.115+arm*TAU/3+t*.25,r=6+i*1.3;points.push([530+Math.cos(angle)*r,83+Math.sin(angle)*r*.55]);}
      stroke(c,points,color,a*.2,6);stroke(c,points,'#c1ffdf',a*.48,1.1);
    }ring(c,530,83,10,7,'#ddfff1',a*.7);
  }else{ // Facets form a sanctuary around a glowing pearl.
    for(let i=0;i<8;i++){
      const angle=i*TAU/8+t*.07,x=529+Math.cos(angle)*52,y=84+Math.sin(angle)*32;
      c.save();c.translate(x,y);c.rotate(angle);polygon(c,0,0,10+Math.sin(p*Math.PI)*5,4,0,color,a*.45,true);polygon(c,0,0,15,4,0,'#d1ffe9',a*.65);c.restore();
      stroke(c,[[x,y],[529,84]],color,a*.18);
    }radial(c,529,84,30,color,a*.55);ring(c,529,84,65,41,color,a*.45,1.5);
  }
}
function ramExtra(c,id,p,a,t,color){
  if(id===3){ // Heavy stone facets revolve on tilted orbits.
    for(let i=0;i<9;i++){
      const angle=i*TAU/9+t*.24,x=530+Math.cos(angle)*72,y=85+Math.sin(angle)*31;
      polygon(c,x,y,5+i%3*2,5,t*.4+i,color,a*.38,true);polygon(c,x,y,5+i%3*2,5,t*.4+i,'#ffe0b4',a*.62);
      stroke(c,[[x,y],[x+Math.sin(angle)*12,y-Math.cos(angle)*5]],color,a*.28,2);
    }ring(c,530,85,73,32,color,a*.22);
  }else if(id===4){ // A forge seal assembles with a warm molten core.
    for(let i=0;i<3;i++)polygon(c,531,85,25+i*15,6,t*.055*(i%2?-1:1),color,a*(.55-i*.12));
    for(let i=0;i<8;i++){const angle=i*TAU/8;stroke(c,[[531+Math.cos(angle)*40,85+Math.sin(angle)*40],[531+Math.cos(angle)*50,85+Math.sin(angle)*50]],'#ffe4bb',a*.65,2);}
    stroke(c,[[520,65],[540,76],[523,87],[541,99],[520,109]],'#fff0d6',a*.8,2);radial(c,531,85,24,color,a*.35);
  }else if(id===5){ // Amber sparks erupt in a parabolic fountain.
    for(let i=0;i<30;i++){
      const q=(p*1.4+i*.137)%1,speed=22+(i*13)%61,side=i%2?1:-1,x=532+side*q*speed,y=124-Math.sin(q*Math.PI)*(30+(i*17)%52);
      stroke(c,[[x-side*3,y+4],[x,y]],i%3?color:'#fff0c7',a*Math.sin(q*Math.PI)*.8,i%4?1.4:2.5);
    }ring(c,532,124,40,8,color,a*.65,2);radial(c,532,119,42,color,a*.3);
  }else if(id===6){ // Three horned spirit echoes charge through the open space.
    for(let i=2;i>=0;i--){const x=453+p*112-i*24,y=84+Math.sin(p*Math.PI)*4;
      c.save();c.translate(x,y);c.scale(.5,.5);c.globalAlpha=a*(.65-i*.18);c.strokeStyle=color;c.lineWidth=3;
      for(const s of [-1,1]){c.beginPath();c.moveTo(s*8,-5);c.bezierCurveTo(s*26,-55,s*66,-43,s*52,-10);c.bezierCurveTo(s*36,12,s*20,-3,s*31,-14);c.stroke();}
      stroke(c,[[-15,0],[0,30],[15,0]],'#ffe1b3',a*(.7-i*.2),2);c.restore();
      stroke(c,[[x-36,y+10],[x-12,y+10]],color,a*.25,2);
    }
  }else{ // Seismic strata buckle into gold-edged mountain bands.
    for(let row=0;row<6;row++){
      const points=[];for(let i=0;i<14;i++){const x=430+i*15,y=130-row*9-Math.sin(i*.8-t*.65+row*.5)*(5+row*2);points.push([x,y]);}
      stroke(c,points,color,a*(.22+row*.045),row%2?1.2:2.5);
    }radial(c,532,110,64,color,a*.2);
  }
}
function phoenixExtra(c,id,p,a,t,color){
  if(id===3){ // A shower of luminous feathers turns as it descends.
    for(let i=0;i<13;i++){const q=(p*.9+i*.173)%1,x=449+(i*37)%160-q*18,y=27+q*112;feather(c,x,y,12+(i%4)*3,.4+Math.sin(t*.4+i)*.45,i%3?color:'#e5e4ff',a*Math.sin(q*Math.PI)*.55);}
  }else if(id===4){ // A sixfold ice blossom grows branching tips.
    for(let i=0;i<6;i++){
      c.save();c.translate(531,84);c.rotate(i*TAU/6+t*.065);const r=36+Math.sin(p*Math.PI)*15;
      stroke(c,[[0,0],[0,-r]],'#dedbff',a*.7,1.6);
      for(let k=1;k<=3;k++){const y=-k*r/4;stroke(c,[[-10,y-8],[0,y],[10,y-8]],color,a*.65,1.3);}c.restore();
    }radial(c,531,84,27,color,a*.35);polygon(c,531,84,13,6,t*.065,color,a*.6);
  }else if(id===5){ // A hollow storm eye winds up through layered spirals.
    for(let i=0;i<7;i++){
      c.globalAlpha=a*(.48-i*.045);c.strokeStyle=i%2?color:'#e2dfff';c.lineWidth=i%2?2.8:1.2;c.beginPath();
      c.ellipse(531,84,17+i*8,9+i*5,-.35,t*.4+i*.4,t*.4+i*.4+Math.PI*1.6);c.stroke();
    }ring(c,531,84,12,7,color,a*.75);
  }else if(id===6){ // A skyfire bird leaves a curved train of feathers.
    const x=447+p*157,y=107-Math.sin(p*Math.PI)*45;
    for(let i=0;i<14;i++){const q=Math.max(0,p-i*.019),tx=447+q*157,ty=107-Math.sin(q*Math.PI)*45;feather(c,tx,ty,8+(1-i/14)*12,-1.1,color,a*(1-i/14)*.4);}
    for(const side of [-1,1])for(let i=0;i<4;i++)feather(c,x,y,17+i*5,side*(.5+i*.19),i%2?color:'#dfdbff',a*.5);
    radial(c,x,y,20,color,a*.45);
  }else{ // Twin aurora wings stream outward as layered silk ribbons.
    for(const side of [-1,1])for(let i=0;i<9;i++){
      const sway=Math.sin(t*.6+i*.35)*7;
      c.globalAlpha=a*(.12+i*.016);c.fillStyle=i%3?color:'#cddfff';c.beginPath();c.moveTo(531,104);
      c.bezierCurveTo(531+side*24,78+sway,531+side*63,95-i*5,531+side*(62+i*3),35+i*4);
      c.bezierCurveTo(531+side*48,86-i*3,531+side*20,102+sway,531,104);c.fill();
    }
  }
}
const EXTRA={bear:bearExtra,turtle:turtleExtra,ram:ramExtra,phoenix:phoenixExtra};
export function paintEffect(c,theme,cue,color,weight=1){
  if(!cue||cue.amount<=0||weight<=0)return;
  if(cue.id>=8){paintPerformance(c,theme,cue.id-8,cue.phase,color,weight);return;}
  const {id,phase,amount}=cue,t=phase*10;
  c.save();
  if(id<3)spectacle(c,theme,t,color,weight,id,amount);
  else EXTRA[theme](c,id,phase,amount*weight,t,color);
  c.restore();
}
function radial(c,x,y,r,color,opacity){
  const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');
  c.globalAlpha=opacity;c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
function stroke(c,points,color,alpha,width=1){
  c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.beginPath();
  points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
}
// Smooth, repeatable acts sampled by the page's existing clock. No particle
// history accumulates; every mote, shard and feather has a fixed index.
const TAU=Math.PI*2;
function ring(c,x,y,rx,ry,color,alpha,width=1){
  c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.stroke();
}
function mote(c,x,y,color,alpha,size=2){
  c.globalAlpha=alpha;c.fillStyle=color;c.beginPath();c.arc(x,y,size,0,TAU);c.fill();
}
function spectacle(c,theme,t,color,w,id,amount){
  const gather=id===0?amount:0,release=id===1?amount:0,echo=id===2?amount:0;
  w*=amount;
  if(theme==='bear'){
    // Sparks converge, the guardian's eyes wake, then three thunder cuts travel.
    for(let i=0;i<22;i++){
      const a=i*2.399+t*.18,r=60+25*Math.sin(i*4.1)-gather*35;
      const x=530+Math.cos(a)*r,y=80+Math.sin(a)*r*.58;
      mote(c,x,y,'#c4efff',(.14+gather*.48)*w,i%5===0?1.7:.8);
      if(gather>.1)stroke(c,[[x,y],[x+Math.cos(a)*5,y+Math.sin(a)*3]],color,gather*.25*w);
    }
    radial(c,530,80,52,color,gather*.28*w);
    for(const side of [-1,1])stroke(c,[[530+side*9,73],[530+side*19,70]],'#dcf7ff',gather*.65*w,2);
    for(let i=0;i<3;i++){
      const p=(((t-8-i*.7)/7)%1+1)%1,x=579-i*33-p*12;
      const intensity=release*Math.sin(p*Math.PI)*w;
      stroke(c,[[x+26,30],[x+4,58],[x+13,57],[x-17,95],[x-10,94],[x-30,127]],color,intensity*.22,6);
      stroke(c,[[x+26,30],[x+4,58],[x+13,57],[x-17,95],[x-10,94],[x-30,127]],'#d6f6ff',intensity*.65,1.3);
    }
    for(let i=0;i<3;i++)ring(c,531,86,28+i*20+echo*17,12+i*9,color,echo*(.25-i*.05)*w);
  }else if(theme==='turtle'){
    // A growing shell becomes a protective dome; tiny orbiting seeds bloom.
    for(let i=0;i<7;i++){
      const a=i*TAU/7+t*.13,x=523+Math.cos(a)*58,y=83+Math.sin(a)*32;
      ring(c,x,y,4+gather*3,3+gather*2,color,(.16+gather*.35)*w);
      stroke(c,[[x,y],[523+Math.cos(a)*27,83+Math.sin(a)*16]],color,gather*.2*w);
    }
    c.globalAlpha=release*.2*w;c.fillStyle=color;c.beginPath();c.ellipse(527,98,64,47,0,Math.PI,TAU);c.closePath();c.fill();
    for(let i=0;i<4;i++)ring(c,527,92,35+i*14+release*8,22+i*8,color,(gather*.10+release*.27)*(1-i*.14)*w,1.2);
    for(let i=0;i<15;i++){
      const p=(t*.055+i*.173)%1,x=430+(i*37)%176+Math.sin(t*.5+i)*8,y=125-p*90;
      mote(c,x,y,'#d6ffeb',Math.sin(p*Math.PI)*(.12+echo*.3)*w,i%4===0?2:1);
    }
    // Broad caustic fans sweep across the face of the shell after the bloom.
    for(let i=0;i<5;i++){
      c.globalAlpha=echo*.23*w;c.strokeStyle=color;c.lineWidth=1.2;c.beginPath();
      c.moveTo(438+i*9,127);c.quadraticCurveTo(501,46+Math.sin(t*.6+i)*9,590+i*6,81-i*8);c.stroke();
    }
  }else if(theme==='ram'){
    // Gold lifts through the horns, a heavy strike fractures the ground,
    // then bounded shards arc upward and settle back into the stone.
    for(const side of [-1,1]){
      c.globalAlpha=gather*.45*w;c.strokeStyle='#ffdfae';c.lineWidth=4;c.beginPath();
      c.ellipse(528+side*39,71,29,25,side*.4,Math.PI*.95+t*.12,Math.PI*1.7+t*.12);c.stroke();
    }
    radial(c,532,109,68,color,release*.32*w);
    for(let i=0;i<5;i++){
      const sign=i%2?1:-1,x=532+sign*(13+i*11);
      stroke(c,[[532,119],[x,111-i*3],[x+sign*9,99-i*4],[x+sign*29,94-i*5]],'#ffdcaa',release*.6*w,1.5);
    }
    for(let i=0;i<18;i++){
      const p=((t-9)/8+i*.097+10)%1,x=530+(i%2?1:-1)*p*(26+(i*13)%53),y=126-Math.sin(p*Math.PI)*(19+(i*11)%42);
      c.save();c.translate(x,y);c.rotate(t*.35+i);c.globalAlpha=(release*.28+echo*.16)*Math.sin(p*Math.PI)*w;c.fillStyle=i%3?color:'#ffe5b9';
      c.beginPath();c.moveTo(-3,-1);c.lineTo(0,-4);c.lineTo(4,0);c.lineTo(0,3);c.closePath();c.fill();c.restore();
    }
    for(let i=0;i<3;i++)ring(c,532,119,32+i*21+release*23,6+i*5,color,release*(.4-i*.09)*w,1.5);
  }else{
    // Feathers gather into paired wings, unfold, then peel into a storm spiral.
    for(const side of [-1,1])for(let i=0;i<7;i++){
      const spread=.5+release*.5,rootX=527+side*7,rootY=95+i*2;
      const tipX=527+side*(24+i*7)*spread,tipY=61-i*4+Math.sin(t*.7+i)*3;
      c.globalAlpha=(.14+gather*.12+release*.3)*w;c.fillStyle=i%2?'#d4d3ff':color;
      c.beginPath();c.moveTo(rootX,rootY);c.quadraticCurveTo(tipX-side*8,rootY-24,tipX,tipY);c.quadraticCurveTo(tipX+side*8,rootY-12,rootX,rootY);c.fill();
    }
    for(let i=0;i<20;i++){
      const a=i*2.399+t*.36,r=21+(i%6)*8+echo*20,x=529+Math.cos(a)*r,y=82+Math.sin(a)*r*.6;
      stroke(c,[[x,y],[x-Math.sin(a)*6,y+Math.cos(a)*3]],'#e1deff',(.12+echo*.4)*w,1.2);
    }
    radial(c,528,88,70,color,release*.2*w);
    for(let i=0;i<3;i++){
      c.globalAlpha=echo*.3*w;c.strokeStyle='#dddfff';c.lineWidth=1.2;c.beginPath();
      c.ellipse(530,87,59+i*17,24+i*7,-.4, t*.25+i, t*.25+i+Math.PI*1.2);c.stroke();
    }
  }
}
