export const API = window.location.origin;

export const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.avi', '.mkv']);
export const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.aiff', '.wma']);
export const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);

export const MAX_UNDO       = 50;
export const MAX_FILE_UNDO  = 20;
export const MAX_GROUP_UNDO = 20;
export const CHIP_LABEL_MAX = 10;
export const CHIP_HOVER_SCROLL_DELAY_MS = 500;

export const KEYBOARD_ROWS = [
  [['`','~'],['1','!'],['2','@'],['3','#'],['4','$'],['5','%'],['6','^'],['7','&'],['8','*'],['9','('],['0',')'],['-','_'],['=','+']],
  [['q','Q'],['w','W'],['e','E'],['r','R'],['t','T'],['y','Y'],['u','U'],['i','I'],['o','O'],['p','P'],['[','{'],[']','}'],['\\','|']],
  [['a','A'],['s','S'],['d','D'],['f','F'],['g','G'],['h','H'],['j','J'],['k','K'],['l','L'],[';',':'],[`'`,'"']],
  [['z','Z'],['x','X'],['c','C'],['v','V'],['b','B'],['n','N'],['m','M'],[',','<'],['.','>'],['/',  '?']],
];

export const KEYBOARD_ORDER = (() => {
  const m = new Map();
  let idx = 0;
  KEYBOARD_ROWS.forEach((row, rowIndex) => {
    row.forEach((pair, colIndex) => {
      pair.forEach((ch, variantIndex) => {
        if (!m.has(ch)) m.set(ch, { row: rowIndex, col: colIndex, variant: variantIndex, idx: idx++ });
      });
    });
  });
  return m;
})();
