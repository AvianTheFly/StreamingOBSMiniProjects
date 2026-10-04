// Continuous deformation of intact painted anatomy. This is a small bounded
// triangle mesh, not a frame cycle or a collection of disconnected limbs.
export class SpriteMesh {
 fromImage(image,cols=10,rows=12){this.image=image;this.cols=cols;this.rows=rows;return this;}
 async load(file,cell=null){
  const image=new Image();image.src=`./assets/${file}.png`;await image.decode();
  const source=document.createElement('canvas'),cols=cell?2:1,rows=cell?2:1;
  source.width=image.width/cols;source.height=image.height/rows;
  const c=source.getContext('2d',{willReadFrequently:true});
  c.drawImage(image,cell?cell[0]*source.width:0,cell?cell[1]*source.height:0,source.width,source.height,0,0,source.width,source.height);
  const d=c.getImageData(0,0,source.width,source.height).data;let left=source.width,top=source.height,right=0,bottom=0;
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(d[(y*source.width+x)*4+3]>20){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  this.image=document.createElement('canvas');this.image.width=right-left+1;this.image.height=bottom-top+1;
  this.image.getContext('2d').drawImage(source,left,top,this.image.width,this.image.height,0,0,this.image.width,this.image.height);
  this.cols=12;this.rows=16;return this;
 }
 draw(c,deform,{from=0,to=1}={}){
  const w=this.image.width,h=this.image.height,n=this.cols,m=this.rows;
  const vertex=(x,y)=>({s:[x/n*w,y/m*h],d:deform(x/n,y/m)});
  const grid=Array.from({length:m+1},(_,y)=>Array.from({length:n+1},(_,x)=>vertex(x,y)));
  for(let y=Math.ceil(from*m);y<Math.floor(to*m);y++)for(let x=0;x<n;x++){
   this.triangle(c,grid[y][x],grid[y][x+1],grid[y+1][x]);
   this.triangle(c,grid[y+1][x+1],grid[y+1][x],grid[y][x+1]);
  }
 }
 triangle(c,a,b,d){
  const sx=b.s[0]-a.s[0],sy=d.s[1]-a.s[1];
  const xx=(b.d[0]-a.d[0])/sx,xy=(b.d[1]-a.d[1])/sx;
  const yx=(d.d[0]-a.d[0])/sy,yy=(d.d[1]-a.d[1])/sy;
  c.save();c.transform(xx,xy,yx,yy,a.d[0]-xx*a.s[0]-yx*a.s[1],a.d[1]-xy*a.s[0]-yy*a.s[1]);
  // Tiny source-space overlap prevents antialias cracks between triangles.
  const cx=(a.s[0]+b.s[0]+d.s[0])/3,cy=(a.s[1]+b.s[1]+d.s[1])/3;
  c.beginPath();[a,b,d].forEach((v,i)=>{const dx=v.s[0]-cx,dy=v.s[1]-cy,k=.6/Math.hypot(dx,dy);i?c.lineTo(v.s[0]+dx*k,v.s[1]+dy*k):c.moveTo(v.s[0]+dx*k,v.s[1]+dy*k);});c.closePath();c.clip();
  c.drawImage(this.image,0,0);c.restore();
 }
}
