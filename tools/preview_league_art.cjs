// Actual Chromium rendering and controls, using a temporary isolated service.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const artifacts =
  path.join(root,'tmp_obs_debug');
fs.mkdirSync(artifacts, { recursive: true });
const server = spawn(
  'py',
  ['-3.11', '-X', 'utf8', '-u', path.join(__dirname, 'league_production_fixture.py')],
  { cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
);
function localRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...options.headers };
    if (options.body) headers['Content-Length'] = Buffer.byteLength(options.body);
    const req = http.request(url, { method: options.method || 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          resolve({ json: async () => data });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.end(options.body);
  });
}
server.stderr.on('data', (data) => process.stderr.write(data));
async function endpoint() {
  return await new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(Error('Fixture startup timed out')), 10000);
    server.stdout.on('data', (chunk) => {
      text += chunk;
      const line = text.split(/\r?\n/).find((line) => line.startsWith('{'));
      if (line) {
        clearTimeout(timer);
        resolve('http://127.0.0.1:' + JSON.parse(line).port);
      }
    });
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(Error('Fixture exited ' + code));
    });
  });
}
(async()=>{
 let browser;
 try{
  const base=await endpoint();browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.goto(base+'/overlay?monitor=1');
  const catalog=(await(await localRequest(base+'/production/settings')).json()).catalog;
  await page.evaluate(async catalog=>{
   const {ProductionScene}=await import('/production/scene.js');
   document.documentElement.style.cssText='height:auto;overflow:visible';document.body.innerHTML='';document.body.style.cssText='height:auto;overflow:visible;margin:0;padding:20px;background:#101b24;color:#d4e4ec;font:15px Segoe UI;display:grid;grid-template-columns:repeat(4,1fr);gap:18px';window.cards=[];
   window.backdrop=(c)=>{
    const g=c.createLinearGradient(0,0,1920,1080);g.addColorStop(0,'#0d2325');g.addColorStop(.5,'#17261e');g.addColorStop(1,'#10232d');c.fillStyle=g;c.fillRect(0,0,1920,1080);
    c.strokeStyle='#639c971b';c.lineWidth=42;c.beginPath();c.moveTo(260,920);c.bezierCurveTo(300,700,1400,450,1640,160);c.stroke();
    c.lineWidth=12;c.strokeStyle='#c5ccb817';c.beginPath();c.moveTo(290,940);c.lineTo(530,320);c.lineTo(1560,170);c.moveTo(290,940);c.lineTo(1310,810);c.lineTo(1560,170);c.stroke();
    for(let j=0;j<30;j++){const x=350+(j*331)%1200,y=230+(j*131)%600;c.fillStyle=j%2?'#163b3888':'#7a918b24';c.beginPath();c.ellipse(x,y,35+j%3*10,25,0,0,Math.PI*2);c.fill();}
    c.fillStyle='#132630aa';c.fillRect(700,986,600,76);c.fillRect(1730,866,170,194);c.strokeStyle='#567b8066';c.lineWidth=1;c.strokeRect(1730,866,170,194);
   };
   for(const effect of [...catalog,{key:'death_ambient',title:'DEATH / SOUL SANCTUARY',duration:8,theme:'ash'}]){
    const card=document.createElement('section'),label=document.createElement('div');label.textContent=effect.title;label.style.cssText='font-size:13px;margin-bottom:8px;letter-spacing:1px';card.appendChild(label);
    const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;canvas.style.cssText='display:block;width:100%;border-radius:8px';card.appendChild(canvas);document.body.appendChild(card);
    const off=document.createElement('canvas');off.width=1920;off.height=1080;const scene=new ProductionScene(off),c=canvas.getContext('2d');
    const state={enabled:true,opacity:.8,edge_width:56,intensity:1.15,effect:effect.key==='death_ambient'?null:{...effect,elapsed:effect.duration*.48},death:effect.key==='death_ambient'?{elapsed:5,remaining:18,worth:false}:null};
    scene.draw(state);window.backdrop(c);c.drawImage(off,0,0);window.cards.push({effect,card,canvas,scene,state});
   }
  },catalog);
  await page.screenshot({path:path.join(artifacts,'league-all-event-borders.png'),fullPage:true});
  await page.evaluate(()=>{
   const featured=['dragon_earth','dragon_fire','dragon_water','dragon_hextech','baron','herald','pentakill','void_grub','vision_activity','large_heal','victory','death_ambient'];
   document.body.style.gridTemplateColumns='repeat(3,1fr)';window.cards.forEach(({effect,card})=>card.style.display=featured.includes(effect.key)?'':'none');
  });
  await page.screenshot({path:path.join(artifacts,'league-auxiliary-designs.png'),fullPage:true});
  const deathPNG=await page.evaluate(()=>window.cards.find(c=>c.effect.key==='death_ambient').canvas.toDataURL().split(',')[1]);
  fs.writeFileSync(path.join(artifacts,'league-death-border.png'),Buffer.from(deathPNG,'base64'));
  const movie=await page.evaluate(async()=>{
   const cards=['baron','dragon_hextech','dragon_water','death_ambient'].map(key=>window.cards.find(x=>x.effect.key===key));
   const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const c=canvas.getContext('2d'),chunks=[],rec=new MediaRecorder(canvas.captureStream(24),{mimeType:'video/webm'});
   rec.ondataavailable=e=>chunks.push(e.data);const finished=new Promise(r=>rec.onstop=r);rec.start();const start=performance.now();
   await new Promise(resolve=>{function frame(now){const t=(now-start)/1000;c.fillStyle='#101b24';c.fillRect(0,0,1920,1080);
    cards.forEach(({scene,effect,canvas:composed},i)=>{const x=i%2*960,y=Math.floor(i/2)*540;scene.draw({enabled:true,opacity:.8,edge_width:56,intensity:1.15,effect:effect.key==='death_ambient'?null:{...effect,elapsed:Math.min(effect.duration-.01,t/8*effect.duration)},death:effect.key==='death_ambient'?{elapsed:t,remaining:24-t}:null});
     const layer=composed.getContext('2d');window.backdrop(layer);layer.drawImage(scene.canvas,0,0);c.drawImage(composed,x+15,y+45,930,475);c.fillStyle='#c8dce5';c.font='500 18px Segoe UI';c.fillText(effect.title,x+20,y+28);
    });if(t<8)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
   rec.stop();await finished;const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);
  });
  fs.writeFileSync(path.join(artifacts,'league-auxiliary-motion.webm'),Buffer.from(movie,'base64'));
  console.log(JSON.stringify({artifacts,catalog:catalog.length}));
 }finally{if(browser)await browser.close();server.stdin.end();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
