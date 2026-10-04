"""Pure shape validation for owner-authored visual behavior descriptions."""


def validate_manifest(data):
    if not isinstance(data, dict): raise ValueError('Map must be an object')
    module = data.get('module', {})
    for field in ('id', 'label', 'group'):
        if not isinstance(module.get(field), str) or not module[field]:
            raise ValueError('Module needs ' + field)
    flows = data.get('flows')
    if not isinstance(flows, list): raise ValueError('Flows must be a list')
    seen = set()
    for flow in flows:
        for field in ('id', 'label', 'topic'):
            if not isinstance(flow.get(field), str) or not flow[field]: raise ValueError('Flow needs ' + field)
        if flow['id'] in seen or not flow['id'].startswith(module['id'] + '.'):
            raise ValueError('Flow identity must be unique and scoped to its owner')
        seen.add(flow['id'])
        trigger = flow.get('trigger', {})
        if trigger.get('kind') not in {'event', 'control', 'poll', 'background', 'browser', 'separate'}:
            raise ValueError('Unknown trigger kind')
        steps = flow.get('steps', [])
        if not steps: raise ValueError('Flow needs steps')
        ids = {step.get('id') for step in steps}
        if len(ids) != len(steps) or None in ids: raise ValueError('Step identities must be unique')
        for step in steps:
            if not step.get('label') or not step.get('owner'): raise ValueError('Step needs a label and owner')
        for edge in flow.get('edges', []):
            if edge.get('from') not in ids or edge.get('to') not in ids: raise ValueError('Edge refers to a missing step')
        if not flow.get('evidence'): raise ValueError('Flow needs review evidence')
