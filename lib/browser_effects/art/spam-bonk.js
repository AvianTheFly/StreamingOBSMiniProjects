function spamBonk(c,t,d,e){
 const {p,sprite,local,line,disc,poly,ring,curve,burst,metal}=spamInk(c,t,d,e);
 const rose='#ed9fc0',ice='#b8e2eb',gold='#efd19c';
 const motion=soundContactMotion('bonk',t),impact=motion.approach,bounce=Math.sin(Math.max(0,motion.age/d)*Math.PI*3)*(1-p);
 // The helmet begins at y=318 in this native atlas placement. Its mallet's
 // lower face ends at that same coordinate, and all burst work uses it too.
 sprite('bonk',1,106,430,224);
 sprite('bonk',2,1808,521,232,{angle:bounce*.035});
 sprite('bonk',0,701,1010,168,{flip:true,angle:bounce*.018});
 sprite('bonk',1,1326,1007,171);
 const contact={x:106,y:318},headY=contact.y-4-(1-impact)*86;
 local(contact.x-(1-impact)*43,headY,1,-.48*(1-impact),()=>{
  line([[0,-23],[0,-91]],'#bdb6cc',8);line([[-2,-27],[-2,-88]],ice,1.2);
  poly([[-33,-26],[33,-26],[38,-17],[33,4],[-33,4],[-38,-17]],metal([-38,-26,38,4],['#ffdeea',rose,'#b68caf','#e7b6d3']));
  ring(-28,-11,4,11,ice,1.1,.8);ring(28,-11,4,11,gold,1.1,.8);
 });
 for(const[x,y,a]of [[77,613,-.1],[1826,271,.1]])local(x,y,1,a,()=>{
  const length=74-impact*18;
  curve(u=>[Math.sin(u*TAU*5)*18,u*length],metal([-20,0,20,length],['#d9f1e8','#839da9','#eacbbc','#657c98']),4);
  line([[-28,0],[28,0]],rose,5);line([[-28,length],[28,length]],ice,5);
 });
 for(const[x,y]of [[106,318],[1808,412]]){
  burst(x,y,motion.age/Math.max(.05,d-motion.contact),gold,10,47);
  for(let j=0;j<5;j++){const a=j*TAU/5+p*5,r=29+impact*13;
   local(x+Math.cos(a)*r,y+Math.sin(a)*r*.5,.37,a,()=>poly([[0,-8],[3,-2],[9,0],[3,3],[0,9],[-3,3],[-9,0],[-3,-2]],j%2?ice:gold,.7));
  }
 }
 for(let j=0;j<11;j++){const x=375+j*119,y=1048;
  ring(x,y,5+Math.sin(p*5+j)**2*3,5,rose,1.2,.6);
 }
}
