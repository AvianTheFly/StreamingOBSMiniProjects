// A planted turn uses actual painted back angles before the return jump.
import {soften} from '../../performance.js';
import {layer,blend} from './views.js';
function sequence(t,keys){if(t<=keys[0][0])return [keys[0][1]];for(let i=1;i<keys.length;i++)if(t<keys[i][0])return blend(keys[i-1][1],keys[i][1],soften((t-keys[i-1][0])/(keys[i][0]-keys[i-1][0])));return [keys.at(-1)[1]];}
export function turning(t){if(t<1.67||t>1.92)return null;
 return sequence(t,[[1.67,layer('side')],[1.73,layer('backQuarter')],[1.80,layer('back')],[1.86,layer('backLeft')],[1.92,layer('side',1,-1)]]);}
export function facingFront(t){return sequence(t,[[2.70,layer('crouch',1,-1)],[2.78,layer('leftQuarter')],[2.86,layer('front')],[3.10,layer('rear')],[3.25,layer('rear')],[3.42,layer('fall')]]);}
