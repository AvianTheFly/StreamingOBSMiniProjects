function spamPiuw(c,t,d,e){
 piuwBorder(c,t,d,e);
 const {p,sprite,local,line,disc,poly,ring,curve,burst,metal}=spamInk(c,t,d,e);
 const aqua='#99e2dd',coral='#f09ba7',lavender='#cab4e5',gold='#ebd39e';
 const recoil=Math.sin(smooth((p-.17)/.25)*Math.PI)*9;
 sprite('piuw',0,111-recoil,359,222,{alpha:1-smooth((p-.24)/.15),angle:-.025});
 sprite('piuw',1,111-recoil,359,222,{alpha:smooth((p-.24)/.15),angle:-.025-recoil*.004});
 sprite('piuw',2,1800,465-recoil*.4,232,{flip:true,angle:Math.sin(p*6)*.04});
 sprite('piuw',1,1250,80,134,{flip:true,angle:.03});
 sprite('piuw',2,697,1004,178,{angle:-.03+p*.05});
 sprite('piuw',0,1293,1007,155,{flip:true});
 // The zap follows a complete perimeter route; it never traverses gameplay.
 const route=pathOf([[82,333],[30,268],[32,202],[382,41],[1000,39],[1545,42],[1885,216],[1887,515],[1851,668]]);
 curve(route,aqua,1,.3);
 const head=Math.max(0,Math.min(1,(p-.18)/.66));
 for(let j=0;j<18;j++){const u=head-j*.009;if(u<0)continue;
  const[x,y]=route(u);disc(x,y,2+(18-j)*.08,2,coral,(1-j/18)*.85);
 }
 const[x,y]=route(head);ring(x,y,8,8,aqua,1,.8);burst(1851,668,(p-.72)/.28,coral,8,35);
 // Solar toys, orbit mobiles and a few tiny rockets counterpoint the zap.
 for(const[xx,yy,s,a]of [[1831,288,.6,.2],[526,65,.5,-.12],[1799,615,.43,.23]])local(xx,yy,s,a,()=>{
  poly([[-11,24],[-13,-12],[0,-34],[13,-12],[11,24]],metal([-13,-34,13,24],['#eef6e6',aqua,'#7183aa','#d8c2e9']));
  poly([[-11,7],[-26,29],[-11,22]],coral);poly([[11,7],[26,29],[11,22]],coral);
  disc(0,-7,6,7,'#58738f');ring(0,-7,6,7,gold,1.2);poly([[-7,25],[0,43+Math.sin(p*7)*4],[7,25]],gold,.75);
 });
 for(const[xx,yy,r]of [[54,592,25],[977,63,23],[1516,1015,22]]){
  disc(xx,yy,r,r,metal([xx-r,yy-r,xx+r,yy+r],['#f2d9e8',lavender,'#7983ab',aqua]));
  ring(xx,yy,r*1.5,r*.3,gold,1.5,.75,-.3+p*.05);
 }
 for(let j=0;j<18;j++){const xx=j%2?1906:17,yy=207+j%9*53;
  local(xx,yy,.55,0,()=>{const a=.2+.65*Math.sin(p*4+j)**2;line([[-4,0],[4,0]],gold,1,a);line([[0,-4],[0,4]],lavender,1,a);});
 }
}
