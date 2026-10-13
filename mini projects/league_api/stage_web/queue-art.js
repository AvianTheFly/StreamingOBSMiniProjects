// Material spirit relics and elemental tracks, sampled on the page-owned clock.
export const SPIRITS={bear:{name:'BEAR · THUNDER',color:'#91d9ff'},turtle:{name:'TURTLE · PROTECTION',color:'#86edcc'},ram:{name:'RAM · RESOLVE',color:'#ffc47d'},phoenix:{name:'PHOENIX · STORM',color:'#c5b9ff'}};
// Layered relics use vector facets, lit edges and a bounded orbital field.
function shape(c,points,fill,edge,alpha=1){
  c.globalAlpha=alpha;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  c.fillStyle=fill;c.fill();if(edge){c.strokeStyle=edge;c.lineWidth=.8;c.stroke();}
}
function crest(c,mode,t,color,intensity,opacity=1){
  const a=(.2+intensity*.6)*opacity;
  if(mode===0){
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4+t*.035,r=78+intensity*4;c.save();c.rotate(angle);
      shape(c,[[-5,-r],[0,-r-12],[5,-r],[0,-r+6]],color+'44',color,a);
      c.strokeStyle=color;c.globalAlpha=a*.6;c.lineWidth=.8;c.beginPath();c.moveTo(-9,-r+4);c.lineTo(0,-r-5);c.lineTo(9,-r+4);c.stroke();c.restore();
    }
  }else if(mode===1){
    for(const side of [-1,1])for(let i=0;i<9;i++){
      const y=59-i*13,x=side*(63+Math.sin(i/8*Math.PI)*14),spread=intensity*(3+Math.sin(t+i)*2);
      shape(c,[[x,y+8],[x+side*(10+spread),y-3],[x+side*8,y-12],[x-side*3,y]],i%2?color+'66':color+'22',color,a);
    }
    shape(c,[[-26,72],[0,80],[26,72],[19,85],[0,91],[-19,85]],color+'33',color,a);
  }else if(mode===2){
    for(let i=0;i<6;i++){
      const angle=i*Math.PI/3+Math.PI/6,r=76+intensity*5;c.save();c.rotate(angle);
      shape(c,[[-25,-r+3],[-18,-r-10],[18,-r-10],[25,-r+3],[16,-r+9],[-16,-r+9]],color+'26',color,a);
      shape(c,[[-14,-r],[0,-r-4],[14,-r],[0,-r+4]],color,null,a*.6);c.restore();
    }
  }else{
    for(let i=0;i<16;i++){
      const angle=i*Math.PI/8+t*.035,r=76,long=i%2?8:16;
      c.save();c.rotate(angle);shape(c,[[-3,-r],[0,-r-long-intensity*3],[3,-r],[0,-r+7]],i%2?color+'55':color+'99',color,a);c.restore();
    }
  }
}
function flourish(c,theme,cue,color,e){
  if(!cue||e<=0)return;
  const p=cue.phase,mode=cue.id%4,turn=p*Math.PI*2;
  c.save();c.strokeStyle=color;c.lineWidth=1;
  if(theme==='bear'){
    // A charged crown, paired claw engravings, flowing standards, or ice orbit.
    for(let i=0;i<6;i++){
      const side=i<3?-1:1,n=i%3;
      if(mode===0||mode===1){
        const x=side*(46+n*7),y=-48+n*13,reach=12+Math.sin(turn+n)*5;
        c.globalAlpha=e*.8;c.beginPath();c.moveTo(x,y);c.lineTo(x-side*6,y+reach*.4);c.lineTo(x+side*3,y+reach*.55);c.lineTo(x-side*5,y+reach);c.stroke();
      }else if(mode===2){
        c.globalAlpha=e*(.2+n*.14);c.beginPath();for(let j=0;j<=14;j++){const y=-50+j*7,x=side*(62+n*5+Math.sin(j*.3-turn+n*.4)*5);j?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
      }else{
        const a=turn*.4+i*Math.PI/3,x=Math.cos(a)*72,y=Math.sin(a)*72;
        shape(c,[[x,y-7],[x+4,y],[x,y+7],[x-4,y]],color+'66','#eafaff',e*.8);
      }
    }
    if(mode===0)shape(c,[[-24,-62],[-19,-73],[-8,-68],[0,-85],[8,-68],[19,-73],[24,-62]],color+'55',color,e*.85);
  }else if(theme==='turtle'){
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+(mode===3?turn*.18:0),r=62+e*10,x=Math.cos(a)*r,y=Math.sin(a)*r;
      c.save();c.translate(x,y);c.rotate(a+Math.PI/2);
      if(mode===0||mode===2){
        c.globalAlpha=e*.65;c.fillStyle=color+'55';c.beginPath();c.moveTo(0,10);c.bezierCurveTo(-14,0,-6,-14,0,-18-e*4);c.bezierCurveTo(6,-14,14,0,0,10);c.fill();c.stroke();
        c.beginPath();c.moveTo(0,9);c.lineTo(0,-12);c.stroke();
      }else if(mode===1)shape(c,[[-10,-8],[0,-14],[10,-8],[10,5],[0,11],[-10,5]],color+'22',color,e*.65);
      else {c.globalAlpha=e*.65;c.beginPath();c.ellipse(0,0,5,10+e*5,0,0,Math.PI*2);c.stroke();}
      c.restore();
    }
  }else if(theme==='ram'){
    for(const side of [-1,1])for(let i=0;i<5;i++){
      c.save();c.scale(side,1);
      const y=-40+i*22,x=60+Math.sin(i*.7)*10;
      if(mode===0||mode===2)shape(c,[[x,y-8],[x+11+e*5,y],[x,y+8],[x+4,y]],color+'55',color,e*(.4+i*.09));
      else if(mode===1){const angle=-2.6+i*.45+turn*.05;c.translate(42,-27);c.rotate(angle);shape(c,[[28,-3],[36,-5],[40,0],[36,5],[28,3]],color+'55',color,e*.85);}
      else {c.rotate(turn*.2);shape(c,[[x,y-5],[x+5,y],[x,y+5],[x-5,y]],color+'55',color,e*.75);}
      c.restore();
    }
    if(mode===1)shape(c,[[-20,68],[0,58],[20,68],[0,80]],color+'44','#fff0d0',e*.8);
  }else{
    for(const side of [-1,1])for(let i=0;i<5;i++){
      const a=side*(.65+i*.16),r=62+i*3,x=Math.sin(a)*r,y=-Math.cos(a)*r+(mode===2?Math.sin(turn+i)*7:0);
      c.save();c.translate(x,y);c.rotate(side*(.7+i*.15)+Math.sin(turn+i*.2)*.12);
      shape(c,[[0,13],[-4,-3],[0,-18-e*5],[4,-3]],color+'66','#ece6ff',e*(.3+i*.12));c.restore();
    }
    for(let i=-2;i<=2;i++){
      const sway=Math.sin(turn+i*.7)*(mode===3?10:4);c.globalAlpha=e*.6;c.beginPath();c.moveTo(i*4,48);c.quadraticCurveTo(i*12+sway,72,i*14+sway,88-Math.abs(i)*4);c.stroke();
      shape(c,[[i*14+sway,80-Math.abs(i)*4],[i*14+sway+3,85-Math.abs(i)*4],[i*14+sway,91-Math.abs(i)*4],[i*14+sway-3,85-Math.abs(i)*4]],color,null,e*.7);
    }
  }
  c.restore();
}
export function paintSpirit(canvas,theme,time=0,motion=true,energy=0,cue=null){
  const c=canvas.getContext('2d'),color=SPIRITS[theme].color,t=motion?time:0,e=motion?energy:0;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);c.save();c.scale(canvas.width/200,canvas.height/200);c.translate(100,100);
  const glow=c.createRadialGradient(0,0,4,0,0,92);glow.addColorStop(0,color+'40');glow.addColorStop(.5,color+'18');glow.addColorStop(1,'transparent');c.fillStyle=glow;c.fillRect(-100,-100,200,200);
  c.lineCap='round';
  const primary={bear:0,turtle:2,ram:1,phoenix:3}[theme];
  crest(c,primary,t,color,.34+e*.38);
  if(motion&&cue&&cue.id%4!==primary)crest(c,cue.id%4,-t,color,e*.65,e);
  for(let band=0;band<3;band++){
    const r=73+band*8,spin=t*(band%2?-.08:.05);
    c.strokeStyle=color;c.lineWidth=band===1?1.4:.6;c.globalAlpha=.22+band*.1;
    for(let i=0;i<4;i++){const a=i*Math.PI/2+spin+band*.3;c.beginPath();c.arc(0,0,r,a,a+.87);c.stroke();}
  }
  for(let i=0;i<40;i++){
    const a=i*Math.PI/20,r=88,length=i%5===0?7:2;
    c.globalAlpha=i%5===0?.55:.2;c.strokeStyle=color;c.lineWidth=.7;c.beginPath();c.moveTo(Math.cos(a)*r,Math.sin(a)*r);c.lineTo(Math.cos(a)*(r-length),Math.sin(a)*(r-length));c.stroke();
  }
  for(let i=0;i<6;i++){
    const a=t*.18+i*Math.PI/3,r=77+Math.sin(t*.5+i)*4,x=Math.cos(a)*r,y=Math.sin(a)*r;
    shape(c,[[x,y-2.7],[x+2.7,y],[x,y+2.7],[x-2.7,y]],color,null,.65+e*.3);
  }
  c.save();c.translate(Math.sin(t*.7)*e*2,Math.sin(t*.8)*2-e*2);c.rotate(Math.sin(t*.45)*.025+Math.sin((cue?.phase||0)*Math.PI*2)*e*.04);c.scale(1+e*.065,1+e*.065);
  const metal=c.createLinearGradient(-50,-55,45,64);metal.addColorStop(0,color);metal.addColorStop(.35,theme==='ram'?'#ad7441':theme==='turtle'?'#257d68':theme==='phoenix'?'#65539d':'#397f9f');metal.addColorStop(.65,'#101f32');metal.addColorStop(1,color+'99');
  if(theme==='bear'){
    const face=[[-55,-28],[-54,-53],[-34,-60],[-21,-43],[0,-47],[21,-43],[34,-60],[54,-53],[55,-28],[45,23],[21,54],[0,64],[-21,54],[-45,23]];
    shape(c,face,metal,color,.95);
    for(const side of [-1,1]){
      shape(c,[[0,-47],[side*21,-43],[side*46,-24],[side*17,-4],[0,7]],side<0?'#b6ebff':'#295570',color,.5);
      shape(c,[[side*46,-24],[side*45,23],[side*21,54],[side*15,16],[side*17,-4]],'#0e3048',color,.8);
      shape(c,[[side*39,-6],[side*15,1],[side*20,7],[side*32,5]],'#e5faff',null,.95);
      shape(c,[[side*50,-49],[side*35,-51],[side*30,-39]],'#082239',color,.8);
    }
    shape(c,[[-15,16],[0,7],[15,16],[13,35],[0,47],[-13,35]],'#478baa',color,.9);
    shape(c,[[-9,18],[9,18],[0,27]],'#061725','#c1efff',1);
    shape(c,[[3,-39],[-8,-15],[3,-18],[-3,-3],[13,-27],[2,-24]],'#e5faff',null,.8+e*.2);
  }else if(theme==='turtle'){
    const pulse=Math.sin(t*.6)*.03+1;c.scale(pulse,pulse);
    for(const side of [-1,1])for(const y of [-25,28])shape(c,[[side*36,y],[side*63,y+12],[side*55,y+27],[side*34,y+16]],metal,color,.65);
    shape(c,[[-9,-49],[-10,-64],[0,-72],[10,-64],[9,-49]],metal,color,.95);
    shape(c,[[-48,-28],[0,-58],[48,-28],[45,30],[0,61],[-45,30]],metal,color,.9);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3-Math.PI/2,b=a+Math.PI/3;
      const split=e*(6+Math.sin(t+i)*3);c.save();c.translate(Math.cos(a+Math.PI/6)*split,Math.sin(a+Math.PI/6)*split);
      shape(c,[[Math.cos(a)*22,Math.sin(a)*25],[Math.cos(b)*22,Math.sin(b)*25],[Math.cos(b)*49,Math.sin(b)*54],[Math.cos(a)*49,Math.sin(a)*54]],i%2?'#1a514d':'#57af91',color,.55+.15*Math.sin(t+i)**2);c.restore();
    }
    const gem=[];for(let i=0;i<6;i++)gem.push([Math.cos(i*Math.PI/3)*24,Math.sin(i*Math.PI/3)*27]);shape(c,gem,'#071f25','#c5ffdc',1);
    for(let i=0;i<3;i++)shape(c,[[0,-20+i*12],[12,-10+i*12],[0,-2+i*12],[-12,-10+i*12]],'#bbffe1',null,.75-i*.16);
  }else if(theme==='ram'){
    for(const side of [-1,1]){
      c.save();c.scale(side,1);c.translate(e*4,-e*3);c.rotate(e*.035);c.globalAlpha=1;c.fillStyle=metal;c.strokeStyle=color;c.lineWidth=1.1;c.beginPath();c.moveTo(7,-18);c.bezierCurveTo(38,-76,81,-52,64,-9);c.bezierCurveTo(52,20,15,9,24,-15);c.bezierCurveTo(30,-34,50,-26,45,-14);c.bezierCurveTo(67,-40,37,-49,21,-10);c.closePath();c.fill();c.stroke();
      for(let i=0;i<7;i++){const a=-2.5+i*.37;c.globalAlpha=.5;c.beginPath();c.moveTo(43+Math.cos(a)*23,-27+Math.sin(a)*22);c.lineTo(43+Math.cos(a+.04)*15,-27+Math.sin(a+.04)*15);c.stroke();}c.restore();
    }
    shape(c,[[-22,-24],[0,-34],[22,-24],[25,17],[0,63],[-25,17]],metal,color,1);
    shape(c,[[0,-34],[0,63],[-25,17],[-22,-24]],'#e1a567',color,.35);
    for(const s of [-1,1])shape(c,[[s*18,-2],[s*6,4],[s*10,9],[s*17,6]],'#fff1d0',null,1);
    shape(c,[[-9,30],[0,36],[9,30],[0,49]],'#322116','#ffdcaa',.95);
  }else{
    for(const s of [-1,1])for(let i=7;i>=0;i--){
      const lift=Math.sin(t*1.4+i*.15)*(7+e*4),tipX=s*(29+i*5.8+e*3),tipY=-63+i*8+lift;
      c.globalAlpha=.62+i*.04;c.fillStyle=metal;c.strokeStyle=i%2?'#e5dfff':color;c.lineWidth=.7;c.beginPath();c.moveTo(s*3,28-i*2);c.bezierCurveTo(s*24,7,tipX-s*3,-13,tipX,tipY);c.quadraticCurveTo(tipX+s*5,26,s*3,43-i*2);c.fill();c.stroke();
    }
    shape(c,[[0,-40],[12,-48],[6,-28],[0,27],[-7,5],[-5,-24]],'#ede9ff',color,.95);
    for(let i=-1;i<=1;i++)shape(c,[[i*7,22],[i*17,48],[i*10,68],[0,42]],metal,color,.85);
  }
  c.restore();
  flourish(c,theme,cue,color,e);
  // Engraved energy moves across the insignia itself, without covering its face.
  if(e>0)for(let i=0;i<3;i++){
    const a=t*.45+i*Math.PI*2/3;c.globalAlpha=e*.65;c.strokeStyle='#effaff';c.lineWidth=1;c.beginPath();c.arc(0,0,67+i*3,a,a+.45+e*.35);c.stroke();
  }
  // Tiny engraved diamonds anchor the moving relic to its frame.
  for(const y of [-94,94])shape(c,[[0,y-3],[5,y],[0,y+3],[-5,y]],color,null,.65);
  c.restore();
}
export function paintTrack(canvas,frame,time=0,motion=true){
  const c=canvas.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);c.save();c.scale(canvas.width/604,canvas.height/20);
  const t=motion?time:0;
  function draw(theme,w){
    const color=SPIRITS[theme].color,energy=motion&&theme===frame.to?(frame.cue?.amount||0):0;
    c.strokeStyle=color;c.lineWidth=.65;c.globalAlpha=.22*w;c.beginPath();c.moveTo(146,7);c.lineTo(584,7);c.moveTo(146,13);c.lineTo(584,13);c.stroke();
    for(let i=0;i<44;i++){const x=150+i*10;c.globalAlpha=(i%5===0?.4:.14)*w;c.fillStyle=color;c.fillRect(x,15,i%5===0?4:1,1);}
    for(let lane=0;lane<3;lane++){
      c.globalAlpha=(.16+lane*.12)*w;c.lineWidth=lane===2?1.3:.7;c.beginPath();
      for(let x=147;x<=585;x+=3){
        let wave;if(theme==='bear')wave=Math.sin(x*.21-t*2+lane)*Math.sin(x*.057+t)*2.7;
        else if(theme==='turtle')wave=Math.sin(x*.035-t*1.4+lane*.65)*2.6;
        else if(theme==='ram')wave=(Math.abs(((x+t*14+lane*7)%38)/19-1)-.5)*5;
        else wave=Math.sin(x*.05-t*2+lane)*Math.sin(x*.013+t*.3)*3.1;
        const y=10+wave*(1+energy*.3);x===147?c.moveTo(x,y):c.lineTo(x,y);
      }c.stroke();
    }
    for(let i=0;i<3;i++){
      const x=150+((t*25+i*145)%432),size=1.7+(i===0?energy*1.4:0);
      c.globalAlpha=(.7-i*.17)*w;c.fillStyle='#e8faff';c.beginPath();c.moveTo(x-size,10);c.lineTo(x,10-size);c.lineTo(x+size,10);c.lineTo(x,10+size);c.closePath();c.fill();
    }
    shape(c,[[139,6],[143,10],[139,14],[135,10]],color,null,w*.75);
  }
  if(frame.from!==frame.to&&frame.mix<1)draw(frame.from,1-frame.mix);draw(frame.to,frame.from===frame.to?1:frame.mix);c.restore();
}
