// Finite authored acts, not a slot carousel. Every act has one entrance and payoff.
export const clamp=v=>Math.max(0,Math.min(1,v));
export const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
export const lerp=(a,b,p)=>a+(b-a)*p;
export const arc=p=>Math.sin(clamp(p)*Math.PI);
export const ACTS=[
 {id:'crab-cannon',key:'crabs',at:0,end:2.35,side:'left'},
 {id:'dragon-confetti-sneeze',key:'toothless',at:.48,end:2.95,side:'right'},
 {id:'penguin-surf-stunt',key:'penguin',at:.95,end:3.3,side:'bottom'},
 {id:'bongo-balloon-solo',key:'bongo',at:2.1,end:4.5,side:'left'},
 {id:'pedro-record-toss',key:'pedro',at:2.78,end:5.45,side:'right'},
 {id:'nyan-comet-delivery',key:'nyan',at:3.18,end:5.03,side:'bottom'},
 {id:'cat-ufo-abduction',key:'spin-cat',at:4.35,end:6.65,side:'left'},
 {id:'banana-record-slip',key:'banana',at:4.94,end:7.22,side:'bottom'},
 {id:'frog-flower-fanfare',key:'frog',at:5.28,end:7.7,side:'right'},
 {id:'cat-crowd-surf',key:'catjam',at:6.5,end:7.92,side:'bottom'}
];
export function storySeed(item){let n=2166136261;for(const c of `${item.id||''}/${item.name||''}/${item.theme||''}`)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export function raidGuests(theme,t,seed=0){
 if(t<=0||t>=8)return [];
 const mirror=theme==='dragon'||theme==='frog';
 return ACTS.filter(a=>t>=a.at&&t<a.end).map(a=>{
  const age=t-a.at,p=age/(a.end-a.at),enter=ease(age/.32),leave=ease((a.end-t)/.28);
  let x=115,y=550,rotation=0,sx=1,sy=1,scale=1.45;
  switch(a.id){
   case 'crab-cannon': x=lerp(-110,112,enter);y=lerp(850,685,ease(p/.4))-arc((p-.47)/.3)*110;rotation=-arc(p)*.15;break;
   case 'dragon-confetti-sneeze':x=1812+160*(1-enter);y=lerp(185,430,ease(p/.3))-arc((p-.6)/.4)*95;rotation=-.3*(1-enter)+arc((p-.47)/.18)*.24;sy=1-arc((p-.22)/.18)*.2;sx=2-sy;scale=1.58;break;
   case 'penguin-surf-stunt':x=lerp(-100,1450,ease(p));y=986-arc((p-.37)/.4)*55;rotation=-.22+arc((p-.37)/.4)*.35;scale=1.23;break;
   case 'bongo-balloon-solo':x=110-200*(1-enter);y=460-arc((p-.68)/.3)*110;rotation=arc(p)*.09;scale=1.5;break;
   case 'pedro-record-toss':x=1810+170*(1-enter);y=720-arc((p-.25)/.5)*45;rotation=-arc((p-.38)/.22)*.19;scale=1.5;break;
   case 'nyan-comet-delivery':x=lerp(-160,2110,p*p);y=954-arc(p)*24;rotation=-.08;scale=1.7;break;
   case 'cat-ufo-abduction':x=118+Math.sin(p*11)*18;y=lerp(750,270,ease((p-.35)/.65));rotation=ease((p-.52)/.4)*Math.PI*2;scale=1.42-ease((p-.55)/.45)*.72;break;
   case 'banana-record-slip':x=lerp(1960,620,ease(p));y=978-arc((p-.3)/.48)*65;rotation=-ease((p-.3)/.45)*Math.PI*2-.18;scale=1.5;break;
   case 'frog-flower-fanfare':x=1810+150*(1-enter);y=430-arc((p-.62)/.3)*70;rotation=-arc((p-.34)/.3)*.12;scale=1.5;break;
   case 'cat-crowd-surf':x=lerp(310,1600,ease(p));y=967-arc(p)*25;rotation=-Math.PI/2+Math.sin(p*9)*.11;scale=1.3;break;
  }
  if(a.side!=='bottom')x+=((seed%5)-2)*3;
  if(mirror){x=1920-x;rotation=-rotation;sx*=-1;}
  return {...a,x,y,rotation,sx,sy,scale,age,p,fade:enter*leave,pose:age*(a.key==='bongo'?1.5:a.key==='toothless'?.78:1),mirrored:mirror};
 });
}
