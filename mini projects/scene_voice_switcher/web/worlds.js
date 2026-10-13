// Authored presentation catalog. Only worlds with complete performances appear.
import {stageVisitors} from './visitor-staging.js';
import {withGameGuests} from './game-guests.js';
import {withLeagueGuests} from './league-guests.js';
import {withLobbyMoments} from './lobby-moments.js';
import {withHabitat} from './habitat-scenes.js';
import {habitatWorld} from './habitat-world.js';
import {habitatDesigns} from './habitat-designs.js';
export const worlds=[
 {id:'reef',source:'ReefLobby',label:'Turtle Reef',title:'Tea beneath the tides.',description:'Swimming turtles, swaying coral, lantern warmth and a few underwater visitors.',module:'reef-world'},
 {id:'forge',source:'ForgeLobby',label:'Hotfix Foundry',title:'The forge got patched. Again.',description:'Legendary rubber ducks, emergency snack patches and a balance hammer with questionable judgment.',module:'forge-world'},
 {id:'sanctuary',source:'SanctuaryLobby',label:'Ionian Spirit Sanctuary',title:'Train hard. Find your balance.',description:'Udyr trains beneath the blossoms, poros raid the tea shelf and lantern festivals drift past the monastery.',module:'sanctuary-world'},
 {id:'sky-harbor',source:'SkyHarborLobby',label:'Lagport',title:'Your loot is arriving. Probably.',description:'Pizza airships, rubber-band luggage and a plunger that confidently points in the wrong direction.',module:'sky-harbor-world'},
 {id:'storm-coast',source:'StormCoastLobby',label:'Storm Coast',title:'A warm seat beside the storm.',description:'Rain moves beyond the retreat, lanterns sway and waves stir. Small visitors bring their own weather gear.',module:'storm-coast-world'},
 {id:'phoenix-observatory',source:'PhoenixObservatoryLobby',label:'Cryophoenix Observatory',title:'The stars have an ice form.',description:'Anivia-inspired frozen astronomy, passing meteors, migrating ice spirits and Udyr chilling the tea.',module:'phoenix-observatory-world'},
 {id:'spirit-rail',source:'SpiritRailLobby',label:'Spirit Railway',title:'A platform between journeys.',description:'The distant train rocks gently, steam rises, banners sway and autumn leaves drift. The station has a few surprises.',module:'spirit-rail-world'},
 {id:'tavern',source:'TavernWorldLobby',label:'Respawn Inn',title:'A terrible plan. A legendary evening.',description:'Loot-hoarding dragons, RNG cheese dice, a legendary spoon and a mimic conducting a loot audit.',module:'tavern-world'},
 {id:'future',source:'FutureWorldLobby',label:'Space Queue Lounge',title:'Still in queue. Still having fun.',description:'Pizza UFOs, AFK toast, a potato-ping robot and a portal that orders takeaway.',module:'future-world'},
 {id:'arcade',source:'SpiritArcadeLobby',label:'One More Game Arcade',title:'One more game. Zero self-control.',description:'Rage-quitting controllers, escaping jackpots, any-percent toast and a prize claw with opinions.',module:'arcade-world'},
 {id:'aurora-camp',source:'AuroraCampLobby',label:'Thunderbear Forest',title:'The forest has terrible pathing.',description:'A sleeping ram blocks the root bridge. Find hidden poros, a legendary spoon, acorn pulley trouble and the goose with a stolen boot.',module:'aurora-camp-world'}
];
export async function loadWorld(id='reef'){
 const entry=worlds.find(w=>w.id===id);if(!entry)throw new Error('Unknown living lobby');
 const world=habitatDesigns[id]?habitatWorld(id):(await import(`./${entry.module}.js`)).world;
 return {...entry,...withHabitat(id,withLobbyMoments(id,withLeagueGuests(id,withGameGuests(id,stageVisitors(id,world)))))};
}
