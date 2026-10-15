"""Read the League launcher API using its rotating local lockfile credentials."""
from __future__ import annotations

import base64
import json
from pathlib import Path
import ssl
import time
from urllib.request import HTTPSHandler, ProxyHandler, Request, build_opener
import websocket


class LeagueClient:
    def __init__(self):
        self.path = None
        self.discover_at = 0
        self.opener = build_opener(ProxyHandler({}), HTTPSHandler(context=ssl._create_unverified_context()))

    def lockfile(self):
        if self.path and self.path.is_file():
            return self.path
        if time.monotonic() < self.discover_at:
            raise OSError('League client is closed')
        self.discover_at = time.monotonic() + 2
        import psutil
        candidates = [Path('C:/Riot Games/League of Legends/lockfile')]
        for process in psutil.process_iter(['name', 'exe']):
            if (process.info['name'] or '').lower() in {'leagueclient.exe', 'leagueclientux.exe'}:
                if process.info['exe']:
                    candidates.insert(0, Path(process.info['exe']).parent / 'lockfile')
        self.path = next((p for p in candidates if p.is_file()), None)
        if self.path is None:
            raise OSError('League client is closed')
        return self.path

    def credentials(self):
        _, _, port, token, protocol = self.lockfile().read_text(encoding='utf-8').strip().split(':')
        port = int(port)
        if protocol != 'https' or not 1 <= port <= 65535 or not token:
            raise ValueError('Invalid League client lockfile')
        authorization = 'Basic ' + base64.b64encode(('riot:' + token).encode()).decode()
        return port, authorization

    def connect_events(self):
        """Subscribe to the local LCU WAMP stream; caller owns the socket."""
        port, authorization = self.credentials()
        connection = websocket.create_connection(
            f'wss://127.0.0.1:{port}/',
            header={'Authorization': authorization},
            sslopt={'cert_reqs': ssl.CERT_NONE, 'check_hostname': False},
            timeout=2,
        )
        try:
            connection.send(json.dumps([5, 'OnJsonApiEvent']))
            connection.settimeout(.5)
        except Exception:
            connection.close()
            raise
        return connection

    @staticmethod
    def relevant_event(raw):
        try:
            message = json.loads(raw)
            if not isinstance(message, list) or len(message) < 3 or message[:2] != [8, 'OnJsonApiEvent']:
                return False
            uri = message[2].get('uri')
            return uri in {'/lol-gameflow/v1/gameflow-phase', '/lol-gameflow/v1/session', '/lol-champ-select/v1/session',
                           '/lol-matchmaking/v1/search', '/lol-lobby/v2/lobby'} or (
                isinstance(uri, str) and uri.startswith('/lol-chat/v1/conversations'))
        except (TypeError, ValueError, AttributeError):
            return False

    def get(self, path):
        port, authorization = self.credentials()
        request = Request(f'https://127.0.0.1:{port}{path}', headers={'Authorization': authorization})
        with self.opener.open(request, timeout=2) as response:
            return json.load(response)

    def chat_messages(self, session):
        """Only the current champion-select room; no direct messages or credentials."""
        room = (session.get('chatDetails') or {}).get('chatRoomName', '')
        conversations = self.get('/lol-chat/v1/conversations')
        if not isinstance(conversations, list):
            return []
        matches = [c for c in conversations if isinstance(c, dict) and c.get('type') == 'championSelect']
        def same_room(conversation):
            if not room:
                return False
            identifiers = (conversation.get('id'), conversation.get('name'), conversation.get('pid'))
            return any(isinstance(value, str) and
                       (room == value or room == value.split('@', 1)[0])
                       for value in identifiers)
        selected = next((c for c in matches if same_room(c)), None)
        if selected is None and len(matches) == 1:
            selected = matches[0]
        if selected is None:
            return []
        from urllib.parse import quote
        messages = self.get('/lol-chat/v1/conversations/' + quote(str(selected['id']), safe='') + '/messages')
        if not isinstance(messages, list):
            return []
        local_cell = session.get('localPlayerCellId')
        local_player = next((p for p in session.get('myTeam', [])
                             if isinstance(p, dict) and local_cell is not None and p.get('cellId') == local_cell), {})
        local_summoner = local_player.get('summonerId')
        def sender(message):
            identity = str(message.get('fromSummonerId') or '').strip()
            if identity in {'', '0'}:
                return 'TEAM'
            if local_summoner and identity == str(local_summoner):
                return 'YOU'
            for index, player in enumerate(session.get('myTeam') or []):
                if not isinstance(player, dict):
                    continue
                if identity == str(player.get('summonerId')):
                    return str(player.get('obfuscatedSummonerName') or player.get('gameName')
                               or player.get('summonerName') or f'Teammate {index + 1}')[:64]
            # Never infer an identity when the client withholds its mapping.
            return 'TEAM'
        return [{'id': str(m.get('id', ''))[:100],
                 'body': str(m.get('body', ''))[:500],
                 'sender': sender(m)}
                for m in messages[-10:] if isinstance(m, dict) and m.get('type') in {'chat', 'groupchat'} and m.get('body')]

    def queue_details(self, phase):
        """Read only timer and local role preferences; optional endpoints fail alone."""
        result = {}
        if phase not in {'Lobby', 'Matchmaking', 'ReadyCheck', 'ChampSelect'}:
            return result
        try:
            search = self.get('/lol-matchmaking/v1/search')
            if isinstance(search, dict):
                result.update(seconds=search.get('timeInQueue'), search_state=search.get('searchState'))
        except (OSError, ValueError, TypeError):
            pass
        try:
            lobby = self.get('/lol-lobby/v2/lobby')
            if isinstance(lobby, dict) and isinstance(lobby.get('localMember'), dict):
                member = lobby['localMember']
                result.update(roles_known=True, primary=member.get('firstPositionPreference'),
                              secondary=member.get('secondPositionPreference'))
        except (OSError, ValueError, TypeError, AttributeError):
            pass
        return result

    def snapshot(self):
        phase = self.get('/lol-gameflow/v1/gameflow-phase')
        if not isinstance(phase, str):
            raise ValueError('Invalid League client phase')
        session = None
        if phase == 'ChampSelect':
            # Gameflow can advance before the session endpoint is ready. Keep
            # the scene hidden until the ban/pick actions can be read.
            try:
                session = self.get('/lol-champ-select/v1/session')
            except (OSError, ValueError, TypeError):
                pass
            if not isinstance(session, dict):
                session = None
        elif phase in {'GameStart', 'InProgress', 'Reconnect', 'WatchInProgress'}:
            try:
                session = self.get('/lol-gameflow/v1/session')
            except (OSError, ValueError, TypeError):
                pass
        return phase, session

    def replay_active(self):
        """Observe the replay game process without requiring the optional API.

        None means a game process could not be inspected; callers retain their
        last observation. Inspect command lines only for the game executable.
        """
        import psutil
        uncertain = False
        from lib.process_inventory import process_snapshot
        for entry in process_snapshot():
            if entry.name.lower() != 'league of legends.exe':
                continue
            try:
                process = psutil.Process(entry.pid)
                if process.name().lower() != 'league of legends.exe':
                    continue  # Reject PID reuse after the discovery snapshot.
                if any(str(arg).strip('"').lower().endswith('.rofl') for arg in process.cmdline()[1:]):
                    return True
            except psutil.NoSuchProcess:
                continue
            except psutil.AccessDenied:
                uncertain = True
        return None if uncertain else False
