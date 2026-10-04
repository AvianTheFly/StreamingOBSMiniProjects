// Death's continuous clock comes from observed state. No result, timer or scene policy.
function soulPerformance(c,death){
 const {w,o,t,line,poly,metal,place,arc,wake,shard,ring,motes}=eventInk(c,{elapsed:death.elapsed||0,duration:Infinity});
 const blue=death.worth?'#c9ddbd':'#a8d4ef',pearl='#deddf0',gold='#dcc79c';
 c.save();c.globalAlpha*=smooth(t/1.25);
 // Four staggered soul lanterns have different etched windows and pendulum phases.
 for(const[x,y,s,phase]of [[66,298,1.08,0],[1849,382,1.06,1.7],[43,655,.74,3.3],[1880,627,.64,4.8]]){
  const swing=Math.sin(t*.55+phase)*.055;
  place(x,y,s,swing,()=>{
   line([[0,-128],[0,-65]],gold,.9,.6);ring(0,-66,9,7,gold,1.3,.8);
   poly([[-32,-44],[-15,-61],[15,-61],[32,-44],[26,35],[12,48],[-12,48],[-26,35]],metal([-32,-61,32,48],['#c7d1dd','#4f7087','#b6b2c7','#385670']),.85);
   poly([[-20,-37],[20,-37],[16,30],[0,39],[-16,30]],blue,.13);line([[-20,-37],[-16,30],[0,39],[16,30],[20,-37]],blue,1.2,.75);
   for(let j=0;j<3;j++){const yy=-23+j*19;line([[-17,yy],[0,yy-8],[17,yy]],pearl,.8,.65);}
   o.ribbon(u=>[Math.sin(u*7+t*.7+phase)*9,23-u*49],{width:10,color:blue,secondary:pearl,phase:t*.22+phase,glass:true,alpha:.74});
   w.mist(0,3,23,40,blue,.7);line([[-32,-44],[32,-44]],gold,2,.75);line([[-26,35],[26,35]],gold,1.4,.75);
  });w.mist(x,y,62*s,113*s,blue,.23);
 }
 // The top hourglass has an actual remaining-life fill and a flowing sand thread.
 place(1444,66,.63,.12,()=>{
  line([[-33,-54],[33,-54]],gold,4,.8);line([[-33,54],[33,54]],gold,4,.8);line([[-26,-48],[-26,48]],blue,2,.65);line([[26,-48],[26,48]],blue,2,.65);
  poly([[-20,-44],[20,-44],[7,-4],[7,4],[20,44],[-20,44],[-7,4],[-7,-4]],'#b9e4f225',.83);
  const fill=Number.isFinite(death.remaining)?Math.min(1,Math.max(0,death.remaining)/35):.6;
  poly([[-16*fill,-38],[16*fill,-38],[0,-5]],blue,.48);poly([[-17,41],[17,41],[0,41-(1-fill)*28]],pearl,.43);wake(u=>[Math.sin(u*5+t*.7)*1.5,-4+u*35],gold,0,1.1,.12,.62);
  line([[-20,-44],[-7,-4],[-7,4],[-20,44]],pearl,1,.7);line([[20,-44],[7,-4],[7,4],[20,44]],blue,1,.6);
 });
 // Soul silk floats at two unequal edges, carrying light rather than an opaque wall.
 for(const [x,sgn,j]of [[17,1,0],[1901,-1,1]])for(let n=0;n<3;n++){
  const path=u=>[x+sgn*(Math.sin(u*10+t*.16+j+n*.32)*18+n*9),932-u*751];
  o.ribbon(path,{width:11+n*4,color:blue,secondary:pearl,phase:t*.13+n+j,glass:true,alpha:.31});wake(path,n%2?gold:blue,n*.24+j*.14,1.4,.21,.071+n*.008);
 }
 // Soul moths: absolute serials select their route and wing phases, no visible reset.
 motes(24,11,.46,(u,j,r,a)=>{
  const x=j%2?1853+Math.sin(u*7+j)*33:58+Math.sin(u*6+j)*34,y=1048-u*855;
  c.save();c.globalAlpha*=a*.64;c.translate(x,y);c.rotate(Math.sin(j+u*2)*.35);const wing=3+Math.abs(Math.sin(t*3.2+j))*8;
  w.petal(-wing*.7,0,wing,blue,-.55,.86);w.petal(wing*.7,0,wing,pearl,.55,.86);line([[0,-5],[0,5]],gold,1.1,.8);c.restore();
 });
 // Long top and lower constellations have staggered charge routes and hanging charms.
 for(let j=0;j<13;j++){const x=350+j*86,y=1058+Math.sin(t*.2+j*.4)*7;shard(x,y,5+j%3*2,j%2?blue:pearl,Math.sin(t*.2+j)*.1);if(j<12)wake(u=>[x+8+u*69,y+Math.sin(u*Math.PI)*4],j%2?blue:gold,j*.11,1.2,.25,.046);}
 for(let j=0;j<5;j++){const x=438+j*211;line([[x,8],[x,28]],gold,.8,.4);ring(x,38,8,14,pearl,.9,.6);shard(x,38,5,blue,.1);}
 c.restore();
}
