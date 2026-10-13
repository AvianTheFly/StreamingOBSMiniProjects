// Frozen pre-preparation painter for finite visual equivalence checks.
// Stateless, pixel-aligned display furniture. Callers own geometry and materials.
export function drawDisplayFrame(c,rect,{dark='#302014',metal='#bd8a42',light='#f7d991',accent='#5fd9df'}={}){
 const [x,y,w,h]=rect,p=18;
 c.save();
 c.shadowColor='#000b';c.shadowBlur=16;c.shadowOffsetY=8;
 c.fillStyle=dark;c.fillRect(x-p,y-p,w+2*p,h+2*p);
 c.shadowBlur=0;c.shadowOffsetY=0;
 const gold=c.createLinearGradient(0,y-p,0,y+h+p);
 gold.addColorStop(0,light);gold.addColorStop(.07,metal);gold.addColorStop(.45,dark);gold.addColorStop(.94,metal);gold.addColorStop(1,light);
 c.strokeStyle=gold;c.lineWidth=8;c.strokeRect(x-11,y-11,w+22,h+22);
 c.strokeStyle=light;c.lineWidth=1;c.strokeRect(x-16.5,y-16.5,w+33,h+33);
 c.strokeStyle=metal;c.lineWidth=2;c.strokeRect(x-2,y-2,w+4,h+4);
 // Small inlaid corner diamonds stay outside the usable picture.
 for(const [xx,yy] of [[x-10,y-10],[x+w+10,y-10],[x-10,y+h+10],[x+w+10,y+h+10]]){
  c.fillStyle=dark;c.strokeStyle=light;c.lineWidth=1.5;c.beginPath();c.moveTo(xx,yy-7);c.lineTo(xx+7,yy);c.lineTo(xx,yy+7);c.lineTo(xx-7,yy);c.closePath();c.fill();c.stroke();
  c.fillStyle=accent;c.fillRect(xx-1.5,yy-1.5,3,3);
 }
 c.fillStyle='#070b12';c.fillRect(x,y,w,h);c.restore();
}
