"""Pure command interpretation; authorization uses server-provided Twitch identity."""
import re
from .community import TOPICS
COMMANDS = {'!melee':'missed_melee', '!range':'missed_ranged', '!ranged':'missed_ranged',
            '!caster':'missed_ranged', '!cannon':'missed_cannon', '!siege':'missed_cannon',
            '!nexus':'nexus_last_hits_manual'}
ALIASES={'farm':'cs','wr':'record','winrate':'record','build':'items','lane':'matchup',
         'average':'averages','firstblood':'objectives','firstbloods':'objectives'}


def parse(text):
    words = str(text).lower().split()
    if words in (['!stats'],['!stats','help']):
        return 'spotlight','help'
    if len(words)==1 and words[0] in COMMANDS:
        return 'add', COMMANDS[words[0]]
    if words == ['!statundo']:
        return 'undo', None
    if len(words)==2 and words[0]=='!count' and re.fullmatch(r'[a-z][a-z0-9_]{0,23}',words[1]):
        return 'add','custom_'+words[1]
    if len(words)==2 and words[0]=='!stats':
        topic=ALIASES.get(words[1],words[1])
        if topic in TOPICS:return 'spotlight',topic
    return None


def authorized(message, settings):
    user = message.get('user', '').lower()
    channel = message.get('channel', '').lower()
    if user!=channel and user in settings.get('blocked_helpers',[]):
        return False
    return bool(user and channel and (user == channel or user in settings['helpers'] or
                settings['allow_moderators'] and message.get('moderator') is True))
