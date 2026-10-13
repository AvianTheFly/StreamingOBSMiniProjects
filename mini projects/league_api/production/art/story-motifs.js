// Small semantic signatures: each cue owns its perimeter silhouette and palette.
const STORY_MOTIFS=Object.freeze({
 dragon_earth:['mountain','#b9e49c','#e8ba76'],dragon_fire:['flame','#ff8650','#ffe278'],
 dragon_water:['drop','#5ce5e1','#87b9ff'],dragon_air:['feather','#a4edff','#fff0b8'],
 dragon_chemtech:['flask','#b0f16a','#71e5b7'],dragon_hextech:['hexagon','#61dfff','#c69aff'],
 dragon_elder:['moon','#d5c7ff','#fff0b5'],
 kill:['blade','#aacbd2','#d7bc93'],assist:['knot','#9fcab4','#d4c695'],first_blood:['cherry','#d2a0af','#e0c18e'],
 low_hp_kill:['clutch','#d1a3b2','#cfbc97'],low_hp_multikill:['clutch-three','#c9a8c3','#d8c493'],
 double_kill:['twins','#a4ccd1','#d1b28e'],triple_kill:['trident','#b6afd2','#dbc492'],quadra_kill:['compass','#abc8bf','#c7add3'],pentakill:['music','#c2a7d4','#dfc393'],ace:['banner','#b6cbb2','#d2bc92'],
 dragon:['wing','#b4cba6','#d8c298'],baron:['horn','#b6a0d2','#a6bdce'],herald:['eye','#b7a4d1','#dbc39b'],void_grub:['grub','#b9a7ce','#aec1cd'],objective_steal:['mask','#99c8d0','#d9bf93'],atakhan_legacy:['thorn','#c3a0b4','#b5a7c4'],
 low_health:['pulse','#d3a4b2','#b5bdcb'],heavy_health_loss:['bandage','#c6a1ad','#dcc79f'],large_heal:['bloom','#a7cdb3','#d2b6c8'],
 resource_spent:['spark','#9bbfce','#b5b8d1'],level_up:['steps','#b8cba4','#d9c091'],ultimate_learned:['key','#b7a9cd','#d8c28f'],ability_rank_up:['notches','#a7c8ca','#c5c7ac'],
 inventory_added:['bag-in','#cabb99','#aac6bd'],inventory_removed:['bag-out','#b6bbca','#c9bbab'],cs_milestone:['wheat','#d9c595','#acc3a0'],vision_activity:['ward','#a5c7bd','#d3c598'],manpower_advantage:['friends','#a9cbd0','#d4c495'],
 game_start:['gate','#b2c5b0','#d6c19b'],minions_spawning:['march','#a5c7d2','#c6aed2'],victory:['cup','#dbc28e','#b0cab6'],defeat:['sprout','#aabaca','#b4c7ac'],game_end:['book','#b1c9c2','#d2c69e'],
 possible_purchase:['bag-in','#c6bca2','#afbfc6'],possible_item_upgrade:['gem','#baadd2','#d4c39c'],possible_consumable_use:['bottle','#b1c9a8','#c8bea4'],possible_base_visit:['home','#b5c8c5','#c9c59e'],
 possible_combat:['blade','#b6bec9','#d3b5b5'],possible_low_hp_escape:['door','#b7c8b4','#d0b1b3'],possible_teamfight:['friends','#c8adbf','#a6bcca'],possible_objective_fight:['horn','#b2a2c9','#d3c29c'],
 possible_power_spike:['spark','#b5aad1','#d6c293'],possible_roam:['plane','#a5c9d2','#d3cbae'],possible_jungle_activity:['firefly','#b5c8a8','#decd9c'],
});
export function storyParticleProgress(p,j,born=.1,spread=.053,life=.55){
 const raw=(p-born-j*spread)/life;return {phase:Math.max(0,Math.min(1,raw)),visible:raw>0&&raw<1};
}
function storyMotif(I,key,index,phase){
 const {line,poly,oval,ring,curve,star,heart,box}=I,[kind,col,ink]=STORY_MOTIFS[key]||['rune','#b9afd0','#d6c9a5'];
 switch(kind){
 case 'mountain':poly([[-21,14],[-9,-15],[0,-5],[10,-21],[23,14]],col);line([[-9,-15],[-3,-5],[0,-5],[10,-21],[14,-9]],ink,2);break;
 case 'flame':poly([[-12,16],[-17,3],[-8,-7],[-1,-26],[7,-12],[15,-2],[12,16]],col,null);poly([[-5,15],[0,-7],[7,15]],ink,null);break;
 case 'drop':curve(u=>{const a=u*TAU;return[Math.sin(a)*(10+7*(1-Math.cos(a))/2),-21+19*(1-Math.cos(a))];},col,3);curve(u=>[-6-u*3,5+u*7],ink,2);break;
 case 'feather':curve(u=>[-18+u*36,10-Math.sin(u*Math.PI)*25],col,3);for(let j=0;j<5;j++)line([[-11+j*6,1-j],[-16+j*6,-6-j*2]],ink,2);break;
 case 'flask':poly([[-6,-20],[6,-20],[6,-5],[16,15],[-16,15],[-6,-5]],col+'70',col,2);line([[-11,6],[11,6]],ink,3);ring(1,0,3,3,ink,1.4);break;
 case 'hexagon':poly(Array.from({length:6},(_,j)=>[Math.cos(j*TAU/6)*19,Math.sin(j*TAU/6)*19]),col+'30',col,2);poly([[3,-13],[-8,2],[0,2],[-3,13],[10,-3],[3,-3]],ink,null);break;
 case 'moon':curve(u=>{const a=-Math.PI*.7+u*Math.PI*1.4;return[Math.cos(a)*19,Math.sin(a)*21];},col,4);star(-7,-2,7,ink);break;
 case 'blade':line([[0,15],[0,-10]],ink,2.6);poly([[0,-20],[-5,-8],[0,-5],[5,-8]],col);line([[-8,5],[8,5]],col,2);break;
 case 'knot':for(const s of [-1,1])curve(u=>[s*(12-u*10),Math.sin(u*Math.PI)*9-4],s<0?col:ink,2);break;
 case 'cherry':line([[-7,3],[0,-14],[8,3]],col,1.5);oval(-7,6,6,6,col);oval(8,6,6,6,col);break;
 case 'clutch':case 'clutch-three':heart(0,1,.42,col);line([[-15,14],[-3,14],[0,8],[5,19],[8,14],[16,14]],ink,1.4);if(kind==='clutch-three')for(let j=0;j<3;j++)star(-11+j*11,-13,3,ink);break;
 case 'twins':for(const s of [-1,1])poly([[s*3,-14],[s*14,-14],[s*14,7],[s*8,14],[s*3,7]],s<0?col:ink);break;
 case 'trident':for(let j=0;j<3;j++)line([[(j-1)*9,13],[(j-1)*9,-14]],j===1?ink:col,2);poly([[-6,-15],[0,-23],[6,-15]],ink);break;
 case 'compass':for(let j=0;j<4;j++){const a=j*Math.PI/2;poly([[Math.cos(a)*6,Math.sin(a)*6],[Math.cos(a)*19,Math.sin(a)*19],[Math.cos(a+.5)*10,Math.sin(a+.5)*10]],j%2?col:ink);}break;
 case 'music':line([[0,12],[0,-12],[12,-8]],ink,2.5);oval(-5,12,7,4,col);break;
 case 'banner':poly([[-11,-14],[11,-14],[11,6],[0,15],[-11,6]],col);star(0,-3,6,ink);break;
 case 'wing':for(const s of [-1,1])poly([[s*2,9],[s*19,-14],[s*17,5],[s*7,15]],col);break;
 case 'horn':for(const s of [-1,1])curve(u=>[s*(5+Math.sin(u*Math.PI)*12),14-u*34],col,3);oval(0,2,5,7,ink);break;
 case 'eye':poly([[-19,0],[0,-12],[19,0],[0,12]],col);oval(0,0,6,9,ink);oval(0,0,2,5,'#4e6072');break;
 case 'grub':oval(0,4,15,10,col);for(const s of [-1,1])poly([[s*5,-1],[s*13,-14],[s*11,3]],ink);oval(-4,2,1.5,2,'#53637c');oval(4,2,1.5,2,'#53637c');break;
 case 'mask':poly([[-17,-6],[17,-6],[12,9],[-12,9]],col);for(const s of [-1,1])line([[s*3,0],[s*10,0]],ink,3);break;
 case 'thorn':for(let j=0;j<5;j++){const a=j*TAU/5;poly([[0,0],[Math.cos(a)*20,Math.sin(a)*20],[Math.cos(a+.4)*8,Math.sin(a+.4)*8]],col);}break;
 case 'pulse':line([[-20,3],[-8,3],[-3,-10],[2,14],[7,0],[20,0]],col,2);break;
 case 'bandage':box(-19,-6,38,12,col,4);box(-6,-6,12,12,ink,1);for(const s of [-1,1])oval(s*12,0,1,1,'#6c7481');break;
 case 'bloom':for(let j=0;j<5;j++){const a=j*TAU/5;oval(Math.cos(a)*9,Math.sin(a)*9,5,5,col);}oval(0,0,4,4,ink);break;
 case 'spark':poly([[3,-20],[-11,2],[-1,2],[-5,19],[13,-6],[3,-6]],col);break;
 case 'steps':for(let j=0;j<3;j++)line([[-17+j*12,12-j*8],[-17+j*12,4-j*8],[-5+j*12,4-j*8]],j%2?ink:col,2.5);break;
 case 'key':ring(-7,-4,7,7,col,2.5);line([[0,-4],[18,-4],[18,4]],ink,3);line([[11,-4],[11,2]],ink,2);break;
 case 'notches':for(let j=0;j<3;j++)box(-14+j*11,-6,8,13,j<=index%3?col:ink,2);break;
 case 'bag-in':case 'bag-out':box(-13,-7,26,23,col,3);curve(u=>[-7+u*14,-7-Math.sin(u*Math.PI)*8],ink,2);line([[kind==='bag-in'?-25:25,0],[kind==='bag-in'?-16:16,0]],ink,2);break;
 case 'wheat':line([[0,18],[0,-16]],col,2);for(let j=0;j<3;j++)for(const s of [-1,1])poly([[0,6-j*8],[s*10,1-j*8],[s*7,-5-j*8]],ink);break;
 case 'ward':line([[0,8],[0,21]],ink,3);poly([[-17,0],[0,-11],[17,0],[0,11]],col);oval(0,0,5,7,ink);break;
 case 'friends':case 'march':for(const s of [-1,1]){oval(s*10,0,6,9,s<0?col:ink);line([[s*10,8],[s*10+Math.sin(phase*Math.PI)*3,16]],col,2);}break;
 case 'gate':for(const s of [-1,1]){line([[s*15,16],[s*15,-17]],ink,3);poly([[s*15,-17],[s*3,-12],[s*3,11],[s*15,16]],col);}break;
 case 'cup':poly([[-14,-14],[14,-14],[10,3],[0,9],[-10,3]],col);line([[0,9],[0,18],[-10,18],[10,18]],ink,2.5);break;
 case 'sprout':line([[0,17],[0,-6]],ink,2);for(const s of [-1,1])poly([[0,0],[s*15,-13],[s*12,-1]],col);break;
 case 'book':poly([[-17,-9],[0,-4],[17,-9],[17,13],[0,17],[-17,13]],col);line([[0,-4],[0,17]],ink,1.5);break;
 case 'gem':poly([[0,-18],[-13,0],[0,18],[13,0]],col);line([[-13,0],[13,0],[0,-18],[0,18]],ink,1);break;
 case 'bottle':poly([[-5,-15],[5,-15],[5,-5],[13,15],[-13,15],[-5,-5]],col);line([[-5,-15],[5,-15]],ink,4);break;
 case 'home':poly([[-17,0],[0,-17],[17,0]],ink);box(-12,0,24,18,col,2);box(-4,7,8,11,ink,1);break;
 case 'door':line([[-13,18],[-13,-18],[13,-18],[13,18]],col,2);heart(0,2,.3,ink);break;
 case 'plane':poly([[-21,-8],[22,0],[-17,12],[-8,0]],col);line([[-8,0],[22,0]],ink,1);break;
 case 'firefly':for(const s of [-1,1])oval(s*7,-4,7,4,col);oval(0,3,4,7,ink);break;
 default:poly([[0,-19],[-13,0],[0,19],[13,0]],col+'66');line([[0,-15],[0,15],[-10,0],[10,0]],ink,1.5);
 }
}
