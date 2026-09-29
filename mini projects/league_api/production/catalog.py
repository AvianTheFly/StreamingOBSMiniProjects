"""Small set of deliberate shows, selected from observed friendly/local events."""
NAMES = {
    'earth': 'MOUNTAIN DRAGON', 'fire': 'INFERNAL DRAGON', 'water': 'OCEAN DRAGON',
    'air': 'CLOUD DRAGON', 'hextech': 'HEXTECH DRAGON', 'chemtech': 'CHEMTECH DRAGON',
    'elder': 'ELDER DRAGON',
}
STREAKS = {'double_kill': 2, 'triple_kill': 3, 'quadra_kill': 4, 'pentakill': 5}


def show_for(candidate, settings):
    key = candidate['key']
    if key.startswith('dragon_') and settings['objectives']:
        theme = key.removeprefix('dragon_')
        if theme in NAMES:
            return dict(kind='dragon', theme=theme, title=NAMES[theme] + ' SECURED', priority=98,
                        family='objective', rank=1)
    if settings['objectives'] and key in {'baron', 'herald', 'ace', 'objective_steal'}:
        return dict(kind='baron' if key in {'baron', 'herald'} else 'sigil', theme='void' if key != 'ace' else 'gold',
                    title={'baron':'BARON SECURED', 'herald':'HERALD SECURED', 'ace':'TEAM ACE',
                           'objective_steal':'OBJECTIVE STOLEN'}[key],
                    priority=95 if key == 'objective_steal' else 88, family='objective', rank=1)
    if settings['structures'] and key in {'turret_destroyed', 'first_turret', 'inhibitor_destroyed'}:
        return dict(kind='structure', theme='earth', title='INHIBITOR DOWN' if key == 'inhibitor_destroyed' else 'TOWER DOWN',
                    priority=70, family='structure', rank=1)
    if settings['combat'] and key in STREAKS:
        rank = STREAKS[key]
        return dict(kind='streak', theme='gold', title=key.replace('_', ' ').upper(),
                    priority=80 + rank * 3, family='combat', rank=rank)
    return None
