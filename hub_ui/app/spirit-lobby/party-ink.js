// Small, crisp canvas props shared by the finite party animations.
import {ellipse,TAU} from './paint.js';
export function star(c,x,y,r,color,turn=0){
  c.save();c.translate(x,y);c.rotate(turn);c.beginPath();
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,q=i%2?r*.43:r;c.lineTo(Math.cos(a)*q,Math.sin(a)*q);}c.closePath();c.fillStyle=color;c.fill();c.restore();
}
export function duck(c,x,y,size,color,phase=0,mirror=false){
  c.save();c.translate(x,y);c.scale((mirror?-1:1)*size,size);
  ellipse(c,0,0,24,16,'#ffd744');ellipse(c,13,-16,13,13,'#ffe567');
  c.fillStyle='#ff9c31';c.beginPath();c.moveTo(23,-18);c.lineTo(38,-12);c.lineTo(24,-8);c.fill();
  ellipse(c,17,-19,2.3,2.3,'#152744');c.save();c.translate(-3,0);c.rotate(Math.sin(phase)*.24);ellipse(c,0,0,14,7,'#f6ae32');c.restore();
  c.fillStyle=color;c.beginPath();c.moveTo(4,-27);c.lineTo(14,-49);c.lineTo(24,-27);c.closePath();c.fill();star(c,14,-49,4,'#fff6dc');
  c.strokeStyle='#fff8b5';c.lineWidth=2;c.beginPath();c.arc(-5,-4,11,Math.PI,Math.PI*1.6);c.stroke();c.restore();
}
export function record(c,x,y,r,color,turn){
  c.save();c.translate(x,y);c.rotate(turn);ellipse(c,0,0,r,r,'#11172a');
  c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.arc(0,0,r-1,0,TAU);c.stroke();
  c.strokeStyle='#70809055';c.lineWidth=1;for(let q=.5;q<.94;q+=.1){c.beginPath();c.arc(0,0,r*q,0,TAU);c.stroke();}
  ellipse(c,0,0,r*.34,r*.34,color);ellipse(c,0,0,3,3,'#10192a');
  c.strokeStyle='#e3ffffaa';c.lineWidth=3;c.beginPath();c.arc(0,0,r*.78,-.8,-.2);c.stroke();c.restore();
}
