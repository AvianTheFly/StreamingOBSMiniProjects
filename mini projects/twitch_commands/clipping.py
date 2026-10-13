"""Moderator clip policy over the shared, single-flight Twitch clip transport."""
from collections import OrderedDict
import time
from lib.twitch_clips import request_clip


class ClipCommand:
    def __init__(self, stop, reply):
        self.stop, self.reply = stop, reply
        self.seen = OrderedDict()

    def receive(self, message, data, allowed):
        row = next((row for row in data['commands'] if row['command'] == '!clip'), None)
        if row is not None and not row['enabled']:
            return False
        if (not allowed() or message.get('channel') != data['channel']
                or str(message.get('text', '')).strip().lower() != '!clip'
                or not message.get('id') or not message.get('user_id')):
            return False
        if not (message.get('moderator') is True or message.get('user') == data['channel']):
            return False
        try:
            fresh = abs(time.time() - int(message.get('sent_at', '')) / 1000) <= 30
        except (ValueError, TypeError):
            fresh = False
        if not fresh or message['id'] in self.seen:
            return False
        self.seen[message['id']] = True
        while len(self.seen) > 512:
            self.seen.popitem(last=False)

        def completed(result):
            if not allowed():
                return
            text = ('Clip saved! ' + result.get('message', 'Twitch clip ready.') + ' ' + result['url'] if result['status'] == 'ready'
                    else result.get('message') or 'Clip could not be confirmed. Check Twitch Clips Manager and Hub clip status before retrying.')
            if result['status'] != 'ready' and result.get('url'):
                text += ' ' + result['url']
            self.reply(message['channel'], text, message['id'], allowed=allowed)

        return request_clip(on_complete=completed, reuse=True)
