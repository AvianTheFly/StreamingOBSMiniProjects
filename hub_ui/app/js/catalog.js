// Presentation metadata only. Feature APIs own state and behavior.
import { displayName, esc } from './utils.js';

const PATHS = {
  desk: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 10h18M10 10v11"/>',
  library: '<rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="16" rx="2"/><path d="M6 8h1M17 8h1"/>',
  audio: '<path d="M5 4v16M12 4v16M19 4v16"/><path d="M2 9h6M9 15h6M16 8h6"/>',
  replay: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/><path d="m11 9 5 3-5 3Z"/>',
  scene: '<rect x="3" y="4" width="18" height="14" rx="3"/><path d="M8 22h8M12 18v4m-3-11 2 2 4-4"/>',
  music: '<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',
  soundboard: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 7h2v2H7zm8 0h2v2h-2zM7 15h2v2H7zm8 0h2v2h-2z"/>',
  automation: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.1M10 9h.1M14 9h.1M18 9h.1M6 13h.1M10 13h.1M14 13h.1M18 13h.1M8 16h8"/>',
  voice: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  settings: '<path d="M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2"/><circle cx="12" cy="12" r="5"/>',
  play: '<path d="m8 4 13 8-13 8Z"/>',
  save: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chart: '<path d="M4 3v18h17M8 16v-4m5 4V7m5 9v-6"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
  chat: '<path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z"/><path d="M8 10h8M8 14h5"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
};
export function icon(name, className = '') {
  return `<svg class="ui-icon ${esc(className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || PATHS.spark}</svg>`;
}
export const FEATURES = {
  twitch_commands: { label: 'Chat commands', icon: 'chat', group: 'Automatic & community', description: 'Edit your Twitch replies, aliases, permissions and cooldowns.', keywords: 'bot opgg discord commands twitch' },
  instant_replay: { label: 'Replay studio', icon: 'replay', group: 'Clips & media', description: 'Save moments, preview clips and build highlights.', keywords: 'instant replay recording trim clip' },
  starting_soon: { label: 'Starting soon', icon: 'play', group: 'On screen', description: 'Set the mood with a waiting room and clip playlist.' },
  specific_song: { label: 'Music', icon: 'music', group: 'Clips & media', description: 'Find a song, play it and manage your music library.' },
  soundboard: { label: 'Soundboard', icon: 'soundboard', group: 'Clips & media', description: 'Trigger your sounds and effects. Edit keys and phrases.' },
  sound_effects: { label: 'Sound effects', icon: 'audio', group: 'Clips & media', description: 'Browse and play short audio cues.' },
  tik_tok: { label: 'TikTok clips', icon: 'play', group: 'Clips & media', description: 'Play short videos and manage their triggers.' },
  scene_voice_switcher: { label: 'Scenes & lobbies', icon: 'scene', group: 'On screen', description: 'Choose the view in OBS or change your lobby.', keywords: 'scene voice switcher game desktop capture' },
  spotify: { label: 'Spotify overlay', icon: 'music', group: 'On screen', description: 'Show the current song with a reactive visualizer.' },
  love_me: { label: 'Mood cues / Love Me', icon: 'spark', group: 'On screen', description: 'Original Love Me plus transparent music moments, variations, hotkeys and cue timing.' },
  league_api: { label: 'League alerts', icon: 'automation', group: 'Automatic & community', description: 'Configure game events, alert media and presentation.', keywords: 'api production league' },
  league: { label: 'League events', icon: 'automation', group: 'Automatic & community', description: 'Manage the overlays and audio driven by your game.' },
  league_stats: { label: 'League stats', icon: 'chart', group: 'Automatic & community', description: 'Review games, records and viewer stat requests.' },
  twitch_celebrations: { label: 'Twitch celebrations', icon: 'spark', group: 'Automatic & community', description: 'Manage shows for subscribers, cheers and raids.', href: 'http://127.0.0.1:7443' },
};
export const TOOLS = [
  { id: 'chat', label: 'Chat overlay', icon: 'chat', group: 'Automatic & community', description: 'Style chat, stickers and the desktop overlay.', href: '/chat/' },
  { id: 'transitions', label: 'Spirit transitions', icon: 'spark', group: 'On screen', description: 'Preview the animal transitions between scenes.', href: '/transitions/' },
  { id: 'rewards', label: 'Channel rewards', icon: 'spark', group: 'Automatic & community', description: 'Manage viewer redemptions and reward playback.', href: 'http://127.0.0.1:7442' },
  { id: 'editor', label: 'Media & hotkey editor', icon: 'keyboard', group: 'Clips & media', description: 'Organize assets, voice phrases, keys and OBS placement.', href: '/editor' },
];
export const GROUPS = ['Clips & media', 'On screen', 'Automatic & community'];
export function feature(name) {
  return { id: name, href: `#projects/${name}`, ...FEATURES[name], label: FEATURES[name]?.label || displayName(name), icon: FEATURES[name]?.icon || 'spark', group: FEATURES[name]?.group || 'Other tools', description: FEATURES[name]?.description || 'Open this feature’s controls and settings.' };
}
export function destinations(projects) {
  return [
    { id: 'dashboard', label: 'Live desk', icon: 'desk', description: 'Scenes, quick actions and current activity', href: '#dashboard' },
    { id: 'library', label: 'Library & tools', icon: 'library', description: 'Browse all stream features', href: '#library' },
    { id: 'workflows', label: 'Stream map', icon: 'automation', description: 'See how your stream connects, then open a smaller map', href: '#workflows' },
    { id: 'mixer', label: 'Audio · OBS sources', icon: 'audio', description: 'Live source volume and mute controls', href: '#mixer' },
    { id: 'audio', label: 'Audio · saved media', icon: 'audio', description: 'Project, profile and per-file levels', href: '#audio' },
    ...projects.map(p => feature(p.name)), ...TOOLS,
    { id: 'rules', label: 'Automation rules', icon: 'automation', description: 'How features work together', href: '#rules' },
    { id: 'profiles', label: 'Hotkeys & profiles', icon: 'keyboard', description: 'Saved bindings and trigger sequences', href: '#profiles' },
    { id: 'voice', label: 'Voice & microphone', icon: 'voice', description: 'Voice recognition and microphone controls', href: '#voice' },
    { id: 'settings', label: 'Hub settings', icon: 'settings', description: 'Preferences and advanced configuration', href: '#settings' },
  ];
}
