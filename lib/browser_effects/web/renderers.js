import {MuffinShow} from './muffins.js';
import {BorderShow} from './borders.js';
export function makeRenderer(canvas,effect){
 if(effect.renderer==='muffins')return new MuffinShow(canvas);
 if(effect.renderer==='borders')return new BorderShow(canvas);
 throw Error('Unknown browser effect renderer');
}
