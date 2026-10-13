// Physical contacts measured against the distinct-v4 paintings in 1920x1080 space.
// x/y is the foot/contact plane, never the centre of a floating overlay.
const at=(character,x,y,height,role,label,zone,extra={})=>({character,x,y,height,role,label,zone,...extra});
export const habitatPlaces={
 'aurora-camp':[
  at('kirby',1390,953,68,'roast','Kirby overcommits to a toasted marshmallow','fire'),
  at('creeper',1135,1035,60,'startle','The forest answers Creeper with thunder','right-root'),
  at('goose',730,858,58,'thief','Knife goose steals the camp tea','tea')],
 sanctuary:[
  at('kirby',1060,889,60,'tea','Kirby discovers extremely relaxing shrine tea','tea'),
  at('boo',1253,895,58,'boo','Boo hides behind the tea table','tea'),
  at('hornet',410,620,52,'silk','Hornet uses the shrine beam as a shortcut','left-ledge',{silkAnchor:[80,-120]})],
 forge:[
  at('crewmate',780,706,66,'repair','Crewmate repairs the forge rune; it overachieves','bench'),
  at('climber',570,900,77,'climb','Getting Over the monumental anvil','bench',{ledge:[85,-140],shadow:false}),
  at('salvager',1050,732,61,'delivery','Salvage robot delivers a helmet for the duck','bench')],
 'phoenix-observatory':[
  at('kirby',1510,683,65,'brainfreeze','Kirby orders tea, receives Wingborne Storm','ice-table'),
  at('hornet',610,639,54,'silk','Hornet anchors silk to the observatory stonework','left-platform',{silkAnchor:[60,-113]}),
  at('climber',480,813,74,'climb','Getting Over the floating observatory','left-platform',{ledge:[77,-125],shadow:false})]
};
export function admitHabitat(event,active){
 if(!event.habitatZone)return true;
 return !active.some(e=>e.habitatZone===event.habitatZone)&&active.filter(e=>e.habitatStory).length<2;
}
export function visibleHabitatEvents(events){
 const claims=new Map();for(const e of events)if(e.manual&&e.habitatZone)claims.set(e.habitatZone,e.id);
 return events.filter(e=>!e.habitatZone||!claims.has(e.habitatZone)||claims.get(e.habitatZone)===e.id);
}
