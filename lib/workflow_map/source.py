"""Import-free source facts and review proofs. Never execute feature/config code."""
from __future__ import annotations

import ast
import hashlib
import os
from pathlib import Path

from lib.project_registry import SUPPORTED_RUNTIME_PROJECTS


def application_sources(root: Path):
    folders = ['lib', 'obs', 'voice', 'hub_ui', 'footage_manager', 'spirit_lobby']
    folders += ['mini projects/' + name for name in sorted(SUPPORTED_RUNTIME_PROJECTS)]
    paths = [root / name for name in ('hub.py', 'main.py', 'coordinator.py', 'shared.py',
                                    'events.py', 'hub_actions.py', 'hub_rules.py', 'hub_config.py')]
    for folder in folders:
        for extension in ('*.py','*.js'):paths.extend((root / folder).rglob(extension))
    return sorted(p for p in set(paths) if p.is_file() and not p.name.startswith('test')
                  and not {'archive', '__pycache__', 'sandbox_testing'} & set(p.parts))


def owner_for(relative: str):
    parts = Path(relative).parts
    if parts[0] == 'mini projects':
        return parts[1]
    for prefix, owner in (
        ('spirit_lobby/', 'lobby_screens'), ('hub_ui/app/spirit-lobby/', 'lobby_screens'),
        ('hub_ui/app/lobby-motion/shared/', 'browser_effects'),
        ('hub_ui/app/lobby-motion/', 'scene_voice_switcher'),
        ('hub_ui/routes/spirit_lobby.py', 'lobby_screens'),
        ('lib/coordination/', 'coordination'), ('lib/shared_media/', 'media_workers'),
        ('lib/twitch_redemptions/', 'rewards'), ('lib/chat_overlay/', 'chat'),
        ('lib/scene_transitions/', 'transitions'), ('lib/browser_effects/', 'browser_effects'),
        ('voice/', 'voice'), ('footage_manager/', 'footage_desk'),
        ('lib/twitch_clips', 'twitch_clips'), ('lib/twitch_chat', 'chat_transport'),
        ('lib/media_jobs', 'conversion'), ('lib/asset_preparation', 'preparation'),
        ('lib/settings_backups', 'settings_history'), ('hub_ui/', 'hub'),
        ('lib/global_hotkeys', 'keyboard'), ('lib/keyboard_worker', 'keyboard'),
        ('obs/', 'obs'),
    ):
        if relative.startswith(prefix):
            return owner
    return 'hub'


def owner_fingerprints(root, paths):
    """Conservative owner scopes catch helper changes outside a cited function."""
    digests={}
    for path in paths:
        relative=path.relative_to(root).as_posix()
        owner=owner_for(relative)
        digest=digests.setdefault(owner,hashlib.sha256())
        digest.update(relative.encode())
        try:
            source=path.read_text(encoding='utf-8-sig')
            digest.update((ast.dump(ast.parse(source),include_attributes=False) if path.suffix=='.py' else source).encode())
        except (OSError,SyntaxError,UnicodeError):digest.update(b'UNREADABLE')
    return {owner:digest.hexdigest() for owner,digest in digests.items()}


def safe_source(root, relative):
    """Review checkout files and supported module junctions to their durable home.

    Discovery already follows installed feature directories. Proofs accept only
    that same supported module's exact LOCALAPPDATA home, never arbitrary links
    or links escaping from inside an installed module.
    """
    relative = Path(relative)
    if relative.is_absolute() or '..' in relative.parts or relative.suffix != '.py':
        raise ValueError('Source must be a Python file inside this checkout')
    path = (root / relative).resolve()
    if path.is_relative_to(root.resolve()):
        return path
    parts=relative.parts
    local=os.environ.get('LOCALAPPDATA')
    if local and len(parts)>=3 and parts[0]=='mini projects' and parts[1] in SUPPORTED_RUNTIME_PROJECTS:
        installed=Path(local)/'StreamingHub'/'feature-packages'/parts[1]
        checkout_module=root/'mini projects'/parts[1]
        if checkout_module.resolve()==installed.resolve() and path.is_relative_to(installed.resolve()):
            return path
    raise ValueError('Source must be a Python file inside this checkout or its installed feature')


def symbols(tree):
    result = {'<module>': tree}
    def visit(node, prefix=''):
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                name = prefix + child.name
                result[name] = child
                visit(child, name + '.')
            else:
                visit(child, prefix)
    visit(tree)
    return result


def proof(root, reference):
    path = safe_source(root, reference['path'])
    tree = ast.parse(path.read_text(encoding='utf-8-sig'), filename=reference['path'])
    node = symbols(tree).get(reference['symbol'])
    if node is None:
        raise ValueError('Source symbol no longer exists: ' + reference['symbol'])
    # Attribute-free AST remains stable when lines move or formatting changes.
    digest = hashlib.sha256(ast.dump(node, include_attributes=False).encode()).hexdigest()
    return {**reference, 'current_hash': digest, 'line': getattr(node, 'lineno', 1),
            'end_line': getattr(node, 'end_lineno', len(path.read_text(encoding='utf-8-sig').splitlines()))}


def _literal(node, values):
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.Name):
        return values.get(node.id)
    if isinstance(node, ast.Attribute):
        return values.get(ast.unparse(node))
    return None


def event_facts(root, path):
    if path.suffix!='.py':return []
    relative = path.relative_to(root).as_posix()
    owner = owner_for(relative)
    tree = ast.parse(path.read_text(encoding='utf-8-sig'), filename=relative)
    aliases = {'events', 'hub_events'}
    functions = {}
    values = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            aliases.update(a.asname or a.name for a in node.names if a.name == 'events')
        if isinstance(node, ast.ImportFrom) and node.module == 'events':
            functions.update({a.asname or a.name:a.name for a in node.names})
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
            for target in node.targets:
                if isinstance(target, ast.Name): values[target.id] = node.value.value
    # Resolve a feature's declarative event binding without importing config.
    config = path.parent/'config.py'
    if config.is_file():
        config_tree=ast.parse(config.read_text(encoding='utf-8-sig'))
        for node in ast.walk(config_tree):
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
                for target in node.targets:
                    if isinstance(target, ast.Name): values.setdefault(target.id,node.value.value)
        for node in ast.walk(config_tree):
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call):
                for keyword in node.value.keywords:
                    if keyword.arg=='event_name':
                        value=_literal(keyword.value,values)
                        for target in node.targets:
                            if isinstance(target,ast.Name) and value: values[target.id+'.event_name']=value
    facts = []
    if path.name=='config.py' and owner in SUPPORTED_RUNTIME_PROJECTS and values.get('CONFIG.event_name'):
        facts.append({'event':values['CONFIG.event_name'],'kind':'listen','owner':owner,'path':relative,
                      'line':1,'symbol':'CONFIG','handler':'Configured media event binding'})
    for symbol, scope in symbols(tree).items():
        # Calls belong to their nearest scope, rather than every containing class.
        def walk(node):
            for child in ast.iter_child_nodes(node):
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)): continue
                yield child
                yield from walk(child)
        for node in walk(scope):
            if not isinstance(node, ast.Call) or not node.args: continue
            func = node.func
            method = func.attr if isinstance(func, ast.Attribute) else ''
            receiver = ast.unparse(func.value) if isinstance(func, ast.Attribute) else ''
            bus = 'hub' if receiver in aliases else None
            if isinstance(func,ast.Name) and func.id in functions:
                method=functions[func.id];bus='hub'
            if owner == 'league' and receiver.endswith('.events') and method in {'emit', 'register'}:
                bus = 'league'
            if owner == 'league_api' and relative.endswith('/engine.py') and isinstance(func, ast.Name) and func.id == 'emit':
                method, bus = 'emit', 'league_api'
            if not bus or method not in {'emit', 'subscribe', 'register', 'inspect_event'}: continue
            name = _literal(node.args[0], values)
            if not name: continue  # Dynamic names are represented by reviewed flows.
            event = name if bus == 'hub' else bus + ':' + name
            facts.append({'event': event, 'kind': 'observe' if method=='inspect_event' else 'emit' if method == 'emit' else 'listen',
                          'owner': owner, 'path': relative, 'line': node.lineno, 'symbol': symbol,
                          'handler': ast.unparse(node.args[1]) if method != 'emit' and len(node.args)>1 else ''})
    return facts
