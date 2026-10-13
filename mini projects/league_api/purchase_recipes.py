"""Pure item-recipe accounting for observed inventory changes.

Data Dragon's purchasable flag also covers zero-cost quest upgrades. Resolve
actual consumed recipe components before deciding whether gold was required.
"""
from collections import Counter
import math


def number(value):
    return float(value) if type(value) in (int, float) and math.isfinite(value) and value >= 0 else None


def inventory(player):
    items=player.get('items')
    if not isinstance(items,list) or len(items)>16:
        return None
    counts=Counter()
    for item in items:
        if not isinstance(item,dict):return None
        identity,count=item.get('itemID'),item.get('count',1)
        if type(identity) is not int or identity<=0 or type(count) is not int or not 0<count<=20:
            return None
        counts[identity]+=count
    return counts


class PurchaseRecipes:
    def __init__(self,catalog):
        self.catalog=catalog

    def meta(self,identity):
        return self.catalog.get(str(identity),{})

    def total(self,identity):
        return number(self.meta(identity).get('gold',{}).get('total'))

    def children(self,identity):
        meta=self.meta(identity)
        special=meta.get('specialRecipe')
        if special and str(special).isdigit():return [int(special)]
        return [int(i) for i in meta.get('from',[]) if str(i).isdigit()]

    def consume(self,identity,removed,visited=()):
        if identity in visited or len(visited)>12:return 0
        total=self.total(identity)
        if removed[identity] and total is not None:
            removed[identity]-=1
            return total
        # Magical Footwear replaces ordinary Boots in the same paid recipes.
        if identity==1001 and total is not None and removed[2422] and self.total(2422)==total:
            removed[2422]-=1
            return total
        return sum(self.consume(child,removed,(*visited,identity)) for child in self.children(identity))

    def gold_requirement(self,additions,after,active):
        """Standard-map discounts verified against 16.20.1 and 26.1/26.3 notes.

        Legendary classification is inferred from the store recipe graph. This
        is an accounting allowance, not a new source of transaction certainty.
        """
        support_complete=any(after[i]>0 for i in (3867,3869,3870,3871,3876,3877))
        cost=0
        for row in additions:
            identity=row['purchased_id']
            required=row['cost']
            if identity==2055 and support_complete:
                required=min(required,40)
            required-=self.rebate(identity,active)
            cost+=required
        return cost

    def rebate(self,identity,active):
        full=active.get('fullRunes')
        runes=full.get('generalRunes',[]) if isinstance(full,dict) else []
        if not isinstance(runes,list):runes=[]
        if not any(isinstance(r,dict) and r.get('id')==8321 for r in runes):return 0
        identity=self.paid_form(identity)
        meta=self.meta(identity)
        terminal=not any(self.meta(int(i)).get('gold',{}).get('purchasable')
                         for i in meta.get('into',[]) if str(i).isdigit())
        if self.children(identity) and terminal and not set(meta.get('tags',[]))&{'Boots','Consumable','Trinket','Lane'}:
            return (self.total(identity) or 0)*.075
        return 0

    def sale_values(self,removed,active):
        gross=sum((number(self.meta(i).get('gold',{}).get('sell')) or 0)*n for i,n in removed.items())
        # Keep both alternatives: rebate clawback timing is not a live API field.
        net=gross-sum(self.rebate(i,active)*n for i,n in removed.items())
        return gross,net

    def paid_form(self,identity):
        """Known non-store transformations may immediately follow a real purchase."""
        visited=set()
        while identity not in visited:
            visited.add(identity)
            meta=self.meta(identity)
            if meta.get('gold',{}).get('purchasable') is not False and meta.get('inStore') is not False:
                return identity
            parents=self.children(identity)
            if len(parents)!=1:return None
            identity=parents[0]
        return None

    def additions(self,before,after,details):
        added=after-before
        removed=before-after
        result=[]
        # Large recipes first; a removed component can fund only one result.
        for identity,count in sorted(added.items(),key=lambda pair:self.total(pair[0]) or 0,reverse=True):
            meta=self.meta(identity)
            paid=self.paid_form(identity)
            total=self.total(identity)
            if total is None:total=number(details[identity].get('price'))
            for _ in range(min(count,20)):
                available=removed.copy()
                credit=sum(self.consume(child,removed) for child in self.children(identity))
                cost=max(0,(total or 0)-credit)
                if paid is not None and cost>0:
                    result.append(dict(item_id=identity,cost=cost,purchased_id=paid,consumed=available-removed,
                                       name=details[identity].get('displayName') or meta.get('name') or f'Item {identity}'))
        # Unconsumed removals can be sales. Gold increases alone are not sales.
        sales=sum((number(self.meta(identity).get('gold',{}).get('sell')) or 0)*count
                  for identity,count in removed.items() if count>0)
        return result,sales,removed
