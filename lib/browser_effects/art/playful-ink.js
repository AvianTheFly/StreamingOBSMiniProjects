// Shared miniature illustration mechanics. Each performance owns its cast and story.
function playfulInk(c,t,d){
 const p=Math.max(0,Math.min(1,t/Math.max(.001,d))),tau=Math.PI*2;
 const colors=['#ffadbf','#9ee8de','#c9b1ff','#ffe294','#90caff'];
 function local(x,y,s,a,fn){c.save();c.translate(x,y);c.rotate(a);c.scale(s,s);fn();c.restore();}
 function line(pts,color='#34425e',width=3,alpha=1){c.save();c.globalAlpha*=alpha;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.strokeStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();}
 function fill(path,color){const g=c.createLinearGradient(-40,-45,35,48);g.addColorStop(0,'#fff1df');g.addColorStop(.22,color);g.addColorStop(1,color);c.fillStyle=g;c.fill(path);c.strokeStyle='#273851';c.lineWidth=2.4;c.stroke(path);}
 function oval(x,y,rx,ry,color){const path=new Path2D();path.ellipse(x,y,rx,ry,0,0,tau);fill(path,color);}
 function poly(pts,color){const path=new Path2D();pts.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y));path.closePath();fill(path,color);}
 function box(x,y,w,h,r,color){const path=new Path2D();path.roundRect(x,y,w,h,r);fill(path,color);}
 function face(x,y,mood='happy',s=1){local(x,y,s,0,()=>{
  if(mood==='sleep'){line([[-12,-3],[-6,0],[-1,-3]],'#273851',2);line([[5,-3],[11,0],[16,-3]],'#273851',2);}else{for(const xx of [-9,10]){oval(xx,-3,3,mood==='shock'?6:4,'#273851');c.fillStyle='#fff';c.fillRect(xx-1,-5,1.4,1.7);}}
  c.strokeStyle='#273851';c.lineWidth=2;c.beginPath();if(mood==='sad'){c.arc(1,13,7,Math.PI*1.13,Math.PI*1.87);}else if(mood==='shock'){c.ellipse(1,10,4,6,0,0,tau);}else{c.arc(1,3,8,.1,Math.PI-.1);}c.stroke();
  c.save();c.globalAlpha*=.55;oval(-18,5,5,2,'#ff7eab');oval(19,5,5,2,'#ff7eab');c.restore();
 });}
 function prop(type,x,y,s=1,a=0,col='#a8dcff',mood='happy'){
  local(x,y,s*1.22,a,()=>{
   // Highlighted enamel silhouettes have real dark edges and warm reflected light.
   switch(type){
    case 'star':{const pts=[];for(let j=0;j<10;j++){const angle=-Math.PI/2+j*Math.PI/5,r=j%2?17:35;pts.push([Math.cos(angle)*r,Math.sin(angle)*r]);}poly(pts,col);face(0,0,mood,.65);break;}
    case 'heart':{const path=new Path2D();path.moveTo(0,32);path.bezierCurveTo(-63,-2,-26,-45,0,-17);path.bezierCurveTo(26,-45,63,-2,0,32);fill(path,col);face(0,-1,mood,.7);break;}
    case 'ghost':{const path=new Path2D();path.moveTo(-28,25);path.bezierCurveTo(-44,-62,43,-62,29,25);path.lineTo(18,17);path.lineTo(6,29);path.lineTo(-7,18);path.lineTo(-18,27);path.closePath();fill(path,col);face(0,-3,mood,.9);break;}
    case 'grub':case 'bean':case 'frog':case 'cat':case 'rat':case 'crab':case 'duck':{
     if(type==='frog'){oval(-21,-22,13,14,col);oval(21,-22,13,14,col);}if(type==='cat'){poly([[-31,-9],[-27,-39],[-4,-18]],col);poly([[31,-9],[27,-39],[4,-18]],col);}if(type==='rat'){oval(-23,-22,16,16,col);oval(23,-22,16,16,col);oval(-23,-22,8,8,'#ffbdce');oval(23,-22,8,8,'#ffbdce');}
     if(type==='crab'){for(const side of [-1,1]){for(let j=0;j<3;j++)line([[side*20,j*8],[side*41,10+j*10]],col,5);oval(side*41,-20,13,16,col);line([[side*25,-1],[side*38,-16]],col,5);}}
     oval(0,0,type==='grub'?33:29,type==='bean'?36:26,col);if(type==='duck'){oval(20,9,19,7,'#ffbb65');face(-6,-3,mood,.6);}else face(0,-3,mood,.8);
     for(const side of [-1,1]){line([[side*15,22],[side*21,31+Math.sin(t*6+side)*5]],'#34425e',5);if(!['crab','duck'].includes(type))line([[side*24,2],[side*36,-8+Math.sin(t*5+side)*12]],col,6);}
     if(type==='grub'){poly([[-20,-21],[-8,-47],[0,-22]],'#fff0b1');poly([[4,-23],[20,-41],[24,-16]],'#fff0b1');}break;}
    case 'dragon':case 'serpent':{
     const tail=new Path2D();tail.moveTo(-18,18);tail.bezierCurveTo(-82,52,-48,81,-90,56);c.strokeStyle='#273851';c.lineWidth=15;c.stroke(tail);c.strokeStyle=col;c.lineWidth=10;c.stroke(tail);
     for(const side of [-1,1])poly([[side*18,7],[side*58,-31],[side*54,16],[side*41,7],[side*27,26]],col);
     oval(0,6,25,30,col);oval(7,-23,32,25,col);oval(27,-14,20,12,col);poly([[-16,-40],[-17,-62],[0,-44]],'#ffe4a4');poly([[21,-42],[31,-59],[32,-37]],'#ffe4a4');face(6,-25,mood,.85);oval(3,13,12,20,'#ffedb7');break;}
    case 'cloud':{for(const[x,y,r]of [[-23,2,20],[0,-10,27],[27,5,20]])oval(x,y,r,r,col);box(-29,0,59,21,10,col);face(0,4,mood,.65);break;}
    case 'coin':oval(0,0,28,32,'#f4bf64');oval(0,0,21,25,'#ffe79b');line([[0,-15],[0,15]],'#b27848',3);line([[-7,-11],[8,-11],[-8,11],[7,11]],'#b27848',2);break;
    case 'crown':poly([[-35,21],[-40,-22],[-15,-7],[0,-35],[15,-7],[40,-22],[35,21]],'#ffda80');box(-34,13,68,13,4,'#edb460');for(const xx of [-22,0,22])oval(xx,8,4,6,col);break;
    case 'cup':{box(-24,-27,48,46,9,col);const path=new Path2D();path.ellipse(31,-7,12,16,0,0,tau);c.strokeStyle='#ffe29c';c.lineWidth=7;c.stroke(path);box(-6,19,12,17,4,'#ffe29c');box(-27,34,54,8,4,'#ffe29c');face(0,-4,mood,.7);break;}
    case 'sword':poly([[-9,19],[-10,-34],[0,-56],[10,-34],[9,19]],'#ccecff');line([[0,-44],[0,15]],'#fff',2);box(-26,15,52,9,4,col);box(-5,24,10,24,3,'#7b609c');oval(0,49,7,7,col);break;
    case 'hammer':box(-5,-5,10,59,4,'#c28b68');box(-33,-28,66,28,8,col);line([[-24,-21],[22,-21]],'#fff',2,.7);face(0,-13,mood,.65);break;
    case 'potion':case 'flask':{box(-10,-38,20,29,5,'#bddbfa');oval(0,11,28,30,'#d0edff');c.save();c.globalAlpha*=.78;oval(0,20,24,19,col);c.restore();box(-14,-43,28,9,3,'#cfaa83');face(0,12,mood,.7);line([[-16,0],[-19,11]],'#fff',3);break;}
    case 'book':poly([[-35,-28],[-3,-21],[0,34],[-35,26]],col);poly([[0,-21],[35,-28],[35,26],[0,34]],'#fff0d3');for(let j=0;j<4;j++)line([[7,-12+j*10],[27,-15+j*10]],'#b496aa',1.3);line([[0,-20],[0,31]],'#695f92',3);break;
    case 'castle':box(-29,-2,58,42,6,col);for(const xx of [-25,25]){box(xx-12,-29,24,60,5,col);for(let j=0;j<3;j++)box(xx-13+j*9,-37,7,15,2,col);}box(-8,12,16,28,8,'#796a9b');face(0,0,mood,.65);break;
    case 'eye':oval(0,0,37,25,'#fff1dc');oval(0,0,17,20,col);oval(Math.sin(t*2)*4,0,7,11,'#30425c');oval(-4,-7,4,4,'#fff');for(let j=-1;j<=1;j++)line([[j*22,-20],[j*26,-34]],'#34425e',3);break;
    case 'mushroom':box(-10,0,20,37,7,'#ffeecb');oval(0,-9,37,25,col);for(const[xx,yy]of [[-19,-15],[5,-22],[23,-4]])oval(xx,yy,6,6,'#fff3df');face(0,18,mood,.65);break;
    case 'rocket':{poly([[0,-47],[23,-12],[19,31],[-19,31],[-23,-12]],col);oval(0,-3,11,13,'#b0edff');poly([[-19,13],[-34,36],[-17,29]],'#ffb9c8');poly([[19,13],[34,36],[17,29]],'#ffb9c8');poly([[-11,32],[0,57+Math.sin(t*20)*8],[11,32]],'#ffce85');break;}
    case 'plane':poly([[-44,-18],[43,0],[-39,24],[-13,1]],col);line([[-13,1],[43,0]],'#fff',2);break;
    case 'moon':{oval(0,0,30,33,col);c.save();c.globalCompositeOperation='destination-out';c.beginPath();c.ellipse(17,-11,23,26,0,0,tau);c.fill();c.restore();break;}
    case 'note':line([[10,13],[10,-31],[31,-22]],col,5);oval(0,17,13,9,col);break;
    case 'bow':poly([[-30,-15],[-6,0],[-30,17]],col);poly([[30,-15],[6,0],[30,17]],col);oval(0,0,8,10,'#ffe6a9');break;
    case 'balloon':oval(0,-8,24,32,col);poly([[-4,23],[4,23],[0,31]],col);line([[0,31],[Math.sin(t*3)*12,51],[0,76]],'#d6defa',1.5);line([[-13,-22],[-17,-10]],'#fff',3);break;
    case 'disco':{oval(0,0,31,31,col);for(let j=-2;j<=2;j++){line([[j*10,-26],[j*10,26]],'#fff',1,.7);line([[-26,j*10],[26,j*10]],'#fff',1,.7);}break;}
    case 'violin':{oval(0,19,21,27,col);oval(0,-18,18,24,col);box(-4,-68,8,68,2,'#c88d67');line([[-7,-58],[-7,36]],'#ffecc1',1);line([[2,-58],[2,36]],'#ffecc1',1);line([[-25,36],[28,-43]],'#ffdf9b',4);break;}
    case 'cake':{box(-30,-8,60,40,10,col);for(let j=-2;j<=2;j++)oval(j*12,-9,9,10,'#fff1cf');line([[0,-15],[0,-37]],'#afcfff',6);oval(0,-45,5,10,'#ffc977');face(0,14,mood,.7);break;}
    case 'alarm':oval(0,0,29,29,col);oval(0,0,22,22,'#fff2d7');line([[0,-15],[0,0],[13,6]],'#34425e',3);for(const side of [-1,1]){oval(side*25,-26,12,8,col);line([[side*16,24],[side*24,34]],'#34425e',4);}break;
    case 'paw':oval(0,10,22,18,col);for(let j=0;j<4;j++)oval(-24+j*16,-13-Math.sin(j*Math.PI/3)*9,8,10,col);break;
    case 'gear':{const pts=[];for(let j=0;j<32;j++){const a=j*tau/32,r=j%4<2?33:26;pts.push([Math.cos(a)*r,Math.sin(a)*r]);}poly(pts,col);oval(0,0,11,11,'#42516e');break;}
    case 'bolt':poly([[-1,-37],[21,-37],[7,-8],[25,-8],[-16,39],[-5,8],[-23,8]],col);break;
    default:prop('star',0,0,1,0,col,mood);
   }
  });
 }
 function trail(fn,col,phase=0,width=3){const head=p*1.4-phase;for(let j=0;j<28;j++){const a=head-.22+j*.22/28,b=a+.22/28;if(a<0||b>1)continue;line([fn(a),fn(b)],col,width,(j/28)**2*.7);}if(head>0&&head<1){const[x,y]=fn(head);local(x,y,1,0,()=>oval(0,0,3,3,'#fff4cc'));}}
 function ribbon(fn,col,width=12,alpha=.24,phase=0){const pts=Array.from({length:45},(_,i)=>fn(i/44));line(pts,col,width,alpha*.36);line(pts,col,width*.34,alpha*.65);line(pts,'#edf8ff',.8,alpha);trail(fn,col,phase,2.5);}
 function garland(fn,type,col,n=11,size=.19,phase=0){const pts=Array.from({length:40},(_,i)=>fn(i/39));line(pts,col,1.2,.4);for(let j=0;j<n;j++){const u=j/(n-1),[x,y]=fn(u);prop(type,x,y+Math.sin(t*2+j+phase)*5,size,Math.sin(t*1.6+j)*.16,col);}}
 function sparkle(x,y,s,col,a=0){local(x,y,s,a,()=>{poly([[0,-12],[3,-3],[12,0],[3,3],[0,12],[-3,3],[-12,0],[-3,-3]],col);});}
 function scatter(x,y,col,count=8,phase=0){const q=Math.max(0,Math.min(1,(p-phase)*1.8));c.save();c.globalAlpha*=Math.sin(q*Math.PI);for(let j=0;j<count;j++){const a=j*tau/count+.15;const r=20+q*75;local(x+Math.cos(a)*r,y+Math.sin(a)*r*.7,.35+j%3*.08,a+t,()=>box(-4,-8,8,16,2,col));}c.restore();}
 function bubbles(x,y,col,count=7){for(let j=0;j<count;j++){const q=Math.max(0,Math.min(1,p*1.6-j*.08));c.save();c.globalAlpha*=Math.sin(q*Math.PI)*.5;local(x+Math.sin(j*2+q*4)*28,y-q*170,1,0,()=>{c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.arc(0,0,5+j%4*2,0,tau);c.stroke();line([[-2,-3],[0,-4]],'#fff',1);});c.restore();}}
 function words(text,x,y,col='#e7ecff',size=18){c.save();c.font=`800 ${size}px "Trebuchet MS","Segoe UI",sans-serif`;c.textAlign='center';c.lineWidth=4;c.strokeStyle='#273851';c.strokeText(text,x,y);c.fillStyle=col;c.fillText(text,x,y);c.restore();}
 return {c,t,d,p,tau,colors,local,line,oval,poly,box,face,prop,trail,ribbon,garland,sparkle,scatter,bubbles,words};
}
