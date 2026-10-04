// One decoded photographic sheet; all motion follows the owning croak's clock.
const momFrogSprites=new ScenicLayers({frog:ATLAS_DATA.momFrog});
function momFrogConcert(c,t,d){
 frogBorder(c,t,d);
 const p=Math.max(0,Math.min(1,t/d)),q=smooth(p);
 const {line,poly,disc,curve,metal,ring}=cueInk(c,t,d,{});
 const mint='#92d8b9',rose='#e9adc8',ice='#b8e9ee',gold='#e7c78d';
 const local=(x,y,s,angle,draw)=>{c.save();c.translate(x,y);c.rotate(angle);c.scale(s,s);draw();c.restore();};
 const pad=(x,y,s,phase)=>local(x,y,s,Math.sin(p*3+phase)*.035,()=>{
  const shade=metal([-55,-13,50,12],['#d6edbc','#609c86','#285c62','#a8cdb4']);
  c.beginPath();c.ellipse(0,0,58,15,0,.25,TAU-.25);c.lineTo(0,0);c.closePath();c.fillStyle=shade;c.fill();
  for(let j=0;j<5;j++){const a=j*1.05+.55;line([[0,0],[Math.cos(a)*49,Math.sin(a)*11]],'#d7f1c1',.8,.65);}
  for(let j=0;j<3;j++)ring(0,5,64+j*14+q*19,15+j*3+q*5,ice,1,.42*(1-p*.7));
 });
 const frog=(index,x,y,size,phase,flip=false,prop='')=>{
  const hop=Math.sin(Math.PI*p)*Math.sin(Math.PI*p+phase)*11;
  pad(x,y+size*.21,size/135,phase);
  local(x,y-hop,1,Math.sin(p*5+phase)*.045,()=>{
   c.scale(flip?-1:1,1);
   momFrogSprites.draw(c,'frog',[{source:[index/3,0,1/3,1],target:[-size/2,-size/2,size,size]}],0);
   if(prop==='crown'){
    const yy=-size*.245;
    poly([[-17,yy],[-22,yy-22],[-8,yy-13],[0,yy-29],[8,yy-13],[22,yy-22],[17,yy]],metal([-22,yy-29,22,yy],['#fff3bc',gold,'#8f817b',gold]));
    line([[-17,yy-3],[17,yy-3]],'#fff7d6',1.4);disc(0,yy-19,3,3,rose);
   }
   if(prop==='bow'){
    const yy=size*.05;
    poly([[-3,yy],[-20,yy-9],[-20,yy+9]],rose);poly([[3,yy],[20,yy-9],[20,yy+9]],rose);disc(0,yy,4,4,gold);
   }
  });
 };
 const mic=(x,y,angle)=>local(x,y,1,angle,()=>{
  curve(u=>[-16+Math.sin(u*5)*15,20+u*43],gold,1.4,.8);
  line([[0,11],[0,42]],'#829da5',4);line([[-16,42],[16,42]],'#d4e4db',3);
  disc(0,0,10,16,metal([-10,-16,10,16],['#eefaf5','#597987','#b4cbd0','#354d60']));
  for(let j=0;j<5;j++)line([[-6,-9+j*4],[6,-9+j*4]],'#243e4a',1,.85);
  ring(0,0,14,20,gold,1.4,.8);
 });
 // Unequal little stages keep the original frog recognizable at every angle.
 frog(0,107,352,180,0,false,'crown');mic(180,365,-.3);
 frog(1,1811,458,168,.5,false,'bow');mic(1745,481,.3);
 frog(2,101,602,145,1.3,true);mic(175,617,-.22);
 frog(2,1819,254,125,2.1);mic(1758,271,.26);
 frog(0,644,70,132,.4,false,'bow');
 frog(1,1295,76,145,1.6,false,'crown');
 frog(2,672,1002,137,1.1,true);
 frog(0,1252,1002,157,2.2);
 // A pearl-pink lotus and silver croak ripples answer each miniature performer.
 for(const[x,y,s]of [[442,1009,.8],[1484,1005,1],[1015,64,.7]])local(x,y,s,0,()=>{
  for(let j=0;j<7;j++){const a=-Math.PI+j*Math.PI/6;
   c.save();c.translate(Math.cos(a)*17,Math.sin(a)*15);c.rotate(a+Math.PI/2);
   const shade=metal([-12,-29,12,15],['#fff0e5',rose,'#8b8dba','#e8c3d7']);
   c.beginPath();c.moveTo(0,-32);c.bezierCurveTo(20,-9,20,16,0,20);c.bezierCurveTo(-20,16,-20,-9,0,-32);c.fillStyle=shade;c.fill();c.restore();
  }disc(0,0,9,6,gold);
 });
 for(const side of [0,1]){
  const x=side?1905:15;
  for(let j=0;j<5;j++){const yy=680-j*38;
   curve(u=>[x+Math.sin(u*2+p*1.8+j)*19,yy-u*(90+j*16)],mint,2,.7);
   local(x+Math.sin(2+p*1.8+j)*19,yy-(90+j*16),1,.2+side*.6,()=>{
    disc(0,0,4,15,metal([-4,-15,4,15],['#f1ddba','#948265','#547979',gold]));
   });
  }
  for(let j=0;j<9;j++){
   const age=(p*.65+j*.113)%1,yy=205+j*52-q*23,xx=(side?1875:48)+Math.sin(j+p*3)*16;
   const r=4+age*9;ring(xx,yy,r,r,ice,1,.6*(1-age));
   curve(u=>[xx-r*.7+u*r*.8,yy-r*.45-Math.sin(u*Math.PI)*r*.4],'#f1ffed',1.5,.64);
  }
 }
 for(let j=0;j<25;j++){
  const x=355+j*49,y=25+Math.sin(j*.6+p*4)*9;
  line([[x-3,y],[x+3,y]],j%2?gold:ice,1,.65);line([[x,y-3],[x,y+3]],rose,1,.6);
 }
 for(const[x,y]of [[107,352],[1811,458],[101,602],[1819,254]])for(let j=0;j<3;j++){
  const r=24+j*13+q*32;ring(x,y-18,r,r*.48,[mint,ice,rose][j],1.1,(1-p)*.48);
 }
}
