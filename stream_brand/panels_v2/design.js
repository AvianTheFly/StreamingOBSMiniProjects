'use strict';
const panel=PanelCatalog.panels.find(p=>p.id===new URLSearchParams(location.search).get('panel'));
if(!panel)throw Error('Unknown panel');
document.documentElement.style.setProperty('--accent',panel.color);
document.getElementById('art').src='art/'+panel.id+'.png';
for(const field of ['label','title','body','cue'])document.getElementById(field).textContent=panel[field];
document.getElementById('arrow').textContent=panel.link?'↗':'';
