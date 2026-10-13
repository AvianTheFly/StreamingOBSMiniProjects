"""Personal purchase inference and bounded presentation queue; no I/O or workers.

The live API exposes inventory, not transactions. A paid inventory addition is
an inference. Sales, free transformations and slot changes are not purchases.
"""
from collections import Counter, deque
import time
import uuid
from .purchase_recipes import PurchaseRecipes, inventory, number
from .purchase_ledger import PurchaseLedger


class ItemPurchases:
    duration = 2.8
    correlation_window = 1.25
    gold_tolerance = 5  # Small passive-income/rounding allowance, never proof by itself.

    def __init__(self, catalog=None, clock=time.monotonic):
        self.catalog = catalog or {}
        self.clock = clock
        self.queue = deque(maxlen=24)
        self.current = None
        self.recipes = PurchaseRecipes(self.catalog)
        self.history = deque(maxlen=8)
        self.ledger = PurchaseLedger()

    def clear(self):
        self.queue.clear()
        self.current = None
        self.history.clear()
        self.ledger.clear()

    def discard_evidence(self):
        self.history.clear()
        self.ledger.clear()

    def _cancel_cues(self, identities):
        self.queue = deque((row for row in self.queue if row['id'] not in identities), maxlen=24)
        if self.current and self.current['id'] in identities:
            self.current = None

    def _commit(self, plan, now, after, active):
        self._cancel_cues(self.ledger.accept_undo(plan['undo']))
        self._returned(plan['sold'].copy())
        for identity, count in plan['sold'].items():
            unit = Counter({identity: 1})
            credit = self.recipes.sale_values(unit, active)[plan['sale_index']]
            for _ in range(count):
                self.ledger.remember('sale', {}, unit, (credit, credit), now)
        for row in plan['rows']:
            cue = self.enqueue(row['item_id'], row['name'])
            amounts = (-row['cost'], -self.recipes.gold_requirement([row], after, active))
            self.ledger.remember('purchase', {row['item_id']: 1}, row['consumed'], amounts, now, cue)

    def _returned(self, removed):
        # One returned stack unit cancels one celebration, newest first.
        kept = []
        for row in reversed(self.queue):
            identity = row['item_id']
            if removed[identity] > 0:
                removed[identity] -= 1
            else:
                kept.append(row)
        self.queue = deque(reversed(kept), maxlen=24)
        if self.current and removed[self.current['item_id']] > 0:
            self.current = None

    def observe(self, before, after, old_active, active, *, game_time=None):
        now = self.clock() if game_time is None else game_time
        old_counts, new_counts = inventory(before), inventory(after)
        old_gold, gold = number(old_active.get('currentGold')), number(active.get('currentGold'))
        if old_counts is None or new_counts is None or old_gold is None or gold is None:
            self.discard_evidence()
            return
        details = {i.get('itemID'): i for i in after.get('items', [])}
        if self.history and (now < self.history[-1][0] or
                             self.history[-1][1:] != (old_counts, old_gold)):
            self.discard_evidence()
        while self.history and now - self.history[0][0] > self.correlation_window:
            self.history.popleft()
        if not self.history:
            self.history.append((now, old_counts, old_gold))
        # Prefer the immediate transition; older snapshots reconcile split updates.
        for _, prior_counts, prior_gold in reversed(self.history):
            plan = self.ledger.resolve(prior_counts, new_counts, gold-prior_gold, now,
                                       self.recipes, active, details, self.gold_tolerance)
            if plan is not None:
                self._commit(plan, now, new_counts, active)
                # Consumed snapshot evidence cannot fund another later purchase.
                self.history.clear()
                break
        self.history.append((now, new_counts, gold))

    def enqueue(self, identity, name):
        if len(self.queue) >= self.queue.maxlen:
            return
        cue_id = uuid.uuid4().hex
        self.queue.append(dict(id=cue_id, item_id=identity, name=name,
                               icon=f'/purchase-assets/{identity}.png',
                               confidence='inferred', queued=self.clock()))
        return cue_id

    def snapshot(self):
        now = self.clock()
        if self.current and now - self.current['started'] >= self.duration:
            self.current = None
        while self.queue and now - self.queue[0]['queued'] > 20:
            self.queue.popleft()
        if self.current is None and self.queue:
            self.current = dict(self.queue.popleft(), started=now)
        if not self.current:
            return None
        return {k: v for k, v in self.current.items() if k not in {'started', 'queued'}} | dict(
            elapsed=max(0, now - self.current['started']), duration=self.duration,
            pending=len(self.queue), x=1120, y=880, size=96, volume=.16)
