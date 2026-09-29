// Shared show metadata: audio hooks and dance cadence, independent of personal overrides.
export const partyTracks = {
 crab: {audio:'crab-rave-party.mp3', label:'Crab Rave', bpm:125, cameo:'crab-rave-dance.mp4'},
 dragon: {audio:'toothless-party.mp3', label:'Driftveil City / Toothless', bpm:125, cameo:'tobey-dance.mp4'},
 cat: {audio:'nyan-cat-party.mp3', label:'Nyan Cat', bpm:142, cameo:'minions-dance.mp4'},
 frog: {audio:'pedro-party.mp3', label:'Pedro', bpm:128, cameo:'pedro-dance.mp4'},
};
// Original vector mascots. Keep each drawing inside the same 160 × 160 stage.
const eyes = '<ellipse cx="62" cy="64" rx="12" ry="16" fill="#fff"/><ellipse cx="100" cy="64" rx="12" ry="16" fill="#fff"/><circle cx="65" cy="67" r="6" fill="#171529"/><circle cx="97" cy="67" r="6" fill="#171529"/><circle cx="67" cy="63" r="2" fill="white"/><circle cx="99" cy="63" r="2" fill="white"/>';
const smile = '<path d="M66 88 Q80 102 95 87" fill="none" stroke="#242039" stroke-width="5" stroke-linecap="round"/>';
const drawings = {
 crab: '<g stroke="#ef675c" stroke-width="10" stroke-linecap="round"><path d="M46 105L20 118M48 116L25 140M112 105L140 118M112 116L136 140"/><path d="M45 92L22 60M116 92L140 60"/></g><g fill="#ff8a73"><ellipse cx="80" cy="102" rx="49" ry="34"/><path d="M25 73Q-4 53 15 25L24 44L39 28Q54 57 25 73M137 73Q110 54 124 28L138 44L147 25Q168 54 137 73"/></g><path d="M62 81V64M99 81V64" stroke="#ff8a73" stroke-width="12"/>'+eyes+smile,
 dragon: '<path d="M47 91L7 51L8 113L48 120M112 91L153 51L152 115L112 120" fill="#8160c5"/><ellipse cx="80" cy="111" rx="37" ry="38" fill="#353145"/><path d="M40 49L26 10L65 31M103 30L137 9L121 53" fill="#353145"/><ellipse cx="80" cy="63" rx="50" ry="40" fill="#443c59"/><ellipse cx="80" cy="119" rx="23" ry="25" fill="#b29ccd"/>'+eyes+smile+'<path d="M51 137L34 149M106 137L123 149" stroke="#443c59" stroke-width="15" stroke-linecap="round"/>',
 cat: '<path d="M38 51L34 9L67 31M95 31L127 9L124 55" fill="#ffc78f"/><ellipse cx="80" cy="111" rx="32" ry="37" fill="#ffc78f"/><path d="M106 125Q157 147 139 99" stroke="#ffc78f" stroke-width="15" fill="none"/><ellipse cx="80" cy="66" rx="48" ry="39" fill="#ffd6a6"/>'+eyes+smile+'<path d="M43 81L17 76M43 89L16 94M116 81L143 76M116 89L145 94" stroke="#d09169" stroke-width="3"/><path d="M58 133L41 147M99 133L116 147" stroke="#ffc78f" stroke-width="16" stroke-linecap="round"/>',
 frog: '<ellipse cx="80" cy="113" rx="36" ry="36" fill="#8bc958"/><ellipse cx="80" cy="76" rx="51" ry="35" fill="#b4e879"/><circle cx="57" cy="53" r="23" fill="#b4e879"/><circle cx="104" cy="53" r="23" fill="#b4e879"/>'+eyes+smile+'<ellipse cx="80" cy="119" rx="25" ry="22" fill="#e1f4ac"/><path d="M53 117L21 141L52 145M108 117L140 141L109 145" stroke="#8bc958" stroke-width="13" fill="none" stroke-linecap="round"/>',
};
export function character(theme) {
 return `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">${drawings[theme] || drawings.cat}<path d="M65 27L81 3L98 27Z" fill="#ffdf83"/><circle cx="81" cy="5" r="4" fill="#fff2ba"/></svg>`;
}
