function spamQuack(c,t,d,e){
 const {p,sprite,local,line,disc,poly,curve,ring,metal}=spamInk(c,t,d,e);
 const aqua='#83d9d4',coral='#ed969c',gold='#edcc86',ice='#c6e8ed';
 const quack=smooth((p-.12)/.14)*(1-smooth((p-.84)/.1));
 sprite('quack',0,113,362,214,{angle:-.015});
 sprite('quack',1,1804,421,220,{angle:-.07+Math.sin(p*Math.PI)*.12,stretch:1+quack*.05});
 sprite('quack',2,111,612,158,{angle:Math.sin(p*8)*.065});
 sprite('quack',2,1362,80,144,{flip:true});
 sprite('quack',0,763,994,163,{flip:true});
 sprite('quack',1,1312,1005,161,{angle:Math.sin(p*8)*.07});
 // A miniature desktop: diskettes tumble, keyboard keys spring after the quack.
 const disk=(x,y,s,a)=>local(x,y,s,a,()=>{
  poly([[-19,-22],[13,-22],[21,-14],[21,22],[-19,22]],metal([-19,-22,21,22],['#badcdb','#4a7e85','#8db8b9','#335a72']));
  poly([[-10,-22],[11,-22],[11,-6],[-10,-6]],'#d7e3e2');poly([[-12,3],[14,3],[14,20],[-12,20]],'#f3c8ca');line([[-6,8],[9,8]],ice,1,.7);poly([[4,-20],[8,-20],[8,-9],[4,-9]],'#567886');
 });
 for(const[x,y,s,a]of [[1871,590,.85,.16],[545,65,.55,-.13],[1036,67,.62,.16],[398,1023,.57,-.12]])disk(x,y-Math.sin(p*6+y)*4,s,a+p*.08);
 for(let j=0;j<12;j++){
  const x=455+j*87,y=31-Math.sin(p*Math.PI*2-j*.28)*3;
  poly([[x,y],[x+19,y],[x+19,y+12],[x,y+12]],j%3?aqua:coral,.75);
  line([[x+2,y+2],[x+16,y+2]],ice,1,.65);
 }
 // Pop-up windows remain thumbnail props in the edge, without captions.
 for(const[x,y]of [[59,241],[1849,275]])local(x,y,1,0,()=>{
  poly([[-32,-20],[32,-20],[32,20],[-32,20]],'#b9d7d990');poly([[-32,-20],[32,-20],[32,-10],[-32,-10]],coral,.85);
  line([[-25,-15],[-19,-15]],ice,1);ring(0,4,8,8,aqua,1.5,.8);
 });
 for(let j=0;j<5;j++){const r=18+j*10+p*20;
  curve(u=>[1838+Math.cos(-.55+u*1.1)*r,409+Math.sin(-.55+u*1.1)*r],j%2?coral:gold,1.5,quack*(.65-j*.08));
 }
 for(let j=0;j<5;j++)ring(108,652,33+j*12+p*16,7+j*3,aqua,1,.46-j*.065);
 for(let j=0;j<13;j++){const x=374+j*93,y=1058;
  poly([[x,y],[x+8,y],[x+8,y-8-(j%4)*3],[x,y-8-(j%4)*3]],j%2?coral:gold,.35+.35*Math.sin(p*7+j)**2);
 }
}
