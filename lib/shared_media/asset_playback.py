"""OBS playback of one asset; scheduling and profile selection belong to callers.

The source worker owns this call until it finishes. Settings callbacks read the
current project/profile values, while this component owns applying asset state,
starting media, waiting, saving overrides and parking the physical source.
"""
from lib.runtime_cleanup import run_cleanup


class AssetPlayback:
    def __init__(self, cfg, *, obs_api, start_source, state_for, apply_media,
                 apply_audio, layout_for):
        self.cfg = cfg
        self.obs = obs_api
        self.start_source = start_source
        self.state_for = state_for
        self.apply_media = apply_media
        self.apply_audio = apply_audio
        self.layout_for = layout_for

    def play(self, stem, path, source, *, cancelled, allowed=None):
        store = self.state_for(source)
        loaded = False
        try:
            if cancelled():
                return
            if store is not None:
                store.apply_for_stem(stem)
            self.apply_media(source)
            self.apply_audio(source, stem)
            if not (store and store.has_transform_override(stem)):
                transform = self.layout_for(stem, path)
                if transform:
                    try:
                        self.obs.set_source_transform(self.cfg.scene, source, transform)
                    except Exception as exc:
                        print(f"[{self.cfg.project_name}] Could not apply layout for '{stem}': {exc}")
            if cancelled():
                return
            shared = bool(getattr(self.cfg, 'single_source_mode', False))
            settle = max(0, int(getattr(self.cfg, 'media_swap_settle_ms', 0) or 0)) if shared else 0
            loaded = self.start_source(scene=self.cfg.scene, source_name=source,
                filepath=path, start_timeout=self.cfg.media_start_timeout,
                swap_settle_ms=settle, cancelled=cancelled)
            if not loaded:
                raise RuntimeError(f"Source '{source}' did not start playback")
            if shared:
                self.apply_audio(source, stem)
            options = {'allowed': allowed} if allowed is not None else {}
            self.obs.wait_for_media_end(source, start_timeout=self.cfg.media_start_timeout,
                total_timeout=self.cfg.media_total_timeout, cancelled=cancelled, **options)
        except Exception as exc:
            if not cancelled():
                print(f"[{self.cfg.project_name}] Playback failed for '{source}': {exc}")
        finally:
            actions = []
            if loaded and store is not None:
                actions.append(lambda: store.capture_override_for_stem(stem))
            actions.append(lambda: self.obs.park_media_source(self.cfg.scene, source))
            run_cleanup(self.cfg.project_name, *actions)
