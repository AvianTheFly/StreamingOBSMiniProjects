// state.js — Reactive app state with subscriber pattern

const _state = {
  projects:     [],   // list of ProjectStatus dicts from API
  connected:    false,
  lastUpdated:  null,
};

const _watchers = {};

function get(key) {
  return key ? _state[key] : { ..._state };
}

function set(updates) {
  let changed = false;
  for (const [k, v] of Object.entries(updates)) {
    if (_state[k] !== v) {
      _state[k] = v;
      changed = true;
      (_watchers[k] ?? []).forEach(cb => { try { cb(v); } catch(e) {} });
    }
  }
  if (changed) {
    (_watchers["*"] ?? []).forEach(cb => { try { cb(_state); } catch(e) {} });
  }
}

function watch(key, cb) {
  (_watchers[key] ??= []).push(cb);
  return () => {
    _watchers[key] = (_watchers[key] ?? []).filter(f => f !== cb);
  };
}

/** Return a project status by name (or undefined). */
function getProject(name) {
  return _state.projects.find(p => p.name === name);
}

export const state = { get, set, watch, getProject };
