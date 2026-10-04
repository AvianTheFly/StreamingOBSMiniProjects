"""Playback policy values, independent of workers, UI, and persistence."""
from dataclasses import dataclass, field


@dataclass
class CoordinationRule:
    requester: str
    pause: list[str] = field(default_factory=list)
    resume_on_finish: bool = True
