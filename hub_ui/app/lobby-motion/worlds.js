// Authored presentation catalog. Only worlds with complete performances appear.
export const worlds=[
 {id:'reef',source:'ReefLobby',label:'Turtle Reef',title:'Tea beneath the tides.',description:'Swimming turtles, swaying coral, lantern warmth and a few underwater visitors.',module:'reef-world'},
 {id:'forge',source:'ForgeLobby',label:'Spirit Forge',title:'A little mischief at the forge.',description:'Banners sway, fire bowls breathe and crystals shimmer. The tools occasionally have ideas of their own.',module:'forge-world'},
 {id:'sanctuary',source:'SanctuaryLobby',label:'Forest Sanctuary',title:'Visitors to the moonlit shrine.',description:'Lanterns sway, incense curls and water flows. Tiny forest guests arrive between the quiet moments.',module:'sanctuary-world'},
 {id:'sky-harbor',source:'SkyHarborLobby',label:'Sky Harbor',title:'Post from above the clouds.',description:'The painted airship bobs, banners sway and cloud light drifts. Little deliveries arrive by air.',module:'sky-harbor-world'},
 {id:'storm-coast',source:'StormCoastLobby',label:'Storm Coast',title:'A warm seat beside the storm.',description:'Rain moves beyond the retreat, lanterns sway and waves stir. Small visitors bring their own weather gear.',module:'storm-coast-world'},
 {id:'phoenix-observatory',source:'PhoenixObservatoryLobby',label:'Phoenix Observatory',title:'Tea among the constellations.',description:'Fire moves in the armillary, hanging crystals sway and the painted sky twinkles. A few little astronomers wander in.',module:'phoenix-observatory-world'},
 {id:'spirit-rail',source:'SpiritRailLobby',label:'Spirit Railway',title:'A platform between journeys.',description:'The distant train rocks gently, steam rises, banners sway and autumn leaves drift. The station has a few surprises.',module:'spirit-rail-world'},
 {id:'tavern',source:'TavernWorldLobby',label:'Lobby of Legends',title:'Another round of little adventures.',description:'The painted dragon breathes, banners sway and mugs steam. Even the furniture joins the evening.',module:'tavern-world'},
 {id:'future',source:'FutureWorldLobby',label:'Future Lounge',title:'Visitors from the next tomorrow.',description:'Robots stir, the galaxy shimmers and consoles pulse. Tiny deliveries arrive from orbit.',module:'future-world'},
 {id:'arcade',source:'SpiritArcadeLobby',label:'Spirit Arcade',title:'One more imaginary credit.',description:'Rain falls outside, plants sway and cabinets glow. Small players have their own games.',module:'arcade-world'},
 {id:'aurora-camp',source:'AuroraCampLobby',label:'Aurora Camp',title:'Stories beside the northern lights.',description:'The aurora flows, the tent breathes and firelight dances. Little campers wander past.',module:'aurora-camp-world'}
];
export async function loadWorld(id='reef'){
 const entry=worlds.find(w=>w.id===id);if(!entry)throw new Error('Unknown living lobby');
 const {world}=await import(`./${entry.module}.js`);return {...entry,...world};
}
