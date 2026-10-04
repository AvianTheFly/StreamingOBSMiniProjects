'use strict';
// Exercise the source/playback owner's real queue against a slow media element.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function main(){
  const source=fs.readFileSync(__dirname+'/web/app.js','utf8');
  const handlers=new Map(),requests=[];
  const player={readyState:1,seeking:false,pause(){},addEventListener:(name,fn)=>handlers.set(name,fn)};
  const context=vm.createContext({selected:{id:1,duration:28800},player,pendingBoundaryFrame:null,position:0,
    cancelClipPreview(){},updateClock(){},queueMicrotask,action:fn=>fn(),
    current:()=>context.position,seek:async(position,preview,boundary)=>{assert.equal(boundary,true);requests.push(position);player.seeking=true;}});
  vm.runInContext(source.slice(source.indexOf('function showBoundaryFrame(position)'),source.indexOf("player.addEventListener('loadedmetadata',()=>queueMicrotask"))+"\n",context);
  context.showBoundaryFrame(14400);context.showBoundaryFrame(14410);context.showBoundaryFrame(14420);
  assert.deepEqual(requests,[14400]);assert.equal(context.pendingBoundaryFrame.position,14420);
  context.position=14400;player.seeking=false;handlers.get('seeked')();assert.deepEqual(requests,[14400,14420]);
  context.position=14420;player.seeking=false;handlers.get('seeked')();assert.equal(context.pendingBoundaryFrame,null);
  player.readyState=0;context.showBoundaryFrame(20000);assert.equal(requests.length,2);
  player.readyState=1;context.flushBoundaryFrame();assert.equal(requests.at(-1),20000);
  context.selected={id:2,duration:100};player.seeking=false;context.flushBoundaryFrame();assert.equal(requests.at(-1),20000); // An old-source request cannot seek the replacement.
  context.position=0;context.showBoundaryFrame(200);assert.equal(context.pendingBoundaryFrame.position,99.999);assert.equal(requests.at(-1),99.999);
  context.position=99.999;player.seeking=false;handlers.get('seeked')();assert.equal(context.pendingBoundaryFrame,null);
  context.showBoundaryFrame(99.999);assert.equal(context.pendingBoundaryFrame,null);assert.equal(requests.length,4); // Same-frame requests do not wait forever.
  const snapshotBinding=source.match(/snapshot:\(\)=>\(\{video:selected,range:draftRange\(\).*undo:clipHistory.available\(selected\?\.id\)\}\)/)[0];
  context.selected=null;context.pendingBoundaryFrame=null;context.draftRange=()=>null;context.current=()=>0;context.draftEditingId=null;context.draftSerial=0;context.extractionActive=()=>false;context.clipHistory={available:()=>false};player.readyState=0;
  const noSource=vm.runInContext('({' + snapshotBinding + '}).snapshot()',context);assert.equal(noSource.position,0);assert.equal(noSource.video,null);handlers.get('seeked')();assert.equal(context.pendingBoundaryFrame,null);
  console.log('Slow-decoder seek coalescing, latest target, metadata wait, source changes and end bounds passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
