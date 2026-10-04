const CHARACTER_CUES=new Set(['mash','balloons','rats','raccoon','shades','nyan']);
function characterCue(c,t,d,e){
 if(!CHARACTER_CUES.has(e.style))return false;
 const{p,beat,line,poly,disc,curve,halo,light,metal,ring,text}=cueInk(c,t,d,e),gold='#ebc98e',ice='#b6edf1',rose='#e3a8d1';
 c.save();c.globalAlpha*=smooth(t/.4)*smooth((d-t)/.5);
 if(e.style==='mash'){
  // A wizard's wand conducts gold ink in a rising, off-centre spell circle.
  c.save();c.translate(58,429);c.rotate(-.38+Math.sin(beat*.9)*.16);
  line([[0,58],[0,-49]],'#6c5444',10);line([[-2,57],[-2,-49]],gold,1.2,.8);
  poly([[-11,-42],[0,-67],[11,-42],[0,-28]],metal([-10,-65,10,-28],['#fff2b8','#ab8051','#ebbc71','#573f42']));halo(0,-49,38,gold,.52);c.restore();
  for(let j=0;j<4;j++){const fn=u=>[21+j*8+Math.sin(u*8+t*.3+j)*16,682-u*485];curve(fn,gold,.9,.24);light(fn,j%2?ice:gold,j*.17,.2,2.3);}
  c.save();c.translate(1120,55);c.rotate(t*.14);ring(0,0,43,43,gold,1.2,.65);ring(0,0,31,31,ice,.8,.35);for(let i=0;i<7;i++){const a=i*TAU/7;line([[Math.cos(a)*31,Math.sin(a)*31],[Math.cos(a+.12)*43,Math.sin(a+.12)*43]],gold,1.2,.7);}poly([[-15,0],[0,-19],[15,0],[0,19]],'#c9a36555');c.restore();
  for(let j=0;j<18;j++){const u=(t*.18+j*.618)%1;disc(1890+Math.sin(j+u*4)*22,680-u*470,1.2+j%2,1.2+j%2,gold,Math.sin(u*Math.PI));}
  text('BLING BANG',787,53,gold,27);
 }else if(e.style==='balloons'){
  // Iridescent helium lanterns ascend in three unequal bunches; foil knots glint.
  for(const[x,y,r,color,phase]of [[30,354,43,rose,0],[1892,519,53,'#a994e5',1],[33,635,28,gold,2]]){
   const yy=y-24*smooth(p)+Math.sin(t*.9+phase)*5;
   disc(x,yy,r,r*1.17,metal([x-r,yy-r,x+r,yy+r],['#f0e4fd',color,'#687190',color]),.82);
   ring(x,yy,r-3,r*1.17-3,'#f8efff',1,.5);curve(u=>[x-r*.36+Math.sin(u*1.1)*7,yy-r*.7+u*r*.49],'#fbffff',2,.62);
   poly([[x-4,yy+r*1.17],[x+4,yy+r*1.17],[x,yy+r*1.17+7]],color);
   curve(u=>[x+Math.sin(u*8-t*.6)*11,yy+r*1.17+7+u*95],color,.9,.63);
   const weightY=yy+r*1.17+107;halo(x,weightY,38,color,.42);
   poly([[x-15,weightY+10],[x-7,weightY-9],[x+7,weightY-9],[x+15,weightY+10]],metal([x-15,weightY-9,x+15,weightY+10],['#e8ddcb','#8f9ca9','#dbc9b0','#697f94']));
   line([[x-7,weightY-9],[x,weightY-17],[x+7,weightY-9]],'#e6d6c0',1.1,.8);
  }
  for(let j=0;j<21;j++){const u=(t*.15+j*.618)%1,x=370+j*54,y=13+Math.sin(j+t*.25)*10;poly([[x,y],[x+6,y-2],[x+8,y+7],[x+1,y+8]],[ice,rose,gold][j%3],.24+.58*Math.sin(u*Math.PI));}
  light(u=>[400+u*1060,1065-8*Math.sin(u*Math.PI)],rose,0,.16,2.2);
 }else if(e.style==='rats'){
  // A little silver rat dances on a service pipe; its cable tail draws the wake.
  c.save();c.translate(59,473+Math.sin(beat*Math.PI)*5);c.rotate(Math.sin(beat*1.2)*.08);
  curve(u=>[15+Math.sin(u*5+beat*.5)*21,15+u*112],rose,3,.75);
  for(const side of [-1,1])line([[side*12,25],[side*23,37+Math.sin(beat*2+side)*5]],'#7896a3',6);
  disc(0,8,23,30,metal([-23,-22,23,38]));disc(-18,-16,13,15,'#bccbd2');disc(18,-16,13,15,'#bccbd2');disc(-18,-17,8,9,'#ba9da8');disc(18,-17,8,9,'#ba9da8');disc(0,-3,22,21,'#b1c6ce');
  disc(-8,-7,2.5,3,'#243548');disc(8,-7,2.5,3,'#243548');disc(0,7,4,3,'#d0a6b9');for(const side of [-1,1])for(let i=0;i<3;i++)line([[side*7,8],[side*29,2+i*6]],ice,.8,.8);c.restore();
  for(const side of [0,1]){const x=side?1905:9;line([[x,197],[x,691]],'#5a777d',8,.74);line([[x-2,197],[x-2,691]],ice,1,.65);for(let j=0;j<6;j++){const yy=220+j*76;ring(x,yy,9,3,gold,1,.6);light(u=>[x,yy+u*64],ice,j*.17,.3,2);}}
  text('RAT DANCE',1010,48,'#cfebdd',28);
 }else if(e.style==='raccoon'){
  // A raccoon dance crew: different poses, scale, hats and phase for each dancer.
  const raccoon=(x,y,s,phase,accessory)=>{const arrive=smooth((p-phase*.018)/.1);c.save();c.globalAlpha*=arrive;c.translate(x,y+Math.sin(beat*Math.PI+phase)*8+(1-arrive)*13);c.scale(s*(1-.06*Math.sin(beat+phase)),s*(1+.03*Math.sin(beat+phase)));c.rotate(Math.sin(beat*1.7+phase)*.15);
  curve(u=>[-5-u*43,30+Math.sin(u*3+beat*.7+phase)*22],'#b2b2c0',16);for(let j=0;j<4;j++)disc(-10-j*9,33+Math.sin(j*.7+beat*.7+phase)*16,5,9,'#43526b',.8);
  disc(0,14,26,30,metal([-28,-12,28,38],['#d1c8bc','#a5a4b4','#5b687b','#c1bab4']));
  for(const side of [-1,1]){const yy=17-Math.sin(beat*2+phase+side)*20;line([[side*18,11],[side*37,yy]],'#afbac7',8);disc(side*39,yy,5,6,'#d7d5d0');line([[side*12,35],[side*21,48+Math.sin(beat*2+phase+side)*5]],'#60718a',9);}
  poly([[-25,-14],[-17,-40],[-5,-19]],'#91a1b0');poly([[25,-14],[17,-40],[5,-19]],'#91a1b0');disc(0,-8,27,24,'#adb4c1');poly([[-25,-15],[-6,-13],[0,-3],[-8,5],[-24,1]],'#344157');poly([[25,-15],[6,-13],[0,-3],[8,5],[24,1]],'#344157');disc(-12,-7,2.5,2.5,'#fff0c1');disc(12,-7,2.5,2.5,'#fff0c1');disc(0,4,4,3,'#253348');line([[-5,11],[0,14],[5,11]],'#253348',1.3);
  if(accessory===0){poly([[-14,-30],[0,-62],[17,-30]],'#cfa5e4');line([[-8,-41],[10,-39]],gold,2,.85);disc(0,-62,4,4,ice);}
  if(accessory===1){poly([[-24,-16],[-3,-16],[-5,-4],[-20,-4]],'#325777');poly([[3,-16],[24,-16],[20,-4],[5,-4]],'#325777');line([[-3,-13],[3,-13]],gold,2);line([[-19,-13],[-8,-13]],ice,1.1);}
  if(accessory===2){ring(0,-7,31,29,rose,4,.78);poly([[-34,-16],[-26,-16],[-26,6],[-34,6]],'#a78cc9');poly([[26,-16],[34,-16],[34,6],[26,6]],'#a78cc9');}
  c.restore();};
  raccoon(1845,409,1.13,0,2);raccoon(81,320,.89,1.1,0);raccoon(75,633,.8,3.8,1);raccoon(1852,714,.73,2.4,0);
  raccoon(522,1050,.52,1.8,1);raccoon(1378,1047,.59,4.1,2);raccoon(1478,73,.59,3.3,0);
  // The DJ has a real two-platter deck and a softly cycling bank of faders.
  c.save();c.translate(95,493);c.rotate(-.07);poly([[-69,-27],[64,-27],[72,-16],[72,24],[-69,24]],metal([-69,-27,72,24],['#bdcde0','#66788f','#b2c2d4','#384e69']));for(const x of [-39,39]){disc(x,-1,23,20,'#284159');ring(x,-1,20,17,ice,1,.7);ring(x,-1,10,8,rose,1,.75);line([[x,-1],[x+Math.cos(t*2+x)*15,Math.sin(t*2+x)*13]],gold,1.8);disc(x,-1,3,3,gold);}for(let j=0;j<4;j++){line([[-10+j*6,-17],[-10+j*6,16]],ice,1,.6);disc(-10+j*6,Math.sin(beat+j)*8,2,3,rose);}c.restore();
  for(const side of [0,1])for(let j=0;j<6;j++){const fn=u=>[side?1900-j*9-Math.sin(u*7-t*.7+j)*13:12+j*9+Math.sin(u*7-t*.7+j)*13,181+u*582];curve(fn,[gold,rose,ice,'#b99ef0'][j%4],1.1,.38);light(fn,[ice,rose,gold][j%3],j*.15+side*.34,.22,2.2);}
  // Rotating disco-petal gobos illuminate the side walls, never the playfield.
  for(const[x,y,phase]of [[56,213,0],[1870,563,1.7],[1879,219,3]]){c.save();c.translate(x,y);c.rotate(t*.45+phase);halo(0,0,92,rose,.25);for(let j=0;j<8;j++){const a=j*TAU/8;poly([[Math.cos(a)*20,Math.sin(a)*20],[Math.cos(a+.1)*71,Math.sin(a+.1)*71],[Math.cos(a+.36)*71,Math.sin(a+.36)*71]],j%2?'#bcebf138':'#d8a5e530');}ring(0,0,28,28,gold,1,.5);c.restore();}
  for(let j=0;j<30;j++){const age=(t*.16+j*.618)%1,x=j%2?1880+Math.sin(j+age*6)*57:48+Math.sin(j+age*7)*46,y=195+age*565;c.save();c.translate(x,y);c.rotate(age*5+j);poly([[-3,-5],[4,-5],[4,5],[-3,5]],[ice,rose,gold,'#b79ee5'][j%4],Math.sin(age*Math.PI)*.8);c.restore();}
  // Hanging foils at the top, and a dancing light floor below the gameplay HUD.
  curve(u=>[324+u*1260,24+Math.sin(u*Math.PI)*13],ice,1,.45);
  for(let j=0;j<17;j++){const x=347+j*72,y=26+Math.sin(j/16*Math.PI)*13;poly([[x,y],[x+26,y+3],[x+13+Math.sin(beat*.8+j)*5,y+25]],[gold,rose,ice][j%3],.6);}
  for(let j=0;j<25;j++){const x=351+j*49,bright=.2+.55*Math.sin(beat*1.1-j*.31)**2;poly([[x,1074],[x+36,1074],[x+44,1059],[x+9,1059]],[ice,rose,gold,'#b79ee5'][j%4],bright);}
  text('PEDRO',1060,73,gold,34);ring(1060,52,99,39,rose,.8,.44);
 }else if(e.style==='shades'){
  // Brushed titanium sunglasses with a gliding spectral reflection, pinstriped rim.
  c.save();c.translate(985,51);c.rotate(Math.sin(t*.4)*.025);
  const lens=[[-90,-17],[-14,-13],[-20,21],[-71,22],[-90,-17]];
  for(const side of [-1,1]){c.save();c.scale(side,1);poly(lens,metal([-90,-17,-14,22],['#425577','#283350','#66769a','#171e35']));line(lens,'#c5d9e5',2,.88);light(u=>[-81+u*57,-10+u*22],ice,0,.26,2.4);c.restore();}line([[-14,-11],[0,-17],[14,-11]],'#dae6eb',3);line([[-90,-14],[-115,-9]],'#94b9c8',3);line([[90,-14],[115,-9]],'#94b9c8',3);c.restore();
  for(const side of [0,1])for(let j=0;j<7;j++){const x=side?1911-j*6:8+j*6;curve(u=>[x+Math.sin(u*3+t*.2)*4,196+u*488],j%2?ice:'#8ca1d9',.8,.25);if(j%2===0)light(u=>[x,196+u*488],ice,j*.12,.12,1.8);}
  for(let j=0;j<5;j++){const x=370+j*236;poly([[x,15],[x+6,8],[x+12,15],[x+6,22]],gold,.65);}
 }else if(e.style==='nyan'){
  // Pixel cat follows a prismatic ribbon, with the face retained in the top strip.
  const x=387+smooth(p)*1130,y=49+Math.sin(t*1.3)*5;
  for(let j=0;j<5;j++){const fn=u=>[300+u*Math.max(50,x-300),y+7+j*5+Math.sin(u*9-t*.8)*4];curve(fn,['#d698d4','#baa6ed','#8ccbe9','#9ad6c2','#e6d899'][j],3.5,.45);}
  c.save();c.translate(x,y);poly([[-26,-17],[19,-17],[19,18],[-26,18]],'#d9c0a0');poly([[-22,-13],[15,-13],[15,14],[-22,14]],'#caa5c6');poly([[10,-23],[20,-23],[20,-31],[29,-31],[29,-22],[42,-22],[42,-31],[51,-31],[51,-13],[57,-13],[57,15],[15,15],[15,8],[10,8]],'#9eb7c2');poly([[24,-8],[29,-8],[29,-2],[24,-2]],'#243948');poly([[43,-8],[48,-8],[48,-2],[43,-2]],'#243948');poly([[34,2],[39,2],[39,7],[34,7]],'#e6aec9');line([[25,10],[45,10]],'#243948',1.5);c.restore();
  for(let j=0;j<21;j++){const a=(t*.14+j*.618)%1,xx=j%2?1893:27,yy=196+(j*67)%465;line([[xx-4,yy],[xx+4,yy]],ice,1.2,Math.sin(a*Math.PI));line([[xx,yy-4],[xx,yy+4]],ice,1.2,Math.sin(a*Math.PI));}
 }
 c.restore();return true;
}
