// Stateless drawing vocabulary, not a frame template. Each score authors its own
// spatial routes, actors and consequences. Only the existing presentation clock runs.
const borderClamp=v=>Math.max(0,Math.min(1,v));
const borderEase=(p,a,b)=>smooth((p-a)/(b-a));
function borderInk(c,e){
 const I=storyInk(c,e),{at,line,poly,oval,ring,curve}=I,p=I.p;
 const fade=(a,fn)=>{if(a<=0)return;c.save();c.globalAlpha*=borderClamp(a);fn();c.restore();};
 const glow=(pts,col,w=3,a=1)=>{line(pts,col,w+17,a*.055);line(pts,col,w+7,a*.18);line(pts,col,w,a);};
 const trace=(fn,col,w=3,a=1)=>glow(Array.from({length:49},(_,i)=>fn(i/48)),col,w,a);
 const route=(pts,q,col,w=3)=>{q=borderClamp(q);if(!q)return;const lens=pts.slice(1).map((b,i)=>Math.hypot(b[0]-pts[i][0],b[1]-pts[i][1])),total=lens.reduce((a,b)=>a+b,0);let left=q*total;const done=[pts[0]];for(let i=0;i<lens.length;i++){const t=Math.min(1,left/lens[i]),a=pts[i],b=pts[i+1];done.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);left-=lens[i];if(left<=0)break;}glow(done,col,w,q===1?.2:.3);if(q<1){let distance=0;const tail=[];for(let i=0;i<lens.length;i++){const lo=Math.max(0,((q-.20)*total-distance)/lens[i]),hi=Math.min(1,(q*total-distance)/lens[i]);if(hi>0&&lo<hi){const a=pts[i],b=pts[i+1];tail.push([a[0]+(b[0]-a[0])*lo,a[1]+(b[1]-a[1])*lo],[a[0]+(b[0]-a[0])*hi,a[1]+(b[1]-a[1])*hi]);}distance+=lens[i];}glow(tail,col,w+1,.95);}return done.at(-1);};
 const spark=(x,y,q,col,n=11,r=80)=>{if(q<=0||q>=1)return;fade((1-q)**1.5,()=>{for(let j=0;j<n;j++){const a=j*TAU/n+.3,rr=12+q*r*(.5+(j%3)*.2);glow([[x+Math.cos(a)*rr,y+Math.sin(a)*rr],[x+Math.cos(a)*(rr+12),y+Math.sin(a)*(rr+12)]],col,j%3===0?4:2);}});};
 const gem=(x,y,s,col,rot=0)=>at(x,y,s,rot,()=>{poly([[0,-28],[22,-8],[15,22],[0,30],[-19,17],[-24,-7]],col+'ad',col,2.5);poly([[0,-28],[-7,-7],[0,30],[-19,17],[-24,-7]],'#ffffff27',null);glow([[0,-28],[-7,-7],[0,30],[9,-7],[0,-28]],col,1.7);line([[-24,-7],[22,-8]],'#eeffff',1,.7);});
 const shield=(x,y,s,col)=>at(x,y,s,0,()=>{poly([[-31,-29],[0,-40],[31,-29],[28,12],[0,38],[-28,12]],col+'99',col,3);poly([[-31,-29],[0,-40],[0,38],[-28,12]],'#ffffff16',null);glow([[-21,-22],[0,-30],[21,-22],[18,8],[0,25],[-18,8],[-21,-22]],'#efffe2',1.4);});
 const blade=(x,y,s,a,col)=>at(x,y,s,a,()=>{poly([[0,-78],[11,-40],[7,8],[-7,8],[-11,-40]],col+'80',col,2);glow([[0,-67],[0,6]],'#f3ffff',2);line([[-20,11],[20,11]],'#ffd38b',7);line([[0,13],[0,37]],'#bd84ee',9);oval(0,39,6,6,'#ffd38b');});
 const crown=(x,y,s,col)=>at(x,y,s,0,()=>{poly([[-36,15],[-44,-27],[-18,-10],[0,-38],[18,-10],[44,-27],[36,15]],col+'55',col,3);glow([[-31,8],[31,8]],col,3);gem(0,0,.24,'#fff3cd');});
 const eye=(x,y,s,col,open=1)=>at(x,y,s,0,()=>{trace(u=>[-41+82*u,Math.sin(u*Math.PI)*-23*open],col,3);trace(u=>[-41+82*u,Math.sin(u*Math.PI)*23*open],col,3);oval(0,0,8,Math.max(1,13*open),col);oval(-3,-4*open,2,2,'#fff');});
 const tower=(x,y,s,col,fall=0)=>at(x,y,s,0,()=>{for(let j=0;j<4;j++)for(const dir of [-1,1])at(dir*(12+fall*(14+j*11)),(23-j*19)*(1-fall)+fall*(27-j%2*12),1,dir*fall*(.2+j*.13),()=>{poly([[-12,0],[-12,-16],[11,-16],[11,0]],col+'99',col,2);line([[-9,-13],[8,-13]],'#ffefcd',1.2,.6);});for(let j=0;j<3;j++)at(-22+j*22+fall*(j-1)*44,-60*(1-fall)+fall*29,1,fall*(j-1)*.9,()=>poly([[-7,4],[-7,-12],[7,-12],[7,4]],col+'bb',col,2));});
 const helm=(x,y,s,col,dead=false)=>at(x,y,s,0,()=>{poly([[-22,16],[-26,-12],[-13,-31],[13,-31],[26,-12],[22,16],[0,24]],col+'55',col,2.5);line([[-17,-5],[17,-5]],'#f6eddb',3);if(dead){line([[-7,-17],[7,-2]],col,2);line([[7,-17],[-7,-2]],col,2);}else line([[0,-24],[0,13]],col,4);});
 const minion=(x,y,s,col,step=0)=>at(x,y,s,0,()=>{poly([[-23,15],[-19,-22],[0,-35],[19,-22],[23,15]],col+'d0',col,2);poly([[-13,14],[0,7],[13,14]],'#fff2cb55',null);oval(0,-1,12,10,'#16273e');for(const z of [-1,1]){oval(z*5,-2,2.6,2.4,'#fff5cb');line([[z*10,14],[z*(15+step*4),26-z*step*5]],col,5);oval(z*23,3,5,7,col);}line([[-25,1],[-29,15]],col,5);line([[24,0],[34,-21]],'#ffe09a',3);line([[-12,-21],[0,-29],[12,-21]],'#f0ffe8',1.4,.8);});
 const flask=(x,y,s,col,q=.65,tilt=0)=>at(x,y,s,tilt,()=>{poly([[-12,-34],[12,-34],[12,-8],[29,25],[23,35],[-23,35],[-29,25],[-12,-8]],'#142d3caa',col,3);poly([[-23,24-q*33],[23,24-q*33],[25,25],[20,30],[-20,30],[-25,25]],col+'90',null);line([[-16,-35],[16,-35]],'#eceacd',5);for(let j=0;j<3;j++)ring(-11+j*10,18-j*9,2+j,2+j,col,1.3);});
 const wing=(x,y,s,col,flip=1,spread=1)=>at(x,y,s,0,()=>{poly([[0,18],[flip*23,-20],[flip*90*spread,-60],[flip*63*spread,-14],[flip*96*spread,1],[flip*51*spread,18],[flip*60*spread,42],[flip*18,30]],col+'91',col,2.5);for(const [xx,yy] of [[90,-60],[96,1],[60,42]])line([[0,18],[flip*23,-20],[flip*xx*spread,yy]],'#eaffdf',1,.6);glow([[0,18],[flip*23,-20],[flip*90*spread,-60]],col,3);});
 const dragon=(x,y,s,col,open=.5)=>at(x,y,s,0,()=>{for(const dir of [-1,1])at(dir*17,16,.58,-dir*.35,()=>wing(0,0,1,col,dir,.6+open*.4));poly([[-17,16],[-25,-7],[-26,-53],[-6,-28],[16,-56],[17,-23],[28,-5],[20,25],[0,39],[-16,24]],col+'ca',col,2);poly([[-13,7],[17,4],[19,22],[0,29],[-14,19]],'#f5e8bb66',null);for(const z of [-1,1]){glow([[z*5,-10],[z*14,-13]],'#fff6d5',3);oval(z*6,13,1.7,2,'#243348');}line([[-8,24],[7,25]],'#f5f1cf',2);});
 const bolt=(x,y,s,col)=>at(x,y,s,0,()=>poly([[3,-28],[-19,4],[-1,4],[-8,29],[22,-9],[5,-9]],col,col,1));
 const boot=(x,y,s,col,a=0)=>at(x,y,s,a,()=>{poly([[-18,-29],[8,-29],[8,-2],[28,9],[30,22],[-21,22],[-24,5]],col+'55',col,3);line([[-21,14],[26,14]],col,3);line([[-14,-18],[4,-18]],'#fff2d4',2);});
 const gear=(x,y,s,col,a=0)=>at(x,y,s,a,()=>{poly(Array.from({length:40},(_,j)=>{const a=j*TAU/40,r=j%4<2?37:29;return[Math.cos(a)*r,Math.sin(a)*r];}),col+'30',col,2);ring(0,0,16,16,col,3);});
 const question=(x,y,s,col)=>at(x,y,s,0,()=>{trace(u=>{const a=-Math.PI+u*Math.PI*1.6;return[Math.cos(a)*11,-12+Math.sin(a)*12];},col,2.5);line([[4,-1],[0,7]],col,2.5);oval(0,16,2.4,2.4,col);});
 const cloud=(x,y,s,col)=>at(x,y,s,0,()=>{oval(-32,0,27,16,col+'55',col);oval(-7,-12,29,25,col+'55',col);oval(26,-3,28,20,col+'55',col);});
 const arc=(x,y,rx,ry,a,b,col,w=3)=>trace(u=>[x+Math.cos(a+(b-a)*u)*rx,y+Math.sin(a+(b-a)*u)*ry],col,w);
 return {...I,fade,glow,trace,route,spark,gem,shield,blade,crown,eye,tower,helm,minion,flask,wing,dragon,bolt,boot,gear,question,cloud,arc,q:(a,b)=>borderEase(p,a,b)};
}
function borderTitle(I){
 const {c,e,p}=I;if(!e.title||!Number.isFinite(e.duration))return;
 I.fade(borderEase(p,.07,.19),()=>{c.font='900 32px "Segoe UI",sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineWidth=5;c.strokeStyle='#101728d9';c.strokeText(e.title,960,133,750);c.fillStyle='#fff0d6';c.fillText(e.title,960,133,750);});
}
