// Timing is the contract between artwork, encoder and OBS. Seconds, 60 fps.
// The opaque plateau must span the cut frame, including video rounding margins.
const timingResponse=await fetch(new URL('./timing.json',import.meta.url));
if(!timingResponse.ok)throw Error('Transition timing could not load');
export const timing=Object.freeze(await timingResponse.json());
export const spirits={
 bear:{name:'Stormclaw',subtitle:'Bear · lightning & claw rips',color:'#7bdcff',dark:'#061321',seed:41},
 turtle:{name:'Verdant Aegis',subtitle:'Turtle · three impacts & hexagonal ward',color:'#b5ffb8',dark:'#07271c',seed:83,material:'turtle-material-v14.png'},
 ram:{name:'Sundering Gold',subtitle:'Ram · mountain leaps, triumph & golden fracture',color:'#ffdf9b',dark:'#302016',seed:127},
 phoenix:{name:'Cinder Ascension',subtitle:'Phoenix · ash, frostfire & rebirth',color:'#91dfff',dark:'#0c1926',seed:199},
};

export function animationTiming(id){return {...timing,...(timing.animations?.[id]||{})};}
export const clips={
 bear:{spirit:'bear',variant:0,name:'Storm stalker'},
 'bear-alt':{spirit:'bear',variant:1,name:'Thunder ambush'},
 turtle:{spirit:'turtle',variant:0,name:'Emerald bulwark'},
 'turtle-alt':{spirit:'turtle',variant:1,name:'Siege ward'},
 ram:{spirit:'ram',variant:0,name:'Mountain breaker'},
 'ram-alt':{spirit:'ram',variant:1,name:'Golden siege'},
 phoenix:{spirit:'phoenix',variant:0,name:'Ash omen'},
 'phoenix-alt':{spirit:'phoenix',variant:1,name:'Ember return'},
};
