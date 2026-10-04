// Toy-plasma motion stays on the perimeter and follows the original zap clock.
function piuwBorder(c,t,d,e){
 const {p,line,curve,disc,ring,burst}=spamInk(c,t,d,e);
 const aqua='#9ff8ed',pink='#ff97c9',gold='#ffe19f',ice='#efffff';
 const power=Math.sin(Math.PI*p)**.6;
 const orbit=pathOf([[28,210],[354,55],[1529,55],[1892,211],[1892,824],[1544,1025],[379,1025],[28,815],[28,210]]);
 curve(orbit,aqua,10,.10*power);curve(orbit,pink,3,.38*power);
 // Counter-traveling ribbons with bright cores, tapered tails and spark debris.
 for(let k=0;k<3;k++){
  const head=(p*1.14+k/3)%1;
  for(let j=0;j<28;j++){
   const u=(head-j*.004+1)%1,v=(u+.004)%1;
   if(v<u)continue;
   const alpha=(1-j/28)**1.4*power;
   line([orbit(u),orbit(v)],k%2?pink:aqua,12,alpha*.16);
   line([orbit(u),orbit(v)],k%2?pink:aqua,4,alpha*.9);
   line([orbit(u),orbit(v)],ice,1.3,alpha*.85);
  }
  const[x,y]=orbit(head);ring(x,y,10,10,gold,2,power);
  for(let j=0;j<7;j++){
   const a=j*TAU/7+p*8,r=15+j%3*6;
   line([[x+Math.cos(a)*r,y+Math.sin(a)*r],[x+Math.cos(a)*(r+6),y+Math.sin(a)*(r+6)]],pink,2,power*.75);
  }
 }
 for(const[x,y]of [[156,239],[1761,226],[1783,889],[149,885]]){
  for(let j=0;j<3;j++){
   const age=(p*1.6+j/3)%1,r=12+age*76;
   ring(x,y,r,r*.48,j%2?pink:aqua,2.6,power*(1-age)*.65,j*.35+p*.3);
  }
  burst(x,y,(p-.2)/.7,gold,10,58);
 }
 // Laser interference zigzags shimmer between the cast, never across the center.
 for(const y of [128,934])for(let j=0;j<22;j++){
  const x=405+j*49,yy=y+Math.sin(j*.8-p*15)*8;
  line([[x,yy],[x+12,yy-7],[x+25,yy+3],[x+37,yy-5]],j%2?aqua:pink,1.7,power*.38);
 }
 for(let j=0;j<42;j++){
  const side=j%2,age=(p*1.7+j*.137)%1,x=(side?1871:47)+Math.sin(j*2+age*7)*25,y=190+j%21*32-age*24;
  disc(x,y,1.6+Math.sin(j)**2,1.6,j%3?gold:ice,power*(1-age)*.85);
 }
}
