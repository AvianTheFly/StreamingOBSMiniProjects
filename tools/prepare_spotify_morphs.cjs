// Offline derived asset. Never contacts OBS, reads user settings or advances music.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const web=path.resolve(__dirname,'../mini projects/spotify/web');
const recipe=['stage_geometry.js','stage_palette.js','stage_designs.js','stage_morph.js','morph_cache.js'];
const hash=crypto.createHash('sha256');
for(const name of recipe){hash.update(name+'\0');hash.update(fs.readFileSync(path.join(web,name),'utf8').replace(/\r\n/g,'\n'));hash.update('\0');}
const Journey=require(path.join(web,'journey.js')),Morph=require(path.join(web,'stage_morph.js'));
const began=performance.now(),data=Morph.exportPrepared(Journey.names.length);data.recipe_hash=hash.digest('hex');
if(!Morph.installPrepared(data,Journey.names.length))throw Error('Generated morph preparation failed validation');
const payload=JSON.stringify(data),target=path.join(web,'prepared-morphs.json'),temporary=target+'.'+process.pid+'.tmp';
try{fs.writeFileSync(temporary,payload);fs.renameSync(temporary,target);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
console.log(JSON.stringify({file:target,bytes:Buffer.byteLength(payload),plans:Morph.planCount(),generationMs:performance.now()-began}));
