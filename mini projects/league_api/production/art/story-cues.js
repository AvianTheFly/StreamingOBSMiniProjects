// Presentation score: one contact beat drives the actor, border and consequence.
// Fractions use the existing director duration, including personal overrides.
export const LEAGUE_SCORES=Object.freeze({
 kill:['strike','#63dfff','#ffd078',.43,'TARGET ACQUIRED.',1],
 assist:['link','#6af1bc','#ffd58c',.43,'TEAMWORK DIFF.',.85],
 first_blood:['cherry','#ff6489','#ffce66',.40,'FIRST POP OF THE NIGHT.',1.45],
 low_hp_kill:['clutch','#ff748c','#ffe085',.43,'ONE HP. STILL CLOCKED IN.',1.3],
 low_hp_multikill:['clutch','#ff68b8','#ffd76e',.43,'THE HEALTH BAR IS A SUGGESTION.',1.6],
 double_kill:['combo','#57d8ff','#ffb970',.52,'MAKE THAT TWO.',1.25],
 triple_kill:['combo','#9c8aff','#ffcf70',.50,'THIRD TIME IS THE CHARM.',1.45],
 quadra_kill:['combo','#74f0d1','#ed89ff',.50,'FOUR DOWN. ONE NERVOUS.',1.7],
 pentakill:['concert','#c780ff','#ffe084',.435,'THE RIFT HAS A HEADLINER.',2],
 ace:['sweep','#8be6be','#ffdb88',.58,'MISSED A SPOT.',1.65],
 manpower_advantage:['squad','#61dce9','#ffd279',.56,'PLUS ONE. BIG DIFFERENCE.',1],
 dragon:['dragon','#8fe5a9','#ffda84',.48,'WINGS SECURED.',1.35],
 dragon_earth:['earth','#b9e49c','#e8ba76',.48,'ROCK SOLID.',1.4],
 dragon_fire:['fire','#ff8650','#ffe278',.51,'EXTRA TOASTY.',1.55],
 dragon_water:['water','#5ce5e1','#87b9ff',.52,'DUCK WEATHER.',1.4],
 dragon_air:['air','#a4edff','#fff0b8',.48,'CLEARED FOR TAKEOFF.',1.35],
 dragon_chemtech:['chemtech','#b0f16a','#71e5b7',.59,'BOTANY WAS NOT IN THE PLAN.',1.5],
 dragon_hextech:['hextech','#61dfff','#c69aff',.46,'FULLY CHARGED.',1.6],
 dragon_elder:['elder','#d5c7ff','#fff0b5',.53,'ANCIENT. STILL GOT IT.',1.85],
 baron:['void','#bc8aff','#64e4d4',.53,'THE HORNS ARE A BIT MUCH.',1.75],
 herald:['eye','#b896ff','#ffd882',.82,'A VERY DISTINGUISHED HERALD.',1.45],
 void_grub:['grubs','#ce9fff','#7ddedc',.75,'WAIT FOR THE LITTLE GUY.',1.1],
 objective_steal:['heist','#61e7ee','#ffcf6c',.63,'IOU ONE OBJECTIVE.',1.8],
 atakhan_legacy:['thorn','#f178af','#be91ee',.55,'A VERY THORNY SITUATION.',1.6],
 turret_destroyed:['rubble','#a6ddcb','#ffc685',.49,'PERMIT: DEMOLISHED.',1.25],
 first_turret:['rubble','#ffd475','#75e3d2',.49,'FIRST BRICK. FIRST PAYCHECK.',1.5],
 inhibitor_destroyed:['shatter','#c38cff','#72ddff',.49,'SOME ASSEMBLY REQUIRED.',1.45],
 inhibitor_respawning_soon:['waiting','#8dc9ff','#c5a0ff',.56,'ASSEMBLY IN PROGRESS.',.8],
 inhibitor_respawned:['restore','#8cebdc','#bba2ff',.64,'BACK IN ONE PIECE.',1.25],
 death:['rest','#a2bce9','#d5c5f1',.50,'BRB. SPIRITUAL MAINTENANCE.',.55],
 respawn:['spirits','#6de5b5','#ffc682',.66,'ROUND TWO.',1.5],
 low_health:['pulse','#ff758e','#ffc58c',.42,'HANDLE WITH CARE.',1],
 heavy_health_loss:['bandage','#ff896e','#ffe2a1',.24,'THAT WILL LEAVE A MARK.',1.25],
 large_heal:['heal','#65edb6','#f5b6e5',.49,'A LITTLE PICK-ME-UP.',1.25],
 resource_spent:['empty','#63ceff','#acb4ff',.66,'NOT EVEN ONE DROP.',.85],
 level_up:['level','#b8ee79','#ffcf6a',.59,'A STEP ABOVE.',1.25],
 ultimate_learned:['unlock','#b69aff','#ffdf85',.59,'THE BIG BUTTON.',1.65],
 ability_rank_up:['rank','#68e1ed','#d3ef88',.59,'ANOTHER NOTCH.',1],
 inventory_added:['loot','#ffd782','#6fdfc2',.59,'IT HAS POCKETS.',1.05],
 inventory_removed:['unpack','#a7baff','#eacba4',.59,'TRAVEL LIGHT.',.85],
 cs_milestone:['harvest','#ffe083','#a7e477',.62,'HONEST WORK.',1.1],
 vision_activity:['vision','#72eccd','#ffe195',.59,'NICE BUSH. WE SEE YOU.',1.1],
 game_start:['gates','#8ee8c9','#ffd084',.50,'EVERYBODY LOOK BUSY.',1.45],
 minions_spawning:['march','#63daff','#e999ef',.52,'TINY LEGS. BIG PLANS.',1.15],
 victory:['trophy','#ffdc74','#75edc1',.49,'GG. TAKE A BOW.',2],
 defeat:['rain','#91bcf5','#b6e5ad',.66,'GROWING THROUGH IT.',.95],
 game_end:['book','#7ee0dc','#ffd589',.65,'SAVE THE GOOD PARTS.',1.05],
 possible_purchase:['signal','#e7c483','#8bdce3',.62,'WINDOW SHOPPING?',.75],
 possible_item_upgrade:['signal','#c29afa','#f2d38c',.62,'NEW LOOK?',.75],
 possible_consumable_use:['signal','#a4e586','#e6c785',.62,'QUICK SIP?',.75],
 possible_base_visit:['signal','#86dece','#efd38c',.62,'HOME SWEET HOME?',.75],
 possible_combat:['signal','#b9c9ef','#ef9cb4',.62,'SOMETHING BREWING?',.85],
 possible_low_hp_escape:['signal','#b2e7a2','#f69ba9',.62,'DID WE GET AWAY?',.8],
 possible_teamfight:['signal','#e498c7','#83c8ee',.62,'EVERYONE HERE?',.9],
 possible_objective_fight:['signal','#b99aed','#ead185',.62,'CONTESTED?',.9],
 possible_power_spike:['signal','#ad9beb','#f4d67f',.62,'FEELING STRONGER?',.8],
 possible_roam:['signal','#80dcea','#e9dc9e',.62,'SCENIC ROUTE?',.75],
 possible_jungle_activity:['signal','#a5e393','#f3da85',.62,'RUSTLE IN THE BUSHES?',.75],
});
const CUSTOM_SCORE=['custom','#c0a0ff','#7de9eb',.52,'',1.05];
export function leagueScore(key){return LEAGUE_SCORES[key]||(key?.startsWith('custom_')?CUSTOM_SCORE:null);}
export function leagueBeat(p,beat){
 const age=p-beat;
 return {anticipation:smooth((p-beat+.22)/.18)*(1-smooth(age/.035)),
  contact:age>=0,impact:age<0?0:Math.max(0,1-age/.17)**2,
  recoil:age<0?0:Math.sin(Math.min(1,age/.18)*Math.PI)*Math.exp(-Math.max(0,age)*12),
  payoff:smooth((age-.08)/.12),settle:smooth((age-.18)/.12)};
}
// Actual blade tip meets the target surface before the star, crack or flag appear.
export function killContactMotion(p){
 const reach=smooth((p-.18)/.25),retreat=smooth((p-.50)/.13);
 return {tipX:-96+56*reach-20*retreat,tipY:0,contact:p>=.43,
  targetX:0,targetFace:-40,star:smooth((p-.43)/.16),flag:smooth((p-.68)/.14)};
}
export function theaterMotion(key,p){
 const score=leagueScore(key),beat=score?.[3]??.52,m=leagueBeat(p,beat);
 return {...m,beat,approach:smooth((p-beat+.27)/.27),
  reveal:smooth((p-.035)/.15),exit:smooth((p-.9)/.1)};
}
