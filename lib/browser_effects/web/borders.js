// Original vector props driven by the original clip's audio clock.
// Every drawing stays outside the central gameplay rectangle.
export class BorderShow{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');}
 clear(){this.c.clearRect(0,0,1920,1080);}
 star(x,y,r,color,angle=0){
  const c=this.c;c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=color;c.beginPath();
  for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.42:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();c.restore();
 }
 draw(t,duration,effect){
  this.clear();const c=this.c,style=effect.style,color=effect.color||'#ffd470',beat=t*(effect.bpm||126)/60;
  c.save();c.beginPath();c.rect(0,0,1920,1080);c.rect(240,170,1440,670);c.clip('evenodd');
  const fade=Math.min(1,t/.09,Math.max(0,(duration-t)/.18)),pulse=(Math.sin(beat*Math.PI*2)+1)/2;
  c.globalAlpha=fade;c.strokeStyle=color;c.lineWidth=style==='arena'?5:3;c.shadowColor=color;c.shadowBlur=12;
  for(const [x,y,dx,dy]of [[20,20,1,1],[1900,20,-1,1],[20,1060,1,-1],[1900,1060,-1,-1]]){
   c.beginPath();c.moveTo(x+dx*(100+pulse*30),y);c.lineTo(x,y);c.lineTo(x,y+dy*90);c.stroke();
  }c.shadowBlur=0;
  if(style==='arena')this.arena(t,pulse,color);
  else if(['disco','coffin','party','crabs','balloons','rats','raccoon','shades','racing','equalizer','cats'].includes(style))this.celebration(t,pulse,color,style);
  else{
   for(let i=0;i<40;i++){
    const side=i%4,along=(i*97+t*(style==='oops'?180:80))%1000;
    const x=side<2?(side?1870:50):70+along*1.78,y=side<2?30+along:(side===2?38:1042);
    if(style==='confetti'){c.save();c.translate(x,y);c.rotate(t*3+i);c.fillStyle=i%2?color:'#ff98d0';c.fillRect(-4,-8,8,16);c.restore();}
    else this.star(x,y,style==='sparkles'?8+pulse*8:5,color,t+i);
   }
   for(const [x,y,flip]of [[115,115,1],[1805,115,-1],[115,970,1],[1805,970,-1]]){
    c.save();c.translate(x,y);c.scale(flip,1);
    if(style==='bonk')this.mallet(t,color);
    else if(style==='oops')this.face(t,color);
    else{this.star(0,0,44+pulse*8,color,Math.sin(t*3)*.18);c.fillStyle='#1e2039';c.beginPath();c.arc(-12,-5,3,0,7);c.arc(12,-5,3,0,7);c.fill();c.beginPath();c.arc(0,6,12,0,Math.PI);c.lineWidth=3;c.strokeStyle='#1e2039';c.stroke();}
    c.restore();
   }
  }
  if(effect.label){
   c.save();c.textAlign='center';c.font='900 35px Arial';c.lineWidth=7;c.strokeStyle='#11182b';c.fillStyle=color;
   c.strokeText(effect.label,960,63,1100);c.fillText(effect.label,960,63,1100);c.restore();
  }c.restore();
 }
 celebration(t,pulse,color,style){
  const c=this.c;
  // Props and trails live in the clipped perimeter; audio time drives every move.
  const props={disco:'🪩',coffin:'⚰️',party:'🎉',crabs:'🦀',balloons:'🎈',rats:'🐀',raccoon:'🦝',shades:'😎',racing:'🏎️',equalizer:'⚡',cats:'🐈'};
  const speed=style==='racing'?340:style==='coffin'?55:95;
  for(let i=0;i<28;i++){
   const side=i%4,along=(i*137+t*speed)%1000;
   const x=side<2?(side?1872:48):70+along*1.78,y=side<2?35+along:(side===2?35:1045);
   c.fillStyle=i%3===0?'#ffffff':color;
   if(style==='racing'){c.fillRect(x-22,y-3,44+35*pulse,6);}
   else if(style==='equalizer'){
    const h=12+65*(.5+.5*Math.sin(t*14+i));c.fillRect(x-5,y-h/2,10,h);
   }else if(style==='balloons'){
    c.beginPath();c.ellipse(x,y,10,14,Math.sin(i)*.2,0,7);c.fill();
    c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.moveTo(x,y+14);c.quadraticCurveTo(x+12,y+25,x,y+40);c.stroke();
   }else if(style==='party'){
    c.save();c.translate(x,y);c.rotate(t*3+i);c.fillRect(-4,-7,8,14);c.restore();
   }else this.star(x,y,4+pulse*5,color,t+i);
  }
  for(let i=0;i<8;i++){
   const x=i<4?115+(i%4)*563:(i%2?1805:115);
   const y=i<4?(i%2?980:100):350+Math.floor((i-4)/2)*365;
   c.save();c.translate(x,y+Math.sin(t*6+i)*12);
   c.rotate(style==='racing'?0:Math.sin(t*5+i)*.16);
   if(style==='disco'){
    c.strokeStyle=color;c.lineWidth=2;
    for(let j=0;j<6;j++){const a=t+j*Math.PI/3;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*100,Math.sin(a)*65);c.stroke();}
   }
   if(style==='coffin'){c.rotate(-.2+pulse*.4);}
   c.font=`${64+pulse*8}px "Segoe UI Emoji"`;c.textAlign='center';c.textBaseline='middle';
   c.fillText(props[style],0,0);
   if(['crabs','rats','raccoon','cats'].includes(style)){
    c.fillStyle=color;c.font='bold 24px Arial';c.fillText(i%2?'♫':'♪',48,-32-pulse*15);
   }
   if(style==='shades'){this.star(-45,-28,10+pulse*5,'#ffffff',t);}
   c.restore();
  }
 }
 mallet(t,color){
  const c=this.c,hit=Math.sin(Math.min(1,t/.22)*Math.PI);c.save();c.rotate(-.5+hit*.9);
  c.strokeStyle='#1c2233';c.lineWidth=5;c.fillStyle='#c19054';c.fillRect(-8,-35,16,100);c.strokeRect(-8,-35,16,100);
  c.fillStyle=color;c.fillRect(-42,-65,84,43);c.strokeRect(-42,-65,84,43);c.restore();
  for(let i=0;i<3;i++)this.star(45+i*14,25+i*8,7,color,t*5);
 }
 face(t,color){
  const c=this.c;c.save();c.rotate(Math.sin(t*12)*.08);c.fillStyle=color;c.beginPath();c.arc(0,0,49,0,7);c.fill();
  c.fillStyle='#172035';for(const x of [-17,17]){c.beginPath();c.ellipse(x,-8,5,9,0,0,7);c.fill();}
  c.beginPath();c.ellipse(0,21,10,14,0,0,7);c.fill();c.fillStyle='#7ce2ff';c.beginPath();c.ellipse(39,-29,7,13,.5,0,7);c.fill();c.restore();
 }
 arena(t,pulse,color){
  const c=this.c;c.strokeStyle=color;c.lineWidth=4;
  for(const x of [38,66,94,1826,1854,1882]){c.beginPath();c.moveTo(x,210);c.lineTo(x,870);c.stroke();}
  for(const y of [990,1018,1046]){c.beginPath();c.moveTo(240,y);c.lineTo(1680,y);c.stroke();}
  for(const x of [120,1800]){c.save();c.translate(x,115);c.rotate(Math.sin(t*5)*.08);c.fillStyle='#c49625';c.fillRect(-45,-24,90,48);c.fillStyle='#ffe49b';c.beginPath();c.ellipse(0,0,29+pulse*3,35,0,0,7);c.fill();c.fillStyle='#463919';c.font='900 20px Arial';c.textAlign='center';c.fillText('CHAMP',0,7);c.restore();}
 }
}
