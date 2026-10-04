"""Reuse the user's installed desktop host; keep restorable original settings."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import threading
import time
import psutil
from lib.json_store import write_json
from lib.paths import PROJECT_ROOT
from lib.settings_backups import SettingsBackups

LOCK = threading.RLock()


def activate(port):
    with LOCK:
        roaming = Path(os.environ['APPDATA']) / 'TransparentTwitchChatWPF'
        executable = Path(os.environ['LOCALAPPDATA']) / 'TransparentTwitchChat' / 'current' / 'TransparentTwitchChatWPF.exe'
        config = roaming / 'AppSettings.json'
        if not executable.is_file() or not config.is_file():
            raise ValueError('Transparent Twitch Chat is not installed at its saved location. Use the live overlay URL in a transparent desktop host.')
        data = json.loads(config.read_text(encoding='utf-8-sig'))
        general = next(item['Value'] for item in data if item.get('Name') == 'GeneralSettings')
        # Do not overwrite a running host's in-memory preferences.
        running = []
        for process in psutil.process_iter(['name', 'exe']):
            try:
                if process.info['exe'] and os.path.normcase(process.info['exe']) == os.path.normcase(str(executable)):
                    running.append(process)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        # Installed 0.x/1.0 hosts use CustomURL=2; the newer NativeChat build
        # uses CustomURL=3. A bundled jchat.html identifies the older host.
        custom_mode = 2 if (executable.parent / 'browser' / 'jchat.html').is_file() else 3
        if running:
            if general.get('ChatType') == custom_mode and general.get('CustomURL') == f'http://127.0.0.1:{port}/chat/overlay.html':
                return {'message': 'Your custom desktop chat is already running. Appearance updates automatically.'}
            raise ValueError('Close Transparent Twitch Chat first so it saves its current preferences, then press Use on my desktop again.')
        SettingsBackups().snapshot()
        history = Path(os.environ['LOCALAPPDATA']) / 'StreamingHub' / 'desktop-chat-backups' / str(time.time_ns())
        history.mkdir(parents=True)
        for name in ('AppSettings.json', 'MainWindow_State.json'):
            if (roaming / name).is_file():
                shutil.copy2(roaming / name, history / name)
        general['ChatType'] = custom_mode
        general['CustomURL'] = f'http://127.0.0.1:{port}/chat/overlay.html'
        general['AllowInteraction'] = False
        # Custom content owns its visual styles; keep all other host preferences.
        general['CustomCSS'] = 'html,body { background: transparent !important; }'
        write_json(config, data)
        state_path = roaming / 'MainWindow_State.json'
        if state_path.is_file():
            import ctypes
            user = ctypes.windll.user32
            width, height = user.GetSystemMetrics(0), user.GetSystemMetrics(1)
            state = json.loads(state_path.read_text(encoding='utf-8-sig'))
            values = {item['Name']: item['Value'] for item in state}
            if values.get('Left', 0) < 0 or values.get('Left', 0) + values.get('Width', 339) > width or values.get('Top', 0) < 0 or values.get('Top', 0) + values.get('Height', 467) > height:
                for item in state:
                    if item['Name'] == 'Left': item['Value'] = 16.0
                    if item['Name'] == 'Top': item['Value'] = float(max(16, (height - 467) // 2))
                write_json(state_path, state)
        subprocess.Popen([str(executable)], cwd=str(executable.parent), creationflags=subprocess.CREATE_NO_WINDOW)
        return {'message': 'Desktop chat launched in click-through mode. Your original host settings are backed up locally.'}
