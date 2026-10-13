// Authored edge embroidery for each clip. No panels, shared default icon row or loops.
const SOUND_SIGNATURES=Object.freeze({
 tantrum:['hurdle','#d7a78b','#b7c9ca'],kitchen:['toast','#dbbf91','#aec8b9'],meltdown:['phone','#bfd0a6','#b0c9cc'],rewind:['clue','#d9c49c','#b3c1cd'],violin:['violin','#cab1bd','#d4c398'],spill:['cup','#cabb9f','#aebec9'],heartbreak:['tissue','#c5adcd','#b9c6ce'],isolation:['mute','#b6c9bd','#c4b1ce'],prowler:['ward','#a49fbd','#b6c9a7'],
 sparkles:['star','#d6c096','#b9bed3'],arcade:['brick','#aec8bf','#d7c398'],approval:['check','#b1cbaf','#d6c9a3'],
 disco:['lace','#a5cfd2','#d5b2cb'],coffin:['hat','#b6b5c5','#d7c29c'],mash:['puff','#d9c093','#c5aed1'],crabs:['shell','#a7d0ca','#d7b38f'],balloons:['fish','#b6c9a6','#adcad1'],rats:['boot','#c3b2c7','#d2c39e'],raccoon:['record','#bad0ba','#d1aec7'],shades:['glasses','#b3c4d9','#c9c2a5'],equalizer:['note','#d9c297','#a7ccc1'],nyan:['pixel','#c7abc9','#b1c9d1'],
 lizard:['popcorn','#d6c79e','#aec5b1'],gary:['spiral','#d3b0c3','#a8cbd2'],quack:['duck','#d5c594','#adcbbf'],bonk:['mallet','#d6b49e','#b3c4d2'],piuw:['orbit','#c5b0d2','#a5cec9'],'mom-frog':['lily','#b4c8a6','#d0c79f'],
 romance:['rose','#d1a9bd','#b7c9a8'],rizz:['receipt','#c6b0ce','#d8c49d'],weeknd:['groove','#c3b6d1','#d5cda9'],love:['cone','#d6b5c5','#a9c8c7'],catlove:['paw','#c4bfcd','#d8ca9f'],falling:['arrow','#c9b6ce','#bdd0b7'],oops:['acorn','#c9bd9c','#afc5c1'],intro:['return','#b5c8a9','#d7c69f'],
});
function soundSignature(c,t,d,e){
 const key=e.scene||e.style,spec=SOUND_SIGNATURES[key];if(!spec)return;
 const [kind,col,accent]=spec,I=cultureInk(c,t,d,e),{p,local,line,shape,disc,box,ring,curve,sparkle,wake}=I;
 const reveal=smooth((p-.045)/.18),motion=smooth((p-.1)/.72),limited=t<d*.87?t:d*.87;
 const cast=['lizard','gary','quack','bonk','piuw','mom-frog'].includes(key);
 const emblem=(j)=>{
  switch(kind){
  case 'hurdle':line([[-14,12],[-14,-8],[14,-8],[14,12]],col,2);line([[-14,-8],[14,-8]],accent,3);break;
  case 'toast':shape([[-12,13],[-12,-7],[-7,-15],[7,-15],[12,-7],[12,13]],col);line([[-6,-2],[6,-2]],accent,2);break;
  case 'phone':curve(u=>[-16+u*32,-5+Math.sin(u*Math.PI)*6],col,7);for(const s of [-1,1])disc(s*15,-4,6,8,accent);break;
  case 'clue':ring(-2,-3,11,11,col,2);line([[6,5],[17,16]],accent,4);break;
  case 'violin':disc(0,-1,7,13,col);disc(0,7,10,9,col);line([[0,-23],[0,14]],accent,2);line([[-12,4],[14,-5]],accent,1.5);break;
  case 'cup':box(-11,-10,22,24,4,col);curve(u=>[12+Math.sin(u*Math.PI)*10,-6+u*15],accent,3);curve(u=>[-4+Math.sin(u*TAU)*3,-12-u*14],accent,1.3);break;
  case 'tissue':shape([[-15,12],[-13,-6],[0,1],[12,-6],[15,12]],col);curve(u=>[-11+u*22,7+Math.sin(u*Math.PI)*4],accent,1.2);break;
  case 'mute':shape([[-15,-4],[-8,-4],[1,-12],[1,12],[-8,4],[-15,4]],col);line([[8,-6],[17,6]],accent,2);line([[17,-6],[8,6]],accent,2);break;
  case 'ward':shape([[-17,0],[0,-11],[17,0],[0,11]],col);disc(0,0,5,7,accent);line([[0,11],[0,23]],col,3);break;
  case 'star':sparkle(0,0,15,col,-.2+motion*.3);break;
  case 'brick':box(-13,-11,26,22,0,col);for(const s of [-1,1])box(s*6-2,-5,4,4,0,accent);line([[-7,6],[7,6]],accent,2);break;
  case 'check':line([[-15,0],[-4,11],[17,-13]],col,4);break;
  case 'lace':for(const s of [-1,1])curve(u=>[s*(2+Math.sin(u*Math.PI)*17),-4+u*17],s<0?col:accent,2);line([[-5,3],[-13,16]],accent,2);line([[5,3],[13,16]],col,2);break;
  case 'hat':box(-14,-18,28,21,4,col);box(-24,0,48,7,3,col);line([[-13,-3],[13,-3]],accent,3);break;
  case 'puff':disc(0,4,18,12,col);curve(u=>[-16+u*32,-1-Math.sin(u*Math.PI)*6],accent,3);break;
  case 'shell':shape([[-19,-2],[-12,-16],[0,-20],[12,-16],[19,-2],[8,12],[-8,12]],col);for(let n=-2;n<=2;n++)line([[0,10],[n*7,-9]],accent,1);break;
  case 'fish':disc(0,0,17,8,col);shape([[-14,0],[-26,-11],[-26,11]],accent);disc(9,-2,2,2,'#66798b');break;
  case 'boot':box(-12,-19,18,28,3,col);box(-14,5,35,12,3,col);line([[-7,-9],[2,-9]],accent,2);break;
  case 'record':ring(0,0,18,18,col,3);ring(0,0,10,10,accent,1.5);disc(0,0,4,4,accent);line([[11,-14],[14,-9]],accent,1);break;
  case 'glasses':for(const s of [-1,1])box(s*12-9,-6,18,13,4,col);line([[-3,0],[3,0]],accent,2);break;
  case 'note':line([[0,10],[0,-14],[13,-10]],col,3);disc(-5,11,8,5,accent);break;
  case 'pixel':for(const [x,y] of [[-14,0],[-7,-7],[0,0],[7,7],[14,0]])box(x-3,y-3,6,6,0,(x/7)%2?col:accent);break;
  case 'popcorn':for(const [x,y] of [[-9,3],[0,-6],[9,3]])disc(x,y,8,8,col);line([[-7,8],[8,8]],accent,2);break;
  case 'spiral':curve(u=>{const a=u*TAU*2,r=u*17;return[Math.cos(a)*r,Math.sin(a)*r];},col,2.4);break;
  case 'duck':disc(-2,4,16,10,col);disc(8,-8,10,10,col);shape([[14,-7],[27,-3],[14,0]],accent);disc(10,-10,2,2,'#687a80');break;
  case 'mallet':line([[0,0],[0,22]],accent,3);box(-18,-9,36,18,4,col);break;
  case 'orbit':ring(0,0,19,8,col,2);disc(0,-2,7,10,accent);disc(18,0,3,3,accent);break;
  case 'lily':disc(0,7,22,7,col);shape([[0,-18],[-10,-4],[0,8],[10,-4]],accent);break;
  case 'rose':line([[0,22],[0,-1]],accent,2);for(let n=0;n<5;n++){const a=n*TAU/5;disc(Math.cos(a)*6,Math.sin(a)*6,6,5,col);}break;
  case 'receipt':shape([[-12,-18],[12,-18],[12,17],[6,14],[0,17],[-6,14],[-12,17]],col);for(let n=0;n<3;n++)line([[-7,-10+n*8],[7,-10+n*8]],accent,1.3);break;
  case 'groove':for(let n=0;n<3;n++)ring(0,0,8+n*5,4+n*2,n%2?col:accent,1.1);break;
  case 'cone':shape([[-12,-1],[12,-1],[0,22]],accent);disc(0,-7,14,12,col);break;
  case 'paw':disc(0,8,7,5,col);for(let n=0;n<3;n++)disc(-9+n*9,-4,3,4,accent);break;
  case 'arrow':line([[-21,0],[16,0]],accent,2);shape([[16,-8],[27,0],[16,8]],col);line([[-17,0],[-24,-7]],col,2);break;
  case 'acorn':disc(0,5,10,13,col);disc(0,-5,13,5,accent);line([[0,-10],[2,-17]],accent,2);break;
  case 'return':curve(u=>[-18+u*35,9-Math.sin(u*Math.PI)*20],col,2.5);shape([[-18,9],[-17,-2],[-7,6]],accent);break;
  }
 };
 c.save();c.globalAlpha*=reveal*.7;
 for(const bottom of [0,1]){
  const y=bottom?1063:26,depth=kind==='groove'?4:kind==='lace'||kind==='phone'?8:5;
  const path=u=>[338+u*1244,y+Math.sin(u*TAU*(kind==='pixel'?3:2)+limited*.4)*depth];
  curve(path,col,1.4,.55);curve(u=>{const [x,y]=path(u);return[x,y+(bottom?-9:9)];},accent,1,.27);
  wake(path,motion,col,2.8,.14);
  for(let j=0;j<5;j++){const q=smooth((p-.1-j*.035)/.25);local(418+j*270,y+(bottom?-19:19),.55+q*.08,Math.sin(q*Math.PI)*.18,()=>{c.save();c.globalAlpha*=q;emblem(j);c.restore();});}
 }
 if(!cast)for(const side of [0,1]){
  const x=side?1901:19;
  curve(u=>[x+Math.sin(u*TAU*1.5+limited*.4)*6,225+u*565],col,1.7,.4);
  for(let j=0;j<3;j++){const q=smooth((p-.16-j*.045)/.29);local(x,263+j*224,.49,side?-.08:.08,()=>{c.save();c.globalAlpha*=q*.7;emblem(j);c.restore();});}
 }
 c.restore();
}
