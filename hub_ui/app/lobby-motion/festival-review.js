// Read-only review: one private iframe at a time. No live cue or settings requests.
import {loadWorld} from './worlds.js';
const rooms=[
 ['aurora-camp','AuroraCampLobby','Thunderbear Forest','Active Â· detailed painting','Open forest clearing: left moss ledge for the host, right bark parchment, and a deep root bridge. Find the squirrel pulley accident, hidden poros, stolen boot, legendary spoon and ram traffic jam.','aurora-distinct-v4b'],
 ['sanctuary','SanctuaryLobby','Jade Spirit Sanctuary','Active Â· detailed painting','Terraced turtle islands: a curved tea landing at lower right and bamboo scroll at left. Discover the fish fishing for a poro, a goose cutting the tea queue, stone-balancing rivalry, biscuit tracks and a sleeping race champion.','ionian-distinct-v4b'],
 ['forge','ForgeLobby','Hotfix Foundry','Active Â· detailed painting','Monumental diagonal smithy: host at the elevated right forge, chat hanging from tongs at left. Duck armor prototypes cover the central anvil; discover turtle shoeing, a sword cheese ramp, poros sharing a helmet and the convoy delay.','forge-distinct-v4'],
 ['phoenix-observatory','PhoenixObservatoryLobby','Cryophoenix Observatory','Active Â· detailed painting','Shattered floating observatory: the host stands on a central ice platform, with a constellation scroll at left. Discover backwards telescope assistance, the spoon-armed egg guard, frozen spiraling tea, goose chess and a skating crab.','cryophoenix-distinct-v4b'],
 ['reef','ReefLobby','Turtle Reef','Top alternate Â· calmer','Best alternate for a clear turtle identity. Underwater motion contrasts beautifully with fire and snow. Its original left-camera layout and large display remain intact.'],
 ['storm-coast','StormCoastLobby','Storm Coast','Top alternate Â· dramatic','Best alternate for thunder-bear atmosphere. Natural waves, distant lightning and warm interiors offer less visual density than the festival paintings.'],
 ['arcade','SpiritArcadeLobby','One More Game Arcade','Occasional alternate Â· high energy','Vibrant neon and strong comedy cadence. Use as a special change of pace: its permanent hardware motifs fit your new brief less closely than the four leads.'],
 ['party','Spirit Afterparty','Spirit Afterparty','Top alternate Â· celebrations','Best for the end-of-session party. Already has autonomous visitors, dancing penguins and environmental effects. Its independent renderer stays intact.'],
 ['tavern','TavernWorldLobby','Respawn Inn','Good contender Â· cosy comedy','Mimics, dragons and loot jokes fit gaming culture naturally. Strong for conversation; warm palette overlaps with Forge, so it is a contrast choice mainly in pacing.'],
 ['future','FutureWorldLobby','Space Queue Lounge','Good contender Â· sci-fi','Portals, cosmic food and suspicious tasks support quick gags. A fun sci-fi break, though less directly aligned with the four spirits.'],
 ['spirit-rail','SpiritRailLobby','Spirit Railway','Situational Â· transitions','Beautiful arrival/departure story and a calm late-night mood. The large media area hides much of the scenic action, so strongest when media itself is the focus.'],
 ['sky-harbor','SkyHarborLobby','Lagport','Situational Â· playful','Loot delivery, questionable navigation and sky traffic work well as intermission jokes. Less differentiated from the other warm fantasy rooms.']
];
const frame=document.querySelector('#preview'),now=document.querySelector('#now'),pause=document.querySelector('#pause'),screen=document.querySelector('#screen'),next=document.querySelector('#next');
let selected=rooms[0],step=0,paused=false,shown=false,broadcast=true,visits=[];
function load(){
 const [id,,name]=selected;paused=false;pause.textContent='Pause';now.textContent=name+' Â· private preview';
 const party=id==='party';next.disabled=true;screen.disabled=true;pause.disabled=true;
 frame.src=party?'/spirit-lobby/index.html?mode=lobby&party=lively&live=0':`index.html?preview=1&broadcast=${broadcast?1:0}&screen=${shown?1:0}&world=${id}&at=30`;
 visits=[];if(!party)loadWorld(id).then(w=>{if(selected[0]===id)visits=w.cues.filter(c=>!c.id.startsWith('border-'));});
 document.querySelector('#studio').href=party?'/spirit-lobby/studio.html':`studio.html?world=${id}`;
 for(const b of document.querySelectorAll('[data-world]'))b.setAttribute('aria-pressed',String(b.dataset.world===id));
}
for(const room of rooms){
 const [id,source,name,tag,description,art]=room,card=document.createElement('article');card.className='card';
 const image=document.createElement('img');image.loading='lazy';image.alt=name;image.src=id==='party'?'/spirit-lobby/art/clubhouse-aligned.png':art?`art/${art}.png`:'/api/projects/scene_voice_switcher/artwork?source='+encodeURIComponent(source);
 const box=document.createElement('section'),label=document.createElement('div'),heading=document.createElement('h2'),text=document.createElement('p'),button=document.createElement('button');label.className='tag';label.textContent=tag;heading.textContent=name;text.textContent=description;button.textContent='Preview this world';button.dataset.world=id;
 button.addEventListener('click',()=>{selected=room;step=0;load();document.querySelector('.player').scrollIntoView({behavior:'smooth',block:'start'});});box.append(label,heading,text,button);card.append(image,box);document.querySelector('#rooms').append(card);
}
pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'Resume':'Pause';frame.contentWindow.postMessage({type:'living-lobby',paused},location.origin);});
next.addEventListener('click',()=>{if(!visits.length)return;const cue=visits[step++%visits.length];now.textContent=selected[2]+' Â· '+cue.label;frame.contentWindow.postMessage({type:'living-lobby',cue:cue.id},location.origin);});
screen.addEventListener('click',()=>{shown=!shown;screen.setAttribute('aria-pressed',String(shown));screen.textContent=shown?'Hide media space':'Show media space';frame.contentWindow.postMessage({type:'living-lobby',displayVisible:shown},location.origin);});
load();
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===frame.contentWindow&&e.data?.type==='living-lobby-ready'&&e.data.world===selected[0]){next.disabled=false;pause.disabled=false;screen.disabled=!['aurora-camp','sanctuary','forge','phoenix-observatory'].includes(selected[0]);}});

document.querySelector('#layout').addEventListener('click',e=>{broadcast=!broadcast;e.currentTarget.textContent=broadcast?'Hide stream layout':'Show stream layout';e.currentTarget.setAttribute('aria-pressed',String(broadcast));frame.contentWindow.postMessage({type:'living-lobby',broadcast},location.origin);});
