"""Combine owner-authored behavior maps with current source wiring and settings."""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
import threading
import time

from .source import application_sources, event_facts, proof, owner_fingerprints


class WorkflowCatalog:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self._lock = threading.Lock()
        self._checked = 0
        self._signature = None
        self._base = None

    def manifests(self):
        folders = ['lib', 'obs', 'voice', 'footage_manager', 'mini projects', 'spirit_lobby']
        return sorted(p for folder in folders for pattern in ('workflows.json','*.workflows.json') for p in (self.root/folder).rglob(pattern)
                      if not {'archive', '__pycache__'} & set(p.parts))

    def _build(self, paths, manifests, signature):
        modules, flows, facts, issues = {}, [], [], []
        fingerprints=owner_fingerprints(self.root,paths)
        for path in manifests:
            try:
                data = json.loads(path.read_text(encoding='utf-8-sig'))
                from .validation import validate_manifest
                validate_manifest(data)
                module = data['module']
                if module['id'] in modules: raise ValueError('Duplicate module')
                modules[module['id']] = module
                for original in data['flows']:
                    flow = copy.deepcopy(original)
                    flow['owner'] = module['id']
                    flow['manifest'] = path.relative_to(self.root).as_posix()
                    flow['proofs'] = []
                    for reference in flow.get('evidence', []):
                        try:
                            evidence = proof(self.root, reference)
                            evidence['status'] = 'verified' if reference.get('hash') == evidence['current_hash'] else 'changed'
                        except (OSError, ValueError, SyntaxError) as exc:
                            evidence = {**reference, 'status': 'missing', 'error': str(exc)}
                        flow['proofs'].append(evidence)
                    flow['verification'] = ('verified' if flow['proofs'] and all(p['status']=='verified' for p in flow['proofs']) else 'review')
                    flow['changed_owners']=[owner for owner,digest in flow.get('owner_hashes',{}).items() if fingerprints.get(owner)!=digest]
                    if flow['changed_owners']:flow['verification']='review'
                    flows.append(flow)
            except (OSError, ValueError, KeyError, TypeError) as exc:
                issues.append({'path': path.relative_to(self.root).as_posix(), 'error': str(exc)})
        for path in paths:
            try: facts.extend(event_facts(self.root, path))
            except (OSError, SyntaxError, UnicodeError) as exc:
                issues.append({'path': path.relative_to(self.root).as_posix(), 'error': str(exc)})
        # Conditions read only the explicitly declared JSON field, never expose
        # credentials or silently replace malformed personal settings.
        settings = {}
        for flow in flows:
            for step in flow.get('steps', []):
                condition = step.get('setting')
                if not condition: continue
                try:
                    relative = condition['path']
                    path = (self.root / relative).resolve()
                    if not path.is_relative_to(self.root) or path.suffix != '.json': raise ValueError('Invalid setting path')
                    if relative not in settings: settings[relative] = json.loads(path.read_text(encoding='utf-8-sig'))
                    value = settings[relative]
                    for key in condition['key'].split('.'): value = value[key]
                    step['configured'] = value if isinstance(value, (bool, int, float, str)) else None
                except (OSError, KeyError, TypeError, ValueError):
                    step['configured'] = None
        revision = hashlib.sha256(repr(signature).encode()).hexdigest()[:16]
        return {'revision': revision, 'generated_at': time.time(), 'modules': list(modules.values()),
                'flows': flows, 'wiring': facts, 'issues': issues, 'source_count': len(paths),
                'review_count': sum(f['verification'] != 'verified' for f in flows)}

    def snapshot(self, *, projects=(), rules=(), workflows=(), hotkeys=None):
        with self._lock:
            if self._base is None or time.monotonic()-self._checked >= 5:
                paths, manifests = application_sources(self.root), self.manifests()
                config_paths = []
                if self._base:
                    config_paths = [self.root/s['setting']['path'] for f in self._base['flows'] for s in f.get('steps',[]) if s.get('setting')]
                signature = [(p.relative_to(self.root).as_posix(), p.stat().st_mtime_ns, p.stat().st_size)
                             for p in sorted(set(paths+manifests+config_paths)) if p.is_file()]
                if signature != self._signature:
                    self._base = self._build(paths, manifests, signature)
                    self._signature = signature
                self._checked = time.monotonic()
            data = copy.deepcopy(self._base)
        data.update(projects=list(projects), rules=list(rules), saved_workflows=list(workflows), hotkeys=hotkeys or {})
        configured=json.dumps({'rules':data['rules'],'workflows':data['saved_workflows'],'hotkeys':data['hotkeys']},sort_keys=True,default=str)
        data['revision']=hashlib.sha256((data['revision']+configured).encode()).hexdigest()[:16]
        return data

    def source_excerpt(self, path, symbol):
        data = self.snapshot()
        reference = next((p for f in data['flows'] for p in f['proofs'] if p['path']==path and p['symbol']==symbol), None)
        if reference is None: raise ValueError('Source is not a mapped behavior')
        if reference['status']=='missing': return reference
        lines = (self.root/path).read_text(encoding='utf-8-sig').splitlines()
        start = reference['line']-1
        return {**reference, 'text': '\n'.join(lines[start:min(reference['end_line'], start+90)])}
