// Metadata changes never recreate player cards or reload unchanged portraits.
export function createRoster(){
  const cards={};
  for(const side of ['allies','enemies']){
    cards[side]=Array.from({length:5},(_,i)=>{
      const row=document.createElement('div');row.className='player';row.style.setProperty('--slot',i);
      const art=document.createElement('img');art.className='champion-art';art.alt='';art.hidden=true;
      art.addEventListener('error',()=>{art.hidden=true;});art.addEventListener('load',()=>{art.hidden=false;});
      const portrait=document.createElement('div');portrait.className='portrait';portrait.textContent='✧';
      const img=document.createElement('img');img.alt='';img.hidden=true;
      img.addEventListener('error',()=>{img.hidden=true;});img.addEventListener('load',()=>{img.hidden=false;});portrait.append(img);
      const info=document.createElement('div');info.className='player-info';
      const labels=['strong','span','small'].map(tag=>{const el=document.createElement(tag);info.append(el);return el;});
      const number=document.createElement('b');number.className='slot-number';number.textContent=String(i+1+(side==='enemies'?5:0)).padStart(2,'0');
      row.append(art,portrait,info,number);document.querySelector('#'+side).append(row);
      return {row,img,art,labels,image:'',artURL:''};
    });
  }
  return roster=>{
    for(const side of ['allies','enemies']){
      const rows=(roster||[]).filter(p=>p.team===side);
      cards[side].forEach((card,i)=>{
        const p=rows.find(p=>p.slot===i)||rows[i]||{};
        const roles={TOP:'TOP',JUNGLE:'JUNGLE',MIDDLE:'MID',MID:'MID',BOTTOM:'BOT',BOT:'BOT',UTILITY:'SUPPORT',SUPPORT:'SUPPORT'};
        const labels=[p.name||'Awaiting champion',p.label||`Player ${i+1}`,roles[String(p.role||'').toUpperCase()]||'ROLE TBD'];
        labels.forEach((label,j)=>{if(card.labels[j].textContent!==label)card.labels[j].textContent=label;});
        const image=/^\/champ-select\/icons\/[1-9][0-9]{0,4}\.png$/.test(p.image||'')?p.image:'';
        if(image!==card.image){card.image=image;card.img.hidden=true;if(image)card.img.src=image;else card.img.removeAttribute('src');}
        const artURL=image?image.replace('/icons/','/portraits/').replace('.png','.jpg'):'';
        if(artURL!==card.artURL){card.artURL=artURL;card.art.hidden=true;if(artURL)card.art.src=artURL;else card.art.removeAttribute('src');}
        card.row.classList.toggle('known',Boolean(p.name));
      });
    }
  };
}
