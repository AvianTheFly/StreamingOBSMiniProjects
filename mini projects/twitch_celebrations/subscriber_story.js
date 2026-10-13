// Subscription-only policy: facts, bounded milestone intensity and shared contacts.
export const SUB_DURATION=4.8;
export function subscriptionLevel(item){
 const value=item.details?.months,months=Number.isInteger(value)&&value>0?value:null;
 return {months,level:months>=12?3:months>=6?2:months>=3?1:0};
}
export function subscriberCopy(item){
 const {months}=subscriptionLevel(item);
 return {kicker:'THANK YOU FOR SUBBING,',name:String(item.name||'Lovely human'),detail:months?`${months.toLocaleString()} ${months===1?'month':'months'} of support ♥`:'♥'};
}
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
export function subscriptionState(t,item){
 const {level,months}=subscriptionLevel(item),coin=ease((t-.75)/1),returning=ease((t-2.25)/1);
 return {level,months,coin:{x:180+1549*coin,y:1020-63*coin-Math.sin(coin*Math.PI)*38,rotation:coin*18,visible:t>=.45&&t<1.75},
  heart:{x:1729-1589*returning,y:957-47*returning-Math.sin(returning*Math.PI)*42,visible:t>=2.25&&t<3.25},
  machine:t<1.75?'waiting':t<2.25?'cranking':'thank-you',
  kirbyPose:t<3?0:t<3.25?1:t<3.75?2:0,
  inhale:t>=3&&t<3.25,balloon:ease((t-3.75)/.5),
  guestCount:3+(level>=1?1:0)+(level>=2?1:0)+(level>=3?1:0),
  burstCount:[8,14,22,30][level],punch:Math.exp(-((t-.25+.5)% .5)/.075)};
}
