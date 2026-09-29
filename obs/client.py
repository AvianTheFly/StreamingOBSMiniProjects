# obs/client.py
#
# Holds the single OBS WebSocket connection for the whole hub.
# Mini-projects never connect themselves - they call get_obs() instead.

from __future__ import annotations

import threading
import logging
import time
from json import JSONDecodeError

import obsws_python as obs
from obsws_python.error import OBSSDKRequestError, OBSSDKTimeoutError
from websocket import WebSocketException

from .obs_config import OBS_HOST, OBS_PORT, OBS_PASSWORD

_lock = threading.RLock()
_client: obs.ReqClient | None = None
_retry_at = 0.0
_retry_delay = 1.0
_offline = False


class OBSUnavailable(RuntimeError):
    """OBS is closed or temporarily not ready; callers may try again later."""


class _ExpectedErrors(logging.Filter):
    def filter(self, record):
        exc = record.exc_info[1] if record.exc_info else None
        # These conditions are handled at the shared connection boundary.
        if isinstance(exc, (OSError, WebSocketException)):
            return False
        if isinstance(exc, OBSSDKRequestError):
            if exc.code == 207:
                return False
            if exc.code == 604 and exc.req_name in {
                'GetInputVolume', 'GetInputMute', 'GetInputAudioMonitorType',
            }:
                return False
        return True


for _logger_name in ('obsws_python.reqs.ReqClient', 'obsws_python.baseclient.ObsClient'):
    logging.getLogger(_logger_name).addFilter(_ExpectedErrors())


def _disconnected():
    global _client, _retry_at, _retry_delay, _offline
    old, _client = _client, None
    if old is not None:
        try:
            object.__getattribute__(old, '_client').base_client.ws.close()
        except Exception:
            pass
    _retry_at = time.monotonic() + _retry_delay
    _retry_delay = min(30.0, _retry_delay * 2)
    if not _offline:
        print('[OBS] Disconnected or not ready. Waiting to reconnect automatically.')
    _offline = True


class _ThreadSafeReqClient:
    """Serialize access to the shared OBS websocket client."""

    def __init__(self, client: obs.ReqClient):
        object.__setattr__(self, "_client", client)
        object.__setattr__(self, "_no_audio", {})

    def __getattr__(self, name):
        target = getattr(object.__getattribute__(self, "_client"), name)
        if not callable(target):
            return target

        def _locked_call(*args, **kwargs):
            with _lock:
                # Long-lived project references must follow the new connection.
                active = get_obs()
                if active is not self:
                    return getattr(active, name)(*args, **kwargs)
                cache = object.__getattribute__(self, '_no_audio')
                source = args[0] if args else kwargs.get('name', kwargs.get('input_name'))
                audio_read = name in {'get_input_volume', 'get_input_mute', 'get_input_audio_monitor_type'}
                if audio_read and source in cache:
                    if time.monotonic() < cache[source]:
                        raise OBSSDKRequestError(name, 604, 'The specified input does not support audio.')
                    del cache[source]
                try:
                    return target(*args, **kwargs)
                except OBSSDKRequestError as exc:
                    if exc.code == 604 and audio_read:
                        cache[source] = time.monotonic() + 30
                    if exc.code != 207:
                        raise
                    _disconnected()
                    raise OBSUnavailable('OBS is offline or not ready') from exc
                except (OSError, WebSocketException, JSONDecodeError, OBSSDKTimeoutError) as exc:
                    _disconnected()
                    raise OBSUnavailable('OBS is offline or not ready') from exc

        return _locked_call

    def __setattr__(self, name, value):
        if name in {"_client", "_no_audio"}:
            object.__setattr__(self, name, value)
            return
        setattr(object.__getattribute__(self, "_client"), name, value)


def get_obs() -> obs.ReqClient:
    """
    Return the shared OBS ReqClient, creating it on first call.
    Thread-safe. Raises RuntimeError if connection fails.
    """
    global _client, _retry_delay, _offline
    with _lock:
        if _client is None:
            if time.monotonic() < _retry_at:
                raise OBSUnavailable('OBS is offline or not ready')
            try:
                _client = _connect()
            except Exception as exc:
                _disconnected()
                raise OBSUnavailable(f'OBS connection unavailable: {exc}') from exc
            _retry_delay = 1.0
            _offline = False
        return _client


def reset_obs() -> None:
    """Force a reconnect on the next get_obs() call (e.g. after a timeout)."""
    global _retry_at
    with _lock:
        _disconnected()
        _retry_at = 0.0


def _connect() -> obs.ReqClient:
    raw_client = None
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
        if raw_client is not None:
            try:
                raw_client.base_client.ws.close()
            except Exception:
                pass
        raise RuntimeError(f"[OBS] Connection failed: {e}")
