"""Authored gaming vocabulary over the channel's actual emote inventory.

This finite maintenance policy builds additions; existing personal aliases win.
It never changes a Twitch/7TV account or performs network requests on import.
"""
GROUPS = {
    'gg': ('gg', 'ggwp', 'gg wp', 'good game', 'well played'),
    'GGEZ': ('ggez', 'gg ez', 'ez clap', 'easy clap'),
    'PogU': ('pog', 'poggers', 'pogchamp', 'clutch', 'outplayed', 'clean', 'insane'),
    'udyrisHYPE': ('hype', 'letsgo', "let's go", 'lets go', 'let’s go', 'lfg', 'huge', 'big win'),
    'GIGACHAD': ('gigachad', 'chad', 'goated', 'goat', 'built different', 'gaming god'),
    'TooBasedyr': ('based', 'too based', 'basedyr'),
    'KEKW': ('kekw', 'lol', 'lmao', 'lmfao', 'rofl', 'haha', 'hahaha'),
    'udyrxdd': ('xdd', 'xd', 'icant', 'i cant', "i can't", 'i can’t'),
    'udyrisCOPIUM': ('copium', 'cope', 'coping', 'surely', 'trust the process'),
    'udyrisBONK': ('bonk', 'bonked', 'get bonked'),
    'udyrisOHNOO': ('oof', 'oops', 'oh no', 'ohno', 'rip', 'yikes', 'cooked', 'its over', "it's over"),
    'Madge': ('tilt', 'tilted', 'salty', 'rage', 'raging', 'mald', 'malding'),
    'Sadge': ('sadge', 'unlucky', 'pain', 'ff', 'ff15', 'ff 15', 'ff20', 'ff 20', 'surrender'),
    'botlaneOops': ('inting', 'int', 'throw', 'throwing', 'skill issue', 'misclick'),
    'Susge': ('sus', 'sussy', 'susge', 'suspicious'),
    'HUH': ('huh', 'bruh', 'what', 'wtf'),
    'AINTNOWAY': ('aintnoway', 'aint no way', "ain't no way", 'no way'),
    'DIESOFCRINGE': ('cringe', 'cringey', 'cringed'),
    'LETHIMCOOK': ('let him cook', 'let me cook', 'cooking', 'chef', 'cook'),
    '5Head': ('5head', 'big brain', 'galaxy brain', 'calculated', '300 iq'),
    'HACKERMANS': ('hacker', 'hacking', 'hackerman', 'aimbot'),
    'monkaW': ('monkaw', 'sweating', 'sweaty', 'close call'),
    'Prayge': ('prayge', 'pray', 'praying', 'rng please'),
    'udyrisYEP': ('yep', 'yup', 'agreed', 'true', 'frfr', 'fr fr', 'for real'),
    'NOPERS': ('nope', 'nop', 'nopers'),
    'aemiJam': ('jam', 'jamming', 'banger', 'bop', 'catjam'),
    'VIBE': ('vibe', 'vibes', 'vibing', 'vibin'),
    'peepoComfy': ('comfy', 'chill', 'chilling', 'cozy'),
    'udyrisSLEEPY': ('sleepy', 'bedge', 'goodnight', 'good night', 'gn'),
    'peepoHey': ('hello', 'hey', 'hi chat', 'yo chat', 'sup chat'),
    'peepoBye': ('bye', 'bye chat', 'see ya', 'cya'),
    'o7': ('o7', 'salute', 'respect'),
    'peepoClap': ('clap', 'claps', 'applause', 'well done'),
    'udyrHug': ('hug', 'hugs', 'wholesome'),
    'UdyrLove': ('love', 'love you', 'ily', 'much love'),
    'CARRY': ('carry', 'carrying', 'hard carry', 'bot diff', 'botlane diff', 'bot lane diff'),
    'UdyrSupreme': ('dyr', 'udyr', 'udyr gaming'),
    'PETTHEDYR': ('pet the dyr', 'pet the bear'),
}


def additions(emotes, existing):
    result = dict(existing)
    added, unavailable = [], []
    for code, aliases in GROUPS.items():
        asset = emotes.get(code)
        if not asset or asset.get('zero_width'):
            unavailable.append(code)
            continue
        for alias in aliases:
            if alias not in result:
                result[alias] = asset['url']
                added.append(alias)
    return result, added, unavailable
