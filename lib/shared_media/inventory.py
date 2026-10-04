"""Map configured asset files to their physical OBS source names."""
from __future__ import annotations
from pathlib import Path
from .media_config import MediaProjectConfig


def build_name_index(
    cfg: MediaProjectConfig,
    single_source_name: str | None = None,
) -> dict[str, tuple[Path, str]]:
    """
    Scan asset_dir and return:
        {lower_stem: (filepath, obs_source_name)}

    When ``single_source_name`` is provided (single-source mode), every stem
    maps to that same OBS source instead of one source per file.
    """
    index: dict[str, tuple[Path, str]] = {}

    if not cfg.asset_dir.is_dir():
        print(f"[{cfg.project_name}] Assets dir not found: {cfg.asset_dir}")
        return index

    for p in cfg.asset_dir.iterdir():
        if p.is_file() and p.suffix.lower() in cfg.valid_extensions:
            obs_name = single_source_name or f"{cfg.obs_source_prefix}{p.stem}"
            index[p.stem.lower()] = (p, obs_name)

    return index
