# specific_song/obs_helpers.py
#
# Compatibility shim — all logic now lives in obs/interaction.py.
# New code should import directly from obs instead of this file.

from obs import get_scene_item_id
from obs import get_source_transform as get_scene_item_transform
from obs import set_source_transform as set_scene_item_transform

__all__ = ["get_scene_item_id", "get_scene_item_transform", "set_scene_item_transform"]
