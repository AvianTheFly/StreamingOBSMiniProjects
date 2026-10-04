// Native celebration assembly. The existing shows own timing and cleanup.
import {WorldPaint,Optics,EdgeFinish,smooth,TAU,pathOf} from './subtle.js';
/* @PARTY_INK@ */
/* @PARTY_PROPS@ */
/* @SUPPORTER_PERFORMANCES@ */
/* @RAID_PERFORMANCES@ */
/* @CHEER_PERFORMANCES@ */
export const celebrationArtReady=Promise.resolve();
export const RAID_WORLDS={
 crab:{title:'THE HARBOR IS HOPPING',label:'Pearl harbor',colors:['#f3c18d','#7ddbdc','#e7ebdc']},
 dragon:{title:'A LITTLE MAGIC JUST LANDED',label:'Lantern migration',colors:['#c0a0f0','#f5ce8a','#85dbc9']},
 cat:{title:'NEXT STOP: GOOD COMPANY',label:'Celestial railway',colors:['#93d9ee','#deb2e4','#f5d699']},
 frog:{title:'ROOM FOR THE WHOLE POND',label:'Moonlit water garden',colors:['#b0dc91','#e5b3cc','#92dfd0']}
};
export function celebrationWorld(c,theme,t,duration,mode='raid',seed=0){
 if(mode==='raid')raidPerformance(c,theme,t,duration,seed);
 else if(mode==='cheer')cheerPerformance(c,theme,t,duration,seed);
 else supporterPerformance(c,theme,t,duration,mode==='gift',seed);
}
export class RaidArt{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.finish=new EdgeFinish();this.ready=celebrationArtReady;}
 clear(){this.c.clearRect(0,0,1920,1080);}
 start(item){this.theme=RAID_WORLDS[item.theme]?item.theme:'crab';this.seed=Array.from(String(item.id||item.name)).reduce((v,ch)=>(v*31+ch.charCodeAt(0))>>>0,7);}
 draw(t,reduced=false){const c=this.c;c.clearRect(0,0,1920,1080);if(t<0||t>=8)return;c.save();c.globalAlpha=smooth(t/.65)*smooth((8-t)/.75);celebrationWorld(c,this.theme,reduced?4.6:t,8,'raid',this.seed);c.restore();this.finish.apply(c,10);}
}
