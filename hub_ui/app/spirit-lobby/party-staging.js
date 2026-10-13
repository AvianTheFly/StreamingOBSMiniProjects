// Afterparty-local depth and contact points. Keep particles/lights in their room
// coordinates; shrink visitors and their props together into the side scenery.
const placements={
 visitor:{from:[960,635],to:[960,570],scale:.48},
 vinyl:{from:[960,730],to:[960,550],scale:.58},
 ducks:{from:[960,994],to:[960,728],scale:.65},
 robot:{from:[960,980],to:[380,651],scale:.32,side:true},
 portal:{from:[960,785],to:[960,586],scale:.66},
 moon:{from:[960,260],to:[960,257],scale:.72},
 jellyfish:{from:[960,995],to:[960,722],scale:.7},
 lanterns:{from:[960,1080],to:[960,765],scale:.75},
 balloons:{from:[960,1170],to:[960,920],scale:.7}
};
export function drawPartyVisitor(c,draw,age,colors,event){
 const p=placements[event.kind];
 if(!p){draw(c,age,colors,event);return;}
 c.save();
 const x=p.side&&Math.floor(event.seed)%2?p.to[0]:p.side?1540:p.to[0];
 c.translate(x,p.to[1]);c.scale(p.scale,p.scale);c.translate(-p.from[0],-p.from[1]);
 try{draw(c,age,colors,event);}finally{c.restore();}
}
