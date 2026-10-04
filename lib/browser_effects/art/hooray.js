// Hooray's transparent foil celebration. Pure audio-time drawing: no timer,
// bitmap background, chroma key, audio source, or mutable particle simulation.
const HOORAY_COLORS=['#ffc85e','#ff6b89','#78c9ff','#bd97ff','#fff2cb'];
function hoorayNoise(n){const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);}
const HOORAY_PAPER=Array.from({length:480},(_,i)=>{
 const r=n=>hoorayNoise(i*13+n),side=i%2,shower=i>=352;
 return {side,shower,birth:shower?r(1)*.32:Math.floor(i/88)*.045,
  x:shower?r(2)*1920:side?1832:88,y:shower?-100-r(3)*190:1010,
  vx:shower?(r(4)-.5)*120:(side?-1:1)*(100+r(4)*590),
  vy:shower?180+r(5)*180:-760-r(5)*470,gravity:shower?115:620+r(6)*130,
  size:5+r(7)*7,spin:r(8)*Math.PI*2,speed:2+r(9)*7,
  color:HOORAY_COLORS[i%HOORAY_COLORS.length],ribbon:i%23===0,star:i%17===0};
});
function hoorayStar(c,x,y,r){
 c.beginPath();for(let j=0;j<8;j++){const a=j*Math.PI/4-Math.PI/2,s=j%2?r*.24:r;const px=x+Math.cos(a)*s,py=y+Math.sin(a)*s;j?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.fill();
}
function hoorayFrame(c,t,p){
 // Two intertwined satin strands skim the outside; the picture has no matte.
 const arrive=smooth(p/.10),depart=smooth((1-p)/.22);c.save();c.globalAlpha*=arrive*depart;
 for(let edge=0;edge<4;edge++){
  const vertical=edge<2,length=vertical?970:1760;
  for(let strand=0;strand<2;strand++){
   c.beginPath();for(let j=0;j<=80;j++){
    const u=j/80,z=length*u,wave=Math.sin(u*Math.PI*8+t*1.7+strand*Math.PI)*10;
    const inset=27+wave,x=vertical?(edge===0?inset:1920-inset):80+z;
    const y=vertical?55+z:(edge===2?inset:1080-inset);
    j?c.lineTo(x,y):c.moveTo(x,y);
   }
   c.strokeStyle=strand?'#ffe9a3':'#d99438';c.lineWidth=strand?1.7:4;c.stroke();
  }
 }
 for(let k=0;k<36;k++){
  const edge=k%4,u=hoorayNoise(k+55),vertical=edge<2;
  const x=vertical?(edge?1890:30):85+u*1750,y=vertical?60+u*960:(edge===2?30:1050);
  const pulse=Math.max(0,Math.sin(t*5+k*2.3))**6;c.globalAlpha=arrive*depart*(.25+.75*pulse);
  c.fillStyle='#fff5d6';hoorayStar(c,x,y,3+pulse*7);
 }
 c.restore();
}
function hoorayPoppers(c,p){
 c.save();c.globalAlpha*=smooth(p/.035)*smooth((.72-p)/.20);
 for(let side=0;side<2;side++){
  c.save();c.translate(side?1832:88,1010);c.rotate(side?-.6:.6);
  const foil=c.createLinearGradient(-32,0,32,0);foil.addColorStop(0,'#93411e');foil.addColorStop(.28,'#ffd277');foil.addColorStop(.52,'#fff0bf');foil.addColorStop(1,'#be6337');
  c.fillStyle=foil;c.beginPath();c.moveTo(-31,-7);c.lineTo(31,-7);c.lineTo(20,91);c.lineTo(-20,91);c.closePath();c.fill();
  c.strokeStyle='#e96683';c.lineWidth=8;for(let j=0;j<4;j++){c.beginPath();c.moveTo(-26+j*1.4,10+j*20);c.lineTo(26-j*1.4,26+j*20);c.stroke();}
  c.fillStyle='#503546';c.beginPath();c.ellipse(0,-7,32,10,0,0,Math.PI*2);c.fill();
  c.strokeStyle='#ffe3a0';c.lineWidth=3;c.stroke();
  c.restore();
 }
 c.restore();
}
function hoorayPaper(c,t,p){
 for(const bit of HOORAY_PAPER){
  if(p<bit.birth)continue;
  const age=(p-bit.birth)*3.25,fade=smooth(age/.055)*smooth((1-p)/.19);
  const x=bit.x+bit.vx*age+Math.sin(age*5+bit.spin)*12;
  const y=bit.y+bit.vy*age+.5*bit.gravity*age*age;
  if(x<-90||x>2010||y<-130||y>1200)continue;
  c.save();c.globalAlpha*=fade;c.translate(x,y);c.rotate(bit.spin+age*bit.speed);
  c.fillStyle=bit.color;c.strokeStyle=bit.color;
  if(bit.ribbon){
   c.lineWidth=4;c.lineCap='round';c.beginPath();
   for(let j=0;j<=24;j++){const z=j/24*95,a=z*.105+age*4,xx=Math.sin(a)*12;j?c.lineTo(xx,z):c.moveTo(xx,z);}c.stroke();
   c.globalAlpha*=.5;c.strokeStyle='#fff6dd';c.lineWidth=1;c.stroke();
  }else if(bit.star){hoorayStar(c,0,0,bit.size);}
  else{
   const fold=Math.cos(age*bit.speed+bit.spin),w=bit.size*(.16+.84*Math.abs(fold)),h=bit.size*.62;
   c.beginPath();c.moveTo(-w,-h);c.lineTo(w,-h*.72);c.lineTo(w*.8,h);c.lineTo(-w,h*.66);c.closePath();c.fill();
   c.fillStyle=fold>0?'#fff8e0':'#61435d';c.globalAlpha*=fold>0?.48:.20;
   c.beginPath();c.moveTo(-w,-h);c.lineTo(w,-h*.72);c.lineTo(-w,h*.66);c.closePath();c.fill();
  }
  c.restore();
 }
}
export class HoorayShow{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.ready=Promise.resolve();}
 clear(){this.c.clearRect(0,0,1920,1080);}
 draw(t,duration){
  this.clear();if(!Number.isFinite(t)||!Number.isFinite(duration)||duration<=0||t<=0||t>=duration)return;
  const c=this.c,p=t/duration;c.save();
  hoorayFrame(c,t,p);hoorayPoppers(c,p);hoorayPaper(c,t,p);c.restore();
 }
}
