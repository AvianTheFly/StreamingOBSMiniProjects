// Dispatch is one explicit composition per observed event. Reusable geometry is
// in border-ink; this registry owns no detection, persistence or runtime resource.
const BORDER_ACTS=Object.freeze({...BORDER_COMBAT,...BORDER_DRAGONS,...BORDER_OBJECTIVES,...BORDER_STRUCTURES,...BORDER_VITALS,...BORDER_PROGRESSION,...BORDER_LIFECYCLE,...BORDER_SIGNALS});
const BORDER_CONTACTS={kill:.43,assist:.43,first_blood:.40,low_hp_kill:.43,low_hp_multikill:.43,double_kill:.48,triple_kill:.65,quadra_kill:.555,pentakill:.43,ace:.58,manpower_advantage:.56,dragon:.48,dragon_earth:.48,dragon_fire:.51,dragon_water:.43,dragon_air:.48,dragon_chemtech:.65,dragon_hextech:.46,dragon_elder:.53,baron:.43,herald:.68,void_grub:.54,objective_steal:.40,atakhan_legacy:.55,turret_destroyed:.40,first_turret:.36,inhibitor_destroyed:.38,inhibitor_respawning_soon:.72,inhibitor_respawned:.61,death:.5,respawn:.44,low_health:.42,heavy_health_loss:.24,large_heal:.49,resource_spent:.60,level_up:.70,ultimate_learned:.53,ability_rank_up:.59,inventory_added:.59,inventory_removed:.59,cs_milestone:.53,vision_activity:.59,game_start:.50,minions_spawning:.52,victory:.42,defeat:.49,game_end:.49};
export const AUTHORED_BORDER_KEYS=Object.freeze(Object.keys(BORDER_ACTS));
export function borderCueMotion(key,p){const beat=BORDER_CONTACTS[key]??.62;return {beat,contact:p>=beat,approach:borderEase(p,Math.max(0,beat-.27),beat),consequence:borderEase(p,beat,Math.min(.96,beat+.22))};}
export function borderComposition(key){return BORDER_ACTS[key]?.name||(key?.startsWith('custom_')?'borderCustom':null);}
function borderPerformance(c,e){
 const act=BORDER_ACTS[e.key]||(e.key?.startsWith('custom_')?borderCustom:null);if(!act)return false;
 const I=borderInk(c,e);c.save();c.globalAlpha*=smooth(I.p/.1);(BORDER_SCENERY[e.key]||BORDER_SCENERY.custom)(I,borderMaterials(I));act(I);borderTitle(I);c.restore();return true;
}
