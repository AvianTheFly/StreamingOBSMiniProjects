// Evidence-backed copy arrives with the same revision as the match report.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function narrative(report,cycle=0){
 const deck=report.narratives||[],story=deck[cycle%Math.max(1,deck.length)];
 if(!story)return '<div class="analysis-empty">Your next story is being assembled<small>More detail appears with verified match data</small></div>';
 return `<article class="narrative" data-story="${esc(story.id)}"><div class="narrative-lead"><small>MATCH CHRONICLE · ${cycle%deck.length+1}/${deck.length}</small><h2>${esc(story.title)}</h2><strong>${esc(story.value)}<span>${esc(story.unit)}</span></strong></div><div class="narrative-copy"><p>${esc(story.text)}</p><div class="narrative-facts">${(story.facts||[]).map(f=>`<div><b>${esc(f.value)}</b><small>${esc(f.label)}</small></div>`).join('')}</div></div></article>`;
}
