const stage = document.querySelector('#stage');
const names = { astral:'ASTRAL OBSERVATORY', tidal:'TIDAL VAULT', neon:'NEON CONCOURSE', frost:'FROST SANCTUM', verdant:'VERDANT ENGINE' };
const keys = ['allies','enemies','allyBans','enemyBans'];
const slots = {};
let previous = new Map();

function makeSlots(key) {
  const container = document.querySelector('#' + (key === 'allyBans' ? 'ally-bans' : key === 'enemyBans' ? 'enemy-bans' : key));
  slots[key] = [];
  for (let i = 0; i < 5; i++) {
    const item = document.createElement('div');
    item.className = key.endsWith('Bans') ? 'ban' : 'pick';
    if (!key.endsWith('Bans')) {
      const number = document.createElement('span'); number.className = 'number'; number.textContent = String(i + 1);
      const name = document.createElement('span'); name.className = 'name';
      item.append(number, name);
    }
    container.append(item); slots[key].push(item);
  }
}
keys.forEach(makeSlots);

function image(src) {
  const img = document.createElement('img');
  img.src = src; img.alt = ''; img.onerror = () => img.remove();
  return img;
}
function renderSlot(key, i, data, localSlot) {
  const item = slots[key][i], champion = Number(data?.championId) || 0;
  const locked = !!data?.locked;
  const signature = champion + ':' + locked;
  if (previous.get(key + i) === signature) return;
  previous.set(key + i, signature);
  item.querySelector('img')?.remove();
  item.classList.remove('filled','locked','tentative');
  if (!champion) {
    if (!key.endsWith('Bans')) item.querySelector('.name').textContent = '';
    return;
  }
  const ban = key.endsWith('Bans');
  if (data[ban ? 'image' : 'portrait']) item.prepend(image(data[ban ? 'image' : 'portrait']));
  if (!ban) {
    item.querySelector('.name').textContent = data.name || `CHAMPION ${champion}`;
    item.querySelector('.tag')?.remove();
    if (key === 'allies' && i === localSlot) {
      const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = 'YOU'; item.append(tag);
    }
  }
  // Restart the short reveal for an actual change, including tentative -> locked.
  void item.offsetWidth;
  item.classList.add('filled');
  if (locked) item.classList.add('locked'); else item.classList.add('tentative');
}
function renderChat(messages) {
  const box = document.querySelector('#chat-messages');
  const signature = JSON.stringify(messages.map(m => [m.id,m.body,m.sender]));
  if (box.dataset.signature === signature) return;
  box.dataset.signature = signature;
  box.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement('p'); empty.className = 'empty-chat'; empty.textContent = 'Team chat will appear here.'; box.append(empty); return;
  }
  for (const entry of messages.slice(-6)) {
    const line = document.createElement('div'); line.className = 'message';
    const sender = document.createElement('span'); sender.className = 'sender'; sender.textContent = entry.sender || 'TEAM';
    const body = document.createElement('span'); body.textContent = entry.body || '';
    line.append(sender, body); box.append(line);
  }
}
function render(state) {
  const theme = names[state.theme] ? state.theme : 'astral';
  if (stage.dataset.theme !== theme) {
    stage.dataset.theme = theme;
    stage.querySelector('.world').style.backgroundImage = `url('/champ-select/backgrounds/${theme}.jpg')`;
    stage.querySelector('.world').style.webkitMaskImage = `url('/champ-select/masks/${theme}.svg')`;
    stage.querySelector('.world').style.maskImage = `url('/champ-select/masks/${theme}.svg')`;
    document.querySelector('#theme-name').textContent = names[theme];
  }
  stage.classList.toggle('hidden', !state.visible);
  const draft = state.draft || {};
  for (const key of keys) {
    for (let i = 0; i < 5; i++) renderSlot(key, i, draft[key]?.[i], draft.localSlot);
  }
  const seconds = Number(draft.seconds);
  document.querySelector('#timer').textContent = Number.isFinite(seconds) && draft.seconds !== null ? `${Math.max(0,seconds)} SEC` : 'PICKS';
  renderChat(state.chat || []);
}

const params = new URLSearchParams(location.search);
if (params.get('demo') === '1') {
  stage.classList.add('demo');
  const theme = names[params.get('theme')] ? params.get('theme') : 'astral';
  const sample = (id,name,locked=true) => ({championId:id,name,locked,image:`/champ-select/icons/${id}.png`,portrait:`/champ-select/portraits/${id}.jpg`});
  const blank = () => ({championId:0,locked:false});
  render({visible:true,theme,draft:{
    allies:[sample(266,'Aatrox'),sample(103,'Ahri'),sample(84,'Akali',false),blank(),blank()],
    enemies:[sample(157,'Yasuo'),sample(22,'Ashe'),sample(64,'Lee Sin',false),blank(),blank()],
    allyBans:[sample(238,'Zed'),sample(555,'Pyke'),sample(777,'Yone'),sample(119,'Draven'),sample(412,'Thresh')],
    enemyBans:[sample(234,'Viego'),sample(107,'Rengar'),sample(121,'Kha’Zix'),sample(81,'Ezreal'),sample(11,'Master Yi')],
    localSlot:1,seconds:28},chat:[{id:'1',sender:'TEAM',body:'We have a strong front line.'},{id:'2',sender:'YOU',body:'I can take mid.'},{id:'3',sender:'TEAM',body:'Let’s lock this in.'}]});
} else {
  async function poll() {
    try {
      const response = await fetch('/champ-select/state', {cache:'no-store'});
      if (response.ok) render(await response.json());
    } catch { /* Keep last known picture during a short Hub reconnect. */ }
    setTimeout(poll, 500);
  }
  poll();
}
