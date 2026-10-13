// Larger, finite scenic events and frame-aware cameos, on the existing cue clock.
import {ellipse,glow,hash,TAU} from './shared/world-motion.js';
import {phase} from './game-guest-acts.js';
import {climber,goose} from './game-guest-stunts.js';
import {spirit,line} from './league-spirit-ink.js';
export const momentWorlds=new Set(['forge','sanctuary','aurora-camp','phoenix-observatory']);
const palettes={forge:['#ffbf6d','#ff794d'],sanctuary:['#ffbadb','#adffe0'],'aurora-camp':['#86ffe0','#91baff'],'phoenix-observatory':['#b9eeff','#a3acff']};
function awakening(c,a,e,art,id){
 const visible=art.displayVisible!==false,fade=phase(a,0,2)*(1-phase(a,9,12));
 const kinds=id==='sanctuary'?['claw','storm']:id==='forge'?['stampede']:id==='phoenix-observatory'?['storm']:['claw','mantle','stampede','storm'];
 const left=visible?1020:230,span=visible?340:1040;
 c.save();c.globalAlpha*=fade;
 for(const [i,kind] of kinds.entries()){
  const x=left+span*(i+.5)/kinds.length,y=visible?110+Math.sin(a*.5+i)*25:250+Math.sin(a*.5+i)*65;
  glow(c,x,y,75,palettes[id][0],.14);spirit(c,kind,x,y,visible?40:65,a,.65);
  for(let j=0;j<14;j++){const q=j*TAU/14+a*.35;ellipse(c,x+Math.cos(q)*55,y+Math.sin(q)*27,1.2,1.2,palettes[id][0]);}
 }
 c.restore();
}
function weather(c,a,e,art,id){
 const colors=palettes[id],fade=phase(a,0,2)*(1-phase(a,9,12));c.save();c.globalAlpha*=fade;
 if(id==='phoenix-observatory'){
  for(let i=0;i<8;i++){const q=(a*.22+i*.14)%1,x=270+i*153-q*210,y=20+q*200;const gradient=c.createLinearGradient(x,y,x+55,y-28);gradient.addColorStop(0,'#e1f8ff');gradient.addColorStop(1,'#c0dfff00');line(c,[[x,y],[x+55,y-28]],gradient,1.6);glow(c,x,y,7,'#bfeaff',.22);}
 }else if(id==='aurora-camp'){
  for(let band=0;band<6;band++){c.lineWidth=9;c.strokeStyle=band%2?'#81ffc844':'#9cafff3f';c.beginPath();for(let x=100;x<1450;x+=12)c.lineTo(x,70+band*22+Math.sin(x*.006+a*.6+band*.4)*40);c.stroke();}
 }else{
  for(let i=0;i<70;i++){const q=(a*.12+hash(i+9))%1,x=80+hash(i+2)*1350+(id==='sanctuary'?q*160:Math.sin(i)*q*90),y=id==='sanctuary'?40+q*930:830-q*630;c.save();c.translate(x,y);c.rotate(a+i);ellipse(c,0,0,id==='sanctuary'?4:2,id==='sanctuary'?1.7:3,colors[i%2]+'aa');c.restore();}
 }
 c.restore();
}
function lanterns(c,a,e,art,id){
 const fade=phase(a,0,2)*(1-phase(a,10,14));c.save();c.globalAlpha*=fade;
 for(let i=0;i<12;i++){
  const q=(a*.038+hash(i+30))%1,x=140+hash(i+10)*1250+Math.sin(a*.5+i)*25,y=800-q*700;
  if(id==='forge'){glow(c,x,y,19,'#ffb351',.2);spirit(c,'stampede',x,y,10,a,.7);}
  else if(id==='phoenix-observatory'){spirit(c,'storm',x,y,13,a,.65);}
  else{glow(c,x,y,28,'#ffd599',.12);c.fillStyle='#f7d594aa';c.fillRect(x-4,y-7,8,12);line(c,[[x-4,y+6],[x+4,y+6]],'#bd8b53',1);}
 }
 c.restore();
}
export function borderAnchor(art,scene,kind){
 const [x,y,w]=art.screenRect||scene.holes[0],shown=art.displayVisible!==false;
 const perches={forge:{climber:[718,764],poro:[910,704],goose:[805,703]},sanctuary:{climber:[1270,985],poro:[1220,880],goose:[1090,883]},'aurora-camp':{climber:[915,1013],poro:[785,828],goose:[950,925]},'phoenix-observatory':{climber:[632,714],poro:[647,625],goose:[1640,697]}};
 if(!shown)return perches[scene.id][kind];
 if(kind==='climber')return [Math.min(1830,x+w+45),y+52];
 return [x+w*(kind==='poro'?.7:.3),y-11];
}
function borderArtist(kind,scene){return(c,a,e,art)=>{
 const [x,y]=borderAnchor(art,scene,kind);c.save();c.translate(x,y);
 if(kind==='climber'){c.scale(-.55,.55);climber(c,a,e,art,{ledge:[70,-115]});}
 else if(kind==='goose'){c.scale(.62,.62);goose(c,a,e,art);}
 else if(art.displayVisible===false){
  ellipse(c,0,0,14,2,'#14232b55');art.league.draw(c,'poro',a>4&&a<7?1:0,0,-Math.abs(Math.sin(a*2))*3,32);
 }else{
  // The screen or shelf occludes the lower body; the face peeks above the edge.
  c.beginPath();c.rect(-80,-90,160,90);c.clip();const rise=phase(a,0,2)*(1-phase(a,9,12));art.league.draw(c,'poro',a>4&&a<7?1:0,0,37*(1-rise)+4+Math.sin(a*2)*2,37);
 }
 c.restore();
};}
export function withLobbyMoments(id,world){
 if(!momentWorlds.has(id))return world;
 const names={forge:['The ram answers the furnace','An enchanted forging burst','Ember spirits escape'],sanctuary:['The shrine spirits awaken','Blossom wind through the monastery','A little lantern festival'],'aurora-camp':['Four Freljord spirits awaken','The northern lights surge','Wishing lanterns drift over camp'],'phoenix-observatory':['The cryophoenix awakens','A passing meteor shower','A migration of ice spirits']};
 const artists={},cues=[];
 for(const [i,[kind,artist]] of [['awakening',awakening],['weather',weather],['lanterns',lanterns]].entries()){
  const key='moment-'+kind;artists[key]=(c,a,e,art)=>{
   c.save();c.beginPath();c.rect(0,0,1920,1080);for(const r of (art.apertures||world.scene.holes))c.rect(...r);c.clip('evenodd');artist(c,a,e,art,id);c.restore();
  };cues.push({id:key,label:names[id][i],description:'A brief scenic moment that settles back into the room.',life:14,weight:.8,impact:1.2,depth:'background'});
 }
 for(const kind of ['climber','poro','goose']){const key='border-'+kind;artists[key]=borderArtist(kind,world.scene);cues.push({id:key,label:{climber:'Getting Over the screen corner',poro:'Poro peeks from behind the frame',goose:'Knife goose patrols the frame'}[kind],description:'Uses the real saved screen border, or a room ledge while the screen is hidden.',life:12,weight:.65,impact:.6,depth:'background',overFrame:kind!=='poro'});}
 return {...world,cues:[...world.cues,...cues],artists:{...world.artists,...artists}};
}
