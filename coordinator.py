"""Compatibility imports; cross-project ownership lives in lib.coordination.

New feature code uses coordinator.request() and finishes its PlaybackTicket
only after source cleanup. Scene policy belongs to features; ownership belongs
in the shared scene director.
"""
from lib.coordination.rules import CoordinationRule
from lib.coordination.playback import PlayCoordinator, PlaybackTicket, coordinator
from lib.coordination.scene_session import SceneSession

__all__ = ['CoordinationRule', 'PlayCoordinator', 'PlaybackTicket', 'SceneSession', 'coordinator']
