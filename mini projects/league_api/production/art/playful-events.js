// Authored light choreography: motion, palette, tiny accent, voices, tempo, story.
// No saved settings, detection, clocks or resources are owned by this table.
const EDGE_CUES = Object.freeze({
 kill:['comet','candy','spark',2,1.1,'A pair of candy comets flicks a tiny victory sparkle'],
 assist:['braid','mint','loop',2,.8,'Two friendship threads braid together and drift apart'],
 first_blood:['bloom','peach','star',3,.8,'A cherry-soda sparkle opens into warm fizz'],
 low_hp_kill:['pulse','candy','heart',2,.85,'A wobbly pink heartbeat catches a lucky gold spark'],
 low_hp_multikill:['comet','sunset','heart',4,1,'A lucky heart surfs a small meteor shower'],
 ace:['orbit','gold','star',5,.7,'Five little lights take a victory lap together'],
 dragon:['breeze','mint','scale',3,.55,'Opal scales surf an airy dragon slipstream'],
 dragon_earth:['prism','sand','pebble',3,.45,'Weightless pebbles skip along warm mineral seams'],
 dragon_fire:['ember','peach','spark',4,.7,'Campfire curls toss popcorn-sized embers'],
 dragon_water:['ripple','ocean','duck',3,.55,'Liquid light ripples past one very small rubber duck'],
 dragon_air:['breeze','sky','plane',3,.7,'Paper planes surf looping cloud scribbles'],
 dragon_chemtech:['bubble','lime','bubble',3,.55,'Lime soda bubbles wobble out of a fizzy experiment'],
 dragon_elder:['breeze','moon','ghost',4,.4,'Pearl wisps escort tiny sleepy spirits around the rim'],
 baron:['braid','violet','eye',4,.55,'Purple noodle-light curls around a cheeky blinking eye'],
 herald:['orbit','violet','eye',3,.65,'An iris-shaped ripple does a slow cosmic roly-poly'],
 void_grub:['bounce','violet','grub',3,.85,'Three glow grubs boing along tiny violet spring trails'],
 objective_steal:['comet','sky','star',3,1.2,'A gold spark cheekily switches into a cyan slipstream'],
 atakhan_legacy:['bloom','rose','petal',3,.5,'Rose-colored smoke unspools into floating thorn petals'],
 turret_destroyed:['prism','sky','diamond',3,.9,'A few blueprint lines unclick into weightless confetti'],
 first_turret:['prism','gold','star',4,.8,'Gold seams unzip into a little first-place sparkle'],
 inhibitor_destroyed:['prism','violet','diamond',4,.75,'A crystal soap bubble opens into lilac fragments'],
 inhibitor_respawning_soon:['orbit','sky','diamond',2,.45,'Sleepy crystal dots lazily find their orbit'],
 inhibitor_respawned:['braid','sky','diamond',3,.7,'Crystal threads zip together with a soft blue twinkle'],
 death:['breeze','moon','ghost',2,.35,'A pocket ghost floats through a quiet moonlit hammock'],
 respawn:['comet','mint','ghost',3,.95,'A tiny ghost catches the mint express back in'],
 low_health:['pulse','rose','heart',2,.5,'One squishy heart rides a gentle pink pulse'],
 heavy_health_loss:['ripple','peach','spark',2,.85,'A rubbery light ripple absorbs the bonk and settles'],
 large_heal:['bloom','mint','heart',3,.65,'Mint spring water lifts a few heart-shaped bubbles'],
 resource_spent:['comet','ocean','bubble',2,.85,'Blue energy droplets trickle into little shooting stars'],
 level_up:['comet','gold','star',3,.8,'Golden starlets climb a springy light staircase'],
 ultimate_learned:['orbit','sunset','star',4,.7,'A tiny disco star unlocks four luminous hula hoops'],
 ability_rank_up:['prism','ocean','spark',2,.65,'A clean cyan glint hops to the next little notch'],
 inventory_added:['bounce','gold','coin',2,.75,'A lucky coin bounces into a golden pocket of light'],
 inventory_removed:['breeze','moon','coin',2,.5,'A silver coin rolls away with a small goodbye twinkle'],
 cs_milestone:['comet','sand','seed',3,.7,'Golden seeds skip along a warm harvest breeze'],
 vision_activity:['ripple','mint','eye',2,.5,'A curious eye sends out soft mint sonar rings'],
 manpower_advantage:['braid','sky','spark',3,.8,'An extra friendly spark joins the blue team braid'],
 game_start:['orbit','sunset','plane',3,.65,'A paper-plane lobby launches through pastel portal loops'],
 minions_spawning:['bounce','sky','grub',3,.7,'Tiny lane beans bounce along parallel neon lanes'],
 victory:['bloom','gold','star',5,.85,'Champagne starlight and curly confetti take a victory lap'],
 defeat:['ripple','moon','heart',2,.4,'A silver puddle catches a pink consolation heart'],
 game_end:['breeze','sky','star',2,.4,'The last arcade spark drifts home along blue hour'],
 double_kill:['comet','candy','star',2,1,'Twin candy meteors play follow the leader'],
 triple_kill:['orbit','sunset','star',3,.9,'Three sherbet satellites juggle their little light tails'],
 quadra_kill:['braid','violet','star',4,.8,'Four lavender streamers make a loose cosmic friendship knot'],
 pentakill:['comet','sunset','star',5,1,'Five rainbow comets deliver a pocket-sized party'],
 possible_purchase:['bounce','sand','coin',2,.5,'A curious little coin follows a tentative golden trail'],
 possible_item_upgrade:['prism','sunset','diamond',2,.55,'A gem glint tries on a slightly bigger halo'],
 possible_consumable_use:['bubble','mint','bubble',2,.7,'A small fizzy toast leaves mint bubble rings'],
 possible_base_visit:['orbit','ocean','loop',2,.4,'A homeward ripple curls into a cozy blue loop'],
 possible_combat:['braid','rose','spark',2,.65,'Two pink sparks circle with playful feints'],
 possible_low_hp_escape:['comet','mint','heart',2,.8,'A lucky heart slips away on a mint vapor trail'],
 possible_teamfight:['braid','candy','loop',4,.7,'Candy-colored ribbons have a small spaghetti argument'],
 possible_objective_fight:['orbit','violet','spark',3,.6,'Purple and gold sparks politely contest the same orbit'],
 possible_power_spike:['ember','sunset','star',3,.7,'A sherbet spark finds its tiny rocket booster'],
 possible_roam:['breeze','sky','plane',2,.7,'One little paper airplane follows a wandering blue doodle'],
 possible_jungle_activity:['bubble','lime','seed',2,.4,'Firefly seeds peek through soft green bubble trails'],
});
const PLAYFUL_EVENT_STORIES=Object.freeze(Object.fromEntries(
 Object.entries(EDGE_CUES).map(([key,cue])=>[key,cue[5]])));
function playfulLeague(c,e){
 if(e.key==='dragon_hextech')return false;
 const cue=EDGE_CUES[e.key] || (e.key?.startsWith('custom_')
  ? ['orbit','sunset','spark',3,.65,'A personal constellation'] : null);
 if(!cue)return false;
 paintEdgeCue(c,e,cue);return true;
}
function playfulRest(c,death){
 c.save();c.globalAlpha*=smooth((death.elapsed||0)/1.2)*.65;
 paintEdgeCue(c,{key:'death',elapsed:death.elapsed||0,duration:Infinity},EDGE_CUES.death);
 c.restore();
}
