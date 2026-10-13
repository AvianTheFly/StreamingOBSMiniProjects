// Read-only offline delivery of the production draft page and its real assets.
const path=require('node:path');
const root=path.resolve(__dirname,'..'),feature=path.join(root,'mini projects/league_api');
async function draftFixture(page,state) {
  await page.route(url=>url.hostname!=='draft.test',route=>route.abort());
  await page.route('http://draft.test/**',route=>{
    const url=new URL(route.request().url()),name=path.basename(url.pathname);
    if(route.request().method()!=='GET')throw Error('Draft preview must be read-only');
    if(url.pathname==='/champ-select/state')return route.fulfill({json:state});
    const file=url.pathname.startsWith('/shared/')?path.join(root,'lib/browser_effects/web',name):
      url.pathname.includes('/backgrounds/')?path.join(feature,'media/champ-select',name):
      url.pathname.includes('/vfx/')?path.join(feature,'media/champ-select/vfx',name):
      url.pathname.includes('/guests/')?path.join(feature,'media/draft-guests',name):
      url.pathname.includes('/icons/')?path.join(feature,'media/champions',name):
      url.pathname.includes('/portraits/')?path.join(feature,'media/champion-portraits',name):
      path.join(feature,'champ_select_web',url.pathname==='/champ-select'?'index.html':url.pathname.replace('/champ-select/',''));
    return route.fulfill({path:file,contentType:file.endsWith('.ttf')?'font/ttf':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':'text/html'});
  });
}
module.exports={draftFixture,root,feature};
