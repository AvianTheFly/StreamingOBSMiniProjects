"""One-shot helper: raise Windows LowLevelHooksTimeout to 1000 ms.

Why
---
Windows silently disables low-level keyboard hooks that take longer than
LowLevelHooksTimeout (default 300 ms) to return. While the hook is stalled
but under the timeout, keystrokes back up and the entire OS's keyboard
input stutters. With the keyboard listener now in a child process this
is unlikely to happen, but raising the timeout adds a safety margin for
worst-case GIL/IO stalls.

Usage
-----
    python tools/set_hook_timeout.py            # set HKCU value to 1000 ms
    python tools/set_hook_timeout.py --reset    # remove the override

The change applies to the current Windows user only and takes effect
after the next sign-out / sign-in. No admin rights required.
"""

from __future__ import annotations

import argparse
import sys


KEY_PATH = r"Control Panel\Desktop"
VALUE_NAME = "LowLevelHooksTimeout"
TARGET_MS = 1000


def _ensure_windows() -> None:
    if sys.platform != "win32":
        sys.exit("This helper only runs on Windows.")


def set_value() -> None:
    import winreg

    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, KEY_PATH, 0, winreg.KEY_SET_VALUE) as key:
        winreg.SetValueEx(key, VALUE_NAME, 0, winreg.REG_DWORD, TARGET_MS)
    print(f"Set HKCU\\{KEY_PATH}\\{VALUE_NAME} = {TARGET_MS} (decimal).")
    print("Sign out and back in for the change to take effect.")


def reset_value() -> None:
    import winreg

    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, KEY_PATH, 0, winreg.KEY_SET_VALUE) as key:
            winreg.DeleteValue(key, VALUE_NAME)
        print(f"Removed HKCU\\{KEY_PATH}\\{VALUE_NAME}. Default (300 ms) restored.")
        print("Sign out and back in for the change to take effect.")
    except FileNotFoundError:
        print(f"HKCU\\{KEY_PATH}\\{VALUE_NAME} was not set; nothing to do.")


def read_value() -> None:
    import winreg

    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, KEY_PATH) as key:
            value, _ = winreg.QueryValueEx(key, VALUE_NAME)
        print(f"Current: HKCU\\{KEY_PATH}\\{VALUE_NAME} = {value} ms.")
    except FileNotFoundError:
        print(f"HKCU\\{KEY_PATH}\\{VALUE_NAME} not set (Windows default = 300 ms).")


def main() -> None:
    _ensure_windows()
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--reset", action="store_true", help="Remove the override.")
    parser.add_argument("--show", action="store_true", help="Print current value and exit.")
    args = parser.parse_args()

    if args.show:
        read_value()
        return
    if args.reset:
        reset_value()
        return
    set_value()


if __name__ == "__main__":
    main()
