const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const folder = path.join(root, 'output', 'champ-select-previews');
  fs.mkdirSync(folder, {recursive:true});
  const browser = await chromium.launch({headless:true, channel:'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1920,height:1080}, deviceScaleFactor:1});
    for (const theme of ['astral','tidal','neon','frost','verdant']) {
      await page.goto(`http://127.0.0.1:7431/champ-select?demo=1&theme=${theme}`);
      await page.locator('.pick').first().waitFor();
      await page.waitForTimeout(750);
      assert.equal(await page.locator('.picks-left .pick').count(), 5);
      assert.equal(await page.locator('.picks-right .pick').count(), 5);
      assert.equal(await page.locator('.bans-left .ban').count(), 5);
      assert.equal(await page.locator('.bans-right .ban').count(), 5);
      const failed = await page.locator('.pick img, .ban img').evaluateAll(images => images.filter(img => !img.complete || !img.naturalWidth).map(img => img.src));
      assert.deepEqual(failed, []);
      const file = path.join(folder, `${theme}.png`);
      await page.screenshot({path:file});
      console.log(file);
    }
    const blank = () => ({championId:0,locked:false});
    const draft = {allies:Array.from({length:5},blank), enemies:Array.from({length:5},blank),
      allyBans:Array.from({length:5},blank), enemyBans:Array.from({length:5},blank),localSlot:0,seconds:25};
    const state = {visible:false,theme:'verdant',draft,chat:[]};
    await page.route('**/champ-select/state', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(state)}));
    await page.goto('http://127.0.0.1:7431/champ-select');
    await page.waitForTimeout(550);
    assert.equal(await page.locator('#stage.hidden').count(),1);
    draft.allies[0] = {championId:103,name:'Ahri',locked:false,image:'/champ-select/icons/103.png',portrait:'/champ-select/portraits/103.jpg'};
    draft.enemyBans[0] = {championId:238,name:'Zed',locked:true,image:'/champ-select/icons/238.png'};
    state.visible = true;
    await page.locator('.picks-left .pick.tentative').first().waitFor();
    await page.locator('.bans-right .ban.filled').first().waitFor();
    assert.equal(await page.locator('.picks-left img[src="/champ-select/portraits/103.jpg"]').count(),1);
    draft.allies[0].locked = true;
    await page.locator('.picks-left .pick.locked').first().waitFor();
    const animation = await page.locator('.picks-left .pick').first().evaluate(el => getComputedStyle(el).animationName);
    assert.equal(animation,'pick-enter');
    console.log('Live state simulation: privacy, tentative pick, ban and lock reveal OK');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1});
