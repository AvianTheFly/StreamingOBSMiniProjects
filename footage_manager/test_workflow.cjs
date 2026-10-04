// Disposable presentation fixtures: no requests to the user's running desk.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Workflow = require('./web/workflow.js');

async function main() {
  const clip = {id:11,start:20,end:45,decision:'keep',title:'A good moment',exported:'',export_signature:''};
  const video = {id:1,path:'C:/fixture.mp4',name:'Fixture <script>',size:5000000,mtime_ns:12345,duration:1800,status:'keep_clips',availability:'online',ranges:[clip]};
  const signature = () => JSON.stringify([video.path,video.size,video.mtime_ns,clip.start,clip.end]);
  assert.equal(Workflow.progress(video).ready,false);
  assert.match(Workflow.progress(video).reason,/Extract 1/);
  clip.exported='C:/fixture-clip.mp4';clip.export_signature=signature();
  assert.equal(Workflow.progress(video).ready,true);
  clip.end=46;
  assert.equal(Workflow.exportCurrent(video,clip),false);
  assert.equal(Workflow.progress(video).pending.length,1);
  clip.export_signature=signature();
  video.ranges.push({id:12,start:100,end:130,decision:'maybe'});
  assert.equal(Workflow.progress(video).ready,false);
  assert.match(Workflow.progress(video).reason,/Resolve/);
  video.ranges.pop();video.status='keep_full';
  assert.equal(Workflow.progress(video).ready,false);
  video.status='keep_clips';video.availability='missing';
  assert.equal(Workflow.progress(video).ready,false);
  video.availability='online';
  const empty={...video,ranges:[]};
  assert.equal(Workflow.progress(empty).ready,false);
  empty.status='delete';assert.equal(Workflow.progress(empty).ready,true);
  clip.export_signature='broken';assert.equal(Workflow.exportCurrent(video,clip),false);
  clip.export_signature=signature();

  const elements=new Map();
  function element(id) {
    if(!elements.has(id)) elements.set(id,{id,hidden:false,disabled:false,innerHTML:'',textContent:'',parentElement:null,
      setAttribute(){},append(child){child.parentElement=this;},classList:{toggle(){}}});
    return elements.get(id);
  }
  const context=vm.createContext({module:{exports:{}},document:{getElementById:element,querySelectorAll:()=>[]}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'web/workflow.js'),'utf8'),context);
  let snapshot={catalogue:{videos:[video]},selected:video,view:'moments',extracting:false}, calls=[];
  element('analysis-panel').hidden=true;
  let finishKeep;
  const controls={snapshot:()=>snapshot,action:fn=>fn(),time:String,size:String,label:String,filters:()=>[],matches:()=>true,
    extract:async ids=>calls.push(['extract',[...ids]]),review:async(...args)=>calls.push(['review',...args]),
    watch:async(...args)=>calls.push(['watch',...args]),trash:async id=>calls.push(['trash',id]),
    navigate:view=>calls.push(['navigate',view]),findGames:()=>calls.push(['games']),
    quickKeep:()=>new Promise(resolve=>{finishKeep=resolve;}),decide:async()=>{},reveal:async()=>{},restore:async()=>{},purge:async()=>{}};
  const desk=context.module.exports.mount(controls);desk.render();
  assert.equal(element('workflow-panel').hidden,false);
  assert.equal(element('workspace').hidden,true);
  assert.equal(element('export-options').parentElement,null); // Optional settings stay in their own dialog.
  assert.match(element('workflow-grid').innerHTML,/EXTRACTED/);
  assert.doesNotMatch(element('workflow-grid').innerHTML,/<script>/);
  assert.equal(element('workflow-batch').disabled,true);
  clip.end=50;desk.render();
  assert.match(element('workflow-grid').innerHTML,/CUT CHANGED/);
  assert.equal(element('workflow-batch').disabled,false);
  await element('workflow-batch').onclick();assert.deepEqual(calls.pop(),['extract',[11]]);
  snapshot.extracting=true;desk.render();assert.equal(element('workflow-batch').disabled,true);
  assert.equal(element('flow-extract').disabled,true);
  snapshot.extracting=false;snapshot.view='deletion';desk.render();
  assert.match(element('workflow-grid').innerHTML,/ONE MORE STEP/);
  assert.match(element('workflow-grid').innerHTML,/data-trash="1" disabled/);
  clip.export_signature=signature();desk.render();
  assert.match(element('workflow-grid').innerHTML,/READY FOR FINAL CHECK/);
  const click=dataset=>({target:{closest:()=>({dataset,disabled:false,hasAttribute:()=>false})}});
  await element('workflow-grid').onclick(click({trash:'1'}));
  assert.deepEqual(calls.pop(),['trash',1]); // Owner validates and confirms; presentation never deletes.
  await element('workflow-grid').onclick(click({review:'1',range:'11'}));
  assert.deepEqual(calls.pop(),['review',1,11]);
  snapshot.view='library';desk.render();
  assert.equal(element('workspace').hidden,false);
  assert.equal(element('workflow-panel').hidden,true);
  assert.equal(element('export-options').parentElement,null);
  const saving=element('quick-keep').onclick();await element('quick-keep').onclick();
  finishKeep();await saving; // A repeated click cannot start a second save while pending.
  snapshot.selected=null;desk.render();assert.equal(element('workspace').hidden,true);
  console.log('Workflow readiness, changed exports, filtering, navigation, owner actions and pending-state checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
