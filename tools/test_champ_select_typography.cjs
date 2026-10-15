// Read-only review of native draft lettering at broadcast and preview sizes.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {draftFixture,root}=require('./champ_select_fixture.cjs');
const output=path.join(root,'output/champ-select-type');
const names=['Aatrox','Lee Sin','Nunu & Willump','Renata Glasc',"Bel’Veth"];
const aliases=['Gromp','Krugs','Murk Wolf','Raptors','Scuttle Crab'];
const roles=['TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY'];
const slot=(name,i)=>({championId:[266,64,103,22,412][i],name,role:roles[i],
  label:i===4?'A very long player alias':aliases[i],locked:true,
  portrait:`/champ-select/portraits/${[266,64,103,22,412][i]}.jpg`});
const state={visible:true,theme:'bear',generation:1,draft:{seconds:21,localSlot:1,
  allies:names.map(slot),enemies:names.map(slot),allyBans:[],enemyBans:[]},
  chat:[{id:'1',sender:'Gromp',body:'I can cover bot after the first clear.'}]};
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await draftFixture(page,state);await page.goto('http://draft.test/champ-select');
    await page.waitForFunction(()=>document.querySelectorAll('.pick.filled').length===10);
    await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>document.querySelector('#stage').classList.add('demo'));
    const results=[];
    for(const theme of ['bear','turtle','ram','phoenix']){
      state.theme=theme;await page.waitForFunction(t=>document.querySelector('#stage').dataset.theme===t,theme);
      assert.equal(await page.locator('.live-badge').count(),0,'draft themes have no LIVE badge');
      for(const [width,height] of [[1920,1080],[1280,720],[880,495]]){
        await page.setViewportSize({width,height});
        const cards=await page.locator('.pick').evaluateAll(items=>items.map(item=>{
          const bounds=e=>{const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right};};
          const textBounds=e=>{const r=document.createRange();r.selectNodeContents(e);const b=r.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right};};
          const plate=item.querySelector('.pick-caption'),name=item.querySelector('.name'),alias=item.querySelector('.player-label'),role=item.querySelector('.role-label');
          return {plate:bounds(plate),name:textBounds(name),alias:bounds(alias),role:bounds(role),roleInk:textBounds(role),
            nameText:name.textContent,fontSize:parseFloat(getComputedStyle(alias).fontSize)};
        }));
        for(const card of cards){
          assert.ok(card.roleInk.left>=card.role.left-.5&&card.roleInk.right<=card.role.right+.5,'full roles must fit');
          assert.ok(card.name.left>=card.plate.left-.5&&card.name.right<=card.plate.right+.5,`champion width ${JSON.stringify(card)}`);
          assert.ok(card.name.top>=card.plate.top-.5&&card.alias.bottom<=card.plate.bottom+.5,`caption height ${JSON.stringify(card)}`);
          assert.ok(card.name.bottom<=card.alias.top+.5,`champion and player must not overlap ${JSON.stringify(card)}`);
          assert.ok(card.alias.bottom-card.alias.top>=card.fontSize,'long champion names must retain a visible player alias');
          if(width===1920)assert.ok(card.fontSize>=17,'player aliases must be legible at broadcast size');
        }
        assert.deepEqual(cards.slice(0,5).map(c=>c.nameText),names,'champion names remain native literal text');
        assert.equal(await page.locator('#allies .player-label').first().textContent(),'Gromp');
        if(width===1920||width===880)await page.screenshot({path:path.join(output,`${theme}-${width}.png`)});
        results.push({theme,width,labelsFit:true});
      }
    }
    state.draft.allies[0].label='Spirit Walker';
    await page.waitForFunction(()=>document.querySelector('#allies .player-label').textContent==='Spirit Walker');
    state.draft.allies[0].label='';
    await page.waitForFunction(()=>document.querySelector('#allies .player-label').textContent==='Teammate 1');
    state.draft.allies[0]=slot('<img src=x onerror=alert(1)>',0);
    await page.waitForFunction(()=>document.querySelector('#allies .name').textContent.startsWith('<img'));
    assert.equal(await page.locator('.name img').count(),0,'names cannot become markup');
    await page.goto('http://draft.test/champ-select?demo=1&theme=ram');
    await page.waitForFunction(()=>document.querySelectorAll('#allies .player-label').length===5);
    assert.deepEqual(await page.locator('#allies .player-label').allTextContents(),aliases,'demo represents exposed ranked aliases');
    await page.getByRole('button',{name:'Lock pick',exact:true}).click();
    assert.deepEqual(await page.locator('#allies .player-label').allTextContents(),aliases,'pick changes preserve aliases');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({passed:true,results,nativeText:true,errors},null,2));
    console.log('Draft typography: all four themes, three sizes, long champion names, roles, aliases and literal text passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
