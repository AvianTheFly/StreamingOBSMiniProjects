// The embedded operator surface owns its browser lifetime; no extra polling here.
export function createRecapController(root){
 const section=document.createElement('section');section.className='card';section.style.cssText='margin-bottom:20px;padding:16px;background:linear-gradient(120deg,#132932,#0c1924);border-color:#355b63';
 section.innerHTML='<details open><summary style="font-size:19px;font-weight:750;cursor:pointer;margin-bottom:12px;color:#d6fff0">Post-game show</summary><div data-recap-frame style="max-width:960px;margin:auto"></div></details>';
 root.querySelector('.page-header').after(section);
 const details=section.querySelector('details'),holder=section.querySelector('[data-recap-frame]');
 const resize=new ResizeObserver(()=>{const frame=holder.firstElementChild;if(frame)frame.style.height=holder.clientWidth<=700?'510px':'658px';});resize.observe(holder);
 function sync(){if(!details.open){holder.replaceChildren();return;}if(holder.children.length)return;
  const frame=document.createElement('iframe');frame.src='/league-stats/postgame.html?control=1';frame.title='Post-game show controls and OBS preview';frame.style.cssText='display:block;width:100%;height:658px;border:0;border-radius:12px';holder.append(frame);
 }
 details.addEventListener('toggle',sync);sync();
 return ()=>{resize.disconnect();details.removeEventListener('toggle',sync);holder.replaceChildren();section.remove();};
}
