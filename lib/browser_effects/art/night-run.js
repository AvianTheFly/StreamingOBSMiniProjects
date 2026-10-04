// Deja Vu: an authored kinetic illustration, reconstructed from audio time.
// No backdrop, repeated full-frame layout, image decoding, or independent clock.
export const NIGHT_RUN_TRACK_LENGTH=2*1692+2*758+TAU*90;
export function nightRunTrack(distance){
 // Arc length parameterization keeps the car's speed continuous through bends.
 let s=((distance%NIGHT_RUN_TRACK_LENGTH)+NIGHT_RUN_TRACK_LENGTH)%NIGHT_RUN_TRACK_LENGTH;
 const straight=(x,y,angle)=>({x,y,angle,corner:0});
 const bend=(x,y,start)=>{const a=start+s/90;return{x:x+Math.cos(a)*90,y:y+Math.sin(a)*90,angle:a+Math.PI/2,corner:1};};
 if(s<1692)return straight(114+s,118,0);s-=1692;
 if(s<Math.PI*45)return bend(1806,208,-Math.PI/2);s-=Math.PI*45;
 if(s<758)return straight(1896,208+s,Math.PI/2);s-=758;
 if(s<Math.PI*45)return bend(1806,966,0);s-=Math.PI*45;
 if(s<1692)return straight(1806-s,1056,Math.PI);s-=1692;
 if(s<Math.PI*45)return bend(114,966,Math.PI/2);s-=Math.PI*45;
 if(s<758)return straight(24,966-s,Math.PI*1.5);s-=758;
 return bend(114,208,Math.PI);
}
export function nightRunMotion(t,d){
 const q=Math.max(0,t/Math.max(.35,d-.9));
 // The increasing slope accelerates the car; one lap completes before fade-out.
 return{distance:NIGHT_RUN_TRACK_LENGTH*(.45*q+.55*q*q),gear:Math.min(5,1+Math.floor(Math.max(0,t/d)*5))};
}
function nightRun(c,t,d,e){
 const p=Math.max(0,Math.min(1,t/d)),beat=t*(e.bpm||154)/60;
 const cyan='#74f5f0',red='#ff536d',cream='#fff5dc',ink='#172635';
 const enter=smooth(t/.65),exit=smooth((d-t)/.65);
 // Complete at least one full circuit before the actual audio's exit fade.
 const {distance,gear}=nightRunMotion(t,d);
 const car=nightRunTrack(distance),lap=Math.floor(distance/NIGHT_RUN_TRACK_LENGTH);
 const line=(pts,color,width=2,alpha=1)=>{c.save();c.globalAlpha*=alpha;c.lineWidth=width;c.strokeStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();};
 const poly=(pts,fill,stroke=ink,width=2)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
 const oval=(x,y,rx,ry,fill,stroke=null,width=2)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
 const wake=(fn,head,color,width=3,tail=.24)=>{for(let j=0;j<28;j++){const a=head-tail*(1-j/28),b=head-tail*(1-(j+1)/28);if(a<0||b>1)continue;line([fn(a),fn(b)],color,width,(j/28)**2*.8);}};
 c.save();c.globalAlpha*=enter*exit;c.lineJoin='round';c.lineCap='round';

 // One typographic gesture: a cut-steel face, offset scarlet underside and
 // aqua edge. Its animation settles instead of bouncing indefinitely.
 c.save();c.translate(923-(1-enter)*100,70-(1-enter)*34);c.transform(1,0,-.16,1,0,0);
 c.font='900 67px Impact,"Arial Black",sans-serif';c.textAlign='center';
 const title=e.label||'DEJA VU',fit=Math.min(1,620/c.measureText(title).width);c.scale(fit,1);
 c.lineWidth=7;c.strokeStyle=ink;c.strokeText(title,0,0);
 c.fillStyle=red;c.fillText(title,6,7);c.fillStyle=cyan;c.fillText(title,-2,-2);
 const face=c.createLinearGradient(0,-64,0,0);face.addColorStop(0,'#ffffff');face.addColorStop(.55,cream);face.addColorStop(.56,'#c9d9db');face.addColorStop(1,'#93aab8');c.fillStyle=face;c.fillText(title,0,0);
 const shine=c.createLinearGradient(-400+p*930,0,-260+p*930,0);shine.addColorStop(0,'#ffffff00');shine.addColorStop(.5,'#ffffffc0');shine.addColorStop(1,'#ffffff00');c.fillStyle=shine;c.fillText(title,0,0);
 c.restore();
 line([[659,88],[746,88],[761,96],[1140,96]],cyan,2,.65);
 c.save();c.font='700 12px Bahnschrift,"Segoe UI",sans-serif';c.fillStyle=cream;c.textAlign='left';c.fillText('NIGHT RUN',770,86);c.textAlign='right';c.fillStyle=red;c.fillText('NO BRAKES',1140,86);c.restore();
 // Asymmetric chevrons give the title direction without a title box.
 for(let j=0;j<3;j++)poly([[1174+j*23,21],[1187+j*23,21],[1170+j*23,71],[1157+j*23,71]],j===0?red:cyan,null);

 // The tachometer lives on one side. It has a transparent glass center,
 // precisely spaced indices, and a needle that accelerates with the clip.
 c.save();c.translate(81-(1-enter)*132,397);c.rotate(-.12);
 c.beginPath();c.arc(0,0,62,-2.45,.8);c.strokeStyle='#203847b0';c.lineWidth=13;c.stroke();
 const shift=Math.max(0,p*5-Math.floor(p*5));
 const rpm=.38+.47*shift+Math.sin(beat*.8)*.025;
 c.beginPath();c.arc(0,0,62,-2.45,-2.45+rpm*3.25);c.strokeStyle=cyan;c.lineWidth=6;c.stroke();
 for(let j=0;j<19;j++){const a=-2.45+j*3.25/18;line([[Math.cos(a)*47,Math.sin(a)*47],[Math.cos(a)*(j%3?52:56),Math.sin(a)*(j%3?52:56)]],j>14?red:cream,j%3?1:2,.8);}
 const a=-2.45+rpm*3.25;
 poly([[Math.cos(a)*49,Math.sin(a)*49],[Math.cos(a+1.6)*4,Math.sin(a+1.6)*4],[Math.cos(a-1.6)*4,Math.sin(a-1.6)*4]],red,null);
 oval(0,0,6,6,cream,ink,2);
 c.font='900 31px Impact,sans-serif';c.textAlign='center';c.fillStyle=cream;c.fillText(String(gear),0,34);
 c.font='700 10px Bahnschrift,sans-serif';c.fillStyle=cyan;c.fillText('GEAR',0,49);
 c.restore();

 // Manual shift gate: restore a tangible prop, distinct from the tachometer.
 // Its chrome knob follows a smooth H-pattern move on each actual gear change.
 c.save();c.translate(80-(1-enter)*110,602);c.rotate(-.08);
 const metal=c.createLinearGradient(-42,-42,40,43);metal.addColorStop(0,'#d7e6e9');metal.addColorStop(.3,'#516977');metal.addColorStop(.55,'#e6eeee');metal.addColorStop(1,'#203d4d');
 c.globalAlpha*=.85;poly([[-39,-46],[32,-46],[43,-32],[43,37],[28,48],[-38,48],[-47,32],[-47,-33]],metal,ink,2);
 poly([[-33,-37],[29,-37],[34,-30],[34,32],[23,39],[-31,39],[-37,30],[-37,-29]],'#183140c0',cyan,1);
 line([[-24,0],[24,0]],cream,3,.5);
 for(const xx of [-24,0,24])line([[xx,-24],[xx,24]],cream,3,.5);
 const seats=[[-24,-24],[-24,24],[0,-24],[0,24],[24,-24]];
 seats.forEach(([xx,yy],i)=>{c.font='700 9px Bahnschrift,sans-serif';c.textAlign='center';c.fillStyle=i+1===gear?cyan:'#dce8e6';c.fillText(String(i+1),xx,yy+(yy<0?-6:12));});
 const target=seats[gear-1],previous=seats[Math.max(0,gear-2)],u=smooth(shift/.18);
 // Travel through neutral before crossing between H-pattern columns.
 const intermediate=u<.5?[previous[0],previous[1]*(1-u*2)]:[previous[0]+(target[0]-previous[0])*smooth((u-.5)*2),target[1]*smooth((u-.5)*2)];
 const knob=gear===1?target:intermediate;
 line([[0,13],[knob[0],knob[1]]],ink,9,.9);line([[-2,12],[knob[0]-2,knob[1]]],cream,3,.8);
 const cap=c.createRadialGradient(knob[0]-4,knob[1]-5,1,knob[0],knob[1],13);cap.addColorStop(0,'#ffffff');cap.addColorStop(.35,'#b5e7e4');cap.addColorStop(.75,'#587887');cap.addColorStop(1,'#253d50');oval(knob[0],knob[1],12,12,cap,ink,2);
 c.font='700 10px Bahnschrift,sans-serif';c.fillStyle=cyan;c.fillText('SHIFT',0,66);c.restore();

 // Passing light wells: changing serials vary depth and brightness. Their
 // translucent pools terminate in the side gutters rather than washing play.
 for(const side of [0,1])for(let j=0;j<13;j++){
  const serial=Math.floor(t*.43+j*.618+side*.23),age=t*.43+j*.618+side*.23-serial;
  const y=190+age*530,x=side?1903-12*Math.sin(age*Math.PI):13+10*Math.sin(age*Math.PI);
  const col=(j+serial)%5===0?red:cyan,alpha=Math.sin(age*Math.PI)*.26;
  const light=c.createLinearGradient(side?1920:0,0,side?1850:70,0);
  light.addColorStop(0,col+'56');light.addColorStop(.55,col+'16');light.addColorStop(1,col+'00');
  c.save();c.globalAlpha*=Math.sin(age*Math.PI);c.fillStyle=light;c.fillRect(side?1850:0,y-12,70,32+age*26);c.restore();
  line([[x,y],[x,y+11+age*22]],col,1.3+age,alpha*2);
  line([[side?1893:30,y+7],[side?1869:54,y+2]],cream,1,alpha);
 }
 // Reflective kerbs are deliberately uneven: staggered marks on the lower
 // left and two illuminated marshal gates on the right.
 for(let j=0;j<12;j++){
  const y=486+j*20,lit=.18+.18*Math.sin(t*.9-j*.4+lap)**2;
  c.save();c.globalAlpha*=lit;
  poly([[2,y],[14,y-5],[14,y+6],[2,y+11]],j%3?cyan:red,null);
  line([[20,y+3],[41,y-5]],cream,1);c.restore();
 }
 for(const [y,col] of [[442,cyan],[633,red]]){
  const proximity=Math.max(0,1-Math.hypot(car.x-1896,car.y-y)/210);
  const pulse=.14+proximity*.5;
  line([[1920,y-34],[1878,y-34],[1868,y-23]],col,2,pulse);
  line([[1920,y+34],[1886,y+34]],col,1,pulse*.7);
  for(let j=0;j<4;j++)line([[1881+j*9,y-10],[1877+j*9,y+10]],cream,2,pulse);
 }
 // The curved tire wake follows the actual car around all four sides. No
 // reset line is drawn when the head crosses the start of the next lap.
 for(let j=0;j<42;j++){
  const a=nightRunTrack(distance-350+j*350/42),b=nightRunTrack(distance-350+(j+1)*350/42);
  line([[a.x,a.y],[b.x,b.y]],j%9<2?red:cyan,2.4,(j/42)**2*.6);
 }
 // Tire ribbons follow a hand-shaped curve at the bottom, never across play.
 const road=u=>[205+u*1510,1062-Math.sin(u*Math.PI)*14+Math.sin(u*9+p*2)*4];
 for(let j=0;j<2;j++){const fn=u=>{const[x,y]=road(u);return[x,y+j*7];};
  line(Array.from({length:65},(_,k)=>fn(k/64)),j?cyan:cream,j?1:2,.15);
  wake(fn,Math.min(1,p*1.16-j*.025),j?red:cyan,j?2:3,.35);
 }

 // Illustrated coupe. Glass, machined wheel faces and hard body highlights
 // have separate materials; no black tile sits behind it.
 const {x,y,angle,corner}=car;
 const hud=Math.max(
  smooth((y-800)/100)*(1-smooth((x-230)/130)),
  smooth((x-1460)/100)*smooth((y-710)/100),
  smooth((y-1000)/40)*smooth((x-480)/100)*(1-smooth((x-1270)/100)),
  (1-smooth((y-180)/70))*Math.max(1-smooth((x-230)/100),smooth((x-1460)/100)));
 const size=.44-hud*.1;
 c.save();c.globalAlpha*=1-hud*.55;c.translate(x,y);c.rotate(angle+(corner?Math.sin(t*1.6)*.045:0));c.scale(size,size);
 oval(-2,39,127,7,'#071d2950');
 const shell=c.createLinearGradient(0,-34,0,34);shell.addColorStop(0,'#fffef2');shell.addColorStop(.55,'#e4eff0');shell.addColorStop(.58,'#87b8be');shell.addColorStop(1,'#2e5968');
 poly([[-118,2],[-104,-11],[-62,-17],[-35,-44],[34,-44],[64,-20],[107,-15],[127,1],[122,27],[-119,27]],shell,ink,3);
 const glass=c.createLinearGradient(-20,-40,45,-18);glass.addColorStop(0,'#86f0e5');glass.addColorStop(.48,'#427282');glass.addColorStop(1,'#182d40');
 poly([[-53,-18],[-30,-39],[30,-39],[55,-18]],glass,ink,2);
 line([[4,-38],[4,-18]],cream,2,.7);line([[-111,2],[117,2]],cyan,2,.9);
 line([[-108,16],[110,16]],red,3,.9);
 poly([[-116,-9],[-145,-13],[-147,-20],[-108,-15]],ink,null);
 for(const xx of [-74,77]){
  oval(xx,25,22,22,'#101e2a',cream,2);oval(xx,25,14,14,'#b2d9db',ink,2);
  for(let j=0;j<5;j++){const a=j*TAU/5+beat*2;line([[xx+Math.cos(a)*4,25+Math.sin(a)*4],[xx+Math.cos(a)*12,25+Math.sin(a)*12]],ink,2,.85);}
  oval(xx,25,4,4,cream);
 }
 poly([[109,-9],[125,-1],[119,5],[105,2]],cream,ink,1);
 line([[-117,-3],[-106,-3]],red,4);
 // A small headlight cone fades out completely rather than whitening gameplay.
 const light=c.createLinearGradient(121,0,250,0);light.addColorStop(0,'#bafff640');light.addColorStop(1,'#bafff600');
 poly([[123,-1],[250,-13],[250,19],[123,7]],light,null);
 c.restore();

 // Checkered cloth arrives late and waves on a different edge from the dial.
 if(p>.51){c.save();c.globalAlpha*=smooth((p-.51)/.15);c.translate(1885,233);c.rotate(-.2);
  line([[0,-38],[0,83]],cream,3,.75);
  for(let row=0;row<4;row++)for(let col=0;col<5;col++){
   const xx=-82+col*16,yy=-35+row*13,dy=Math.sin(t*2-col*.48)*4;
   poly([[xx,yy+dy],[xx+16,yy+Math.sin(t*2-(col+1)*.48)*4],[xx+16,yy+13+Math.sin(t*2-(col+1)*.48)*4],[xx,yy+13+dy]],(row+col)%2?ink:cream,null);
  }c.restore();}
 // Corner sparks are born from successive absolute positions, so later laps
 // produce different trails rather than replaying a pre-recorded burst.
 for(let j=0;j<13;j++){
  const serial=Math.floor(t*8)-j,birth=serial/8,age=t-birth;if(birth<0||age>.85)continue;
  const origin=nightRunTrack(nightRunMotion(birth,d).distance);if(!origin.corner)continue;
  const scatter=(serial%5-2)*.21,a=origin.angle+Math.PI+scatter;
  const sx=origin.x+Math.cos(a)*age*(35+serial%3*25),sy=origin.y+Math.sin(a)*age*(35+serial%3*25);
  line([[sx,sy],[sx+Math.cos(a)*6,sy+Math.sin(a)*6]],serial%2?red:cream,1.3,(1-age/.85)*.65);
 }
 c.restore();
}
