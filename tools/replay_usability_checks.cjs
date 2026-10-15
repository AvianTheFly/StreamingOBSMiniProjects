// Mouse-based checks for the private clip editor, using the studio's disposable media.
const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function auditReplayEditor(page, output) {
  const beforeWrites = [];
  await page.route('**/api/projects/instant_replay/trim', route => {
    beforeWrites.push(route.request().postDataJSON());
    return route.fulfill({json:{job:'usability-cut'}});
  });
  await page.route('**/api/projects/instant_replay/trim?job=usability-cut', route =>
    route.fulfill({json:{status:'ready',title:'A shorter escape',duration:1,path:'C:/fixture/cut.mp4'}}));

  const targets = ['#irCloseEditor','#irReviewNext','#irTrashClip','#irTrimStart',
    '#irTrimEnd','#irTrimStartNumber','#irTrimEndNumber','#irTrimPreview','#irTrimSave'];
  for (const selector of targets) {
    const bounds = await page.locator(selector).boundingBox();
    assert(bounds.width>=44 && bounds.height>=44,`${selector} has a generous mouse target`);
  }
  const save = await page.locator('#irTrimSave').boundingBox();
  assert(save.y>=0 && save.y+save.height<=704,'Save is visible without scrolling at 1280 × 720');

  // Grab the visible thumb off-centre, then move across the actual slider.
  // The inset comes from the authored 36px thumb, not a synthetic input event.
  async function dragThumb(selector, fraction, destination) {
    const box = await page.locator(selector).boundingBox();
    const travel = box.width-36;
    await page.mouse.move(box.x+18+travel*fraction+8,box.y+box.height/2+7);
    await page.mouse.down();
    await page.mouse.move(box.x+18+travel*destination,box.y+box.height/2+7,{steps:16});
    await page.mouse.up();
  }
  await dragThumb('#irTrimStart',0,.25);
  const start = Number(await page.locator('#irTrimStartNumber').inputValue());
  assert(start>=.3 && start<=.6,'Dragging a broad start handle changes the cut');
  await dragThumb('#irTrimEnd',1,.75);
  const end = Number(await page.locator('#irTrimEndNumber').inputValue());
  assert(end>=1.3 && end<=1.6,'Dragging the end handle changes the cut independently');
  await page.locator('#irTrimStartNumber').fill('0.4');
  await page.locator('#irTrimEndNumber').fill('1.4');
  await page.locator('#irTrimEnd').press('ArrowLeft');
  assert.equal(await page.locator('#irTrimEndNumber').inputValue(),'1.3','Keyboard supports fine adjustment');
  await page.locator('#irTrimEndNumber').fill('1.4');
  await page.evaluate(()=>{
    window.trimEvents=[];
    const v=document.querySelector('#irPreview video');
    for(const name of ['play','pause','seeked','seeking','timeupdate','error'])v.addEventListener(name,()=>window.trimEvents.push({name,time:v.currentTime,paused:v.paused}));
  });
  await page.locator('#irTrimPreview').click();
  try { await page.waitForFunction(()=>!document.querySelector('#irPreview video').paused,null,{timeout:5000}); }
  catch(e) { console.error(await page.evaluate(()=>({events:window.trimEvents,status:document.querySelector('#irTrimStatus').textContent}))); throw e; }
  await page.waitForFunction(()=>document.querySelector('#irPreview video').paused);
  const stopped = await page.locator('#irPreview video').evaluate(v=>v.currentTime);
  assert(Math.abs(stopped-1.4)<.15,'Preview stops at the selected end');
  await page.screenshot({path:path.join(output,'mouse-audit-editor-desktop.png')});

  await page.setViewportSize({width:390,height:844});
  await page.locator('#irTrimStart').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#irEditorDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'Narrow editor has no horizontal scrolling');
  const close = await page.locator('#irCloseEditor').boundingBox();
  assert(close.y>=0 && close.y+close.height<844,'Done stays reachable while trimming on a narrow screen');
  await page.screenshot({path:path.join(output,'mouse-audit-editor-mobile.png')});
  await page.locator('#irTrimReset').click();
  await dragThumb('#irTrimStart',0,.25);
  assert(Number(await page.locator('#irTrimStartNumber').inputValue())>.2,'Mouse dragging also works in the narrow editor');
  await page.locator('#irTrimStartNumber').fill('1.9');
  await page.locator('#irTrimEndNumber').fill('0.1');
  await page.locator('#irTrimEndNumber').press('Tab');
  assert(Number(await page.locator('#irTrimEndNumber').inputValue())>Number(await page.locator('#irTrimStartNumber').inputValue()),'Trim boundaries cannot cross');
  await page.locator('#irTrimStartNumber').fill('0.4');
  await page.locator('#irTrimEndNumber').fill('1.4');
  await page.locator('#irTrimName').fill('A shorter escape');
  await page.locator('#irTrimSave').click();
  await page.locator('#irTrimOpen').waitFor();
  assert.deepEqual(beforeWrites,[{path:'C:/fixture/marked.mkv',start:.4,end:1.4,title:'A shorter escape'}]);
  assert.match(await page.locator('#irTrimStatus').textContent(),/original is kept/i);
  await page.setViewportSize({width:1280,height:720});
  await page.locator('#irTrimReset').click();
};
