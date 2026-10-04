/* Standalone graphic exporter. Never starts the Hub or operates live OBS. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const catalog=require('../stream_brand/catalog.js');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'stream_brand','exports');
const review=path.join(root,'output','channel-brand');

async function main(){
  fs.mkdirSync(path.join(output,'panels'),{recursive:true});
  fs.mkdirSync(review,{recursive:true});
  const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-background-networking']});
  const manifest=[];
  let staging;
  try{
    staging=fs.mkdtempSync(path.join(output,'.brand-build-'));
    fs.mkdirSync(path.join(staging,'panels'));
    const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    async function render(asset,width,height,file,panel){
      await page.setViewportSize({width,height});
      const url=pathToFileURL(path.join(root,'stream_brand','design.html'));
      url.searchParams.set('asset',asset);
      if(panel)url.searchParams.set('panel',panel);
      await page.goto(url.href);
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()))});
      const overflow=await page.locator('h1:visible, h2:visible, .label:visible, .subtitle:visible, footer:visible').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.x<0||r.y<0||r.right>innerWidth||r.bottom>innerHeight||n.scrollWidth>n.clientWidth+1}).map(n=>n.textContent));
      if(overflow.length)throw Error('Clipped graphic text: '+overflow.join(', '));
      const destination=path.join(staging,file);
      await page.screenshot({path:destination});
      manifest.push({file,width,height,bytes:fs.statSync(destination).size});
    }
    for(const asset of Object.keys(catalog.cards))await render(asset,1920,1080,asset+'.png');
    await render('banner',1200,480,'profile-banner.png');
    for(const p of catalog.panels)await render('panel',320,100,'panels/'+p.id+'.png',p.id);
    if(errors.length)throw Error(errors.join('\n'));
    if(manifest.some(m=>m.file.startsWith('panels/')&&m.bytes>=2900000))throw Error('Twitch panel exceeds image size limit');
    // Publish complete PNGs only after the entire family passes validation.
    // Native OBS image sources must never observe a partially written image.
    for(const asset of manifest)fs.renameSync(path.join(staging,asset.file),path.join(output,asset.file));
    fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({artMaster:{width:1672,height:941},assets:manifest},null,2)+'\n');
    const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const gallery=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UdyrIsABotLaner channel presentation</title><style>*{box-sizing:border-box}body{margin:0;background:#070f1a;color:#f1eee4;font:16px "Segoe UI",Arial,sans-serif}main{max-width:1240px;margin:auto;padding:42px 40px}small{color:#76e4cf;letter-spacing:2px;font-size:11px}h1{font:42px Georgia,serif;margin:12px 0}h2{font:27px Georgia,serif;margin:38px 0 15px}p{color:#abbcc9;line-height:1.6;max-width:780px}img{display:block;width:100%;height:auto}.hero{border:1px solid #cfdae626;border-radius:3px;overflow:hidden}a{color:#a0dacd}.pairs{display:grid;grid-template-columns:1fr 1fr;gap:20px}.panels{display:grid;grid-template-columns:repeat(3,320px);gap:22px;justify-content:space-between}.panel img{width:320px;height:100px}.caption{display:block;color:#9eafbd;font-size:12px;padding:9px 0}.fine{font-size:12px}@media(max-width:1100px){.panels{grid-template-columns:repeat(2,320px);justify-content:start}}@media(max-width:720px){main{padding:25px 20px}.pairs,.panels{grid-template-columns:1fr}.panel img{max-width:100%;height:auto}h1{font-size:32px}}</style><main><small>UDYRISABOTLANER / FOUR SPIRITS</small><h1>Welcome to the bot lane.</h1><p>A coherent channel identity around the spirits already in your stream. Original riverbank artwork, clear typography, and room for your particular kind of chaos.</p><div class="hero"><a href="offline.png" download><img src="offline.png" alt="Offline video player graphic"></a></div><p class="fine">Exported graphics are ready to use. Twitch uploads are separate from local creation. Existing panel descriptions, jokes, links and payment handles can remain exactly as they are.</p><h2>Between the games. After the stream.</h2><div class="pairs"><div><a href="intermission.png" download><img src="intermission.png" alt="Be right back graphic"></a><span class="caption">Intermission · native OBS image</span></div><div><a href="ending.png" download><img src="ending.png" alt="Stream ending graphic"></a><span class="caption">Signoff · native OBS image</span></div></div><h2>Channel panels</h2><div class="panels">${catalog.panels.map(p=>`<div class="panel"><a href="panels/${p.id}.png" download><img src="panels/${p.id}.png" alt="${escape(p.title)}"></a><span class="caption">${p.existing?'Matches an existing panel':'Optional new panel'} · ${escape(p.title)}</span></div>`).join('')}</div><h2>Responsive profile artwork</h2><div class="hero"><a href="profile-banner.png" download><img src="profile-banner.png" alt="Art only profile banner"></a></div><p class="fine">1200 × 480 · no essential text for Twitch to crop or cover. No new avatar, schedule, rank, viewer perk, or bot command is assumed.</p><p><a href="../../docs/STREAM-PRODUCTION-REVIEW.md">Read the production review</a> · <a href="../../stream_brand/README.md">Installation and panel copy</a></p></main></html>`;
    const courtGallery='<h2>A recurring replay segment</h2><p><strong>Bot Lane Court.</strong> Between games, show one questionable replay, let chat call genius or inting, then reveal the verdict. You read chat and choose the result; these cards do not count votes.</p><div class="pairs"><div><a href="court.png" download><img src="court.png" alt="Bot Lane Court replay question"></a><span class="caption">The question · play your selected Instant Replay next</span></div><div class="pairs"><div><a href="court-genius.png" download><img src="court-genius.png" alt="Genius verdict"></a><span class="caption">Genius</span></div><div><a href="court-inting.png" download><img src="court-inting.png" alt="Inting verdict"></a><span class="caption">Inting</span></div></div></div>';
    const trailerGallery='<h2>A first impression with a payoff.</h2><p>A 36-second channel trailer built from your own Udyr clips, your existing cinematic intro and matching artwork. Both files are local review versions. Listen to the original-audio version before choosing it for publication.</p><div class="pairs"><div><video controls preload="none" style="display:block;width:100%;aspect-ratio:16/9" poster="../../stream_brand/exports/trailer-ending.png" src="file:///C:/StreamingMedia/ChannelPresentation/2026-10-02/channel-trailer-music.mp4"></video><a class="caption" href="file:///C:/StreamingMedia/ChannelPresentation/2026-10-02/channel-trailer-music.mp4">Music only · original score</a></div><div><video controls preload="none" style="display:block;width:100%;aspect-ratio:16/9" poster="../../stream_brand/exports/trailer-ending.png" src="file:///C:/StreamingMedia/ChannelPresentation/2026-10-02/channel-trailer-voice-review.mp4"></video><a class="caption" href="file:///C:/StreamingMedia/ChannelPresentation/2026-10-02/channel-trailer-voice-review.mp4">Original recording audio · listening review</a></div></div><p class="fine"><a href="../../stream_brand/trailer/README.md">Read the edit plan and delivery details</a></p>';
    const reviewGallery=gallery.replace('<h2>Channel panels</h2>',courtGallery+'<h2>Channel panels</h2>').replace('</main></html>',trailerGallery+'</main></html>').replace(/(href|src)="(offline|intermission|ending|welcome|court(?:-genius|-inting)?|profile-banner|panels\/[^" ]+)\.png"/g,'$1="../../stream_brand/exports/$2.png"');
    fs.writeFileSync(path.join(review,'index.html'),reviewGallery);
    await page.setViewportSize({width:1240,height:1000});
    await page.goto(pathToFileURL(path.join(review,'index.html')).href);
    await page.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode())));
    await page.screenshot({path:path.join(review,'presentation-preview.png'),fullPage:true});
    console.log(JSON.stringify({output,assets:manifest.length,errors,panels:catalog.panels.length}));
  }finally{
    await browser.close();
    if(staging){
      const resolved=path.resolve(staging);
      if(!resolved.startsWith(path.resolve(output)+path.sep)||!path.basename(resolved).startsWith('.brand-build-'))throw Error('Refusing cleanup outside the brand export staging directory');
      fs.rmSync(resolved,{recursive:true,force:true});
    }
  }
}
main().catch(e=>{console.error(e);process.exitCode=1});
