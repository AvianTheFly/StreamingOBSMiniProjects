// Feature-owned spirit policy and measured scenery contacts.
export const scenes={
 bear:{name:'THUNDERCLAW',subtitle:'THE BEAR SPIRIT',colors:['#85dfff','#c8b7ff'],source:[[432,880],[1504,880]],guardian:[[538,76],[1376,78]],chat:'STORM LINK'},
 turtle:{name:'JADE AEGIS',subtitle:'THE TURTLE SPIRIT',colors:['#9dffd1','#99eafa'],source:[[361,889],[1556,889]],guardian:[[436,80],[1475,82]],chat:'THE HEALING WELL'},
 ram:{name:'GOLDEN SUMMIT',subtitle:'THE RAM SPIRIT',colors:['#ffdb86','#ffac6e'],source:[[385,864],[1538,864]],guardian:[[457,116],[1465,118]],chat:'FORGE WHISPERS'},
 phoenix:{name:'ASH & AURORA',subtitle:'THE PHOENIX SPIRIT',colors:['#a9edff','#ffb274'],source:[[196,876],[1711,876]],guardian:[[567,82],[1352,78]],chat:'EMBER ECHOES'},
};
export const legacy={astral:'ram',tidal:'turtle',neon:'bear',frost:'phoenix',verdant:'turtle'};
export const supportedTheme=theme=>scenes[theme]?theme:legacy[theme]||'bear';
export const clamp=n=>Math.max(0,Math.min(1,n));
export const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
export const pulse=(age,start,duration)=>Math.sin(clamp((age-start)/duration)*Math.PI);
export function path(c,points,color,width=1,alpha=1){c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
export function light(c,x,y,rx,ry,color,alpha=1){if(alpha<=0)return;c.save();c.translate(x,y);c.scale(1,ry/rx);c.globalAlpha=alpha;const g=c.createRadialGradient(0,0,0,0,0,rx);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(-rx,-rx,rx*2,rx*2);c.restore();}
export function traceSlot(c,p,color,width,alpha){c.save();c.globalAlpha=alpha;c.lineWidth=width;c.strokeStyle=color;c.beginPath();c.roundRect(p.x,p.y,p.w,p.h,8);c.stroke();c.restore();}
