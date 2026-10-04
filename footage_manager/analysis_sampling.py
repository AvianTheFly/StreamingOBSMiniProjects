"""Bounded visual refinement windows around gameplay and desktop transitions."""
import math


def game_refinement_times(samples, games, replays, duration, step, *, interval=2):
    """Refine early play, the last real HUD, and the estimated end separately.

    A late portrait estimate can be minutes into a lobby. Keep the last gameplay
    window even then, without densely decoding the entire inactive gap. Replay
    and browser-playback HUDs cannot move that window away from the live game.
    """
    samples=list(samples)
    times=set()
    for game in games:
        last_hud=max((s['time'] for s in samples if s.get('active') and not s.get('replay')
                      and game['start']<=s['time']<=game['end']
                      and not any(r['start']<=s['time']<=r['end'] for r in replays)),
                     default=max(game['start'],game['end']-step))
        windows=[(game['start']-step,game['start']+320),
                 (last_hud-step,min(game['end']+step,last_hud+180+step))]
        if game['end']-last_hud>180:
            windows.append((game['end']-step,game['end']+step))
        for start,end in windows:
            times.update(range(max(0,math.floor(start)),min(math.ceil(duration),math.ceil(end)),interval))
    return times


def desktop_transition_times(samples, games, step, *, fine=False):
    """Probe game-to-desktop gaps, then brief gaps at quarter-second intervals.

    Probes gather evidence only. Desktop views remain neutral in chronology.
    The one-second pass can expose a short no-HUD state; its remaining gap is
    then small enough for two distinct observations before the desktop appears.
    """
    times, last_active = set(), None
    for sample in sorted(samples, key=lambda s: s['time']):
        if sample.get('replay') or sample.get('loading') or sample.get('continue') or sample.get('outcome'):
            last_active = None
            continue
        if sample.get('active'):
            last_active = sample
            continue
        if not sample.get('desktop') or last_active is None:
            continue
        start, end = last_active['time'], sample['time']
        last_active = None
        if not 0 < end-start <= step*3:
            continue
        if not any(g['start'] <= start < g['end'] for g in games):
            continue
        if fine and end-start > 3:
            continue
        interval = .25 if fine else 1
        times.update(tick*interval for tick in range(math.floor(start/interval)+1, math.ceil(end/interval)))
    return times
