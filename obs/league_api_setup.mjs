// Standalone OBS setup boundary; Node 22+ required. Never prints credentials.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const env = {...process.env};
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath,'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if(m && !(m[1] in env)) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
const ws = new WebSocket(`ws://${env.OBS_HOST || 'localhost'}:${env.OBS_PORT || 4455}`);
const pending = new Map();
const timer = setTimeout(()=>{console.error('OBS setup timed out'); process.exit(1)},15000);
const hash = s=>crypto.createHash('sha256').update(s).digest('base64');
function request(requestType,requestData={}) {
  return new Promise((resolve,reject)=>{
    const requestId=crypto.randomUUID(); pending.set(requestId,{resolve,reject});
    ws.send(JSON.stringify({op:6,d:{requestType,requestData,requestId}}));
  });
}
ws.onerror=()=>{console.error('Cannot connect to OBS WebSocket'); process.exit(1)};
ws.onmessage=async ({data})=>{
  try {
    const {op,d}=JSON.parse(data);
    if(op===0) {
      const ident={rpcVersion:1};
      if(d.authentication) ident.authentication=hash(hash((env.OBS_PASSWORD||'')+d.authentication.salt)+d.authentication.challenge);
      ws.send(JSON.stringify({op:1,d:ident}));
    } else if(op===7) {
      const p=pending.get(d.requestId); pending.delete(d.requestId);
      if(d.requestStatus.result) p?.resolve(d.responseData); else p?.reject(new Error(d.requestStatus.comment));
    } else if(op===2) {
      const scenes=await request('GetSceneList');
      const sceneName='League API', inputName='League API Alerts';
      if(!scenes.scenes.some(s=>s.sceneName===sceneName)) throw new Error('League API scene not found');
      const video=await request('GetVideoSettings');
      if(process.argv.includes('--screenshot')) {
        const result=await request('GetSourceScreenshot',{sourceName:sceneName,imageFormat:'png',imageWidth:1920,imageHeight:1080});
        const target=fileURLToPath(new URL('../mini%20projects/league_api/preview.png',import.meta.url));
        fs.writeFileSync(target,Buffer.from(result.imageData.split(',')[1],'base64')); console.log(target);
      } else if(process.argv.includes('--refresh')) {
        await request('PressInputPropertiesButton',{inputName,propertyName:'refreshnocache'});
        console.log('Refreshed League API Alerts');
      } else if(process.argv.includes('--inspect')) {
        console.log(JSON.stringify({video,items:await request('GetSceneItemList',{sceneName}),current:scenes.currentProgramSceneName}));
      } else {
        const inputSettings={url:'http://127.0.0.1:7431/overlay',width:video.baseWidth,height:video.baseHeight,fps:30,shutdown:false,restart_when_active:false,reroute_audio:true};
        const inputs=await request('GetInputList');
        const existing=inputs.inputs.find(i=>i.inputName===inputName);
        if(existing && existing.inputKind!=='browser_source') throw new Error('Source name exists with another input kind');
        if(!existing) await request('CreateInput',{sceneName,inputName,inputKind:'browser_source',inputSettings,sceneItemEnabled:true});
        else await request('SetInputSettings',{inputName,inputSettings,overlay:true});
        let items=await request('GetSceneItemList',{sceneName});
        if(!items.sceneItems.some(i=>i.sourceName===inputName)) await request('CreateSceneItem',{sceneName,sourceName:inputName,sceneItemEnabled:true});
        items=await request('GetSceneItemList',{sceneName});
        const item=items.sceneItems.find(i=>i.sourceName===inputName);
        await request('SetSceneItemTransform',{sceneName,sceneItemId:item.sceneItemId,sceneItemTransform:{positionX:0,positionY:0,scaleX:1,scaleY:1}});
        await request('SetSceneItemEnabled',{sceneName,sceneItemId:item.sceneItemId,sceneItemEnabled:true});
        console.log(JSON.stringify({scene:sceneName,source:inputName,settings:(await request('GetInputSettings',{inputName})).inputSettings,items:(await request('GetSceneItemList',{sceneName})).sceneItems.map(i=>({name:i.sourceName,enabled:i.sceneItemEnabled}))}));
      }
      clearTimeout(timer); ws.close();
    }
  } catch(e) {console.error(e.message); process.exit(1)}
};
