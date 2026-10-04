"""Evidence for viewer questions; historical comparisons never guess live roles."""
from . import analytics


def facts(records, current):
    lane = []
    if current and current.get('connected'):
        queue=current.get('queue')
        comparable = [r for r in records if queue is not None and str(r.get('queue')) == str(queue)]
        for field, label in (('enemy_adc','vs'),('ally_support','with')):
            champion = current.get('matchups',{}).get(field)
            if not champion:
                continue
            matches = [r for r in comparable if r.get('matchups',{}).get(field) == champion]
            lane.append(dict(label=label,champion=champion,queue_known=queue is not None,**analytics.aggregate(matches)))
    return dict(current=current,lifetime=analytics.aggregate(records),
                finished_items=analytics.items(records)[:3],lane=lane)
