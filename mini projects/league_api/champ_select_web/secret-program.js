// Feature-owned casting and measured floor contacts in the 1920x1080 paintings.
// Three disjoint scenic pockets keep visitors away from portraits, chat and titles.
export const programs={
 bear:[
  {x:230,y:962,h:48,box:[135,865,235,174],acts:['kirby'],original:true,surface:'left rock beside the conductor'},
  {x:600,y:950,h:58,box:[470,805,265,265],acts:['crewmate','climber'],surface:'inner stone shelf above the waterfall'},
  {x:1680,y:955,h:55,box:[1550,815,300,255],acts:['creeper','boo'],surface:'right foreground rock shelf'}],
 turtle:[
  {x:533,y:958,h:51,box:[445,865,285,205],acts:['goose'],original:true,surface:'well-side stone lip'},
  {x:150,y:1022,h:52,box:[25,860,285,210],acts:['kirby','hornet'],surface:'left lily bank'},
  {x:1720,y:1005,h:54,box:[1590,850,300,220],acts:['salvager','boo'],surface:'right garden ledge'}],
 ram:[
  {x:606,y:933,h:48,box:[515,825,220,225],acts:['crewmate'],original:true,surface:'inner forge step'},
  {x:150,y:1030,h:62,box:[25,860,300,210],acts:['climber','creeper'],surface:'left basalt shelf'},
  {x:1680,y:1015,h:58,box:[1550,855,330,215],acts:['salvager','goose'],surface:'right forge rocks'}],
 phoenix:[
  {x:1540,y:1000,h:48,box:[1430,875,220,195],acts:['boo'],original:true,surface:'warm stone beside the brazier'},
  {x:160,y:1030,h:52,box:[25,875,300,195],acts:['kirby','goose'],surface:'left snow shelf'},
  {x:620,y:1012,h:57,box:[485,855,250,215],acts:['hornet','creeper'],surface:'inner ice ledge'}],
};
export const castFor=theme=>[...new Set(programs[theme].flatMap(lane=>lane.acts))];
export function secretState(clock,lane=0){
 const elapsed=Math.max(0,clock)+2+lane*6,cycle=Math.floor(elapsed/18),age=elapsed%18;
 return {cycle,variant:cycle%3,age,active:age<16};
}
export function secretProgram(theme,clock){return programs[theme].map((spot,lane)=>{
 const state=secretState(clock,lane);
 return {...spot,...state,lane,name:spot.acts[state.cycle%spot.acts.length],variation:Math.floor(state.cycle/spot.acts.length)%3};
});}
