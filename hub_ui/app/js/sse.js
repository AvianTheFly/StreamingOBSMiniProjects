// sse.js — Auto-reconnecting SSE client; dispatches typed events to listeners

const _listeners = {};

let _es = null;
let _reconnectTimer = null;

function subscribe(type, cb) {
  (_listeners[type] ??= []).push(cb);
}

function unsubscribe(type, cb) {
  if (!_listeners[type]) return;
  _listeners[type] = _listeners[type].filter(f => f !== cb);
}

function _dispatch(type, payload) {
  (_listeners[type] ?? []).forEach(cb => {
    try { cb(payload); } catch (e) { console.error("[sse] listener error", e); }
  });
  (_listeners["*"] ?? []).forEach(cb => {
    try { cb(type, payload); } catch (e) { console.error("[sse] wildcard error", e); }
  });
}

function connect(onConnect, onDisconnect) {
  if (_es) { _es.close(); _es = null; }

  _es = new EventSource("/api/events");

  _es.onopen = () => {
    clearTimeout(_reconnectTimer);
    if (onConnect) onConnect();
  };

  _es.onmessage = (e) => {
    try {
      const { type, payload } = JSON.parse(e.data);
      _dispatch(type, payload);
    } catch (err) {
      console.warn("[sse] parse error", err);
    }
  };

  _es.onerror = () => {
    _es.close();
    _es = null;
    if (onDisconnect) onDisconnect();
    _reconnectTimer = setTimeout(() => connect(onConnect, onDisconnect), 3000);
  };
}

export const sse = { connect, subscribe, unsubscribe };
