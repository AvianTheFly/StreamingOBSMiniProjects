"""Authored lobby artwork, display apertures and legacy location aliases."""
from pathlib import Path

ART = Path(__file__).with_name('art')
REPLACEMENTS = {'TavernLobby': 'TavernWorldLobby', 'FutureLobby': 'FutureWorldLobby'}
FLAT_LOCATIONS = {'SpiritArcadeLobby', 'AuroraCampLobby'}
# OBS canvas pixels: screen, host above the counter, chat board.
LAYOUTS = {
    'ForgeLobby': ('forge', 'Spirit forge', 'Amber smithy and molten spirit steel.', (60, 180, 896, 504), (980, 450, 460, 460), (1463,203,317,470)),
    'SanctuaryLobby': ('sanctuary', 'Forest sanctuary', 'Moss, rain and a quiet spirit shrine.', (60, 180, 896, 504), (980, 340, 475, 470), (1510,220,215,431)),
    'SkyHarborLobby': ('sky-harbor', 'Sky harbor', 'An airship port above the clouds.', (60, 180, 896, 504), (980, 425, 450, 475), (1465,186,323,466)),
    'StormCoastLobby': ('storm-coast', 'Storm coast', 'A warm retreat overlooking the storm.', (60, 180, 896, 504), (980, 430, 440, 460), (1502,230,282,487)),
    'PhoenixObservatoryLobby': ('phoenix-observatory', 'Phoenix observatory', 'Desert astronomy and phoenix fire.', (60, 180, 896, 504), (980, 445, 430, 460), (1465,203,313,480)),
    'TavernWorldLobby': ('tavern-v2', 'Lobby of Legends', 'Your original tavern, with a complete conversation layout.', (60, 180, 896, 504), (980, 350, 435, 570), (1515,180,311,451)),
    'FutureWorldLobby': ('future-v2', 'Future lounge', 'Your neon space bar, with working display panels.', (60, 180, 896, 504), (980, 350, 360, 520), (1540,270,274,432)),
    'ReefLobby': ('reef', 'Turtle reef', 'A submerged glass dome and ancient turtle spirits.', (640, 140, 896, 504), (140, 320, 390, 550), (1596,213,246,487)),
    'SpiritRailLobby': ('spirit-rail', 'Spirit railway', 'A mountain station at dusk, between journeys.', (640, 140, 896, 504), (150, 320, 355, 510), (1544,183,309,463)),
    'SpiritArcadeLobby': ('spirit-arcade', 'Spirit arcade', 'Rainy neon, arcade cabinets and a late-night spirit hangout.', (60, 180, 896, 504), (980, 340, 400, 490), (1498,166,303,433)),
    'AuroraCampLobby': ('aurora-camp', 'Aurora camp', 'A fireside mountain camp beneath the northern lights.', (60, 180, 896, 504), (980, 330, 400, 355), (1570,265,237,383)),
    'Spirit Afterparty': (None, 'Spirit afterparty', 'Your animated clubhouse, dancing penguins and custom display studio.', (60, 180, 896, 504), (1000, 378, 444, 420), (1460,480,360,225)),
}

def defaults(name):
    row = LAYOUTS[name]
    return {key: list(rect) for key, rect in zip(('screen','camera','chat'),row[3:])}

def canonical(name, available):
    replacement = REPLACEMENTS.get(name)
    return replacement if replacement in available else name

def legacy_exclusions(available):
    return tuple(old for old,new in REPLACEMENTS.items() if new in available)

def artwork(name):
    if name not in LAYOUTS:
        raise ValueError('Unknown lobby artwork')
    path = ART / (LAYOUTS[name][0] + '-base.png')
    if not path.is_file():
        raise FileNotFoundError(path)
    return path
