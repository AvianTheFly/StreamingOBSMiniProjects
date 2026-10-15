export const SPIRITS=['bear','turtle','ram','phoenix'];
export const COLORS=['#86d6ff','#82efc6','#ffbe6d','#c0c0ff'];
export const TITLES=['THUNDER AWAKENS','THE JADE AEGIS','THE MOUNTAIN FORGE','ASH & AURORA'];
export function ceremony(time,moving=true){
  const t=moving?Math.max(0,time):0,cycle=Math.floor(t/14),phase=t%14;
  const index=cycle%4,mix=phase<2?(phase/2)**2*(3-2*phase/2):1;
  return {t,index,previous:(index+3)%4,mix,spirit:SPIRITS[index],color:COLORS[index],title:TITLES[index],charge:.5+.5*Math.sin(phase*Math.PI/14)};
}
