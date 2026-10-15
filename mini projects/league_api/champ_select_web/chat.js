// Presentation only: retain the latest complete cards that fit the actual panel.
// The client owns sender evidence; an unavailable identity stays unlabelled.
const colors=['#aee9ff','#ffd79c','#b5f0bd','#e5c2ff','#ffbccf'];
function senderColor(sender){let hash=0;for(const char of sender)hash=(hash*31+char.codePointAt(0))>>>0;return colors[hash%colors.length];}

export function createDraftChat(box){
  let entries=[],signature='',disposed=false;
  function paint(){
    if(disposed)return;
    box.replaceChildren();
    if(!entries.length){
      const empty=document.createElement('p');empty.className='empty-chat';
      empty.textContent='Waiting for the first message…';box.append(empty);return;
    }
    const cards=entries.map(entry=>{
      const card=document.createElement('div'),content=document.createElement('div');
      card.className='message';content.className='message-content';
      const label=String(entry.sender||'').trim(),body=String(entry.body||'');
      if(label&&label.toUpperCase()!=='TEAM'){
        const sender=document.createElement('span');sender.className='sender';
        sender.textContent=label+':';content.append(sender,document.createTextNode(' '));
        card.style.setProperty('--sender-color',senderColor(label));
      }
      content.append(document.createTextNode(body));card.append(content);
      card.title=(label&&label.toUpperCase()!=='TEAM'?label+': ':'')+body;
      box.append(card);return card;
    });
    if(!box.clientHeight)return;
    const style=getComputedStyle(box),cardStyle=getComputedStyle(cards.at(-1)),textStyle=getComputedStyle(cards.at(-1).firstChild);
    const available=box.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
    const chrome=parseFloat(cardStyle.paddingTop)+parseFloat(cardStyle.paddingBottom)+parseFloat(cardStyle.borderTopWidth)+parseFloat(cardStyle.borderBottomWidth);
    let lines=Math.max(1,Math.floor((available-chrome)/parseFloat(textStyle.lineHeight)));
    box.style.setProperty('--chat-lines',lines);
    const used=()=>[...box.children].reduce((height,card)=>height+card.getBoundingClientRect().height,0)
      +Math.max(0,box.children.length-1)*parseFloat(style.rowGap);
    // Never let flexbox compress neighbouring messages into each other.
    while(used()>available+.5&&box.children.length>1)box.firstElementChild.remove();
    // An exceptionally long newest message gets an ellipsis, not a partial row.
    while(used()>available+.5&&lines>1)box.style.setProperty('--chat-lines',--lines);
  }
  const observer=new ResizeObserver(paint);observer.observe(box);
  document.fonts.ready.then(paint);
  return {
    render(messages){
      const next=(Array.isArray(messages)?messages:[]).filter(m=>m&&m.body).slice(-10);
      const nextSignature=JSON.stringify(next.map(m=>[m.id,m.sender,m.body]));
      if(signature===nextSignature)return;
      signature=nextSignature;entries=next;paint();
    },
    dispose(){disposed=true;observer.disconnect();entries=[];}
  };
}
