// Painted-art dispatch. Acting and contact geometry belong to each animal rig.
import {Parts} from './rig.js';
import {load as loadBearArt} from './rigs/bear/art.js';
import {load as loadTurtleArt} from './rigs/turtle/art.js';
import {load as loadPhoenixArt} from './rigs/phoenix/art.js';
import {load as loadRamArt} from './rigs/ram/art.js';
import * as bear from './rigs/bear.js';
import * as turtle from './rigs/turtle.js';
import * as ram from './rigs/ram.js';
import * as phoenix from './rigs/phoenix.js';
import {Egg} from './rigs/egg.js';
import {world} from './performance.js';
const actors={bear,turtle,ram,phoenix};
export class Character{
 async load(id){this.id=id;this.parts=id==='bear'?await loadBearArt():id==='turtle'?await loadTurtleArt():id==='phoenix'?await loadPhoenixArt():id==='ram'?await loadRamArt():await new Parts().load(id);
  this.materialAsset=this.parts.skin?.material;
  if(id==='phoenix'){this.eggArt=await new Egg().load(this.parts.egg.image);this.featherArt=this.parts.feather.image;}
  return this;}
 draw(c,pose){if(!this.disposed)actors[this.id].draw(this.parts,c,pose);}
 contacts(pose,kind='attack'){return actors[this.id].contacts(pose,this.parts,kind).map(p=>world(pose,p));}
 feather(c,x,y,size,t,alpha=1){c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(Math.sin(t*4)*.16-.3);c.drawImage(this.featherArt,-size*.272,-size*.5,size*.544,size);c.restore();}
 egg(c,x,y,size,t,alpha=1){this.eggArt.draw(c,x,y,size,t,alpha);}
 dispose(){this.disposed=true;this.parts=null;this.eggArt=null;this.featherArt=null;}
}
