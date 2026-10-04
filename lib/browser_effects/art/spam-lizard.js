function spamLizard(c,t,d,e){
 const {p,sprite,local,line,disc,ring,curve,poly,bubble,burst,metal}=spamInk(c,t,d,e);
 const mint='#a7e1bd',coral='#ef939e',ice='#a6e4ed',gold='#ecd08d';
 const press=smooth((p-.20)/.14),release=1-smooth((p-.72)/.15),hit=press*release;
 // Raised-hand and contact poses share the same stage and button position.
 sprite('lizard',0,105,346,206,{alpha:1-press,angle:-.025+hit*.02});
 sprite('lizard',1,105,346+hit*3,206,{alpha:press,angle:-.025+hit*.02});
 sprite('lizard',2,1810,462-Math.sin(p*Math.PI)*8,204,{angle:Math.sin(p*5)*.025});
 sprite('lizard',2,1185,73,133,{flip:true,angle:-.03});
 sprite('lizard',1,687,1004,160,{stretch:1-hit*.035});
 sprite('lizard',0,1288,1004,151,{flip:true,angle:Math.sin(p*4)*.035});
 // Button pulses travel as little contact rings, confined to the four edges.
 for(let j=0;j<3;j++){const age=(p-.25-j*.08)/.65;if(age<0||age>1)continue;
  ring(130,394,17+age*63,5+age*19,coral,1.8,(1-age)*.7);
 }
 for(const side of [0,1])for(let j=0;j<7;j++){
  const x=side?1905:14,y=201+j*68,bright=.25+.65*smooth((p-j*.06)/.12);
  local(x,y,1,0,()=>{disc(0,0,8,8,metal([-8,-8,8,8],['#fff3dc',j%2?coral:ice,'#4e687e',mint]),bright);ring(0,0,11,11,ice,1,.45);});
 }
 // Real food props respond to the popcorn cameo, rather than abstract confetti.
 const kernel=(x,y,s,a)=>local(x,y,s,a,()=>{
  disc(-2,0,4,4,'#f5e6b2');disc(3,-2,4,4,'#fff7d7');disc(1,4,4,3,gold);disc(0,0,2,2,'#d7ba76');
 });
 for(let j=0;j<10;j++){
  const a=Math.max(0,(p-j*.035)/.9),x=1820+Math.sin(j*2.3)*51+a*23,y=438-a*109+a*a*96;
  kernel(x,y,.65+j%3*.2,j+p*4);
 }
 for(let j=0;j<9;j++)kernel(368+j*151,30+Math.sin(j+p*5)*10,.6,j*.8+p);
 // Tiny ticket stubs and cinema spectacles give the top a separate silhouette.
 for(const[x,y,a]of [[541,68,-.12],[1465,67,.12]])local(x,y,1,a,()=>{
  poly([[-38,-16],[38,-16],[38,-6],[31,0],[38,6],[38,16],[-38,16],[-38,6],[-31,0],[-38,-6]],'#ebadc8');
  for(let j=0;j<5;j++)line([[18,-11+j*5],[18,-9+j*5]],'#f9f1d3',1,.8);
  ring(-9,0,6,6,ice,1.3,.8);
 });
 for(let j=0;j<7;j++)bubble(1888+Math.sin(j+p*2)*14,228+j*58-p*17,4+j%3*2,mint,.45);
 burst(130,394,(p-.28)/.62,gold,8,47);
 curve(u=>[352+u*1209,1055+Math.sin(u*12+p*3)*5],mint,1.4,.45);
}
