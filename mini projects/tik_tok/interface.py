from __future__ import annotations

from shared_media.media_project import create_project_interface
from .config import CONFIG
from .main import _live

interface = create_project_interface(
    project_name=CONFIG.project_name,
    controlled_scenes=[CONFIG.scene],
    live_state=_live,
)