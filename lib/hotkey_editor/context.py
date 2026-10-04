"""Editor session references and immutable paths; no sockets or background work."""
from dataclasses import dataclass
from pathlib import Path
from lib.paths import PROJECT_ROOT as _PROJECT_ROOT
_EDITOR_DIR = Path(__file__).resolve().parent
_EDITOR_HTML = _EDITOR_DIR / 'editor.html'
_VIDEO_EXTS = {'.mp4', '.mov', '.mkv', '.avi', '.webm', '.flv', '.ts', '.m4v'}
_PENDING_MOVES_FILE = _PROJECT_ROOT / 'pending_moves.json'

@dataclass
class EditorContext:
    current: dict
    projects: list
    server_ref: list
