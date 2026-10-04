// Accepted four-legged approach; shared by actor placement and claw projection.
import {clamp,smooth} from '../math.js';
import {soften} from '../performance.js';
export const ground=985;
export function arrival(t,variant=0){
 const side=variant?-1:1,stop=1-(1-clamp(t/1.7))**3;
 return {x:960+side*(-1380*(1-stop)),y:ground,size:480+420*soften(t/1.70),
  alpha:smooth(.04,.25,t),stride:1-smooth(1.0,1.55,t),angle:0,variant};
}
