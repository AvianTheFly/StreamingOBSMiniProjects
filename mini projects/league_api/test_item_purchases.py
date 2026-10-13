"""Viewer-facing purchase identity, queue and stale-intent regression coverage."""
import copy
import unittest
import tempfile
import threading
from pathlib import Path
from unittest.mock import patch
from .engine import Engine
from .item_purchases import ItemPurchases
from .test_engine import snapshot


def item(identity=1001, count=1, price=300, name='Boots'):
    return dict(itemID=identity, count=count, price=price, displayName=name)


def catalog_item(total, *, parents=(), purchasable=True, special=None, sell=None):
    result=dict(gold=dict(total=total,purchasable=purchasable,sell=total*.7 if sell is None else sell),
                **{'from':list(map(str,parents))})
    if special:result['specialRecipe']=special
    return result


# Small, fixed 16.20.1 recipe fixtures keep the regression suite offline.
CATALOG={
    '1001':catalog_item(300), '1036':catalog_item(350),
    '2003':catalog_item(50,sell=20), '3340':catalog_item(0),
    '2055':catalog_item(75,sell=30), '2422':catalog_item(300,purchasable=False),
    '3020':catalog_item(1100,parents=[1001]),
    '3175':catalog_item(1100,parents=[3020]),
    '3057':catalog_item(900), '3044':catalog_item(1100), '3051':catalog_item(1200),
    '3078':catalog_item(3333,parents=[3057,3044,3051]),
    '3070':catalog_item(400), '3802':catalog_item(1200), '3108':catalog_item(850),
    '3003':catalog_item(2900,parents=[3070,3802,3108]),
    '3040':catalog_item(2900,purchasable=False,special=3003),
    '3865':catalog_item(400),
    '3866':catalog_item(400,purchasable=False,special=3865),
    '3867':catalog_item(400,purchasable=False,special=3866),
    '3870':catalog_item(400,parents=[3867]),
}


class PurchaseTests(unittest.TestCase):
    def setUp(self):
        self.now=0
        self.engine=Engine(clock=lambda:self.now,item_catalog=CATALOG)
        self.data=snapshot()
        self.engine.ingest(self.data)

    def buy(self, items, gold=500, **kwargs):
        self.data=copy.deepcopy(self.data)
        self.data['gameData']['gameTime']+=.5
        self.data['activePlayer']['currentGold']=gold
        self.data['allPlayers'][0]['items']=items
        self.engine.ingest(self.data, **kwargs)
        return self.engine.purchases.snapshot()

    def test_named_icon_purchase_and_no_duplicate_poll(self):
        cue=self.buy([item()])
        self.assertEqual((cue['item_id'],cue['name'],cue['icon']), (1001,'Boots','/purchase-assets/1001.png'))
        again=self.buy([item()],501)
        self.assertEqual(cue['id'],again['id'])
        self.assertEqual(again['pending'],0)
        self.now=3
        self.assertIsNone(self.engine.purchases.snapshot())

    def test_successive_and_same_poll_stacks_queue_separately(self):
        first=self.buy([item(2003,2,50,'Health Potion')],900)
        self.assertEqual(first['pending'],1)
        cue=self.buy([item(2003,2,50,'Health Potion'),item()],600)
        self.assertEqual(cue['pending'],2)
        self.now=2.81
        second=self.engine.purchases.snapshot()
        self.assertEqual(second['item_id'],2003)
        self.assertNotEqual(first['id'],second['id'])
        self.now=5.62
        self.assertEqual(self.engine.purchases.snapshot()['item_id'],1001)

    def test_completed_recipe_shows_result(self):
        self.buy([item(3057),item(3044),item(3051)],500,baseline=True)
        cue=self.buy([item(3078,1,3333,'Trinity Force')],367)
        self.assertEqual(cue['name'],'Trinity Force')

    def test_split_gold_and_inventory_updates_in_either_order(self):
        for gold_first in [True,False]:
            with self.subTest(gold_first=gold_first):
                self.setUp()
                self.assertIsNone(self.buy([] if gold_first else [item()],700 if gold_first else 1000))
                self.assertEqual(self.buy([item()],700)['item_id'],1001)
                self.assertEqual(self.buy([item()],701)['pending'],0)

    def test_split_recipe_component_removal_and_result(self):
        self.buy([item(3057),item(3044),item(3051)],500,baseline=True)
        self.assertIsNone(self.buy([],367))
        self.assertEqual(self.buy([item(3078,name='Trinity Force')],367)['item_id'],3078)

    def test_free_quest_upgrades_do_not_borrow_another_purchases_gold(self):
        for before,after in [(3020,3175),(3867,3870),(3865,3870),(3003,3040)]:
            with self.subTest(before=before,after=after):
                self.setUp()
                self.buy([item(before)],1000,baseline=True)
                cue=self.buy([item(after),item(2003,price=50,name='Health Potion')],950)
                self.assertEqual((cue['item_id'],cue['pending']),(2003,0))

    def test_paid_purchase_that_immediately_transforms_is_detected(self):
        for before,after,gold in [([1001],3175,200),([3070,3802,3108],3040,550)]:
            with self.subTest(after=after):
                self.setUp()
                self.buy([item(i) for i in before],1000,baseline=True)
                self.assertEqual(self.buy([item(after)],gold)['item_id'],after)

    def test_sale_can_offset_same_poll_purchase(self):
        self.buy([item(1036)],1000,baseline=True)
        cue=self.buy([item(2003,price=50,name='Health Potion')],1195)
        self.assertEqual(cue['item_id'],2003)

    def test_cash_back_purchase_can_increase_gold(self):
        self.data['activePlayer']['fullRunes']={'generalRunes':[{'id':8321}]}
        self.buy([item(3057),item(3044),item(3051)],500,baseline=True)
        # 133 combine cost, approximately 250 rebate on the 3333 total price.
        self.assertEqual(self.buy([item(3078)],617)['item_id'],3078)
        self.setUp()
        self.buy([item(3057),item(3044),item(3051)],500,baseline=True)
        self.assertIsNone(self.buy([item(3078)],617))

    def test_cash_back_full_item_and_free_transformation(self):
        self.data['activePlayer']['fullRunes']={'generalRunes':[{'id':8321}]}
        self.buy([],4000,baseline=True)
        self.assertEqual(self.buy([item(3078)],917)['item_id'],3078)
        self.setUp()
        self.data['activePlayer']['fullRunes']={'generalRunes':[{'id':8321}]}
        self.buy([item(3003)],1000,baseline=True)
        self.assertIsNone(self.buy([item(3040)],1217.5))

    def test_cash_back_refund_can_arrive_after_purchase(self):
        self.data['activePlayer']['fullRunes']={'generalRunes':[{'id':8321}]}
        self.buy([item(3057),item(3044),item(3051)],500,baseline=True)
        cue=self.buy([item(3078)],367)
        self.assertEqual(cue['item_id'],3078)
        again=self.buy([item(3078)],617)
        self.assertEqual((again['id'],again['pending']),(cue['id'],0))

    def test_support_ward_discount_requires_completed_quest_item(self):
        self.buy([item(3870)],1000,baseline=True)
        self.assertEqual(self.buy([item(3870),item(2055,price=75)],960)['item_id'],2055)
        self.setUp()
        self.assertIsNone(self.buy([item(2055,price=75)],960))

    def test_magical_boots_can_fund_paid_upgrade(self):
        self.buy([item(2422)],1000,baseline=True)
        self.assertEqual(self.buy([item(3020)],200)['item_id'],3020)

    def test_partial_stack_undo_preserves_other_purchase(self):
        first=self.buy([item(2003,count=2,price=50)],900)
        cue=self.buy([item(2003,count=1,price=50)],950)
        self.assertEqual((cue['id'],cue['pending']),(first['id'],0))

    def test_partial_stack_undo_split_updates_cancel_only_one_unit(self):
        for gold_first in [True,False]:
            with self.subTest(gold_first=gold_first):
                self.setUp()
                first=self.buy([item(2003,count=3,price=50)],850)
                self.buy([item(2003,count=3 if gold_first else 2,price=50)],900 if gold_first else 850)
                cue=self.buy([item(2003,count=2,price=50)],900)
                self.assertEqual((cue['id'],cue['pending']),(first['id'],1))
                self.assertEqual(self.buy([item(2003,count=2,price=50)],901)['pending'],1)

    def test_gold_evidence_is_bounded_and_cannot_be_reused(self):
        self.buy([item()],700)
        self.assertEqual(self.buy([item(),item(2003,price=50)],700)['pending'],0)
        self.setUp()
        self.buy([],700)
        for _ in range(3):self.buy([],700)
        self.assertIsNone(self.buy([item()],700))

    def test_malformed_inventory_discards_pending_evidence(self):
        self.buy([],700)
        self.assertIsNone(self.buy([dict(itemID=1001,count='bad')],700))
        self.assertIsNone(self.buy([item()],700))
        self.assertIsNone(self.buy([item()],700))

    def test_recipe_cost_requires_enough_spending_with_small_passive_income_allowance(self):
        self.assertIsNone(self.buy([item()],800))
        self.setUp()
        self.assertEqual(self.buy([item()],702)['item_id'],1001)

    def test_reorder_free_reward_sale_and_missing_gold_do_not_trigger(self):
        for gold,items in [(1001,[item()]),(500,[item(3340,price=0)]),(1200,[])]:
            with self.subTest(gold=gold):
                self.setUp()
                self.assertIsNone(self.buy(items,gold))
        self.setUp();self.data['allPlayers'][0]['items']=[item(),item(1036)]
        self.engine.ingest(self.data,baseline=True)
        self.assertIsNone(self.buy(list(reversed(self.data['allPlayers'][0]['items'])),500))
        self.setUp();self.assertIsNone(self.buy([item()],None))

    def test_reconnect_paused_disabled_game_end_and_new_game_clear(self):
        for mode in ['baseline','paused','disabled','ended','new']:
            with self.subTest(mode=mode):
                self.setUp();self.buy([item()])
                if mode=='paused':self.engine.config['paused']=True
                if mode=='disabled':self.engine.production.settings['item_purchases']=False
                if mode=='ended':self.data['events']['Events']=[dict(EventName='GameEnd',EventTime=101,EventID=1)]
                if mode=='new':self.data['gameData']['gameTime']=0
                self.assertIsNone(self.buy([item(),item(1036)],100,baseline=mode=='baseline'))

    def test_undo_removes_returned_item_and_rebuy_works(self):
        self.buy([item()],700)
        self.assertIsNone(self.buy([],1000))
        self.assertIsNotNone(self.buy([item()],700))

    def test_personal_clip_alerts_can_stay_disabled(self):
        self.engine.config['overlay_enabled']=False
        self.assertEqual(self.buy([item()])['item_id'],1001)
        self.assertEqual(self.engine.slots,[])

    def test_shared_pause_claim_discards_queue_without_replay_on_resume(self):
        from . import main
        with tempfile.TemporaryDirectory() as folder, patch.object(main,'ROOT',Path(folder)):
            service=main.Service(threading.Event())
            service.purchase_permission=threading.Event()
            service.engine.purchases.enqueue(1001,'Boots')
            self.assertIsNone(service.snapshot()['purchase'])
            service.purchase_permission.set()
            self.assertIsNone(service.snapshot()['purchase'])
            service.engine.purchases.enqueue(1001,'Boots')
            self.assertIsNotNone(service.snapshot()['purchase'])
            service.engine.production.settings['item_purchases']=False
            self.assertIsNone(service.snapshot()['purchase'])

    def test_bounded_queue_stale_delivery_and_unpurchasable_transform(self):
        p=ItemPurchases({'1001':{'gold':{'purchasable':False}}},clock=lambda:self.now)
        p.observe({'items':[]},{'items':[item()]},{'currentGold':1000},{'currentGold':500})
        self.assertIsNone(p.snapshot())
        for _ in range(100):p.enqueue(1001,'Boots')
        self.assertEqual(len(p.queue),24)
        self.now=21
        self.assertIsNone(p.snapshot())
