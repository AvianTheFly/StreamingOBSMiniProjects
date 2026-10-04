// Standalone offline-tool transport. Importing does not bind a port.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {once}=require('node:events');
const web=path.resolve(__dirname,'../lib/scene_transitions/web');
const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.wav':'audio/wav'};
async function serve(root=web){
 root=path.resolve(root);
 const server=http.createServer((req,res)=>{
  let relative=decodeURIComponent(new URL(req.url,'http://local').pathname);if(relative==='/')relative='/index.html';
  const filename=path.resolve(root,'.'+relative);
  if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');
  fs.createReadStream(filename).pipe(res);
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 return {url:`http://127.0.0.1:${server.address().port}/`,close:()=>server.close()};
}
module.exports={serve,web};
