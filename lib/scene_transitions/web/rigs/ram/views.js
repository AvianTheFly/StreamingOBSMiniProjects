// Public skin/performance contract. View order is not a choreography dependency.
export const viewIds=['side','quarter','front','rear','fall','backQuarter','back','backLeft','leftQuarter','crouch','push','tuck','reach'];
export const layer=(id,weight=1,mirror=1)=>({id,weight,mirror});
export function blend(a,b,p){return [layer(a.id,1-p,a.mirror),layer(b.id,p,b.mirror)].filter(v=>v.weight>0);}
