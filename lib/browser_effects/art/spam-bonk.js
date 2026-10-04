function spamBonk(c,t,d,e){
 const {p,sprite,local,line,disc,poly,ring,curve,burst,metal}=spamInk(c,t,d,e);
 const rose='#ed9fc0',ice='#b8e2eb',gold='#efd19c';
 const impact=smooth((p-.23)/.16),bounce=Math.sin(Math.max(0,p-.35)*Math.PI*3)*(1-impact*.4);
 sprite('bonk',0,111,380,212,{stretch:1-impact*.025});
 sprite('bonk',1,1806,475,215,{flip:true,angle:bounce*.018});
 sprite('bonk',2,634,75,135,{flip:true});
 sprite('bonk',1,1316,76,140);sprite('bonk',2,1212,1001,162);
 sprite('bonk',0,695,1004,157,{flip:true});
 // A soft mallet arcs down once; little spring coils take up the impact.
 local(95,279,1,-.9+impact*1.07,()=>{
  line([[0,42],[0,-15]],'#bdb6cc',8);line([[-2,36],[-2,-13]],ice,1.2);
  poly([[-33,-32],[33,-32],[38,-10],[33,8],[-33,8],[-38,-10]],metal([-38,-32,38,8],['#ffdeea',rose,'#b68caf','#e7b6d3']));
  ring(-28,-12,4,14,ice,1.1,.8);ring(28,-12,4,14,gold,1.1,.8);
 });
 for(const[x,y,a]of [[77,613,-.1],[1826,271,.1]])local(x,y,1,a,()=>{
  const length=74-impact*18;
  curve(u=>[Math.sin(u*TAU*5)*18,u*length],metal([-20,0,20,length],['#d9f1e8','#839da9','#eacbbc','#657c98']),4);
  line([[-28,0],[28,0]],rose,5);line([[-28,length],[28,length]],ice,5);
 });
 for(const[x,y]of [[104,317],[1810,388]]){
  burst(x,y,(p-.3)/.7,gold,10,47);
  for(let j=0;j<5;j++){const a=j*TAU/5+p*5,r=29+impact*13;
   local(x+Math.cos(a)*r,y+Math.sin(a)*r*.5,.37,a,()=>poly([[0,-8],[3,-2],[9,0],[3,3],[0,9],[-3,3],[-9,0],[-3,-2]],j%2?ice:gold,.7));
  }
 }
 for(let j=0;j<11;j++){const x=375+j*119,y=1048;
  ring(x,y,5+Math.sin(p*5+j)**2*3,5,rose,1.2,.6);
 }
}
