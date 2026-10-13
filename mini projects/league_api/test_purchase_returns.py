"""Sales and reversals must not masquerade as new shop purchases."""
import unittest
from collections import Counter
from . import test_item_purchases as fixtures
from .purchase_ledger import PurchaseLedger
from .purchase_recipes import PurchaseRecipes
item = fixtures.item


class ReturnTests(unittest.TestCase):
    setUp = fixtures.PurchaseTests.setUp
    buy = fixtures.PurchaseTests.buy

    def test_sale_then_undo_sale_is_silent_and_real_rebuy_is_new(self):
        first=self.buy([item()],700)
        self.assertIsNone(self.buy([],910))
        self.assertIsNone(self.buy([item()],700))  # Undo sale costs 210, not 300.
        self.assertIsNone(self.buy([],910))
        rebuy=self.buy([item()],610)
        self.assertEqual(rebuy['item_id'],1001)
        self.assertNotEqual(rebuy['id'],first['id'])

    def test_sale_and_larger_purchase_cancel_old_cue_despite_gold_drop(self):
        self.buy([item()],700)
        cue=self.buy([item(1036,price=350,name='Long Sword')],560)
        self.assertEqual((cue['item_id'],cue['pending']),(1036,0))

    def test_sale_and_purchase_can_leave_gold_unchanged(self):
        self.buy([item(1036,price=350)],650)
        cue=self.buy([item(9999,price=245,name='Test replacement')],650)
        self.assertEqual((cue['item_id'],cue['pending']),(9999,0))

    def test_undo_sale_and_new_purchase_only_celebrates_new_item(self):
        self.buy([item()],1000,baseline=True)
        self.assertIsNone(self.buy([],1210))
        cue=self.buy([item(),item(2003,price=50,name='Health Potion')],950)
        self.assertEqual((cue['item_id'],cue['pending']),(2003,0))

    def test_undo_purchase_and_new_purchase_only_celebrates_replacement(self):
        self.buy([item()],700)
        cue=self.buy([item(1036,price=350)],650)
        self.assertEqual((cue['item_id'],cue['pending']),(1036,0))

    def test_combined_item_undo_restores_components_without_new_cues(self):
        components=[item(3057),item(3044),item(3051)]
        self.buy(components,500,baseline=True)
        self.buy([item(3078)],367)
        self.assertIsNone(self.buy(components,500))
        self.assertEqual(self.buy([item(3078)],367)['item_id'],3078)

    def test_cash_back_combine_undo_lowers_gold_and_cancels_cue(self):
        self.data['activePlayer']['fullRunes']={'generalRunes':[{'id':8321}]}
        components=[item(3057),item(3044),item(3051)]
        self.buy(components,500,baseline=True)
        self.buy([item(3078)],617)
        self.assertIsNone(self.buy(components,500))

    def test_cash_back_undo_split_updates_in_both_orders(self):
        for gold_first in (True,False):
            with self.subTest(gold_first=gold_first):
                self.setUp()
                self.data['activePlayer']['fullRunes']={'generalRunes':[{'id':8321}]}
                components=[item(3057),item(3044),item(3051)]
                self.buy(components,500,baseline=True)
                self.buy([item(3078)],617)
                self.buy([item(3078)] if gold_first else components,500 if gold_first else 617)
                self.assertIsNone(self.buy(components,500))

    def test_cash_back_sale_uses_net_proceeds_and_undo_sale_is_silent(self):
        self.data['activePlayer']['fullRunes']={'generalRunes':[{'id':8321}]}
        self.buy([],4000,baseline=True)
        self.buy([item(3078)],917)
        # Fixed test catalog sell price is 2333.1; rebate is 249.975.
        proceeds=2333.1-249.975
        self.assertIsNone(self.buy([],917+proceeds))
        self.assertIsNone(self.buy([item(3078)],917))

    def test_tier_three_boot_undo_preserves_the_original_boot_purchase(self):
        self.buy([],3000,baseline=True)
        first=self.buy([item()],2700)
        self.buy([item(3175)],1900)
        cue=self.buy([item()],2700)
        self.assertEqual((cue['id'],cue['pending']),(first['id'],0))

    def test_partial_stack_sale_and_undo_do_not_replay_or_remove_other_units(self):
        first=self.buy([item(2003,count=3,price=50)],850)
        cue=self.buy([item(2003,count=2,price=50)],870)
        self.assertEqual((cue['id'],cue['pending']),(first['id'],1))
        cue=self.buy([item(2003,count=3,price=50)],850)
        self.assertEqual((cue['id'],cue['pending']),(first['id'],1))
        self.assertEqual(self.buy([item(2003,count=3,price=50)],851)['pending'],1)

    def test_multiple_units_undone_together_cancel_only_their_receipts(self):
        first=self.buy([item(2003,count=3,price=50)],850)
        cue=self.buy([item(2003,count=1,price=50)],950)
        self.assertEqual((cue['id'],cue['pending']),(first['id'],0))

    def test_free_upgrade_does_not_become_an_undo_and_repurchase(self):
        self.buy([],2000,baseline=True)
        first=self.buy([item(3020,price=1100)],900)
        cue=self.buy([item(3175,price=1100)],900)
        self.assertEqual((cue['id'],cue['pending']),(first['id'],0))

    def test_gold_gain_must_match_sale_or_observed_refund(self):
        first=self.buy([item()],700)
        cue=self.buy([],710)
        self.assertEqual(cue['id'],first['id'])
        self.assertEqual([r['kind'] for r in self.engine.purchases.ledger.entries],['purchase'])

    def test_consumption_plus_small_income_is_not_a_sale(self):
        first=self.buy([item(2003,price=50)],950)
        cue=self.buy([],956)
        self.assertEqual(cue['id'],first['id'])
        self.assertEqual([r['kind'] for r in self.engine.purchases.ledger.entries],['purchase'])

    def test_split_sale_and_sale_undo_updates_in_both_orders(self):
        for gold_first in (True,False):
            with self.subTest(gold_first=gold_first):
                self.setUp();self.buy([item()],700)
                self.buy([item()] if gold_first else [],910 if gold_first else 700)
                self.assertIsNone(self.buy([],910))
                self.assertIsNone(self.buy([] if gold_first else [item()],700 if gold_first else 910))
                self.assertIsNone(self.buy([item()],700))

    def test_duplicate_snapshot_does_not_forget_purchase_receipt(self):
        self.buy([item()],700)
        self.engine.ingest(self.data)
        self.assertEqual(len(self.engine.purchases.ledger.entries),1)
        self.assertIsNone(self.buy([],1000))

    def test_baseline_and_malformed_inventory_forget_shop_history(self):
        self.buy([item()],700)
        self.buy([item()],700,baseline=True)
        self.assertFalse(self.engine.purchases.ledger.entries)
        self.buy([item(),item(2003,price=50)],650)
        self.buy([{'itemID':2003,'count':'bad'}],650)
        self.assertFalse(self.engine.purchases.ledger.entries)

    def test_history_is_bounded_and_expired_reversals_are_not_assumed(self):
        ledger=PurchaseLedger()
        for _ in range(100):ledger.remember('sale',{}, {1001:1},(210,210),0)
        self.assertEqual(len(ledger.entries),64)
        matched,_,_=ledger.propose_undo(Counter(),Counter({1001:1}),121)
        self.assertFalse(matched)
        self.assertFalse(ledger.entries)

    def test_unseen_sale_before_baseline_does_not_invent_a_purchase(self):
        self.buy([],910,baseline=True)
        self.assertIsNone(self.buy([item()],700))

    def test_missing_boot_metadata_does_not_invent_component_credit(self):
        recipes=PurchaseRecipes({'3020':fixtures.CATALOG['3020']})
        rows,_,_=recipes.additions(Counter({2422:1}),Counter({3020:1}),{3020:item(3020,price=1100)})
        self.assertEqual(rows[0]['cost'],1100)
        self.assertFalse(rows[0]['consumed'])
