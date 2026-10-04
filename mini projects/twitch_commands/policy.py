"""Pure matching, audience permissions and local response generation."""
from datetime import datetime
import random
from zoneinfo import ZoneInfo


def match(data,message):
    if not data['enabled'] or message.get('channel')!=data['channel']:
        return None
    words = str(message.get('text','')).split()
    if not words:
        return None
    name = words[0].lower()
    for row in data['commands']:
        if row['enabled'] and name in [row['command'],*row.get('aliases',[])]:
            owner = message.get('user')==data['channel']
            permission = row.get('permission','everyone')
            if permission=='owner' and not owner:
                return None
            if permission=='moderator' and not (owner or message.get('moderator') is True):
                return None
            return row
    return None


def render(row,data,message,*,now=None,choose=random.choice):
    kind = row.get('kind','text')
    if kind=='index':
        names = [c['command'] for c in data['commands'] if c['enabled'] and c.get('permission','everyone')=='everyone']
        words = str(message.get('text','')).split()
        try: page = int(words[1]) if len(words)>1 else 1
        except ValueError: page = 1
        pages = max(1,(len(names)+7)//8)
        page = min(max(1,page),pages)
        return f'Commands {page}/{pages}: '+', '.join(names[(page-1)*8:page*8])+f' | !commands <page> for more.'
    if kind=='time':
        moment = now or datetime.now(ZoneInfo('America/New_York'))
        return 'Bot-lane clock: '+moment.strftime('%I:%M %p %Z').lstrip('0')+'.'
    if kind=='8ball':
        return choose(['The spirits approve.','Turtle says take it slow.','Phoenix says send it.',
                       'Ram is already running at them.','Bear would like more evidence.',
                       'Ask again after the next wave.','The lane is questionable. The answer is yes.'])
    return row['response']
