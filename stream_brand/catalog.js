/* Authored graphic copy. This is an export catalog, not live Hub settings. */
(function(root) {
  const panels = [
    {id:'about', title:'Meet the bot laner', spirit:'bear', kicker:'WELCOME TO THE BOT LANE', note:'Udyr. Bot lane. Questionable decisions.', existing:false},
    {id:'why-udyr-bot', title:'Why Udyr bot?', spirit:'ram', kicker:'OFF META. ON PURPOSE.', existing:true},
    {id:'udyr-bot-club', title:'The Udyr bot club', spirit:'turtle', kicker:'THERE ARE DOZENS OF US. MAYBE.', existing:true},
    {id:'match-history', title:'The receipts', spirit:'bear', kicker:'MATCH HISTORY', existing:true},
    {id:'find-me', title:'Find me on X', spirit:'phoenix', kicker:'@UDYRISABOTLANER', existing:true},
    {id:'support', title:'Support the stream', spirit:'phoenix', kicker:'THANKS FOR BEING HERE', existing:true},
    {id:'pineapples', title:'I like pineapples', spirit:'turtle', kicker:'MANGOS MAY BE BETTER', existing:true},
    {id:'pum-pum', title:'Lil pum pum', spirit:'ram', kicker:'WHAT\u2019S A PUM PUM?', existing:true},
    {id:'the-show', title:'Four spirits. One lane.', spirit:'bear', kicker:'THE STREAM', existing:false},
    {id:'clips', title:'The good decisions', spirit:'ram', kicker:'CLIPS & PAST STREAMS', existing:false},
  ];
  const cards = {
    offline:{label:'THE STREAM IS OFFLINE', top:'UDYR', bottom:'BOT LANE', subtitle:'Four spirits. One questionable lane.', footer:'Watch the clips. Come back for the chaos.', tag:'UDYRISABOTLANER'},
    intermission:{label:'A QUICK BREAK', top:'BE RIGHT', bottom:'BACK.', subtitle:'Even the spirits need a breather.', footer:'Thanks for hanging out.', tag:'UDYRISABOTLANER'},
    ending:{label:'THAT\u2019S THE STREAM', top:'GG.', bottom:'THANK YOU.', subtitle:'Same spirits. More questionable decisions next time.', footer:'Clips live here. Find me on X @udyrisabotlaner.', tag:'UDYRISABOTLANER'},
    welcome:{label:'WELCOME TO THE STREAM', top:'UDYR.', bottom:'BOT LANE.', subtitle:'Yes, really. Make yourself at home.', footer:'Four spirits. One questionable lane.', tag:'UDYRISABOTLANER'},
    'trailer-ending':{label:'UDYRISABOTLANER', top:'FOUR SPIRITS.', bottom:'ONE LANE.', subtitle:'Come for the off-meta. Stay for the chaos.', footer:'TWITCH.TV/UDYRISABOTLANER', tag:'SEE YOU IN THE BOT LANE'},
    court:{label:'THE COURT OF QUESTIONABLE DECISIONS', top:'GENIUS', bottom:'OR INTING?', subtitle:'Watch the replay. Chat makes the call.', footer:'Vote in chat: genius or inting. No command needed.', tag:'BOT LANE COURT'},
    'court-genius':{label:'THE CHAT HAS SPOKEN', top:'ABSOLUTE', bottom:'GENIUS.', subtitle:'Somehow, the spirits approved.', footer:'Case closed. Back to the bot lane.', tag:'BOT LANE COURT'},
    'court-inting':{label:'THE CHAT HAS SPOKEN', top:'GUILTY.', bottom:'OF INTING.', subtitle:'The decision making allegations continue.', footer:'Case closed. Back to the bot lane.', tag:'BOT LANE COURT'},
  };
  const catalog = {panels,cards,accent:'#76e4cf',ink:'#0a1422',gold:'#dcb779'};
  if (typeof module !== 'undefined' && module.exports) module.exports=catalog;
  else root.BrandCatalog=catalog;
})(typeof window !== 'undefined' ? window : {});
