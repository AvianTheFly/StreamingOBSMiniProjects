// A finite second act and encore for long sounds; progress never wraps to zero.
function playfulSoundActs(c,t,d,key){
 const{p,prop,local,line,oval,poly,box,scatter,words}=playfulInk(c,t,d),pink='#ffb0cc',mint='#a3e6d6',gold='#ffe097',blue='#a4d9ff',lilac='#c6b4ff';
 const gate=(a,b)=>smooth((p-a)/.055)*smooth((b-p)/.055),move=(a,b)=>smooth((p-a)/(b-a));
 function act(a,b,fn){const alpha=gate(a,b);if(alpha<=0)return;c.save();c.globalAlpha*=alpha;fn(move(a,b));c.restore();}
 const perimeter=u=>{const path=[[290,76],[1732,76],[1819,273],[1819,797],[1616,1027],[318,1027],[102,797],[102,240],[290,76]],distance=u*(path.length-1),i=Math.min(path.length-2,Math.floor(distance)),v=distance-i;return[path[i][0]+(path[i+1][0]-path[i][0])*v,path[i][1]+(path[i+1][1]-path[i][1])*v];};
 switch(key){
 case 'crabs':
  act(.27,.72,q=>{for(let j=0;j<5;j++)prop('crab',458+j*215+q*34,1041-Math.sin(t*3+j)*7,.35,-.08,j%2?pink:gold);});act(.64,1,q=>{prop('crown',1832,382,.45,Math.sin(t*2)*.08,gold);prop('disco',700+q*506,63,.66,t*.7,mint);});break;
 case 'coffin':
  act(.31,.79,q=>{for(let j=0;j<4;j++)prop('ghost',1831+j%2*51,729-q*444-j*23,.37,Math.sin(t*3+j)*.12,j%2?pink:blue);});act(.7,1,q=>{prop('crown',95,355,.54,Math.sin(t)*.08,gold);prop('bow',1840,530,.5,0,gold);scatter(1030,75,gold,14,.73);});break;
 case 'disco':
  act(.26,.67,q=>{for(let j=0;j<4;j++)prop('note',84+Math.sin(t*2+j)*33,752-q*427-j*31,.44,Math.sin(t*3+j)*.2,[pink,mint,gold,blue][j]);});act(.6,1,q=>{for(let j=0;j<3;j++)prop('disco',696+j*318,69,.51,t*(j%2?-1:1)*.35,[gold,pink,mint][j]);for(let j=0;j<4;j++)prop('bow',433+j*292,1021,.27,Math.sin(t*3+j)*.1,pink);});break;
 case 'mash':
  act(.3,.76,q=>{for(let j=0;j<4;j++)prop('book',431+j*273,75-Math.sin(q*Math.PI)*10,.33,-.13+j*.08,[mint,pink,lilac,blue][j]);});act(.65,1,q=>{prop('dragon',1838,688-q*87,.68,Math.sin(t)*.07,mint);prop('crown',106,274,.4,0,gold);});break;
 case 'balloons':
  act(.28,.72,q=>local(997,67,.84,Math.sin(t)*.06,()=>{box(-44,-19,88,40,8,lilac);line([[0,-17],[0,20]],gold,7);poly([[-28,-21],[-18,-41],[0,-22]],pink);poly([[28,-21],[18,-41],[0,-22]],pink);prop('star',0,-39-q*31,.41,t*.25,gold);}));act(.65,1,q=>{prop('cake',1091,1031,.73,Math.sin(t*2)*.05,pink);for(let j=0;j<4;j++)prop('balloon',431+j*290,77-q*38,.34,Math.sin(t+j)*.1,[mint,pink,gold,blue][j]);});break;
 case 'rats':
  act(.23,.83,q=>{const[x,y]=perimeter(q);prop('rat',x,y,.52,Math.sin(t*4)*.09,blue);local(x+31,y+13,.37,.12,()=>poly([[-24,13],[-24,-17],[27,7],[27,17]],gold));});act(.73,1,q=>{prop('crown',90,264,.38,Math.sin(t)*.07,gold);for(let j=0;j<3;j++)prop('disco',643+j*335,61,.32,t*.5,pink);});break;
 case 'shades':
  act(.3,.77,q=>{for(let j=0;j<4;j++)prop('star',497+j*267,73+Math.sin(t*2+j)*7,.34,Math.sin(t*2+j)*.17,[blue,mint,pink,gold][j]);});act(.67,1,q=>{prop('crown',86,346,.55,-.08,gold);prop('bow',1833,645,.43,.12,lilac);});break;
 case 'equalizer':
  act(.24,.8,q=>{const[x,y]=perimeter(q);prop('rocket',x,y,.5,q*Math.PI*2,mint);});act(.68,1,q=>{for(let j=0;j<5;j++)prop('note',449+j*234,70+Math.sin(t*4+j)*7,.48,Math.sin(t*2+j)*.14,[mint,pink,gold,blue,lilac][j]);prop('crown',1830,404,.56,0,gold);});break;
 case 'nyan':
  act(.26,.8,q=>{const[x,y]=perimeter(q);prop('cat',x,y,.51,-.15+q*.3,mint);for(let j=0;j<4;j++)prop('star',x-25-j*17,y+Math.sin(t*2+j)*7,.17-j*.02,0,[pink,gold,blue,lilac][j]);});act(.7,1,q=>{prop('crown',1840,488,.4,.09,gold);for(let j=0;j<4;j++)prop('paw',487+j*267,73,.31,Math.sin(t*3+j)*.12,pink);});break;
 case 'tantrum':
  act(.3,.76,q=>prop('bean',97,575-q*228,.55,-q*1.7,gold,'shock'));act(.68,1,q=>{prop('cloud',1200,66,.7,.08,mint,'happy');prop('bow',96,435,.4,.1,gold);});break;
 case 'kitchen':
  act(.29,.76,q=>{const x=113+Math.sin(q*Math.PI)*57,y=469-Math.sin(q*Math.PI)*200;local(x,y,.69,q*2.2,()=>{oval(0,0,27,20,'#fff0d6');oval(0,0,13,13,gold);});});act(.67,1,q=>{for(let j=0;j<4;j++)prop('cake',531+j*230,1039,.42,Math.sin(t*2+j)*.08,gold);prop('crown',86,242,.42,.1,gold);});break;
 case 'meltdown':
  act(.25,.72,q=>{for(let j=0;j<3;j++)prop('alarm',661+j*291,65+Math.sin(t*3+j)*7,.33,Math.sin(t*4+j)*.17,[mint,pink,gold][j]);});act(.63,1,q=>{prop('cloud',1783,762,.6,.1,mint,'sleep');prop('heart',137,797,.48,-.1,pink,'happy');prop('bow',1010,119,.41,0,gold);});break;
 case 'rewind':
  act(.27,.75,q=>{prop('plane',431+q*1060,76,.56,-.1,mint);});act(.65,1,q=>{for(let j=0;j<3;j++)prop('eye',595+j*350,65,.39,Math.sin(t*2+j)*.1,[mint,gold,pink][j]);prop('star',89,754,.58,t*.2,gold,'shock');});break;
 case 'spill':
  act(.28,.79,q=>{for(let j=0;j<4;j++)prop('frog',465+j*235,1047+Math.sin(t*4+j)*6,.36,Math.sin(t*3+j)*.08,[mint,pink,lilac,blue][j]);});act(.69,1,q=>{prop('crown',1840,503,.5,0,gold);prop('duck',102,772,.64,Math.sin(t)*.1,gold);});break;
 case 'heartbreak':
  act(.31,.77,q=>{for(let j=0;j<3;j++)prop('cloud',1830+j%2*42,761-q*279-j*52,.33,Math.sin(t*2+j)*.08,blue,'sad');});act(.66,1,q=>{prop('bow',1832,469,.58,0,gold);prop('star',136,680,.52,-.1,mint);prop('heart',775+q*397,69,.55,Math.sin(t)*.07,pink,'happy');});break;
 case 'isolation':
  act(.3,.8,q=>{prop('cup',111,659,.6,Math.sin(t)*.05,gold);prop('cloud',1850,725,.52,0,blue,'sleep');});act(.71,1,q=>{prop('star',1321,68,.48,Math.sin(t)*.08,mint);prop('heart',164,565,.32,.1,pink);});break;
 case 'prowler':
  act(.27,.79,q=>{prop('eye',1000-q*529,66,.53,-.05,lilac);});act(.66,1,q=>{prop('paw',90,725,.66,-.18,mint);prop('eye',1779,729,.46,.1,pink);});break;
 case 'rescue':
  act(.25,.77,q=>{prop('heart',566+q*937,68,.51,Math.sin(t)*.1,pink);});act(.65,1,q=>{prop('crown',1839,360,.59,0,gold);prop('bow',84,501,.51,-.1,mint);for(let j=0;j<3;j++)prop('heart',574+j*380,1034,.49,Math.sin(t+j)*.1,[mint,pink,gold][j]);});break;
 case 'confusion':
  act(.29,.78,q=>{prop('eye',589+q*716,70,.64,Math.sin(t)*.1,gold);});act(.67,1,q=>{prop('alarm',114,711,.55,-.12,lilac);prop('cloud',1790,753,.51,.1,mint,'shock');prop('star',1138,1043,.55,t*.12,pink,'shock');});break;
 }
}
