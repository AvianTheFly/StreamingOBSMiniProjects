// Typography is drawn flat once, then projected onto the actual sign surfaces.
import {neon} from './paint.js';
import {paintPanel} from './surfaces.js';
export class TextScreens {
  constructor(){this.cache=new Map();}
  draw(c,target,top,bottom,color){
    const key=[top,bottom,color].join('|');let record=this.cache.get(target);
    if(!record||record.key!==key){
      const image=document.createElement('canvas');image.width=820;image.height=target==='booth'?182:340;
      const p=image.getContext('2d');p.fillStyle=target==='booth'?'#080b18':'#18202a';p.fillRect(0,0,image.width,image.height);
      if(target==='booth'){
        neon(p,top,410,62,78,color,748);p.fillStyle='#d0bfeb';p.textAlign='center';p.textBaseline='middle';p.font='600 24px Segoe UI';
        const size=Math.min(24,24*744/Math.max(1,p.measureText(bottom).width));p.font=`600 ${size}px Segoe UI`;p.fillText(bottom,410,133);
      }else{neon(p,top,410,113,65,color,735);neon(p,bottom,410,229,82,color,735);}
      record={key,image};this.cache.set(target,record);
    }paintPanel(c,record.image,target);
  }
}
