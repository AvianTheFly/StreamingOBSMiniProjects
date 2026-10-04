// Authored presentation defaults and URL controls. No Hub settings are written.
export const W = 1920, H = 1080;
const clamp = (n,lo,hi) => Math.max(lo,Math.min(hi,n));
const numeric = (value,fallback,lo,hi) => value !== null && value !== '' && Number.isFinite(Number(value)) ? clamp(Number(value),lo,hi) : fallback;
export function readConfig(query = location.search) {
  const p = new URLSearchParams(query), mode = ['outro','break','lobby'].includes(p.get('mode')) ? p.get('mode') : 'outro';
  return {
    mode,
    layer: ['background','foreground'].includes(p.get('layer')) ? p.get('layer') : 'full',
    cameraGuide: p.get('cameraGuide') === '1',
    party: ['off','gentle','lively','wild'].includes(p.get('party')) ? p.get('party') : 'lively',
    title: (p.get('title') || ({outro:'GOOD NIGHT',break:'BE RIGHT BACK',lobby:'THE AFTERPARTY'})[mode]).replace(/[\x00-\x1f]/g,'').slice(0,52),
    subtitle: (p.get('subtitle') || ({outro:'THANKS FOR HANGING OUT',break:'KEEPING YOUR SEAT WARM',lobby:'MAKE YOURSELF AT HOME'})[mode]).replace(/[\x00-\x1f]/g,'').slice(0,76),
    leftTitle:(p.get('leftTitle')||'THE').slice(0,28),leftSubtitle:(p.get('leftSubtitle')||'AFTERPARTY').slice(0,28),
    rightTitle:(p.get('rightTitle')||'STAY').slice(0,28),rightSubtitle:(p.get('rightSubtitle')||'WEIRD').slice(0,28),
    penguinOpacity:numeric(p.get('penguinOpacity'),.68,.35,1),
    screenMain:p.get('background')||'auto',leftScreen:p.get('leftScreen')||'auto',rightScreen:p.get('rightScreen')||'auto',boothScreen:p.get('boothScreen')||'auto',
    explicit:Array.from(p.keys()),
    energy: numeric(p.get('energy'),.68,0,1),
    speed: numeric(p.get('speed'),1,.35,1.7),
    palette: ['electric','aurora','sunset'].includes(p.get('palette')) ? p.get('palette') : 'electric',
    quality: ['low','standard','high'].includes(p.get('quality')) ? p.get('quality') : 'standard',
    background: ['cosmos','liquid','spirit'].includes(p.get('background')) ? p.get('background') : 'cosmos',
    paused: p.get('paused') === '1',
    at: numeric(p.get('at'),0,0,100000),
  };
}
export const palettes = {
  electric: ['#63fff0','#ed69ff','#a88aff','#ffc86a'],
  aurora: ['#6dffce','#80aaff','#d398ff','#e4f5a9'],
  sunset: ['#ff8b65','#ff76c9','#af80ff','#ffe096'],
};
