# obs/client.py
#
# Holds the single OBS WebSocket connection for the whole hub.
# Mini-projects never connect themselves - they call get_obs() instead.

from __future__ import annotations

import threading

import obsws_python as obs

from .obs_config import OBS_HOST, OBS_PORT, OBS_PASSWORD

_lock: threading.Lock = threading.Lock()
_client: obs.ReqClient | None = None


class _ThreadSafeReqClient:
    """Serialize access to the shared OBS websocket client."""

    def __init__(self, client: obs.ReqClient):
        object.__setattr__(self, "_client", client)
        object.__setattr__(self, "_request_lock", threading.RLock())

    def __getattr__(self, name):
        target = getattr(object.__getattribute__(self, "_client"), name)
        if not callable(target):
            return target

        def _locked_call(*args, **kwargs):
            with object.__getattribute__(self, "_request_lock"):
                return target(*args, **kwargs)

        return _locked_call

    def __setattr__(self, name, value):
        if name in {"_client", "_request_lock"}:
            object.__setattr__(self, name, value)
            return
        setattr(object.__getattribute__(self, "_client"), name, value)


def get_obs() -> obs.ReqClient:
    """
    Return the shared OBS ReqClient, creating it on first call.
    Thread-safe. Raises RuntimeError if connection fails.
    """
    global _client
    with _lock:
        if _client is None:
            _client = _connect()
    return _client


def reset_obs() -> None:
    """Force a reconnect on the next get_obs() call (e.g. after a timeout)."""
    global _client
    with _lock:
        _client = None


def _connect() -> obs.ReqClient:
    try:
        raw_client = obs.ReqClient(
            host=OBS_HOST, port=OBS_PORT, password=OBS_PASSWORD, timeout=10
        )
        raw_client.get_version()   # sanity-check the connection
        print(f"[OBS] Connected to {OBS_HOST}:{OBS_PORT}")
        return _ThreadSafeReqClient(raw_client)
    except ImportError:
        raise RuntimeError("obsws-python not installed - run: pip install obsws-python")
    except Exception as e:
        raise RuntimeError(f"[OBS] Connection failed: {e}")
