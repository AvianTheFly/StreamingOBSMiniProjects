async function main(){
// Draft-only fixtures: never contact the running desk or change user markers.
const assert=require('node:assert/strict');
const Editor=require('./web/clip_editor.js');
global.FootageClipDrag=require('./web/clip_drag.js');
assert.deepEqual(Editor.fit(2,10,18),{start:0,end:10});
assert.deepEqual(Editor.fit(17,10,18),{start:8,end:18});
assert.deepEqual(Editor.fit(8,120,18),{start:0,end:18});
assert.equal(Editor.fit(1,10,0),null);
assert.equal(Editor.valid({start:2,end:2},18),false);
assert.equal(Editor.valid({start:-1,end:4},18),false);
assert.equal(Editor.valid({start:2,end:19},18),false);
assert.deepEqual(Editor.moveEdge({start:2,end:6},'start',10,18),{start:5.9,end:6});
assert.deepEqual(Editor.moveEdge({start:2,end:6},'end',0,18),{start:2,end:2.1});
assert.deepEqual(Editor.windowFor({start:350,end:380},1800,0),{start:335,end:395});
assert.equal(Editor.previewFinished({videoId:1,end:6},1,5.9),false);
assert.equal(Editor.previewFinished({videoId:1,end:6},1,6),true);
assert.equal(Editor.previewFinished({videoId:1,end:6},2,2),true);
assert.equal(Editor.previewFinished(null,1,7),false);
const elements=new Map();
function element(id){if(!elements.has(id))elements.set(id,{value:'',style:{},dataset:{},classList:{toggle(){}},setAttribute(){},addEventListener(){}});return elements.get(id);}
const lengths=[10,30,60,120].map(n=>({...element('preset-'+n),dataset:{clipLength:String(n)}}));
global.document={getElementById:element,querySelectorAll:()=>lengths,querySelector:()=>element('player-box')};
global.localStorage={getItem:()=>null,setItem(){}};
let snapshot={video:{id:1,duration:18,availability:'online'},range:{start:2,end:6},position:12,editing:{id:11,decision:'keep',notes:'My note',tags:'clutch'}},calls=[],holdExtract=false,releaseExtract;
const editor=Editor.mount({snapshot:()=>snapshot,time:String,duration:n=>n+' seconds',action:fn=>fn(),preview:()=>calls.push('preview'),extract:()=>{calls.push('extract');if(holdExtract)return new Promise(resolve=>{releaseExtract=resolve;});},remove:()=>calls.push('remove'),undo:()=>calls.push('undo'),custom:value=>calls.push(['custom',value]),scrub:value=>calls.push(['frame',value]),setRange:(r,reframe,newDraft)=>{snapshot.range=r;calls.push({r,reframe,newDraft});editor.sync(reframe);}});
editor.sync();assert.equal(element('quick-keep').textContent,'Save changes');
assert.deepEqual(snapshot.range,{start:2,end:6}); // Mode changes do not resize a saved cut.
element('clip-start').value='3';element('clip-start').oninput();assert.equal(snapshot.range.start,3);assert.deepEqual(calls.at(-1),['frame',3]);assert.deepEqual(editor.notes(),{tags:'clutch',notes:'My note'});
element('clip-preview').onclick();assert.equal(calls.at(-1),'preview');await element('clip-extract').onclick();assert.equal(calls.at(-1),'extract');await element('clip-skip').onclick();assert.equal(calls.at(-1),'remove');element('mode-recording').onclick();assert.equal(element('clip-editor').hidden,false);element('mode-highlight').onclick();assert.equal(element('clip-editor').hidden,false);
element('clip-new').onclick();assert.deepEqual(calls.at(-1),['custom',12]);
snapshot.undo=true;editor.sync();assert.equal(element('clip-undo').hidden,false);await element('clip-undo').onclick();assert.equal(calls.at(-1),'undo');
snapshot.range={start:0,end:0};element('mode-highlight').onclick();assert.equal(calls.at(-1).newDraft,true);
snapshot.editing=null;editor.sync();assert.equal(element('quick-keep').textContent,'Keep');
snapshot.range={start:5,end:4};editor.sync();assert.equal(element('clip-preview').disabled,true);assert.equal(element('quick-keep').disabled,true);
holdExtract=true;const before=calls.length,pending=element('clip-extract').onclick();await element('clip-extract').onclick();assert.equal(calls.length,before+1);releaseExtract();await pending;holdExtract=false;
snapshot.video.availability='missing';editor.sync();assert.equal(element('clip-extract').disabled,true);
editor.position(10);assert.equal(element('clip-playhead').hidden,false);editor.position(30);assert.equal(element('clip-playhead').hidden,true);
snapshot.video={id:2,duration:28800,availability:'online'};snapshot.range={start:14390,end:14410};snapshot.position=14400;snapshot.editing=null;editor.sync(true);const savedBounds={...snapshot.range};editor.navigate(20000);assert.deepEqual(snapshot.range,savedBounds);assert.deepEqual(editor.viewport(),{start:19970,end:20030});element('clip-zoom-in').onclick();assert.equal(editor.viewport().end-editor.viewport().start,30);element('clip-fit').onclick();assert.deepEqual(editor.viewport(),{start:14370,end:14430});
editor.restoreNotes({tags:'restored',notes:'Original note'});assert.deepEqual(editor.notes(),{tags:'restored',notes:'Original note'});
console.log('Clip sizing, edge bounds, saved-clip updates, preview boundaries and presentation callbacks passed.');

}
main().catch(error=>{console.error(error);process.exitCode=1;});
