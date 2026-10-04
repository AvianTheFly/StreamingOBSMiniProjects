// Personal group 2: existing audio, selection and cleanup own the performance.
const spamSprites=new ScenicLayers({lizard:ATLAS_DATA.spamLizard,gary:ATLAS_DATA.spamGary,
 quack:ATLAS_DATA.spamQuack,bonk:ATLAS_DATA.spamBonk,piuw:ATLAS_DATA.spamPiuw});
const SPAM_PERFORMANCES={lizard:spamLizard,gary:spamGary,quack:spamQuack,bonk:spamBonk,piuw:spamPiuw};
function spamCue(c,t,d,e){
 const key=e.scene||(e.style==='bonk'?'bonk':null),draw=SPAM_PERFORMANCES[key];
 if(!draw)return false;
 draw(c,t,d,e);return true;
}
