// The stage owns this bounded glow atlas. Tiny particles reuse soft light tiles
// instead of constructing and rasterizing radial gradients every frame.
const contexts=new WeakMap(),LIMIT=32,SIZE=96;
export function bindLights(context){
 const tiles=new Map();contexts.set(context,tiles);
 return ()=>{if(contexts.get(context)===tiles)contexts.delete(context);for(const tile of tiles.values())tile.width=tile.height=1;tiles.clear();};
}
export function cachedLight(c,x,y,rx,ry,color,alpha){
 const tiles=contexts.get(c);if(!tiles)return false;
 let tile=tiles.get(color);
 if(!tile){
  if(tiles.size>=LIMIT)return false;
  tile=document.createElement('canvas');tile.width=tile.height=SIZE;
  const ink=tile.getContext('2d'),r=SIZE/2,g=ink.createRadialGradient(r,r,0,r,r,r);
  g.addColorStop(0,color);g.addColorStop(1,'transparent');ink.fillStyle=g;ink.fillRect(0,0,SIZE,SIZE);tiles.set(color,tile);
 }
 const previous=c.globalAlpha;c.globalAlpha=alpha;c.drawImage(tile,x-rx,y-ry,rx*2,ry*2);c.globalAlpha=previous;return true;
}
