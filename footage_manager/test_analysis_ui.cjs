// Large analysis libraries remain navigable without rendering the whole archive.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
async function main(){
  const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,innerHTML:'',textContent:'',disabled:false,scrollIntoView(){}});return elements.get(id);};
  const games=Array.from({length:75},(_,i)=>({video_id:i+1,index:0,source_name:'Session '+(i+1),source_path:'C:/fixture-'+i+'.mp4',start:0,end:900,trim_start:0,trim_end:960,score:75-i,confidence:.8,outcome:i%2?'victory':'defeat',metrics:{early_kda:false},moments:[],availability:'online'}));
  const context=vm.createContext({$:element,localStorage:{getItem:()=>null,setItem(){}},document:{querySelector:()=>({checked:true,value:'1'})},api:async()=>({games,replays:[],analyzed:[],candidate_count:75}),action:fn=>fn(),escape:String,time:String,setInterval(){},workflow:null,player:{pause(){}}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'web/analysis.js'),'utf8'),context);
  await vm.runInContext('refreshAnalysis()',context);
  assert.equal((element('detected-games').innerHTML.match(/class="detected-game"/g)||[]).length,30);
  assert.equal(element('analysis-page-label').textContent,'Games 1–30 of 75');
  assert.equal(element('analysis-prev').disabled,true);
  element('analysis-next').onclick();assert.equal(element('analysis-page-label').textContent,'Games 31–60 of 75');
  assert.match(element('detected-games').innerHTML,/data-game-play="31:0"/);
  element('analysis-next').onclick();assert.equal(element('analysis-page-label').textContent,'Games 61–75 of 75');
  assert.equal(element('analysis-next').disabled,true);
  element('analysis-search').value='Session 1';element('analysis-search').oninput();
  assert.equal(element('analysis-page-label').textContent,'Games 1–11 of 11');
  element('analysis-outcome').value='victory';element('analysis-outcome').onchange();
  assert.equal(element('analysis-page-label').textContent,'Games 1–5 of 5');
  element('analysis-search').value='no match';element('analysis-search').oninput();
  assert.equal(element('analysis-page-label').textContent,'No matching games');
  assert.equal(element('analysis-prev').disabled,true);assert.equal(element('analysis-next').disabled,true);
  console.log('Analysis pagination, stable source IDs, search and outcome-filter checks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
