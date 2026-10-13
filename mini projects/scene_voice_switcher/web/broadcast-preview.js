// Private gallery stand-ins only; no live camera, chat, queue or capture access.
export function previewHost(c,rect){
 const [x,y,w,h]=rect;c.save();c.beginPath();c.rect(...rect);c.clip();
 const cx=x+w/2,head=y+h*.24,r=w*.18;
 c.fillStyle='#d8b297';c.beginPath();c.ellipse(cx,head,r,r*1.22,0,0,Math.PI*2);c.fill();
 c.fillStyle='#252d44';c.beginPath();c.ellipse(cx,head-r*.7,r*1.04,r*.65,0,Math.PI,Math.PI*2);c.fill();
 c.fillStyle='#354961';c.beginPath();c.moveTo(x+w*.08,y+h);c.quadraticCurveTo(x+w*.03,head+r*1.6,cx,head+r*1.35);c.quadraticCurveTo(x+w*.97,head+r*1.6,x+w*.92,y+h);c.closePath();c.fill();
 c.strokeStyle='#a5dfd9';c.lineWidth=8;c.beginPath();c.arc(cx,head,r*1.2,Math.PI,0);c.stroke();
 c.fillStyle='#e8f9f6';c.font='15px system-ui';c.textAlign='center';c.fillText('CAMERA PREVIEW',cx,head+r*2.5);c.restore();
}
export function previewChat(c,rect,id){
 const [x,y,w,h]=rect;c.save();c.beginPath();c.rect(...rect);c.clip();
 const dark=id==='sanctuary'||id==='forge';c.fillStyle=dark?'rgba(26,23,16,.88)':'rgba(5,14,30,.8)';c.fillRect(x,y,w,h);
 c.font='bold 17px system-ui';c.fillStyle='#afe8db';c.fillText('PREVIEW CHAT',x+12,y+26);
 const rows=[['poro_patrol','wait... who gave the fish a fishing rod'],['boots_diff','the goose has better items than me'],['gg_leaf','one more game. surely.'],['ward_enjoyer','found another tiny disaster']];
 let py=y+64;for(const [name,msg] of rows){if(py+65>y+h)break;c.fillStyle='#edc48d';c.font='bold 16px system-ui';c.fillText(name,x+12,py);py+=23;c.font='16px system-ui';c.fillStyle='#f6f1e5';let line='';for(const word of msg.split(' ')){if(c.measureText(line+word).width>w-24){c.fillText(line,x+12,py);py+=22;line='';}line+=word+' ';}c.fillText(line,x+12,py);py+=38;}c.restore();
}
export function previewQueue(c){c.save();c.fillStyle='rgba(8,18,25,.88)';c.beginPath();c.roundRect(20,988,320,70,14);c.fill();c.fillStyle='#84e7cc';c.font='bold 19px system-ui';c.fillText('IN QUEUE',40,1017);c.fillStyle='#c4d3db';c.font='15px system-ui';c.fillText('Preview · waiting for the next adventure',40,1040);c.restore();}
export function previewMedia(c,rect){const [x,y,w,h]=rect;c.save();c.fillStyle='#101b29';c.fillRect(...rect);c.strokeStyle='#2c4257';c.lineWidth=1;for(let i=1;i<8;i++){c.beginPath();c.moveTo(x+i*w/8,y);c.lineTo(x+i*w/8,y+h);c.stroke();}c.fillStyle='#d6eee9';c.textAlign='center';c.font='26px system-ui';c.fillText('YOUR MEDIA CANVAS',x+w/2,y+h/2-14);c.font='18px system-ui';c.fillStyle='#9eafc2';c.fillText('Udyr · League client · Desktop · Chrome',x+w/2,y+h/2+23);c.restore();}
