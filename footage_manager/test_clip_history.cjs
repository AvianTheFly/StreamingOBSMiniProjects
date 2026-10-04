'use strict';
const assert=require('node:assert/strict');
const History=require('./web/clip_history.js');
async function main(){
  let saved={id:11,video_id:1,start:2,end:10,title:'Reaction',decision:'keep',tags:'funny',notes:'A personal note',usage:'unused',purpose:'',collection:'',exported:'retained.mp4'},writes=0;
  const history=History.create({read:async()=>saved,write:async range=>{writes++;saved={...saved,...range};}});
  const before={...saved};saved={...saved,start:1,end:12};history.remember(before,saved);
  assert.equal(history.available(2),false);assert.equal(await history.undo(2),null);
  await history.undo(1);assert.equal(saved.start,2);assert.equal(saved.end,10);assert.equal(saved.notes,'A personal note');assert.equal(saved.exported,'retained.mp4');assert.equal(history.available(1),false);
  history.remember(null,saved);await history.undo(1);assert.equal(saved.decision,'reject');assert.equal(saved.exported,'retained.mp4');
  const kept={...saved,decision:'keep'};history.remember(kept,saved);await history.undo(1);assert.equal(saved.decision,'keep');
  history.remember(null,saved);saved={...saved,notes:'A newer edit'};const count=writes;
  await assert.rejects(history.undo(1),/changed since/);assert.equal(writes,count);assert.equal(saved.notes,'A newer edit');assert.equal(history.available(1),false);
  history.remember(null,saved);const first=history.undo(1);assert.equal(await history.undo(1),null);await first;
  console.log('Undo keep/removal/boundary edits, retained metadata, duplicate clicks and stale-edit protection passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
