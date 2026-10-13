const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const source=fs.readFileSync('hub_ui/app/chat/text_replacements.js','utf8');
 const {textFragments}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const rules={god:'gyatt 😂'};
 const text=value=>textFragments(value,rules).map(p=>p.text).join('');
 assert.equal(text('oh my God! GOD, god. godlike goddess'), 'oh my gyatt 😂! gyatt 😂, gyatt 😂. godlike goddess');
 assert.equal(text('https://example.com/god @God !god #god'), 'https://example.com/god @God !god #god');
 assert.equal(textFragments('God',rules,{God:{url:'https://example.com/emote'}})[0].text,'God');
 const protocol=fs.readFileSync('hub_ui/app/chat/protocol.js','utf8')
  .replace("'./text_replacements.js'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(source).toString('base64')))
  .replace("'./stickers.js'",JSON.stringify('data:text/javascript;base64,'+fs.readFileSync('hub_ui/app/chat/stickers.js').toString('base64')));
 const {fragments}=await import('data:text/javascript;base64,'+Buffer.from(protocol).toString('base64'));
 const parts=fragments('God Kappa gaming god',{emotes:'25:4-8'},{},{'gaming god':'https://example.com/sticker'},{textReplacements:rules});
 assert.equal(parts.filter(p=>'text' in p).map(p=>p.text).join(''),'gyatt 😂  gaming gyatt 😂');
 assert.equal(parts.filter(p=>p.url).length,1);
 assert.equal(parts.find(p=>p.url).alt,'Kappa');
 assert.equal(fragments('good game',{}, {},{'good game':'https://example.com/gg'},{textReplacements:rules})[0].url,'https://example.com/gg');
 const sticker=fragments('oh my GOD!',{}, {},{peepoGiggles:'https://example.com/frog'},{textReplacements:{god:'gyatt peepoGiggles'}});
 assert.equal(sticker.filter(p=>'text' in p).map(p=>p.text).join(''),'oh my gyatt !');
 assert.equal(sticker.find(p=>p.url).url,'https://example.com/frog');
 // Ordinary speech survives aliases and provider codes in all casing; expressive
 // phrases and deliberate codes remain available without deleting the library.
 const catalog={I:{url:'https://example.com/i'},milk:{url:'https://example.com/milk'},RaveTime:{url:'https://example.com/rave'}};
 const aliases={i:'https://example.com/i',milk:'https://example.com/milk',why:'https://example.com/why','good morning':'https://example.com/morning',hype:'https://example.com/hype',':O':'https://example.com/surprise','🛟':'https://example.com/safe'};
 const options={literalWords:['i','milk','why','good morning','o'],textReplacements:{kys:'KeEp YoUrSeLf SaFe 🛟'}};
 const speech='I said why? Milk, milk and MILK. Good morning!';
 assert.equal(fragments(speech,{},catalog,aliases,options).map(p=>p.text||'').join(''),speech);
 assert.equal(fragments('I milk',{},catalog,aliases,{...options,natural:false}).filter(p=>p.url).length,0);
 assert.equal(fragments('I milk',{},catalog,aliases,{...options,limit:0}).filter(p=>p.url).length,0);
 assert.equal(fragments('hYpE RaveTime :O',{},catalog,aliases,options).filter(p=>p.url).length,3);
 const safe=fragments('kYs',{},catalog,aliases,options);
 assert.equal(safe.filter(p=>p.text).map(p=>p.text).join(''),'KeEp YoUrSeLf SaFe ');
 assert.equal(safe.find(p=>p.url).url,'https://example.com/safe');
 assert.equal(fragments('I Kappa',{emotes:'25:2-6'},catalog,aliases,options).find(p=>p.url).alt,'Kappa');
 console.log('Chat text replacement regressions passed.');
})().catch(error=>{console.error(error);process.exit(1);});
