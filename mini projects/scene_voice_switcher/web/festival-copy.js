// Authored jokes, questions and spirit casting. Decorative fiction, never game telemetry.
export const themes={
 bear:{name:'THUNDER BEAR',color:'#80e9ff',second:'#bf9bff'},
 turtle:{name:'JADE GUARDIAN',color:'#90ffda',second:'#ffb8dd'},
 ram:{name:'HOTFIX FOUNDRY',color:'#ffc17e',second:'#ff816b'},
 phoenix:{name:'COSMIC RESPAWN',color:'#b9dbff',second:'#dc9cff'}
};
export const worldThemes={'aurora-camp':'bear',sanctuary:'turtle',forge:'ram','phoenix-observatory':'phoenix',reef:'turtle','storm-coast':'bear',arcade:'ram',tavern:'ram',future:'phoenix','sky-harbor':'phoenix','spirit-rail':'bear'};
const beat=(title,line,act)=>({title,line,act});
export const common=[
 beat('SIDE QUEST ACCEPTED','Chat: what game deserves a second chance?','loot'),
 beat('UNTITLED GOOSE INCIDENT','The final boss has stolen the objective.','goose'),
 beat('THE CAKE IS STILL A LIE','Chat: name a game you wish you could forget and replay.','portal'),
 beat('TOTALLY NORMAL CHEST','Chat: open it, poke it, or leave immediately?','mimic'),
 beat('CHECKPOINT REACHED','Drink water. Unclench jaw. Blame pathing.','bonfire'),
 beat('ONE MORE GAME','A legally non-binding statement.','loop'),
 beat('LORE ACCURATE LOOT','Legendary rarity. Emotional support stats.','loot'),
 beat('THE SECRET BOSS IS CHAT','Chat: what is your most defensible gaming hot take?','goose')
];
export const stories={
 bear:[
  beat('BOSS MUSIC. NO BOSS.','The bear sat on the volume button.','bear'),
  beat('PARRY THIS, WEATHER','Chat: dodge roll or stand there confidently?','parry'),
  beat('BONFIRE LIT','Rested. Hydrated. Still in queue.','bonfire'),
  beat('TACTICAL REPOSITIONING','Running away, but with excellent branding.','dash'),
  beat('BEARLY A SKILL ISSUE','Chat: which boss took you the most attempts?','bear'),
  beat('THE FLOOR IS A MECHANIC','The bear would like a second opinion.','parry'),
  beat('STORM BUILD ONLINE','Four spirits. One shared brain cell.','bear'),
  beat('YOU CAN PET THE BOSS','This has not been approved by the boss.','goose')
 ],
 turtle:[
  beat('TOUCH GRACE. THEN GRASS.','The turtle has completed both dailies.','turtle'),
  beat('LET THE TURTLE COOK','Estimated completion: eventually.','turtle'),
  beat('DAMAGE? IN THIS ECONOMY?','Shield first. Questions after tea.','parry'),
  beat('PACIFIST RUN','Except for that one suspicious pot.','mimic'),
  beat('REST IS A VALID BUILD','Chat: what is your comfort game?','bonfire'),
  beat('THE REAL ENDGAME IS FISHING','The main quest can wait another 80 hours.','turtle'),
  beat('NO THOUGHTS. ONLY SHELL.','Chat: tank, healer, or chaos gremlin?','turtle'),
  beat('SECRET AREA DISCOVERED','It was behind the waterfall. Of course it was.','portal')
 ],
 ram:[
  beat('PARRY THIS, PATCH NOTES','The ram has submitted feedback. Physically.','parry'),
  beat('LET HIM COOK','Update: the kitchen is now a raid encounter.','ram'),
  beat('INTENDED GAMEPLAY','The feature formerly known as a bug.','mimic'),
  beat('BONK BUILD VIABLE','Chat: stylish combo or one enormous hit?','ram'),
  beat('TASK FAILED SUCCESSFULLY','The anvil has been promoted to management.','loot'),
  beat('ONE DOES NOT SIMPLY WALK','The ram has selected sprint.','dash'),
  beat('BALANCED, AS ALL THINGS...','The goose has eaten the rest of the patch notes.','goose'),
  beat('THIS IS FINE','Chat: which game has your favourite combat?','bonfire')
 ],
 phoenix:[
  beat('YOU RESPAWNED','Same confidence. New loading screen.','phoenix'),
  beat('NEW GAME PLUS','The bird remembered the lore. Forgot the controls.','loop'),
  beat('THE CAKE IS IN ANOTHER CASTLE','Chat: best game soundtrack, no hesitation?','portal'),
  beat('SKILL ISSUE: GRAVITY','The phoenix has requested a hotfix.','phoenix'),
  beat('SPEEDRUN STRAT: REBIRTH','Death is just a very dramatic shortcut.','dash'),
  beat('A SECOND PHASE?','Chat: which boss reveal lives rent-free in your head?','phoenix'),
  beat('RARE DROP: FREE TIME','Immediately spent on one more run.','loot'),
  beat('ACHIEVEMENT: STILL HERE','Against all odds, the egg believes in you.','phoenix')
 ]
};
export const SLOT_SECONDS=36,SHOW_SECONDS=23;
export function festivalBeat(id,time){
 const key=worldThemes[id];if(!key||!Number.isFinite(time))return null;
 const offset=Object.keys(worldThemes).indexOf(id)*7,t=Math.max(0,time+offset),slot=Math.floor(t/SLOT_SECONDS),age=t%SLOT_SECONDS;
 if(age>=SHOW_SECONDS)return null;
 const index=Math.floor(slot/2)%common.length,story=slot%2?common[index]:stories[key][index];
 return {...story,theme:key,age,slot};
}
