"""Bounded observed shop history for inferred reversals; no I/O or workers."""
from collections import Counter, deque


class PurchaseLedger:
    capacity = 64
    lifetime = 120  # A local inference horizon, not Riot's undo eligibility rule.

    def __init__(self):
        self.entries = deque(maxlen=self.capacity)

    def clear(self):
        self.entries.clear()

    def expire(self, now):
        while self.entries and now-self.entries[0]['time'] > self.lifetime:
            self.entries.popleft()

    def remember(self, kind, gained, lost, gold, now, cue=None):
        self.expire(now)
        self.entries.append(dict(kind=kind, gained=Counter(gained), lost=Counter(lost),
                                 gold=tuple(gold), time=now, cue=cue))

    def propose_undo(self, before, after, now, protected=None):
        """Find non-overlapping inverse item deltas, newest observations first.

        The caller must validate the combined gold balance before accepting.
        Items observed together have no known click order.
        """
        self.expire(now)
        added, removed = after-before, before-after
        eligible = removed-(protected or Counter())
        matched = []
        for entry in reversed(self.entries):
            if entry['lost'] <= added and entry['gained'] <= eligible:
                added -= entry['lost']
                removed -= entry['gained']
                eligible -= entry['gained']
                matched.append(entry)
        return matched, removed, added

    def accept_undo(self, entries):
        selected = {id(row) for row in entries}
        self.entries = deque((row for row in self.entries if id(row) not in selected), maxlen=self.capacity)
        return {row['cue'] for row in entries if row['cue'] is not None}

    def resolve(self, before, after, gold_gain, now, recipes, active, details, tolerance=5):
        """Propose a balanced reversal/sale/purchase plan without committing it."""
        _, _, unused = recipes.additions(before, after, details)
        # A component consumed by a normal recipe is not evidence of an undo.
        protected = (before-after)-unused
        reversed_entries, remaining_removed, remaining_added = self.propose_undo(before, after, now, protected)
        if reversed_entries:
            for index in (0, 1):
                refund = -sum(row['gold'][index] for row in reversed_entries)
                result = self._account(remaining_removed, remaining_added, after, gold_gain-refund,
                                       recipes, active, details, tolerance, strict=True)
                if result is not None:
                    return result | {'undo': reversed_entries}
        result = self._account(before, after, after, gold_gain, recipes, active, details, tolerance)
        return None if result is None else result | {'undo': []}

    @staticmethod
    def _account(before, after, actual_inventory, gold_gain, recipes, active, details, tolerance, strict=False):
        rows, _, removed = recipes.additions(before, after, details)
        costs = (sum(row['cost'] for row in rows), recipes.gold_requirement(rows, actual_inventory, active))
        # Require a matching balance before calling a disappearance a sale.
        # Catalog sell prices vary by item; a universal 70% assumption is wrong.
        if removed:
            for index, credit in enumerate(recipes.sale_values(removed, active)):
                if credit > 0 and any(abs(gold_gain-(credit-cost)) <= tolerance for cost in costs):
                    return dict(rows=rows, sold=removed, sale_index=index)
        if strict:
            balanced = not removed and any(abs(gold_gain+cost) <= tolerance for cost in costs)
        else:
            balanced = bool(rows) and any(
                (-gold_gain > 1 and -gold_gain+tolerance >= cost) if cost > 1
                else abs(gold_gain+cost) <= tolerance for cost in costs)
        return dict(rows=rows, sold=Counter(), sale_index=0) if balanced else None
