// Each short cue is a different peripheral action, not a skin on a common frame.
function libraryScene(c,id,t,d,p){
 const w=new WorldPaint(c),z=smooth(p),tau=TAU;
 const ice='#a9e4ef',mint='#9bd4b0',gold='#e8c28a',rose='#e6adce',red='#e27e8a',violet='#baa6e6';
 const poly=(pts,col,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.fillStyle=col;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();c.restore();};
 const line=(pts,col=ice,width=1,alpha=.7)=>w.beam(pts,col,width,alpha);
 const curve=(fn,col=ice,width=1,alpha=.6)=>w.line(fn,col,width*1.7,Math.min(.92,alpha*1.15));
 const arc=(x,y,rx,ry,a=0,b=tau)=>u=>[x+Math.cos(a+u*(b-a))*rx,y+Math.sin(a+u*(b-a))*ry];
 const trail=(fn,col=ice,offset=0,width=2,speed=.15)=>w.light(fn,(t*speed+offset)%1.35,col,width,.27,.95);
 const disc=(x,y,rx,ry,col,alpha=.8)=>{c.save();c.globalAlpha*=alpha;c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,0,0,tau);c.fill();c.restore();};
 const lens=(x,y,rx,ry,col,alpha=.75)=>{c.save();c.translate(x,y);c.scale(1,ry/rx);c.globalAlpha*=alpha;const g=c.createRadialGradient(-rx*.28,-rx*.28,rx*.07,0,0,rx);g.addColorStop(0,'#effffd99');g.addColorStop(.23,col+'18');g.addColorStop(.72,col+'24');g.addColorStop(.9,col+'bf');g.addColorStop(.97,'#eaffffb0');g.addColorStop(1,col+'00');c.fillStyle=g;c.beginPath();c.arc(0,0,rx,0,tau);c.fill();c.restore();};
 const sheet=(draw,col,axis,alpha=.7)=>{c.save();c.globalAlpha*=alpha;const g=c.createLinearGradient(...axis);g.addColorStop(0,col+'ec');g.addColorStop(.28,col+'80');g.addColorStop(.65,col+'28');g.addColorStop(1,col+'00');c.fillStyle=g;c.beginPath();draw(c);c.fill();c.restore();};
 const dust=(x,y,col,n=24,spread=30,height=470,speed=.12)=>{for(let j=0;j<n;j++){const serial=Math.floor(t*speed+j*.618),age=t*speed+j*.618-serial;w.mote(x+Math.sin(j*9+serial*2.31+age*3)*spread,y-age*height,1+j%3*.5,col,Math.sin(age*Math.PI)*.85);}};
 const petal=(x,y,r,col,angle=0,alpha=.85)=>w.petal(x,y,r,col,angle,alpha);
 const teeth=(x,y,n,dx,dy,col,rotation=0)=>{for(let j=0;j<n;j++){c.save();c.translate(x+j*dx,y+j*dy);c.rotate(rotation);poly([[0,0],[11,-3],[19,7],[8,11]],col,.3+.5*Math.sin(j*.5+t*.5)**2);c.restore();}};
 c.save();c.lineCap='round';c.lineJoin='round';
 switch(id){
 case 'mom-frog':momFrogConcert(c,t,d);break;
 case 'later':{ // Clock face emerges from the left, escapement teeth rotate gently.
  lens(-34,410,106,192,gold,.6);for(let j=0;j<36;j++){const a=j*tau/36;line([[-34+Math.cos(a)*80,410+Math.sin(a)*146],[-34+Math.cos(a)*92,410+Math.sin(a)*167]],gold,j%3?1:2,.7);}
  const a=-1.1+z*2.2;line([[-34,410],[-34+Math.cos(a)*91,410+Math.sin(a)*169]],'#fff0c9',2.5,.95);dust(1892,660,gold,21,19,440,.06);break;}
 case 'airlock':{ // Recessed mechanical hatch segments slide toward one scan line.
  for(let j=0;j<7;j++){const y=188+j*67,x=(1-z)*Math.sin(j+1)*11;poly([[0,y],[43+x,y+13],[53+x,y+40],[0,y+58]],'#243a49',.92);line([[0,y+3],[41+x,y+16],[48+x,y+35]],ice,1,.8);}
  const scan=180+z*476;line([[1850,scan],[1920,scan]],red,2,.95);w.mist(1890,scan,43,6,red,.5);line([[1888,190],[1888,660]],red,1,.18);for(let j=0;j<8;j++)disc(570+j*104,12,2,2,j%2?red:ice);break;}
 case 'opening':{ // Manga-style speed slashes migrate, accompanied by thin cel arcs.
  for(let j=0;j<13;j++){const x=348+j*90,yy=(j%4)*9;poly([[x,0],[x+6,0],[x+55,47+yy],[x+49,41+yy]],j%2?rose:ice,.75);}
  for(let j=0;j<11;j++){const y=180+j*44+Math.sin(t*.8+j)*8;line([[0,y+24],[47,y]],j%3?ice:rose,1+j%2,.6);}trail(u=>[1904-27*Math.sin(u*Math.PI),183+u*472],gold,0,3);break;}
 case 'another':{ // Domino discs advance around an offset circular track.
  for(let j=0;j<14;j++){const a=-1.5+j*.22;const x=-15+Math.cos(a)*52,y=424+Math.sin(a)*211;disc(x,y,4,13,gold,.45+.45*smooth((p-j*.024)/.2));}
  for(let j=0;j<3;j++){const x=770+j*132;curve(arc(x,8,39,28,0,Math.PI),ice,2,.6);trail(arc(x,8,39,28,0,Math.PI),gold,j*.2,3);}break;}
 case 'payment':{ // Contactless waves meet one liquid-gold acceptance seal.
  for(let j=0;j<5;j++){const fn=arc(955,-20,38+j*19,38+j*19,.23,Math.PI-.23);curve(fn,mint,1.7,.55);trail(fn,'#d8ffe7',j*.16,2);}
  lens(39,397,30,47,mint,.9);line([[23,399],[35,411],[58,376]],'#e5ffd4',2.2,z);dust(1895,658,mint,19,14,453,.1);break;}
 case 'fracture':{ // A porcelain crack propagates from one collision point.
  sheet(q=>{q.moveTo(0,177);q.lineTo(47,192);q.lineTo(31,349);q.lineTo(66,398);q.lineTo(36,469);q.lineTo(28,659);q.lineTo(0,695);},'#c9d1c8',[0,0,79,0],.86);
  const fissure=pathOf([[6,190],[20,307],[9,341],[44,395],[18,459],[32,516],[5,680]]);curve(fissure,'#31444e',2,.9);trail(fissure,'#fff5dd',0,2.2);for(let j=0;j<13;j++)poly([[1880+j%3*9,223+j*29],[1890+j%3*9,219+j*29],[1889+j%3*9,235+j*29]],ice,.8);break;}
 case 'revulsion':{ // Green film gathers into merging bubbles under a sharp meniscus.
  for(let j=0;j<9;j++)lens(6+Math.sin(j+t*.3)*10,205+j*53,24+j%3*9,21+j%4*8,mint,.64);
  for(let j=0;j<4;j++){const fn=u=>[1899+Math.sin(u*13-t*.36+j*.9)*15,182+u*483];curve(fn,'#cbdd96',1,.6);trail(fn,mint,j*.19);}teeth(410,12,18,60,0,gold,.2);break;}
 case 'bruh':{ // One heavy translucent slab droops at the center, held by fine pins.
  sheet(q=>{q.moveTo(395,0);q.lineTo(1515,0);q.quadraticCurveTo(990,19+z*37,395,9);},'#8399b8',[0,0,0,70],.82);
  line([[423,0],[423,31]],ice,2,.8);line([[1481,0],[1481,22]],ice,2,.8);dust(34,660,violet,11,17,460,.04);curve(u=>[1905-15*Math.sin(u*Math.PI),208+u*440],violet,3,.5);break;}
 case 'untouchable':{ // Iridescent chain links weave in and out of a velvet ribbon.
  for(let j=0;j<31;j++){const x=360+j*39,y=17+Math.sin(j*.42+t*.25)*8;curve(arc(x,y,18,5,j%2*.9,tau+j%2*.9),j%3?gold:ice,2,.7);}
  for(let j=0;j<6;j++){const fn=u=>[12+j*7+Math.sin(u*7+t*.4+j*.2)*13,183+u*487];curve(fn,violet,2,.23);trail(fn,rose,j*.18,1.4);}break;}
 case 'chill':{ // Sunset glass horizon and a handful of reeds moving in a breeze.
  for(let j=0;j<7;j++){const fn=u=>[335+u*1220,8+j*5+Math.sin(u*6+t*.15+j*.3)*4];curve(fn,j%3?mint:gold,1.3,.55);}
  for(let j=0;j<11;j++){const x=j*4;curve(u=>[x+Math.sin(u*2+t*.2+j)*20,680-u*(90+j*30)],mint,1.3,.6);petal(x+10,630-j*24,12,gold,-.8,.6);}lens(1902,465,31,176,ice,.3);break;}
 case 'confetti':{ // Crisp folded paper tumbles down in two unequal peripheral fans.
  for(let j=0;j<45;j++){const age=(t*.14+j*.618)%1,side=j%3===0,x=side?1883+Math.sin(j+age*3)*28:28+Math.sin(j+age*4)*28,y=172+age*508;petal(x,y,4+j%5,[gold,rose,ice][j%3],j+age*7,Math.sin(age*Math.PI));}
  teeth(348,9,26,47,0,gold,-.3);break;}
 case 'dayum':{ // Copper radiating fan unfolds abruptly, then floats apart.
  for(let j=0;j<17;j++){const a=-1.4+j*.17,b=.05+z*.012;poly([[-10,416],[-10+Math.cos(a)*86,416+Math.sin(a)*222],[-10+Math.cos(a+b)*86,416+Math.sin(a+b)*222]],j%3?gold:rose,.42);}
  trail(u=>[360+u*1180,10+Math.sin(u*7)*12],gold,0,4);dust(1890,650,rose,15,20,460,.16);break;}
 case 'ding-one':{ // One tubular bell and the soft elliptical ripples of its strike.
  line([[26,203],[26,630]],gold,9,.78);line([[23,203],[23,629]],'#fff1bf',1.4,.9);
  for(let j=0;j<7;j++)curve(arc(26,397,12+j*6+z*9,33+j*19),gold,1,.55-j*.05);trail(u=>[355+u*1200,13],ice,0,2.6);break;}
 case 'ding-two':{ // A hanging crystal chime cluster refracts three spectral streaks.
  for(let j=0;j<11;j++){const x=610+j*66,h=27+(j%4)*12;line([[x,0],[x,9]],ice,.7,.6);poly([[x-3,9],[x+7,13],[x+3,h],[x-4,h-5]],ice,.55);line([[x,13],[x,h-4]],'#effcff',1,.9);}
  for(let j=0;j<3;j++)trail(u=>[1904-j*12+Math.sin(u*5)*8,175+u*490],[ice,rose,violet][j],j*.19,2);break;}
 case 'disconnect':{ // Two fine cable ends recoil from their broken contact.
  const gap=10+z*31;curve(u=>[342+u*(600-gap),17+Math.sin(u*4)*9],violet,4,.62);curve(u=>[980+gap+u*(577-gap),19+Math.sin(u*5)*8],ice,3,.65);
  for(let j=0;j<19;j++){const y=195+j*25;line([[0,y],[17+j%3*5,y]],j/19<p?violet:ice,2,.8);}dust(1890,663,violet,19,20,445,.12);break;}
 case 'applause':{ // Warm footlights and a gilded balcony seen in low perspective.
  for(let j=0;j<24;j++){const x=351+j*51;disc(x,1071,3,2,gold);w.mist(x,1068,20,30,gold,.16+.13*Math.sin(t*1.1+j)**2);}
  for(let j=0;j<4;j++){const fn=u=>[332+u*1240,5+j*9+Math.sin(u*Math.PI)*11];curve(fn,gold,j?1:5,.55);}dust(39,655,gold,31,27,450,.13);break;}
 case 'suspicious':{ // Moving blinds let a narrow search beam slip through.
  for(let j=0;j<17;j++){const y=183+j*28;poly([[0,y],[57,y-12],[52,y-3],[0,y+9]],'#223b35',.88);line([[0,y],[57,y-12]],mint,1,.6);}
  const yy=226+z*389;sheet(q=>{q.moveTo(0,yy);q.lineTo(121,yy-31);q.lineTo(84,yy+20);},gold,[0,yy,126,yy],.57);teeth(370,12,23,49,0,mint);break;}
 case 'downer':{ // A waterfall of silver drops and a bowed cold-blue horizon.
  for(let j=0;j<23;j++){const age=(t*.16+j*.618)%1;disc(22+Math.sin(j)*22,180+age*500,1.4+j%2,4+j%5,ice,Math.sin(age*Math.PI));}
  for(let j=0;j<4;j++)curve(u=>[370+u*1170,8+j*4+Math.sin(u*Math.PI)*z*31],violet,1.4,.6-j*.1);lens(1914,435,43,155,ice,.24);break;}
 case 'airburst':{ // Concentric warm pneumatic ripples, with one escaping mist plume.
  for(let j=0;j<8;j++)curve(arc(-29,419,40+j*9+z*14,67+j*24,-1.4,1.4),gold,j?1.3:5,.8-j*.075);
  for(let j=0;j<7;j++)curve(u=>[1891+Math.sin(u*12+t*.22+j*.2)*15,655-u*453],ice,.7,.18);dust(1890,668,gold,15,22,450,.16);break;}
 case 'brass':{ // Three trumpet-bell cross sections open in a downward sequence.
  for(let j=0;j<3;j++){const y=265+j*157;lens(-27,y,78,65,gold,.82);curve(arc(-27,y,74,61),gold,2,.9);trail(arc(-27,y,66,53),ice,j*.2,2.3);}
  for(let j=0;j<7;j++)line([[600+j*110,0],[629+j*110,26]],gold,1.6,.7);dust(1895,656,gold,22,13,450,.1);break;}
 case 'newt':{ // Tiny iridescent scales cascade under a sinuous aquatic wake.
  for(let j=0;j<36;j++){const y=182+j*13,x=10+j%3*12;petal(x,y,9,[mint,ice,gold][j%3],.9+Math.sin(t*.3+j)*.1,.75);}
  for(let j=0;j<3;j++)trail(u=>[1890+Math.sin(u*9-t*.3+j)*20,185+u*482],ice,j*.22,2);teeth(377,14,19,61,0,mint,-.2);break;}
 case 'glitch':{ // A sparse spectral readhead remaps packets along interrupted paths.
  for(let j=0;j<30;j++){const x=345+j*40,y=(j%4)*9+4;line([[x,y],[x+13+j%3*4,y]],j%3?ice:rose,1+j%3,.6);}
  for(let j=0;j<17;j++){const y=190+j*27,shift=Math.floor(t*3+j*.77)%5;poly([[0,y],[14+shift*5,y],[14+shift*5,y+4],[0,y+4]],j%4?ice:rose,.8);line([[1905-shift*3,y+14],[1920,y+14]],mint,2,.65);}break;}
 case 'scream':{ // Air-pressure ribbons flare outward with unequal wavefronts.
  for(let j=0;j<10;j++){const fn=u=>[7+j*4+Math.sin(u*17-t*2+j*.17)*(12*Math.sin(u*Math.PI)),177+u*490];curve(fn,j%3?red:ice,1.3,.6-j*.035);}
  for(let j=0;j<8;j++)curve(arc(1940,419,34+j*8,58+j*28,1.75,4.52),rose,1.2,.6-j*.05);dust(67,659,gold,17,14,460,.23);break;}
 case 'swear':{ // Red lacquer scratches erupt from one margin and cool to embers.
  for(let j=0;j<14;j++){const y=190+j*33;poly([[0,y],[44+j%4*5,y-14],[27,y+10],[0,y+24]],j%3?'#812f47':red,.8);line([[0,y+2],[43+j%4*5,y-12]],'#efb5a4',.8,.55);}
  dust(1893,660,red,41,25,470,.21);trail(u=>[350+u*1200,15+Math.sin(u*8)*8],red,0,3);break;}
 case 'galaxy':{ // Edge-on nebula gas, pin-sharp stars and an inclined elliptical orbit.
  for(let j=0;j<13;j++){const y=190+j*36;w.mist(11+Math.sin(j)*17,y,56,45,j%2?violet:ice,.16);}
  for(let j=0;j<47;j++){const side=j%2,x=side?1885:22,y=181+(j*71)%486;w.star(x+Math.sin(j)*23,y,1+j%3,j%4?ice:gold,.2+.6*Math.sin(t*.21+j)**2);}
  const orbit=u=>[350+u*1200,27+Math.sin(u*Math.PI)*28];curve(orbit,violet,1,.3);trail(orbit,ice,0,2.4,.055);break;}
 case 'casino':{ // Felt-green roulette arc, brass indexing, and a single travelling ball.
  sheet(q=>{q.moveTo(0,186);q.bezierCurveTo(92,281,90,541,0,679);},mint,[0,0,101,0],.38);
  for(let j=0;j<29;j++){const a=-1.28+j*.09;line([[Math.cos(a)*46-5,428+Math.sin(a)*219],[Math.cos(a)*59-5,428+Math.sin(a)*238]],j%2?red:gold,4,.7);}
  const a=-1.26+z*2.5;disc(Math.cos(a)*62-5,428+Math.sin(a)*238,3.5,3.5,'#fff1c6');dust(1892,662,gold,19,16,470,.1);teeth(420,10,18,62,0,gold);break;}
 case 'paradise':{ // Smoked amber city towers and one art-deco sunburst.
  for(let j=0;j<32;j++){const x=344+j*38,h=9+(j*17)%39;poly([[x,0],[x+20,0],[x+20,h],[x,h]],'#302f38',.8);line([[x+3,2],[x+3,h-3]],gold,.8,.55);}
  for(let j=0;j<19;j++){const a=-1.5+j*.166;line([[0,423],[Math.cos(a)*64,423+Math.sin(a)*207]],gold,1,.36);}dust(1897,660,gold,14,15,449,.08);break;}
 case 'gary':{ // Mother-of-pearl shell spiral; small liquid bubbles follow its wake.
  lens(-9,410,76,126,rose,.65);const spiral=u=>{const r=3+u*58;return[-9+Math.cos(u*tau*2.6+z*.2)*r,410+Math.sin(u*tau*2.6+z*.2)*r*1.6];};curve(spiral,ice,1.4,.75);trail(spiral,gold,0,2,.08);
  for(let j=0;j<13;j++){const age=(t*.07+j*.618)%1;lens(1898+Math.sin(j)*12,660-age*466,3+j%4,4+j%4,mint,.65);}break;}
 case 'goofy':{ // Elastic spring coils compress and release in staggered steps.
  for(let j=0;j<9;j++){const y=190+j*52,b=Math.sin(t*2+j*.8)*5;curve(u=>[7+u*36,y+Math.sin(u*tau*2)*7+b*Math.sin(u*Math.PI)],gold,2,.75);}
  for(let j=0;j<27;j++){const x=360+j*43,y=12+Math.sin(t*1.4+j*.7)*8;disc(x,y,4+j%3,2,ice,.7);}dust(1893,668,rose,17,21,470,.2);break;}
 case 'heaven':{ // Volumetric organ light from above; alabaster feathers rise gently.
  for(let j=0;j<13;j++){const x=347+j*92;sheet(q=>{q.moveTo(x,0);q.lineTo(x+31,0);q.lineTo(x+53,104);q.lineTo(x-21,67);},j%3?ice:gold,[0,0,0,112],.42);}
  for(let j=0;j<18;j++){const y=203+j*24;petal(17+j%3*9,y,12,'#f3e8cf',-.55+Math.sin(t*.2+j)*.08,.65);}dust(1888,667,gold,37,25,480,.09);break;}
 case 'intro':{ // One sweeping satin loop wraps around an off-center aperture.
  for(let j=0;j<9;j++){const fn=u=>[361+u*1200,13+j*3+Math.sin(u*9+t*.2+j*.1)*9];curve(fn,j%3?rose:gold,1.2,.46);}
  for(let j=0;j<3;j++)curve(arc(-12,418,33+j*12,168+j*13,-1.45,1.45),rose,2,.5);trail(arc(-12,418,53,194,-1.45,1.45),ice,0,2);break;}
 case 'love':{ // One ribbon draws a heart around the top edge; warm petals lift.
  const heart=u=>{const a=u*tau;return[961+Math.sin(a)**3*72,33-(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))*2.4];};curve(heart,rose,1.5,.4);trail(heart,gold,0,2.5,.07);
  for(let j=0;j<29;j++){const age=(t*.1+j*.618)%1;petal(j%2?1890+Math.sin(j)*25:24+Math.sin(j)*23,668-age*489,5+j%3,rose,j+age*3,Math.sin(age*Math.PI));}break;}
 case 'falling':{ // Cascading blush glass leaves veer across a silver rain curtain.
  for(let j=0;j<22;j++){const age=(t*.11+j*.618)%1;petal(25+Math.sin(age*5+j)*26,177+age*494,8+j%5,rose,j+age*3,.8);}
  for(let j=0;j<11;j++){const fn=u=>[1893+j%3*7+Math.sin(u*5+j)*4,178+u*490];curve(fn,ice,.6,.25);trail(fn,ice,j*.1,1.1,.08);}teeth(362,11,22,53,0,rose,.4);break;}
 case 'charge':{ // Conduction climbs a narrow phosphor tube and lights a top arc.
  sheet(q=>q.rect(9,185,21,485),mint,[9,0,31,0],.6);curve(u=>[20,670-u*482],mint,2,.35);trail(u=>[20,670-u*482],ice,0,4,.13);
  for(let j=0;j<5;j++)curve(arc(964,-24,63+j*28,63+j*9,0,Math.PI),j/5<p?mint:ice,1.4,.5);dust(1895,660,mint,11,13,449,.15);break;}
 case 'cash':{ // Coins appear edge-on in a cascading gold minting press.
  for(let j=0;j<13;j++){const y=188+j*38,swing=Math.cos(t*.6+j*.7);lens(25,y,4+Math.abs(swing)*12,17,gold,.82);line([[25,y-14],[25,y+14]],'#ffe8b5',.8,.55);}
  for(let j=0;j<25;j++){const x=359+j*48;line([[x,3],[x+9,15],[x+22,3]],gold,1.2,.75);}dust(1893,665,gold,25,21,473,.13);break;}
 case 'isolation':{ // Quiet cobalt curtains peel away from each other asymmetrically.
  for(let j=0;j<7;j++){const fn=u=>[8+j*6+Math.sin(u*Math.PI)*(23+z*9),183+u*486];curve(fn,violet,3,.38-j*.025);}
  for(let j=0;j<3;j++){const fn=u=>[1909-j*12-Math.sin(u*5)*13,254+u*383];curve(fn,ice,1.5,.45);trail(fn,ice,j*.26,1.2,.04);}dust(440,84,ice,12,80,72,.035);break;}
 case 'lizard':{ // Polychromatic reptile scales catch individual moving highlights.
  for(let j=0;j<48;j++){const y=186+Math.floor(j/3)*30,x=j%3*15;petal(x,y,10,[mint,gold,ice][j%3],1.2,.45+.35*Math.sin(j*.23+t*.31)**2);}
  const tail=u=>[1878+Math.sin(u*12+p)*22,193+u*452];curve(tail,mint,3,.55);trail(tail,gold,0,2);break;}
 case 'loading':{ // Broken orbital segments assemble into a precise spinner at top.
  for(let j=0;j<16;j++){const a=j*tau/16+t*.08;curve(arc(962,11,49,49,a,a+.2),j/16<p?mint:ice,2.2,.75);}
  for(let j=0;j<29;j++){const y=191+j*16;disc(17,y,2,1.3,j/29<p?mint:ice,.65);}trail(u=>[1898,184+u*484],ice,0,3,.1);break;}
 case 'behind':{ // Radar arcs emerge from opposite corners of the safe side strips.
  for(let j=0;j<7;j++)curve(arc(-27,225,34+j*11,39+j*16,-.1,1.55),gold,1.4,.6-j*.05);
  for(let j=0;j<6;j++)curve(arc(1942,645,40+j*10,40+j*20,Math.PI,Math.PI*1.55),ice,1.3,.65-j*.05);trail(u=>[358+u*1200,12+Math.sin(u*6)*7],gold,0,2.4);break;}
 case 'catlove':{ // Pearl cat-eye glints and fine curving whisker filigree.
  lens(940,26,23,9,mint,.8);lens(1001,26,23,9,mint,.8);
  for(let j=0;j<7;j++){const fn=u=>[0+u*72,225+j*57+Math.sin(u*Math.PI)*(14+j)];curve(fn,rose,1.1,.7);}
  for(let j=0;j<15;j++){const age=(t*.08+j*.618)%1;petal(1894+Math.sin(j)*21,665-age*469,5+j%3,gold,age*2+j,.75);}break;}
 case 'quack':{ // Pond ripples and a soft yellow feather drift past the edge.
  for(let j=0;j<8;j++)curve(arc(-15,407,30+j*7,18+j*21),j%2?mint:gold,1.5,.65-j*.055);
  for(let j=0;j<13;j++){const x=350+j*92;petal(x,15+Math.sin(t*.31+j)*9,8,gold,.4,.8);}dust(1890,661,ice,20,19,450,.11);break;}
 case 'alert':{ // One amber scan wedge locks onto the upper rim; no screen flash.
  const y=186+z*481;sheet(q=>{q.moveTo(0,y);q.lineTo(107,y-40);q.lineTo(90,y+16);},gold,[0,y,111,y],.7);line([[0,y],[72,y]],'#ffe4b3',2,.8);
  for(let j=0;j<13;j++)line([[360+j*92,4],[379+j*92,18]],gold,1.5,.65);for(let j=0;j<17;j++)disc(1903,200+j*27,2,2,red,.6);break;}
 case 'refusal':{ // A red silken clasp recoils in two opposite directions.
  for(let j=0;j<4;j++){curve(u=>[359+u*539,10+j*5+Math.sin(u*Math.PI)*(13+z*9)],red,2,.6);curve(u=>[1028+u*535,14+j*3-Math.sin(u*Math.PI)*7],ice,1.3,.45);}
  teeth(10,209,15,0,30,red,-.4);dust(1892,656,ice,13,18,455,.1);break;}
 case 'piuw':{ // A sapphire dart follows a curved magnetic flight path.
  const fn=u=>[23+Math.sin(u*7)*21,665-u*484];curve(fn,violet,1,.2);trail(fn,ice,0,3.8,.25);for(let j=0;j<7;j++)curve(arc(23,222+j*61,24,10),violet,1,.4);
  trail(u=>[358+u*1200,11+Math.sin(u*4)*9],ice,.31,2.7,.21);break;}
 case 'prowler':{ // Black ink serrations carry a slow ultraviolet edge glow.
  for(let j=0;j<11;j++){const y=183+j*44;poly([[0,y],[39,y+14],[58,y+44],[12,y+31],[0,y+41]],'#282039',.96);line([[39,y+14],[58,y+44]],violet,1,.7);}
  for(let j=0;j<21;j++)petal(378+j*55,7+(j%3)*6,8,violet,-.45,.75);dust(1892,663,rose,33,29,472,.06);break;}
 case 'scratch':{ // Off-center record groove, and one bright tonearm snapping back.
  for(let j=0;j<18;j++)curve(arc(-58,424,100-j*3,218-j*5,-1.4,1.4),j%4?ice:gold,.75,j%4?.25:.65);
  line([[1382,6],[1401,46],[1321-z*57,46]],gold,4,.8);line([[360,11],[1220,11]],ice,.7,.5);dust(1893,660,ice,13,14,470,.15);break;}
 case 'rizz':{ // Sculpted rose-silver liquid lens at one edge, suspended pearl points.
  for(let j=0;j<5;j++)lens(-24,400+j*12,65-j*4,189-j*13,j%2?rose:ice,.25);
  for(let j=0;j<25;j++){const x=360+j*49;disc(x,11+Math.sin(j*.38+t*.21)*9,1.3+j%3*.5,1.5,j%3?rose:gold,.8);}trail(u=>[1901+Math.sin(u*6)*10,183+u*480],rose,0,2,.065);break;}
 case 'romance':{ // A climbing rose vine unfurls individual translucent leaves.
  const vine=u=>[20+Math.sin(u*9)*16,667-u*478];curve(vine,gold,1.3,.85);for(let j=0;j<17;j++){const[x,y]=vine(j/17);petal(x+(j%2?9:-7),y,12,rose,j%2?-.5:.6,.75);}
  for(let j=0;j<27;j++){const age=(t*.055+j*.618)%1;petal(1891+Math.sin(j)*22,182+age*480,5+j%3,rose,j+age*2,Math.sin(age*Math.PI));}break;}
 case 'run':{ // Escape velocity: unequal streaks rush along a dark aerodynamic seam.
  for(let j=0;j<9;j++){const fn=u=>[3+j*6+Math.sin(u*4)*8,181+u*487];curve(fn,'#506075',1,.22);trail(fn,j%3?ice:red,j*.16,1.4+j%2,.34+j*.007);}
  for(let j=0;j<17;j++){const x=360+j*69;line([[x,8],[x+24,22]],red,1.3,.6);}dust(1899,665,red,29,13,470,.4);break;}
 case 'disgust':{ // Thin organic lime membranes fold back and shed tiny beads.
  for(let j=0;j<8;j++){const y=203+j*54;sheet(q=>{q.moveTo(0,y);q.quadraticCurveTo(89,y-35,29,y+24);q.lineTo(0,y+19);},mint,[0,0,73,0],.62);}
  for(let j=0;j<22;j++){const age=(t*.09+j*.618)%1;lens(1896+Math.sin(j)*14,182+age*485,2+j%3,3+j%4,gold,.8);}break;}
 case 'fail':{ // A brass fan slowly droops while pale enamel chips fall away.
  for(let j=0;j<17;j++){const x=360+j*71;line([[x,2],[x+17,12+Math.sin(j*.4+p)*14]],gold,2,.7);}
  for(let j=0;j<21;j++){const age=(t*.12+j*.618)%1;poly([[15+Math.sin(j)*15,182+age*485],[29+Math.sin(j)*15,190+age*485],[19+Math.sin(j)*15,202+age*485]],ice,.6);}
  for(let j=0;j<4;j++)curve(arc(1933,423,30+j*7,164+j*19,1.75,4.5),violet,1,.4);break;}
 case 'awww':{ // Warm pearl bubbles stretch delicately along one margin.
  for(let j=0;j<9;j++)lens(4+Math.sin(j)*11,218+j*48,26+j%3*8,22+j%2*7,rose,.65);
  for(let j=0;j<21;j++)petal(362+j*59,8+Math.sin(t*.24+j)*7,7,gold,-.4,.8);dust(1892,660,rose,29,24,471,.055);break;}
 case 'smart':{ // Fine drafting circles and logic traces resolve to one exact point.
  for(let j=0;j<5;j++)curve(arc(-14,411,35+j*11,80+j*26,-1.43,1.43),ice,1,.5);
  for(let j=0;j<6;j++){const y=231+j*67;line([[0,y],[32,y],[47,y-15],[60,y-15]],mint,1.2,.7);disc(60,y-15,2,2,gold,.9);}
  trail(u=>[350+u*1200,11+Math.sin(u*4)*7],ice,0,2,.07);break;}
 case 'weeknd':{ // Red photographic light leaks and soft nightclub lens ghosts.
  for(let j=0;j<9;j++)w.mist(0,202+j*53,59,51,j%2?red:violet,.3);
  for(let j=0;j<7;j++)lens(1898,220+j*66,14+j%3*9,8+j%3*3,red,.4);
  for(let j=0;j<6;j++){const fn=u=>[360+u*1200,9+j*5+Math.sin(u*6+t*.21+j*.4)*6];curve(fn,j%2?red:rose,1,.5);trail(fn,ice,j*.19,1.4,.05);}break;}
 case 'sparta':{ // Weathered bronze shield edge, spear shadows and dust.
  lens(-69,423,119,219,gold,.76);for(let j=0;j<17;j++){const a=-1.3+j*.16;disc(-69+Math.cos(a)*110,423+Math.sin(a)*207,2,2,'#efcd9d');}
  for(let j=0;j<9;j++)line([[370+j*138,0],[405+j*138,35]],gold,1.7,.7);dust(1890,663,gold,37,26,474,.1);break;}
 case 'troll':{ // An impossible ribbon knot changes over/under order as it slides.
  for(let j=0;j<3;j++){const fn=u=>[358+u*1200,19+Math.sin(u*19+j*tau/3+t*.3)*16];curve(fn,[mint,violet,gold][j],2.4,.7);trail(fn,'#efffe9',j*.27,1.1,.09);}
  for(let j=0;j<7;j++)curve(arc(12,226+j*67,24,17,j*.4,j*.4+tau*.84),mint,2,.55);dust(1893,663,violet,22,22,467,.12);break;}
 case 'boom':{ // Pressure in smoked glass radiates outward from a deep cold impact.
  for(let j=0;j<9;j++){const fn=arc(-44,423,52+j*8+z*14,69+j*23,-1.36,1.36);curve(fn,j%3?ice:violet,j===0?4:1.2,.78-j*.067);}
  w.mist(0,420,105,185,violet,.18);trail(u=>[358+u*1200,12],ice,0,3,.21);dust(1895,661,ice,25,17,476,.13);break;}
 case 'confusion':{ // Anamorphic loops almost join, then miss by a small offset.
  for(let j=0;j<6;j++){const y=230+j*72;curve(arc(19,y,29,23,.5+p*.4,5.5+p*.4),j%2?violet:ice,1.5,.8);}
  for(let j=0;j<7;j++)curve(arc(425+j*166,-9,48,31,0,Math.PI),j%2?ice:violet,1.3,.6);dust(1894,660,gold,13,18,461,.065);break;}
 case 'mystery':{ // Jade silk folds let delicate champagne highlights peek through.
  for(let j=0;j<10;j++){const fn=u=>[4+j*5+Math.sin(u*7+t*.22+j*.13)*13,183+u*482];curve(fn,mint,2.1,.38);trail(fn,gold,j*.1,1,.047);}
  for(let j=0;j<19;j++){const x=360+j*65;petal(x,12+Math.sin(j*.3)*10,7,gold,.3,.7);}lens(1906,428,29,171,violet,.34);break;}
 case 'western':{ // Braided leather, silver saddle stitches and turquoise inlays.
  for(let j=0;j<3;j++)curve(u=>[15+Math.sin(u*57+j*tau/3)*8,184+u*482],j===1?gold:'#a17f68',2.6,.8);
  for(let j=0;j<12;j++){const y=205+j*39;line([[1,y],[9,y+5]],ice,1,.9);}for(let j=0;j<19;j++)lens(375+j*63,8,5,8,ice,.85);dust(1892,656,gold,17,19,460,.07);break;}
 case 'rescue':{ // An opal wing of individual feathers unfolds into a healing wake.
  for(let j=0;j<18;j++){const y=191+j*25;petal(13+j%3*9,y,17-j%4,ice,-.55+Math.sin(t*.2+j)*.07,.86);}
  for(let j=0;j<4;j++){const fn=u=>[1893-j*7+Math.sin(u*7+j)*11,665-u*479];curve(fn,mint,1,.28);trail(fn,gold,j*.23,2,.07);}teeth(385,10,21,56,0,mint);break;}
 case 'camera':{ // Large cropped lens iris: six blades close and release on one side.
  lens(-31,411,95,171,ice,.45);for(let j=0;j<8;j++){const a=j*tau/8+.08*Math.sin(p*Math.PI),r=32+Math.sin(p*Math.PI)*12;const pts=[[r,0],[r+31,12],[r+19,43],[r-17,25]].map(([x,y])=>[-31+x*Math.cos(a)-y*Math.sin(a),411+(x*Math.sin(a)+y*Math.cos(a))*1.8]);poly(pts,j%2?'#506677':'#202e3c',.91);line([pts[0],pts[1]],ice,.8,.8);}
  for(let j=0;j<32;j++){const x=361+j*38;line([[x,6],[x+15,6]],gold,2,.6);}trail(u=>[1904,188+u*475],ice,0,2.3,.16);break;}
 case 'respawn':{ // A suspended hard-light gateway assembles upward in calm blue.
  for(let j=0;j<5;j++){const x=5+j*11,fn=u=>[x+Math.sin(u*Math.PI)*12,666-u*483];curve(fn,ice,1.4,.5);trail(fn,mint,j*.14,2.5,.1);}
  for(let j=0;j<7;j++){const y=211+j*67;line([[1878,y+18],[1897,y],[1918,y+18]],ice,1.3,.7);}
  for(let j=0;j<4;j++)curve(arc(959,-12,139+j*99,39+j*11,.05,Math.PI-.05),ice,1,.45);dust(45,664,mint,23,24,472,.1);break;}
 default: throw new Error('Unknown authored sound scene: '+id);
 }
 c.restore();
}
