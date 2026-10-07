// Authored cultural context comes from the actual local clips, not their filenames.
export const SOUND_CULTURE_STORIES={
 disco:'Blue-shirt shuffle becomes a moonwalk, one turn and a held victory pose; the late dancer catches up.',
 coffin:'Astronomia crew enters together, wobbles, catches a lost hat and bows without dropping the casket.',
 mash:'Mashle dances, stops to flex a wand, then eats the pastry reward with cream on his face.',
 crabs:'Crab Rave chorus jumps a rolling beach ball; the last crab lands upside down while the crew salutes.',
 muffins:'Muffin Song: call-and-response cast, a wave, then all eight collapse on the final die with X-eyes and dropped accessories.',
 balloons:'Dancing Toothless spots a fish, stops dancing, jumps to gulp it, then lets out a fish-shaped burp.',
 arena:'John Cena waves an open palm across his face, vanishes, and leaves an abandoned belt while autofocus searches.',
 rats:'Milton Rat Dance: one boot flies off; a one-foot hop ends in a recovered boot and triumphant pose.',
 raccoon:'Pedro: the crew does a staggered wave, one raccoon tastes the stolen record, another flips, then everyone poses.',
 shades:'Sigma Boy: mock-serious cool strut, sunglasses catch, one wobble, shameless self-rating.',
 racing:'Deja Vu: preserve the speeding full-perimeter car and gear shifts; add a pit crew joke.',
 equalizer:'When Mom Is Not Home: the oven percussion opens into a toast launch, a mitt catches breakfast, the door closes.',
 nyan:'Nyan Cat flies a continuous rainbow, dodges a pixel moon, barrel-rolls once and sheds a few crumbs.',
 lizard:'Tom button meme: physical button contact launches a popcorn ripple and cinema reaction.',
 gary:'Gary meows a fish biscuit into his open mouth, sheds crumbs and closes his mouth; the recognizable snail cast remains.',
 quack:'Mac Quack: a cursor closes QUACK.EXE, but three rubber ducks escape. Task failed successfully.',
 bonk:'Bonk: a mallet physically meets the dog pot helmet, then a comic impact settles.',
 piuw:'Piuw: a toy zap ricochets between edge satellites; a tiny alien fails to catch it.',
 'mom-frog':'Mom Frog stays unimpressed as one croak topples the microphone around its planted foot.',
 tantrum:'Buttercup running meme: frantic feet clear a hurdle, skid to a stop, then slump over one misclick.',
 kitchen:'Cooked dog sips coffee in denial, pops out of the toaster with his drink, then settles with crumbs: update, cooked.',
 meltdown:'Oh no telephone meme: three escalating banana-phone answers, then the plug is pulled and the handset stays down.',
 rewind:'Perspective/Frolic: the detective ignores Exhibit A, plants a shoe on the peel, slips, kicks up a leg and loses his glasses.',
 violin:'Sad violin: staggered solos, a snapped string, notes falling off the score and the hamster raising a tissue flag.',
 spill:'Curb/end credits: a pointer nudges a mug off a ledge, coffee lands, undo fails, then credits and a clapper finish the misclick.',
 heartbreak:'Untitled/How Could This Happen: emo clouds mourn a broken heart; tissues arrive, then a crooked bandage repairs it.',
 isolation:'Akira Leave Me Alone: accumulating pings, a precise mute click, disappearing notifications and a relaxed inner-peace pose.',
 prowler:'Prowler sting: a hiding red-masked figure discovers an active ward and sinks into the box. The gank was visible.',
 rescue:'Starman/Superman: catch an ally at 1 HP, restore health, then deflect the final projectile off the raised fist.',
 confusion:'X-Files dog: UFO abduction, a confused descent, and a folded foil-hat souvenir before the craft leaves.'
};
function culturePerformance(c,t,d,e){
 return cultureParty(c,t,d,e)||cultureReaction(c,t,d,e);
}
function cultureAudioEffect(e){
 const data=CULTURE_TIMING[e.scene||e.style||'muffins'];
 return data?.bpm?{...e,bpm:data.bpm,beatOffset:data.offset}:e;
}
