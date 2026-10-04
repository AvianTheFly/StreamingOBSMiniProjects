/* Image-led About copy and existing destinations; no live settings access. */
(function(root){
  const panels=[
    {id:'social',title:'Find me on X',label:'BEYOND THE BOT LANE',body:'@udyrisabotlaner',cue:'OPEN PROFILE',color:'#efa773',link:'https://x.com/udyrisabotlaner',description:'',previous:'add me on X! @udyrisabotlaner'},
    {id:'club',title:'The Udyr bot club',label:'OFF META. TOGETHER.',body:'Meet the other bot-lane believers.',cue:'BROWSE THE PLAYERS',color:'#98d3b8',link:'https://www.deeplol.gg/champions/udyr/mastery/bot',description:'',previous:"here's a list of every udyr bot otp in the world"},
    {id:'support',title:'Support the stream',label:'THANKS FOR BEING HERE',body:'Venmo: earthlydirt\nPayPal: avianfly',cue:'YOU MAKE THE CHAOS POSSIBLE',color:'#e6bc76',link:'',description:'',previous:'donations'},
    {id:'receipts',title:'The receipts',label:'MATCH HISTORY',body:'Udyr bot. The proof is in the games.',cue:'VIEW THE MATCH HISTORY',color:'#dbbd83',link:'https://imgur.com/a/bQmhmxD',description:'',previous:'Match History Proof of Udyr bot'},
    {id:'why',title:'Why Udyr bot?',label:'OFF META. ON PURPOSE.',body:'Why fight Garen, Darius or Mordekaiser\ntop when you can destroy bot lane?',cue:'FOUR SPIRITS. ONE QUESTIONABLE LANE.',color:'#a8d8ee',link:'',description:'',previous:'why udyr bot'},
    {id:'fruit',title:'I like pineapples.',label:'A VERY IMPORTANT OPINION',body:'Although mangos might be better.',cue:'THE FRUIT DEBATE CONTINUES',color:'#e8c16e',link:'',description:'',previous:'I like pineapples'},
    {id:'pum',title:'Lil pum pum.',label:'FOREST LORE, APPARENTLY',body:"What's a pum pum?",cue:'YOUR GUESS IS AS GOOD AS MINE',color:'#9dd9c9',link:'',description:'',previous:'I"m just a lil pum pum'},
    {id:'build',title:'Build & game plan',label:'THE BOT-LANE EXPERIMENT',body:'How I make lane Udyr work.',cue:'READ THE BUILD GUIDE',color:'#e6c48e',link:'https://www.reddit.com/r/Udyrmains/comments/1r43rdr/the_objectively_best_lane_udyr_build/',description:'',previous:null},
  ];
  for(const p of panels)p.alt=[p.title,p.body.replace(/\n/g,'. '),p.cue].join('. ');
  const catalog={width:320,height:250,panels};
  if(typeof module!=='undefined'&&module.exports)module.exports=catalog;
  else root.PanelCatalog=catalog;
})(typeof window!=='undefined'?window:{});

