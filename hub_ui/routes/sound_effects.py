"""Feature-specific HTTP adapter; no runtime state ownership."""
from pathlib import Path
from hub_ui import updates

class SoundEffectRoutes:
    def _sfx_library(self):
        try:
            from sound_effects.config import CONFIG
            asset_dir = Path(str(CONFIG.asset_dir))
            if not asset_dir.exists():
                self._json(200, [])
                return
            exts = set(getattr(CONFIG, "valid_extensions", {".mp3", ".wav", ".mp4"}))
            files = sorted(
                f.stem for f in asset_dir.iterdir()
                if f.is_file() and f.suffix.lower() in exts
            )
            self._json(200, files)
        except Exception as exc:
            self._err(500, str(exc))


    def _sfx_post(self, action: str, body: dict):
        if action == "play":
            source = body.get("source", "")
            if not source:
                self._err(400, "source required")
                return
            try:
                import events as hub_events
                hub_events.emit("sfx.play", source=source)
                self._json(200, {"ok": True})
            except Exception as exc:
                self._err(500, str(exc))
        else:
            self._err(404, f"Unknown action: {action}")

