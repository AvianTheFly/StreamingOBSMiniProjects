// Shared display geometry: perspective-project a texture onto each physical panel.
export const panels={
  main:[[710,239],[1205,239],[1211,429],[704,430]],
  left:[[48,374],[196,385],[209,448],[41,433]],
  right:[[1725,384],[1870,370],[1883,427],[1720,444]],
  booth:[[754,775],[1164,775],[1163,866],[755,866]],
};
function point(q,u,v){return [q[0][0]*(1-u)*(1-v)+q[1][0]*u*(1-v)+q[2][0]*u*v+q[3][0]*(1-u)*v,q[0][1]*(1-u)*(1-v)+q[1][1]*u*(1-v)+q[2][1]*u*v+q[3][1]*(1-u)*v];}
function triangle(c,image,s,d){
  const [[x0,y0],[x1,y1],[x2,y2]]=s,[[u0,v0],[u1,v1],[u2,v2]]=d;
  const den=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
  const a=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/den,b=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/den;
  const cc=((u2-u0)*(x1-x0)-(u1-u0)*(x2-x0))/den,dd=((v2-v0)*(x1-x0)-(v1-v0)*(x2-x0))/den;
  // Overlap subpixel clip edges to avoid diagonal hairlines in text and video.
  const mx=(u0+u1+u2)/3,my=(v0+v1+v2)/3,expanded=d.map(([x,y])=>{const length=Math.hypot(x-mx,y-my)||1;return [x+(x-mx)*1.2/length,y+(y-my)*1.2/length];});
  c.save();c.beginPath();expanded.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();
  c.transform(a,b,cc,dd,u0-a*x0-cc*y0,v0-b*x0-dd*y0);c.drawImage(image,0,0);c.restore();
}
export function paintPanel(c,image,target){
  const q=panels[target],w=image.width,h=image.height,n=4;
  c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  c.beginPath();q.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=x/n,v=y/n,uu=(x+1)/n,vv=(y+1)/n;
    const s=[[u*w,v*h],[uu*w,v*h],[uu*w,vv*h],[u*w,vv*h]],d=[point(q,u,v),point(q,uu,v),point(q,uu,vv),point(q,u,vv)];
    triangle(c,image,[s[0],s[1],s[2]],[d[0],d[1],d[2]]);triangle(c,image,[s[0],s[2],s[3]],[d[0],d[2],d[3]]);
  }c.restore();
}
