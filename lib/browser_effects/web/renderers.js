import {MuffinShow} from './muffins.js';
import {BorderShow} from './borders.js';
import {HoorayShow} from './rave.js';
export function makeRenderer(canvas,effect){
 if(effect.renderer==='muffins')return new MuffinShow(canvas);
 if(effect.renderer==='borders')return new BorderShow(canvas);
 if(effect.renderer==='hooray')return new HoorayShow(canvas);
 throw Error('Unknown browser effect renderer');
}
