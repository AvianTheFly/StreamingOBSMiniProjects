// World-owned blocking: coordinates are contacts with painted shelves, paths and
// windows in the 1920x1080 artwork. A whole act (including its props) moves as one.
// Foreground acts keep a physical payoff; background acts receive more invitations.
const place=(from,to,scale,depth='background')=>({from,to,scale,depth});
const back=(x,y,tx,ty,s=.45)=>place([x,y],[tx,ty],s);
const near=(x,y,tx=x,ty=y,s=.65)=>place([x,y],[tx,ty],s,'foreground');
export const staging={
 arcade:{
  coin:back(430,859,570,158,.35), pixels:back(1100,280,1190,225,.5),
  gamer:back(682,835,1420,685,.45), joystick:back(932,840,1409,541,.42),
  marbles:near(260,810,315,816,.5), prize:near(824,594,1845,272,.62),
  salt:back(1340,878,1400,721,.36), speedrun:back(450,869,530,158,.4),
  'raccoon-heist':back(300,855,535,158,.38), 'joystick-solo':back(1690,852,1420,545,.38),
  'coin-boss':back(729,850,1399,687,.36), 'cable-portal':near(418,855,600,837,.52),
  'podium-throw':back(1610,850,1407,545,.34), 'coin-conga':back(513,1063,600,158,.42)
 },
 tavern:{
  sneeze:near(471,879,478,880,.65), mug:back(1400,1027,834,813,.48),
  hat:near(1664,915,1488,910,.5), quill:back(649,1000,748,796,.42),
  dice:near(749,1012,915,946,.55), coins:back(380,1020,721,832,.43),
  respawn:back(1030,1050,917,844,.43), quest:back(645,800,1444,695,.36),
  'dragon-snacks':back(438,1002,819,825,.35), 'mimic-chase':back(270,1003,683,830,.43),
  'tankard-choir':back(1520,1006,790,795,.35), 'dragon-miscast':near(1480,1000,825,955,.43),
  'mimic-inspection':back(630,999,905,831,.38), 'last-call':back(1090,1067,787,830,.38)
 },
 forge:{
  hammer:near(1443,848,1657,840,.6), duck:back(1430,907,913,792,.32),
  runes:back(945,282,1079,275,.5), crystals:near(297,831,629,815,.48),
  moth:back(447,210,1251,353,.5), forged:near(1535,880,1672,851,.55),
  hotfix:back(598,849,895,793,.42), loot:back(713,884,749,794,.42),
  'goblin-bonk':near(401,860,490,832,.53), 'duck-knights':back(1530,873,1241,444,.26),
  'anvil-audit':back(698,855,920,795,.36), 'duck-levelup':back(1510,884,913,792,.30),
  'anvil-moonwalk':back(1340,1053,681,790,.43), 'goblin-delivery':back(300,1060,627,795,.45)
 },
 future:{
  coffee:back(1330,820,1434,537,.48), bot:back(540,851,1367,719,.4),
  toast:back(1278,298,1355,309,.4), astronaut:near(1818,987,1820,964,.45),
  marbles:back(714,813,1165,281,.45), comet:back(950,304,1035,243,.5),
  ready:near(1020,988,862,817,.52), wormhole:near(1420,842,1390,818,.5),
  'toaster-launch':near(497,841,525,827,.5), 'snail-speedrun':back(1730,1042,1380,717,.4),
  'pizza-convoy':back(1180,283,1190,330,.45), 'takeaway-abduction':near(1360,854,1400,807,.5),
  'snail-finish':back(480,844,1367,714,.4), 'toaster-disco':back(1060,1069,1180,328,.34)
 },
 'sky-harbor':{
  airship:back(1050,275,1110,300,.5), paper:back(1080,380,1230,338,.5),
  pilot:back(590,984,650,785,.42), teaballoon:back(1304,283,1370,315,.42),
  swallows:back(1040,242,1170,208,.5), compass:near(975,981,976,980,.55),
  lag:back(1420,1015,926,789,.4), boarding:back(744,1030,917,789,.36),
  'pigeon-mail':near(320,1010,494,979,.44), 'pizza-drop':back(1160,282,1150,300,.42),
  'luggage-escape':back(1390,1016,1040,393,.48), 'air-traffic':back(1130,295,1160,251,.5),
  'pigeon-ranked':back(430,1061,650,785,.4), 'luggage-loot':back(1530,1022,808,788,.34)
 },
 sanctuary:{
  boat:near(1765,982,1765,982,.65), mushroom:back(320,982,470,159,.3),
  moths:back(1198,132,1205,144,.8), tea:back(750,889,1180,286,.23),
  frog:near(1755,1003,1755,1003,.75), stars:back(1372,756,1340,269,.5)
 },
 'storm-coast':{
  umbrella:near(316,850,364,842,.65), message:back(1364,841,1130,363,.52),
  gulls:back(1000,145,1200,170,.65), shells:near(319,849,307,841,.6),
  lightning:back(1143,198,1170,217,.8), lifebuoy:back(1330,855,1260,395,.45)
 },
 'phoenix-observatory':{
  comet:back(1000,189,1160,183,.62), astronomer:near(335,991,1580,912,.32),
  phoenix:back(998,269,1130,266,.55), planets:near(142,743,142,743,.8),
  wish:back(1040,268,1250,216,.65), moon:back(1821,769,1812,722,.6)
 },
 'spirit-rail':{
  train:back(1003,837,1030,727,.45), luggage:back(650,856,790,732,.5),
  conductor:near(650,826,576,793,.65), ticket:back(685,495,573,416,.7),
  bell:near(551,774,551,774,.8), leaves:back(1106,823,1360,758,.55)
 },
 'aurora-camp':{
  marshmallows:near(827,933,1095,858,.55), kettle:near(1091,824,1091,824,.8),
  moths:back(1258,735,1258,735,.8), camper:back(577,915,1040,704,.38),
  constellation:back(1265,130,1265,130,.85), lantern:back(1380,945,1430,741,.5)
 },
 reef:{
  teapot:back(900,165,890,105,.65), diver:back(900,167,865,102,.65),
  manta:back(900,158,950,95,.7), jelly:back(0,0,0,0,1),
  courier:back(900,168,860,102,.65), school:back(660,160,1035,92,.6),
  crab:near(960,1006,960,926,.5), treasure:near(1325,694,1325,694,.85),
  chart:near(435,980,435,980,1)
 }
};

export function stageVisitors(id,world){
 const placements=staging[id];
 const cues=world.cues.map(cue=>{
  const p=placements[cue.id];
  if(!p)throw new Error(`Missing visitor placement: ${id}/${cue.id}`);
  return {...cue,depth:p.depth,weight:cue.weight*(p.depth==='background'?1.7:.5)};
 });
 const artists=Object.fromEntries(Object.entries(world.artists).map(([id,draw])=>{
  const p=placements[id];
  return [id,(c,age,event,art)=>{
   c.save();c.translate(...p.to);c.scale(p.scale,p.scale);c.translate(-p.from[0],-p.from[1]);
   try{draw(c,age,event,art);}finally{c.restore();}
  }];
 }));
 return {...world,cues,artists};
}
