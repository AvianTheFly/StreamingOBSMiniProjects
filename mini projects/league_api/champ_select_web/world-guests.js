import {scenes,clamp,smooth,pulse,path,light} from './scene-map.js';

// Small residents stand on authored contacts. Reactions follow real draft cues;
// occasional idle business uses the same document clock, never a new timer.
export function paintGuest(c,t,theme,events,assets) {
  const s=scenes[theme],[name,x,y,h]=s.guest;
  const recent=[...events].reverse().find(e=>t-e.at<3.8);
  const age=recent?t-recent.at:0,kind=recent?.kind;
  const idle=(t%31),business=idle>20&&idle<27?(idle-20)/7:0;
  let pose=0,dy=0,dx=0,turn=0,squash=1;
  // Soft contact shadows attach feet to the ledge, not to the viewport.
  c.save();c.globalAlpha=.3;c.fillStyle='#071018';c.beginPath();c.ellipse(x,y+1,h*.4,h*.07,0,0,Math.PI*2);c.fill();c.restore();
  if(name==='kirby') {
    // A star from the nearby orrery is swallowed; lock-in yields a celebratory spit.
    if(kind==='lock'){pose=age<.25?1:age<1?2:0;dy=-Math.sin(clamp((age-.2)/.65)*Math.PI)*14;squash=1-pulse(age,0,.45)*.15;}
    if(kind==='ban'){pose=age<1.2?1:2;turn=Math.sin(age*12)*.05*(1-clamp(age/2));}
    if(kind==='chat'||business){pose=1;turn=-.12*pulse(kind?age:business*3,0,2.5);}
    const star=kind==='lock'?pulse(age,.3,1.6):business?Math.sin(business*Math.PI):0;
    if(star>0){const u=kind?clamp((age-.3)/1.6):business;
      light(c,x+25+u*45,y-30-Math.sin(u*Math.PI)*40,10,10,'#ffdf8c',star);
      path(c,[[x+25+u*45-5,y-30-Math.sin(u*Math.PI)*40],[x+25+u*45+5,y-30-Math.sin(u*Math.PI)*40]],'#fff0a9',2,star);}
  } else if(name==='crewmate') {
    // Leans onto a fuse box on the painted bridge. Ban shocks send it into cover.
    c.fillStyle='#152837';c.globalAlpha=1;c.fillRect(x+22,y-25,20,25);
    path(c,[[x+24,y-17],[x+40,y-17]],kind==='ban'?'#ff6b7c':'#69efff',2,.8);
    if(kind==='lock'||kind==='chat'){pose=1;turn=.18*pulse(age,0,.6);dx=5*pulse(age,0,.8);}
    if(kind==='ban'){pose=2;squash=1-pulse(age,0,1.3)*.3;dy=7*pulse(age,0,1.3);}
    if(business){pose=1;turn=Math.sin(business*Math.PI)*.15;}
  } else if(name==='boo') {
    // The ghost peeks above the stair parapet, then hides from a ban or new chat.
    dy=Math.sin(t*1.3)*3;
    if(kind==='ban'||kind==='chat'){pose=2;dy+=h*.7*pulse(age,0,2);}
    if(kind==='lock'){pose=1;dy-=Math.sin(clamp(age/1.1)*Math.PI)*17;}
    if(business){pose=1;dx=Math.sin(business*Math.PI)*19;}
    c.save();c.beginPath();c.rect(x-h,y-h*1.7,h*2,h*1.7);c.clip();
    assets.sprite(c,pose,x+dx,y+dy,h,{turn,squash});c.restore();return;
  } else {
    // The goose fishes a pearl from the pool edge; a ban snaps its beak shut.
    if(kind==='ban'){pose=1;turn=.12*pulse(age,0,1);dx=7*pulse(age,0,1.1);}
    if(kind==='lock'){pose=2;dy=-Math.sin(clamp(age/.9)*Math.PI)*12;}
    if(kind==='chat'||business){pose=1;turn=.1;}
    if(kind==='ban'&&age>.25){const p=clamp((age-.25)/1.8);light(c,x+27+p*28,y-27+Math.sin(p*Math.PI)*-25,5,5,'#e5eac7',1-p);}
  }
  assets.sprite(c,pose,x+dx,y+dy,h,{turn,squash});
}
