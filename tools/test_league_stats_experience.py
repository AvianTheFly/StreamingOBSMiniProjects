"""Viewer evidence, live goal pace and filtered chart coverage; no external calls."""
import copy
import unittest
from unittest.mock import Mock
from tools import test_league_stats as fixtures
from league_stats import audience, analytics, presentation, chat_replies, commands
from league_stats.community import TOPICS


def record(identity=1,**patch):
    return dict(id=f'p:{identity}',account='p',champion='Jinx',state='complete',queue=420,
                started_at=identity,win=True,duration=1200,metrics=dict(kills=6,deaths=2,assists=4,cs=160),
                items=[dict(id=1001,name='Boots')],matchups=dict(enemy_adc='Caitlyn',ally_support='Lulu'),**patch)


class AudienceFactsTests(unittest.TestCase):
    def test_confirmed_matchups_compare_same_queue_decided_games_only(self):
        own=record();own.update(connected=True,state='live')
        rows=[record(1),record(2),record(3)]
        rows[1].update(queue=440,win=False)
        rows[2].update(win=None)
        lane=audience.facts(rows,own)['lane']
        self.assertEqual([r['champion'] for r in lane],['Caitlyn','Lulu'])
        self.assertEqual(lane[0]['completed_games'],2)
        self.assertEqual(lane[0]['result_games'],1)
        reply=chat_replies.stat('matchup',analytics.aggregate([]),{},current=own,lane=lane)
        self.assertIn('vs Caitlyn: 1W–0L in 1 game',reply)
        own['connected']=False
        self.assertEqual(audience.facts(rows,own)['lane'],[])

    def test_unknown_queue_and_roles_are_not_guessed(self):
        own=record();own.update(connected=True,queue=None)
        old=record();old['queue']=None
        facts=audience.facts([old],own)
        self.assertFalse(facts['lane'][0]['queue_known'])
        self.assertEqual(facts['lane'][0]['result_games'],0)
        self.assertIn('queue not reported',chat_replies.stat('matchup',facts['lifetime'],{},**facts))
        own['matchups']={}
        self.assertEqual(audience.facts([old],own)['lane'],[])

    def test_final_item_frequency_deduplicates_inventory_slots(self):
        row=record();row['items']*=2
        facts=audience.facts([row],None)
        self.assertEqual(facts['finished_items'][0]['games'],1)
        text=chat_replies.stat('items',facts['lifetime'],{},**facts)
        self.assertIn('Common final items',text)
        self.assertIn('Boots (1 game)',text)

    def test_nexus_sources_are_distinct_and_cannot_double_count_one_event(self):
        row=record();row['metrics'].update(nexus_last_hits=1,nexus_last_hits_manual=1)
        reply=chat_replies.stat('nexus',analytics.aggregate([row]),{})
        self.assertIn('API kills 1',reply)
        self.assertIn('Helper-confirmed +50g reports 1',reply)
        self.assertNotIn('reports 2',reply)
        for alias,topic in [('build','items'),('firstblood','objectives'),('lane','matchup'),('farm','cs')]:
            self.assertEqual(commands.parse('!stats '+alias),('spotlight',topic))

    def test_missing_fields_remain_unknown_and_live_does_not_invent_cs(self):
        row=record();row['metrics']={};row.update(connected=True,state='live')
        facts=audience.facts([row],row)
        text=chat_replies.stat('live',facts['lifetime'],{},**facts)
        self.assertIn('unknown CS',text)
        text=chat_replies.stat('objectives',facts['lifetime'],{},**facts)
        self.assertIn('First bloods unknown',text)
        text=chat_replies.stat('record',facts['lifetime'],{},**facts)
        self.assertIn('WR unknown',text)
        self.assertNotIn('unknown%',text)


class ProgressTests(unittest.TestCase):
    def test_account_labels_use_observed_names_without_changing_identity(self):
        labels=presentation.account_labels([record()],{'p':{'name':'Tester','tag':'NA1'}},'p','Old display')
        self.assertEqual(labels,{'p':'Tester#NA1'})
        self.assertEqual(presentation.account_labels([record()],{},'p','Current display'),{'p':'Current display'})
        self.assertEqual(presentation.account_labels([record()],{},'other','Other'),{'p':'Account p'})

    def test_live_pace_expresses_minions_needed_without_rounding_away_deficit(self):
        current=record();current.update(connected=True,duration=601,metrics={'cs':60})
        p=presentation.live_progress(current,{'cs_goal':7})
        self.assertEqual(p['needed'],11)
        self.assertFalse(p['on_target'])
        current['metrics']['cs']=80
        p=presentation.live_progress(current,{'cs_goal':7})
        self.assertTrue(p['on_target']);self.assertEqual(p['needed'],0)
        current['connected']=False
        self.assertFalse(presentation.live_progress(current,{'cs_goal':7})['available'])

    def test_pace_requires_reported_cs_and_positive_game_time(self):
        row=record();row['connected']=True;row['metrics']={}
        self.assertFalse(presentation.live_progress(row,{'cs_goal':7})['available'])
        row['metrics']['cs']=0;row['duration']=0
        self.assertFalse(presentation.live_progress(row,{'cs_goal':7})['available'])

    def test_form_is_chronological_bounded_completed_only_and_has_gaps(self):
        rows=[record(i) for i in range(20)]
        rows[-1]['state']='partial';rows[-2]['metrics'].pop('cs')
        form=presentation.form(list(reversed(rows)))
        self.assertEqual(len(form),12)
        self.assertEqual([r['id'] for r in form],[f'p:{i}' for i in range(7,19)])
        self.assertNotIn('cs_per_minute',form[-1]['metrics'])
        self.assertEqual(form[-2]['metrics']['cs_per_minute'],8)
        self.assertNotIn('raw_postgame',form[0])


class ViewerIntegrationTests(unittest.TestCase):
    setUp=fixtures.TrackerTests.setUp
    new_tracker=fixtures.TrackerTests.new_tracker
    advance=fixtures.TrackerTests.advance
    ingest=fixtures.TrackerTests.ingest

    def test_named_helper_can_correct_own_last_report_after_another_helper_reports(self):
        self.advance(600);self.ingest()
        first=self.tracker.observe('add','missed_cannon',actor='alice')['observation']['id']
        self.advance(16);self.ingest(616)
        second=self.tracker.observe('add','missed_melee',actor='bob')['observation']['id']
        result=self.tracker.observe('undo',actor='alice',moderator=False,message_id='undo-own')
        self.assertEqual(result['observation']['id'],first)
        self.assertTrue(self.tracker.current['observations'][0]['undone'])
        self.assertFalse(self.tracker.current['observations'][1].get('undone'))
        self.assertEqual(self.tracker.current['metrics']['missed_cannon'],0)
        self.assertEqual(self.tracker.current['metrics']['missed_melee'],1)
        with self.assertRaises(ValueError):self.tracker.observe('undo',actor='alice',moderator=False)
        self.assertNotEqual(first,second)

    def test_session_and_lifetime_scopes_are_distinct_and_account_filtered(self):
        old=fixtures.match(1);self.tracker.enrich(old,'p')
        self.advance(600);self.ingest()
        data=self.tracker.snapshot()
        self.assertEqual(data['session_summary']['completed_games'],0)
        lifetime=next(r for r in data['reply_previews'] if r['topic']=='lifetime')
        self.assertIn('1 completed',lifetime['text'])
        self.assertIn('All recorded',lifetime['text'])
        self.assertNotIn('completed',next(r for r in data['reply_previews'] if r['topic']=='live')['text'])
        self.tracker.review_match({'id':'p:1','revision':0,'excluded':True,'note':''})
        self.assertEqual(self.tracker.snapshot()['form'],[])
        self.assertIn('0 completed',next(r for r in self.tracker.snapshot()['reply_previews'] if r['topic']=='lifetime')['text'])

    def test_new_commands_show_matching_overlay_without_changing_counts(self):
        self.advance(600);self.ingest();self.tracker.reply=Mock()
        before=copy.deepcopy(self.tracker.current)
        self.tracker.enqueue_chat(dict(text='!stats live',user='viewer',channel='owner',id='one'))
        self.tracker.drain_chat()
        data=self.tracker.snapshot()
        self.assertEqual(data['spotlight']['topic'],'live')
        self.assertEqual(data['spotlight']['scope'],'Current live game')
        self.assertIn('Live Jinx',data['spotlight']['text'])
        self.assertEqual(self.tracker.current,before)
        self.advance(6)
        self.assertFalse(self.tracker.snapshot()['live_progress']['available'])
        self.assertIn('No live game',next(r for r in self.tracker.snapshot()['reply_previews'] if r['topic']=='live')['text'])

    def test_help_and_all_catalog_answers_are_short_including_long_custom_names(self):
        self.advance(600);self.ingest()
        data=self.tracker.snapshot();previews=data['reply_previews']
        self.assertEqual({p['topic'] for p in previews},set(TOPICS))
        self.assertTrue(all(len(p['text'])<400 and '\n' not in p['text'] for p in previews))
        help_text=next(p['text'] for p in previews if p['topic']=='help')
        self.assertIn('!stats <topic>',help_text)
        self.assertIn('matchup',help_text)
        self.assertIn('helpers',help_text)


if __name__=='__main__':unittest.main()
