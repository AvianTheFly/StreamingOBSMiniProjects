"""A cheap, continuous travel animatic; timing can change without new artwork."""
import math

DURATION = 40
FPS = 30
WIDTH, HEIGHT = 1280, 720
BEAT = 60 / 128
PHASE = .03

SCENES = [
    ('sanctuary', 0, PHASE + 16 * BEAT, 'Sanctuary', 'Follow the spirits out into the world'),
    ('coast', PHASE + 16 * BEAT, PHASE + 28 * BEAT, 'Storm Coast', 'Bear: gather speed, then leap between sea stacks'),
    ('reef', PHASE + 28 * BEAT, PHASE + 42 * BEAT, 'Reef', 'Turtle: dive inside a shell of air and explore the ruins'),
    ('forge', PHASE + 42 * BEAT, PHASE + 56 * BEAT, 'Forge', 'Ram: sprint over the broken bridge and vault the furnace'),
    ('sky', PHASE + 56 * BEAT, PHASE + 72 * BEAT, 'Sky Harbor', 'Phoenix: unfold wings and soar past the floating city'),
    ('observatory', PHASE + 72 * BEAT, DURATION, 'Phoenix Observatory', 'Land, awaken the astrolabe, reveal the whole journey'),
]
COLORS = {'bear': '#287eaa', 'turtle': '#32896b', 'ram': '#bd7834', 'phoenix': '#8c5ca2'}
REFERENCES = {
    'sanctuary': 'C:/StreamingMedia/LobbyWorkspace/2026-10-03-previews/SanctuaryLobby.png',
    'coast': 'C:/StreamingMedia/LobbyWorkspace/2026-10-03-previews/StormCoastLobby.png',
    'reef': 'C:/StreamingMedia/LobbyWorkspace/verified-lobbies/ReefLobby.png',
    'forge': 'C:/StreamingMedia/LobbyWorkspace/2026-10-03-previews/ForgeLobby.png',
    'sky': 'C:/StreamingMedia/LobbyWorkspace/verified-lobbies/SkyHarborLobby.png',
    'observatory': 'C:/StreamingMedia/LobbyWorkspace/2026-10-03-previews/PhoenixObservatoryLobby.png',
}


def ease(a, b, t):
    q = max(0, min(1, (t - a) / (b - a)))
    return q * q * (3 - 2 * q)


def leap(a, b, t):
    q=max(0,min(1,(t-a)/(b-a)))
    return 4*q*(1-q)


def compress(a,b,t):
    if t<a:
        return ease(a-BEAT,a,t)
    return 1-ease(b,b+.25,t) if t>=b else 0


def pose(t):
    """Screen position and joint motion stay continuous through world changes."""
    if not 0 <= t <= DURATION:
        raise ValueError('Time is outside the authored excerpt')
    scene = next((s for s in SCENES if s[1] <= t < s[2]), SCENES[-1])
    name, start, end, _, _ = scene
    u, length = t - start, end - start
    x, y, lean, power, mode = 480 + 80 * ease(0, 40, t), 530., 0., None, 'walk'
    cycle = t * math.tau / (2 * BEAT)
    compression = 0
    action = scene[4]
    if name == 'sanctuary':
        motion = ease(.6, 1.8, u) * (1 - ease(length - .8, length, u))
        y -= 3 * abs(math.sin(cycle)) * motion
        mode = 'walk' if motion > .1 else 'stand'
    elif name == 'coast':
        power, mode = 'bear', 'run'
        launch,land=6*BEAT,10*BEAT
        y -= 210 * leap(launch,land,u)
        compression=compress(launch,land,u)
        lean = 18 * math.sin(math.pi * u / length)
        if u < 1:
            action = 'Storm gathers around Udyr; the bear appears beside him'
        elif u < launch:
            action = 'Sprint toward the broken cliff edge'
        else:
            action = 'Launch across the gap; land without stopping'
    elif name == 'reef':
        power, mode = 'turtle', 'swim'
        swim = math.sin(math.pi * ease(.5, length - .5, u))
        y -= 110 * swim
        lean = 70 * swim
        action = 'Turtle folds a shell of air around Udyr; they dive through a ruined arch'
    elif name == 'forge':
        power, mode = 'ram', 'run'
        launch,land=8*BEAT,12*BEAT
        y -= 185 * leap(launch,land,u)
        compression=compress(launch,land,u)
        lean = 22 * math.sin(math.pi * u / length)
        action = 'Ram-powered sprint' if u < launch else 'Horn-assisted vault across the broken forge bridge'
    elif name == 'sky':
        power, mode = 'phoenix', 'fly'
        flight = math.sin(math.pi * ease(.3, length - .3, u))
        x += 75 * flight
        y -= 260 * flight
        lean = -12 * flight
        action = 'Wings unfold; climb above the clouds' if u < 2 else 'Bank past airships, then descend onto the observatory'
    else:
        mode = 'reach' if 1 < u < 3 else 'stand'
        action = 'Light the astrolabe with all four spirits' if u < 3.8 else 'Camera pulls back: Udyr and the spirits overlook the world'
    # Gait fades at each landing; no discontinuous limb pose at a realm boundary.
    motion = math.sin(math.pi * ease(0, length, u))
    return dict(scene=name, start=start, end=end, u=u, x=x, y=y, lean=lean,
                power=power, mode=mode, cycle=cycle, motion=motion, compression=compression, action=action)
