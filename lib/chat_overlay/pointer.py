"""Read pointer position without registering a mouse listener or taking focus."""
import os
import time
import threading
import psutil

DESKTOP_APPS = {'chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe', 'opera.exe',
                'chatgpt.exe', 'discord.exe', 'obs64.exe', 'explorer.exe',
                'spotify.exe', 'code.exe', 'notepad.exe', 'steam.exe',
                'leagueclient.exe', 'leagueclientux.exe', 'riotclientservices.exe'}
GAMES = {'league of legends.exe', 'r5apex.exe', 'valorant-win64-shipping.exe',
         'fortniteclient-win64-shipping.exe', 'cs2.exe', 'dota2.exe',
         'overwatch.exe', 'rocketleague.exe', 'minecraft.exe', 'javaw.exe'}


def is_game(name, covers_screen):
    name = name.lower()
    if name in GAMES or name.endswith('-win64-shipping.exe'):
        return True
    if name in DESKTOP_APPS:
        return False
    # Be conservative for unknown fullscreen/borderless applications.
    return covers_screen


class PointerState:
    def __init__(self):
        self.lock = threading.Lock()
        self.host = None
        self.last_scan = 0
        self.foreground = None
        self.game = True
        if os.name != 'nt':
            self.user = None
            return
        import ctypes
        from ctypes import wintypes
        self.ctypes, self.types = ctypes, wintypes
        self.user = ctypes.WinDLL('user32', use_last_error=True)
        self.user.GetForegroundWindow.restype = wintypes.HWND
        self.user.IsWindow.argtypes = [wintypes.HWND]
        self.user.IsWindowVisible.argtypes = [wintypes.HWND]
        self.user.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
        self.user.GetClientRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
        self.user.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
        self.user.ClientToScreen.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.POINT)]
        self.user.GetCursorPos.argtypes = [ctypes.POINTER(wintypes.POINT)]
        self.callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def read(self):
        if self.user is None:
            return {'available': False, 'game': True, 'x': None, 'y': None}
        with self.lock:
            user, types, ctypes = self.user, self.types, self.ctypes
            now = time.monotonic()
            if now - self.last_scan > 1:
                self.last_scan = now
                hosts = {p.pid for p in psutil.process_iter(['name'])
                         if p.info['name'] == 'TransparentTwitchChatWPF.exe'}
                windows = []
                def inspect(hwnd, _):
                    pid = types.DWORD()
                    user.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                    if pid.value in hosts and user.IsWindowVisible(hwnd):
                        windows.append(hwnd)
                    return True
                callback = self.callback_type(inspect)
                user.EnumWindows(callback, 0)
                self.host = windows[0] if len(windows) == 1 else None
                foreground = user.GetForegroundWindow()
                if foreground and foreground != self.host:
                    pid = types.DWORD()
                    user.GetWindowThreadProcessId(foreground, ctypes.byref(pid))
                    rect = types.RECT()
                    user.GetWindowRect(foreground, ctypes.byref(rect))
                    covers = (rect.right - rect.left >= user.GetSystemMetrics(0) * .9
                              and rect.bottom - rect.top >= user.GetSystemMetrics(1) * .85)
                    try:
                        self.game = is_game(psutil.Process(pid.value).name(), covers)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        self.game = True
            if not self.host or not user.IsWindow(self.host):
                return {'available': False, 'game': self.game, 'x': None, 'y': None}
            cursor, origin, rect = types.POINT(), types.POINT(), types.RECT()
            if not (user.GetCursorPos(ctypes.byref(cursor)) and
                    user.GetClientRect(self.host, ctypes.byref(rect)) and
                    user.ClientToScreen(self.host, ctypes.byref(origin))):
                return {'available': False, 'game': self.game, 'x': None, 'y': None}
            width, height = rect.right, rect.bottom
            x, y = cursor.x - origin.x, cursor.y - origin.y
            inside = width > 0 and height > 0 and 0 <= x < width and 0 <= y < height
            return {'available': True, 'game': self.game,
                    'x': x / width if inside else None,
                    'y': y / height if inside else None}


pointer = PointerState()
