import { load } from './modules/api.js';
import { initEventListeners } from './modules/events.js';
import { initPanelResizer } from './modules/resizer.js';
import { initVolume } from './modules/volume.js';

initPanelResizer();
initVolume();
initEventListeners();
load();
