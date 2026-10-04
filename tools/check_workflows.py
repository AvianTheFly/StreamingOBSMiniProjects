"""Check visual workflow coverage and reviewed source evidence, without runtime imports.

After reviewing a changed explanation against its owner, --stamp FLOW_ID updates
only that flow's source proofs. It does not generate policy from code or settings.
"""
import argparse
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from lib.project_registry import SUPPORTED_RUNTIME_PROJECTS
from lib.workflow_map.catalog import WorkflowCatalog
from lib.workflow_map.source import proof, application_sources, owner_fingerprints
from lib.json_store import update_json


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stamp',action='append',default=[],metavar='FLOW_ID')
    args=parser.parse_args()
    catalog=WorkflowCatalog(ROOT)
    fingerprints=owner_fingerprints(ROOT,application_sources(ROOT))
    for identity in args.stamp:
        matched=False
        for path in catalog.manifests():
            data=json.loads(path.read_text(encoding='utf-8-sig'))
            if not any(f.get('id')==identity for f in data.get('flows',[])):continue
            def reviewed(current):
                for flow in current['flows']:
                    if flow['id']==identity:
                        flow['evidence']=[{**r,'hash':proof(ROOT,r)['current_hash']} for r in flow['evidence']]
                        flow['owner_hashes']={owner:fingerprints.get(owner,'') for owner in {current['module']['id'],*(s['owner'] for s in flow['steps'])}}
                return current
            update_json(path,reviewed)
            matched=True
        if not matched:parser.error('Unknown flow: '+identity)
    data=catalog.snapshot()
    owners={m['id'] for m in data['modules']}
    errors=[f"Missing feature map: {owner}" for owner in sorted(set(SUPPORTED_RUNTIME_PROJECTS)-owners)]
    errors.extend(f"{i['path']}: {i['error']}" for i in data['issues'])
    identities=set()
    for flow in data['flows']:
        if flow['id'] in identities:errors.append('Duplicate flow: '+flow['id'])
        identities.add(flow['id'])
        for step in flow['steps']:
            if step['owner'] not in owners:errors.append(f"{flow['id']}: unmapped owner {step['owner']}")
        for reference in flow['proofs']:
            if reference['status']!='verified':errors.append(f"{flow['id']}: review {reference['path']} / {reference['symbol']}")
        if flow.get('changed_owners'):errors.append(f"{flow['id']}: review changed owner scope {', '.join(flow['changed_owners'])}")
    print(f"Workflow map: {len(owners)} modules, {len(data['flows'])} behaviors, {len(data['wiring'])} source facts")
    for error in errors:print(error)
    return bool(errors)


if __name__=='__main__':raise SystemExit(main())
