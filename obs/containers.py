"""Enumerate scene or group children without changing their presentation."""
from obsws_python.error import OBSSDKRequestError


def container_items(client, name):
    """Return the usual SDK response for either kind of OBS container.

    OBS reports resource-type mismatch (602) for a group passed to the scene
    getter. Only that error permits the group getter; missing resources and
    transport failures remain visible to callers. No inventory is cached across
    collection changes.
    """
    try:
        return client.get_scene_item_list(name)
    except OBSSDKRequestError as error:
        if error.code != 602:
            raise
        return client.get_group_scene_item_list(name)


def is_group(client, name):
    """Resolve the current resource type without retaining collection state."""
    return name in client.get_group_list().groups
