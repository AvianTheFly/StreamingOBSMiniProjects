/* Pure presentation: no polling, sockets, audio, settings writes or scene control. */
(function(){
  const query=new URLSearchParams(location.search);
  const kind=query.get('asset')||'offline';
  const graphic=document.getElementById('graphic');
  function set(id,value){document.getElementById(id).textContent=value||''}
  if(kind==='panel'){
    const panel=BrandCatalog.panels.find(p=>p.id===query.get('panel'))||BrandCatalog.panels[0];
    const styles={bear:['#91c9ed','-335px','-110px'],turtle:['#76e4cf','-415px','-195px'],ram:['#dcb779','-500px','-100px'],phoenix:['#e99761','-370px','-10px']}[panel.spirit];
    ['--panel-accent','--art-x','--art-y'].forEach((name,i)=>graphic.style.setProperty(name,styles[i]));
    set('kicker',panel.kicker);set('panel-title',panel.title);
    graphic.setAttribute('aria-label',panel.title);
  }else if(kind!=='banner'){
    const card=BrandCatalog.cards[kind]||BrandCatalog.cards.offline;
    ['label','top','bottom','subtitle','footer','tag'].forEach(id=>set(id,card[id]));
    graphic.setAttribute('aria-label',card.label);
  }
  graphic.dataset.kind=kind==='banner'||kind==='panel'||BrandCatalog.cards[kind]?kind:'offline';
  document.title=graphic.getAttribute('aria-label')+' — UdyrIsABotLaner';
})();
