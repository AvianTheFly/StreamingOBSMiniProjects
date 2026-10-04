import { esc } from '../utils.js';
import { eventTitle, label } from './model.js';
export function time(value){return new Date(value*1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});}
export function recordKey(r){return `${r.session || ''}:${r.id ?? `${r.time}:${r.event}:${r.listener || ''}`}`;}
export function recordList(records,catalog,{compact=false}={}){
  if(!records.length)return '<div class="wf-empty">No observations in this range yet.</div>';
  return records.map(r=>`<button class="wf-record ${compact?'wf-record-compact':''}" data-record="${esc(recordKey(r))}"><time>${esc(time(r.time))}</time><span class="wf-record-mark ${/failed|reject|skip|cancel/i.test(r.phase||'')?'wf-mark-warning':''}"></span><span class="wf-record-title">${esc(eventTitle(r))}<small>${esc(r.owner?label(catalog,r.owner):r.requester?label(catalog,r.requester):r.listener?'Subscriber callback':'Event bus')}</small></span><span class="wf-phase">${esc(r.phase || 'observed')}</span></button>`).join('');
}
export function traceDetails(record,records,catalog){
  const siblings=record.dispatch?records.filter(r=>r.session===record.session&&r.dispatch===record.dispatch):[];
  const started=siblings.find(r=>r.phase==='emitted'), listeners=started?.listeners || record.listeners || [];
  const outcomes=listeners.map(listener=>{const result=siblings.find(r=>r.listener===listener);return `<li><span>${esc(listener)}</span><b>${esc(result?.phase || 'Outcome outside loaded range')}</b></li>`;}).join('');
  const safeFields=['phase','owner','requester','project','scene','source','kind','action','reason','outcome','sequence','parent'];
  return `<p class="wf-eyebrow">${esc(new Date(record.time*1000).toLocaleString())}</p><h3>${esc(eventTitle(record))}</h3>
    <dl class="wf-facts">${safeFields.filter(key=>record[key]!==undefined&&record[key]!==null&&record[key]!=='').map(key=>`<div><dt>${esc(key.replaceAll('_',' '))}</dt><dd>${esc(['owner','requester','project'].includes(key)?label(catalog,record[key]):record[key])}</dd></div>`).join('')}</dl>
    ${listeners.length?`<h4>Actual fan-out · ${listeners.length}</h4><ul class="wf-trace">${outcomes}</ul><p class="wf-note">Received means the callback returned. Playback and scene decisions are recorded separately.</p>`:''}
    ${record.event==='runtime.state'?'<button class="btn btn-primary" data-snapshot>View this state</button>':''}
    <p class="wf-note">Observed by the Hub. Browser animation frames and activity in the separate Footage Desk are outside this recording.</p>`;
}
