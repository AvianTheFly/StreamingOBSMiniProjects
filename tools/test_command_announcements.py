"""Fake clocks and senders prove reminders without posting to Twitch."""
import sys
from pathlib import Path
import random
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'mini projects'))
from twitch_commands.announcements import Announcements, candidates, format_message
from twitch_commands.policy import match, render


def config():
    rows = [dict(command='!test'+str(i), enabled=True, kind='text',
                 response='A real reply '+str(i), permission='everyone') for i in range(12)]
    rows += [dict(command='!clip', enabled=True, kind='clip', permission='moderator'),
             dict(command='!private', enabled=True, kind='text', response='Private', permission='owner'),
             dict(command='!disabled', enabled=False, kind='text', response='', permission='everyone')]
    return dict(channel='fixture', enabled=True, announcements_enabled=True, commands=rows)


class AnnouncementTests(unittest.TestCase):
    def setUp(self):
        self.now = 100
        self.send = Mock(return_value=True)
        self.owner = Announcements(self.send, clock=lambda:self.now, rng=random.Random(7))
        self.data = config()

    def tick(self, **changes):
        return self.owner.tick(self.data, **dict(ready=True, clips_ready=True, allowed=lambda:True, **changes))

    def test_random_intervals_five_rows_and_rotation(self):
        self.assertFalse(self.tick())
        delays, messages = [], []
        for _ in range(3):
            delays.append(self.owner.due-self.now)
            self.now = self.owner.due-.01
            self.assertFalse(self.tick())
            self.now += .01
            self.assertTrue(self.tick())
            messages.append(self.send.call_args.args[1])
        self.assertTrue(all(1800 <= value <= 3600 for value in delays))
        self.assertEqual(len(set(delays)), 3)
        self.assertTrue(all(text.count(' | ')==4 for text in messages))
        first = {part.split(' (')[0].split()[-1] for part in messages[0].split(' | ')}
        second = {part.split(' (')[0].split()[-1] for part in messages[1].split(' | ')}
        self.assertFalse(first & second)
        self.assertNotIn('!private', ''.join(messages))
        self.assertNotIn('!disabled', ''.join(messages))
        self.assertIn('!clip (Mods)', ''.join(messages))

    def test_offline_and_disabled_reset_no_catchup(self):
        self.tick()
        self.now += 7200
        self.owner.tick(self.data, ready=False, clips_ready=True, allowed=lambda:True)
        self.assertIsNone(self.owner.due)
        self.send.assert_not_called()
        self.tick()
        self.assertGreaterEqual(self.owner.due-self.now, 1800)
        self.data['announcements_enabled'] = False
        self.tick()
        self.assertIsNone(self.owner.due)

    def test_live_filter_and_permission_match(self):
        self.assertNotIn('!clip', [r['command'] for r in candidates(self.data)])
        for row in candidates(self.data, clips_ready=True):
            message = dict(channel='fixture', user='viewer', text=row['command'],
                           moderator=row.get('permission')=='moderator')
            self.assertIs(match(self.data, message), row)
            self.assertTrue(render(row, self.data, message))
        self.data['enabled'] = False
        self.assertEqual(candidates(self.data, clips_ready=True), [])

    def test_edits_empty_catalog_failure_and_bounded_copy(self):
        self.tick()
        for row in self.data['commands']:
            row['enabled'] = False
        self.now = self.owner.due
        self.assertFalse(self.tick())
        self.send.assert_not_called()
        self.data = config()
        self.send.return_value = False
        self.now = self.owner.due
        self.assertFalse(self.tick())
        self.assertEqual(self.owner.count, 0)
        self.assertGreaterEqual(self.owner.due-self.now, 1800)
        rows = [dict(command='!'+'x'*32, response='y'*400, permission='everyone')]*5
        self.assertLessEqual(len(format_message(rows)), 400)

    def test_broken_renderer_is_not_advertised_and_time_really_works(self):
        row = dict(command='!time',kind='time',enabled=True,permission='everyone')
        self.data['commands'].append(row)
        self.assertIn('Bot-lane clock:',render(row,self.data,{}))
        original = render
        def unavailable(row,*args,**kwargs):
            if row.get('kind')=='time':
                raise KeyError('timezone data unavailable')
            return original(row,*args,**kwargs)
        with patch('twitch_commands.announcements.render',side_effect=unavailable):
            result = candidates(self.data)
        self.assertTrue(result)
        self.assertNotIn('!time',[r['command'] for r in result])


if __name__ == '__main__':
    unittest.main()
