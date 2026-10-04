"""Saved replay inventory, game/tag views, and clip lookup."""
from __future__ import annotations
from pathlib import Path
from .config import CLIPS_DIR
from .config import EDITED_DIR
from .config import REPLAY_DIR
from .config import TRIMMED_SUFFIX
from .commands import _match_tag

_REPLAY_MEDIA_EXTENSIONS = {".mkv", ".mp4", ".mov", ".webm"}


def replay_files(root, *, highlights_only=False) -> list[Path]:
    """One inventory for playback and offline management, with linked copies hidden."""
    root = Path(root)
    if not root.is_dir():
        return []
    files = [path for path in root.iterdir() if path.is_file() and path.suffix.lower() in _REPLAY_MEDIA_EXTENSIONS]
    for folder in (root / 'clips', root / 'edited', root / 'replay-only', root / 'cuts'):
        if folder.is_dir():
            files.extend((path for path in folder.rglob('*') if path.is_file() and path.suffix.lower() in _REPLAY_MEDIA_EXTENSIONS))
    files = [path for path in files if path.name.endswith(TRIMMED_SUFFIX) or not path.with_name(path.stem + TRIMMED_SUFFIX).is_file()]
    from . import library
    labels = library.read()['clips']
    linked_sources = {str(Path(m['capture_source']).resolve()) for m in labels.values()
                      if m.get('capture_source') and Path(m.get('path', '')).is_file()}
    files = [p for p in files if str(p.resolve()) not in linked_sources]
    if highlights_only:
        files = [p for p in files if library.highlight_candidate(labels.get(library.clip_id(p), {}))]
    return sorted(files, key=lambda path: path.stat().st_mtime, reverse=True)


def _replay_files_on_disk(*, highlights_only=False) -> list[Path]:
    """Compatibility for existing selection and playback callers."""
    return replay_files(REPLAY_DIR, highlights_only=highlights_only)

class ReplayInventory:

    def __init__(self, state):
        self.state = state

    def _list_clips(self) -> list[dict]:
        """Return saved replay files, newest first, for the Hub UI."""
        with self.state._lock:
            current = {str(Path(item['path']).resolve()): dict(item) for item in self.state._clip_registry}
            previous = {str(Path(item['path']).resolve()): dict(item) for item in self.state._previous_game_clips}
        from . import library
        persisted = library.read()['clips']
        rows = []
        edited_root = Path(EDITED_DIR).resolve()
        for path in _replay_files_on_disk():
            try:
                resolved = path.resolve()
                stat = path.stat()
            except OSError:
                continue
            key = str(resolved)
            metadata = current.get(key) or previous.get(key) or persisted.get(library.clip_id(resolved), {})
            scope = 'current game' if key in current else 'previous game' if key in previous else 'saved'
            try:
                if resolved.is_relative_to(edited_root):
                    scope = 'highlight reel'
            except ValueError:
                pass
            rows.append({'name': path.name, 'path': str(resolved), 'tag': str(metadata.get('tag') or ''), 'saved_at': float(metadata.get('saved_at') or stat.st_mtime), 'size_bytes': int(stat.st_size), 'scope': scope})
        return rows

    def _get_most_recent_clip(self) -> list[str]:
        """Return [path] or [] if no clips."""
        with self.state._lock:
            if self.state._clip_registry:
                return [self.state._clip_registry[-1]['path']]
        files = _replay_files_on_disk()
        return [str(files[0])] if files else []

    def _get_all_clips_in_order(self) -> list[str]:
        with self.state._lock:
            return [e['path'] for e in self.state._clip_registry]

    def _resolve_play_spec(self, spec: str) -> list[str]:
        """
        Resolve a play spec like "win", "win 2", "escape" to a list of clip paths.
        Returns [] if nothing matches.  Uses the same fuzzy tag matcher as save.
        """
        parts = spec.lower().split()
        raw_tag = parts[0].rstrip('.,!?;:\'"')
        tag = _match_tag(raw_tag) or raw_tag
        _WORD_TO_NUM = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10}
        number: int | None = None
        if len(parts) >= 2:
            raw_num = parts[1].rstrip('.,!?;:\'"')
            try:
                number = int(raw_num)
            except ValueError:
                number = _WORD_TO_NUM.get(raw_num)
        with self.state._lock:
            matches = [e for e in self.state._clip_registry if e['tag'].lower() == tag]
        if not matches:
            from . import library
            persisted = library.tagged_paths(tag, REPLAY_DIR)
            if number is not None:
                return [persisted[number - 1]] if 0 < number <= len(persisted) else []
            return [persisted[-1]] if persisted else library.search_paths(spec, REPLAY_DIR)
        matches.sort(key=lambda e: e['saved_at'])
        if number is not None:
            idx = number - 1
            if 0 <= idx < len(matches):
                return [matches[idx]['path']]
            return []
        return [matches[-1]['path']]

    def _format_tag_summary(self) -> str:
        with self.state._lock:
            counts: dict[str, int] = {}
            for entry in self.state._clip_registry:
                t = entry['tag']
                counts[t] = counts.get(t, 0) + 1
            if not counts:
                return '(none)'
            return ', '.join((f'{t}: {c}' for t, c in counts.items()))
