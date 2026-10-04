"""Feature-owned living-world catalog and protected display apertures.

Each registered world retains its original painting beneath a transparent layer.
Unregistered worlds keep their authored layers until their choreography is ready.
"""
import json
from urllib.parse import urlencode

WORLDS = {'ReefLobby': 'reef', 'ForgeLobby': 'forge', 'SanctuaryLobby': 'sanctuary',
          'SkyHarborLobby': 'sky-harbor', 'StormCoastLobby': 'storm-coast',
          'PhoenixObservatoryLobby': 'phoenix-observatory', 'SpiritRailLobby': 'spirit-rail',
          'TavernWorldLobby': 'tavern', 'FutureWorldLobby': 'future',
          'SpiritArcadeLobby': 'arcade', 'AuroraCampLobby': 'aurora-camp'}


def layer(name, placement):
    world = WORLDS.get(name)
    if world is None:
        return None
    holes = [placement[key] for key in ('screen', 'camera', 'chat')]
    query = urlencode({'world': world, 'holes': json.dumps(holes, separators=(',', ':'))})
    return {'source': name + ' Living World', 'kind': 'browser_source', 'configure': True,
            'settings': {'url': 'http://127.0.0.1:7420/lobby-motion/index.html?' + query,
                         'width': 1920, 'height': 1080, 'fps': 24,
                         'shutdown': True, 'restart_when_active': True}}
