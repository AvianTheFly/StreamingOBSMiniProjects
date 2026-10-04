"""Scene queries and compatibility commands; scene writes belong to the director."""
from __future__ import annotations


from .client import get_obs


def switch_scene(scene: str, *, owner: str = 'manual', reason: str = '') -> bool:
    """Deliberate scene selection through the shared director.

    Automatic features use scene_director.request(..., automatic=True).
    """
    from lib.coordination.scenes import scene_director
    return scene_director.request(scene, owner=owner, reason=reason, automatic=False)

def get_current_scene() -> str:
    return get_obs().get_current_program_scene().current_program_scene_name

def list_scenes() -> list[str]:
    return [s["sceneName"] for s in get_obs().get_scene_list().scenes]

def create_scene_if_missing(scene: str) -> bool:
    """
    Create an OBS scene if it does not already exist.
    Returns True if it was created, False if it already existed.
    """
    try:
        existing = list_scenes()
        if scene in existing:
            return False
        get_obs().create_scene(scene)
        print(f"[OBS] Created scene: {scene!r}")
        return True
    except Exception as e:
        print(f"[OBS] create_scene_if_missing failed for {scene!r}: {e}")
        return False
