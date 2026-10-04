"""Shared hotkey, voice and music helpers used by mini-projects.

Project interface contracts and the live registry are re-exported from
lib.project_runtime for compatibility with existing `from shared import ...` code.
"""

from lib.key_sequences import SequenceTrigger
# Compatibility exports: all callers share the same registry and interface types.
from lib.project_runtime import (
    ProjectInterface,
    ProjectStatus,
    _ProjectRegistry,
    project_registry,
)



# Compatibility export; session ownership lives in the voice package.
from voice.ptt import VoicePTT


# Legacy public import; the implementation has one responsibility and one instance.
from lib.music_service import _MusicService, music_service
