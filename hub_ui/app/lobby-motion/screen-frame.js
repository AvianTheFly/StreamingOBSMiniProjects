// Lobby art policy: the desktop's saved rectangle is also its painted aperture.
import {drawDisplayFrame} from './shared/display-frame.js';
const materials={
 forge:{dark:'#231a16',metal:'#a27334',light:'#ffd282',accent:'#57d8ef'},
 future:{dark:'#102333',metal:'#328bba',light:'#9efaff',accent:'#27e3ef'},
 arcade:{dark:'#2b1621',metal:'#9b6448',light:'#efc490',accent:'#eb78e1'},
 sanctuary:{dark:'#253022',metal:'#9e8846',light:'#ddd098',accent:'#7ae5b9'},
 reef:{dark:'#19292a',metal:'#a17c43',light:'#f1c987',accent:'#76e5dc'},
 'aurora-camp':{dark:'#243026',metal:'#95834f',light:'#dfd098',accent:'#79d8be'},
};
export function screenFrame(c,rect,id){drawDisplayFrame(c,rect,materials[id]);}
