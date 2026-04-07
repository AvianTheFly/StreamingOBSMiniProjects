# twitch_integration/bot.py
"""
IRC-based Twitch chat bot.

Connects to Twitch's IRC, reads PRIVMSG lines, dispatches known commands and
prints everything else so you can log them.

When the config field is filled and the bot connects, you'll see chat live print.
Commands are registered by decorating functions and adding them to COMMANDS.
"""

from __future__ import annotations

import re
import socket
import ssl
import threading
import time

from events import emit

from .config import (
    IRC_SERVER,
    IRC_PORT,
    TWITCH_CHANNEL,
    TWITCH_NICK,
    TWITCH_OAUTH_TOKEN,
)

# Register commands here with the decorator:
#   @command("!hello")
#   def on_hello(bot, username, message):
#       bot.send_message(f"Hello {username}!")
#
# Each handler receives (bot_instance, username, message).
COMMANDS: dict[str, callable] = {}


def command(name: str):
    """Decorator to register a chat command."""
    def decorator(fn):
        COMMANDS[name.lower()] = fn
        return fn
    return decorator


class TwitchBot:
    def __init__(self):
        self._sock: ssl.SSLSocket | socket.socket | None = None
        self._running = False
        self._lock = threading.Lock()

    # ── Connection ───────────────────────────────────────────────────────

    def connect(self) -> None:
        if not TWITCH_OAUTH_TOKEN:
            print("[twitch] ⚠  TWITCH_OAUTH_TOKEN is empty. Set it in config.py and restart.")
            return False

        print(f"[twitch] Connecting to {IRC_SERVER}:{IRC_PORT} …")
        raw = socket.create_connection((IRC_SERVER, IRC_PORT))
        ctx = ssl.create_default_context()
        self._sock = ctx.wrap_socket(raw, server_hostname=IRC_SERVER)

        self._sock.settimeout(30)

        # Auth
        self._send(f"PASS {TWITCH_OAUTH_TOKEN}")
        self._send(f"NICK {TWITCH_NICK.lower()}")
        self._send(f"JOIN #{TWITCH_CHANNEL.lower()}")

        self._running = True
        print(f"[twitch] Connected. Joined #{TWITCH_CHANNEL.lower()}.")
        return True

    # ── Main read loop ────────────────────────────────────────────────────

    def run_forever(self, stop_event: threading.Event) -> None:
        while not stop_event.is_set():
            ok = self.connect()
            if not ok:
                return

            buf = ""

            try:
                while self._running and not stop_event.is_set():
                    try:
                        chunk = self._sock.recv(4096).decode("utf-8", errors="replace")
                    except socket.timeout:
                        # Twitch sends nothing during quiet periods — that's fine,
                        # just keep looping.
                        continue
                    except (ConnectionResetError, OSError, ssl.SSLError) as exc:
                        print(f"[twitch] Connection lost: {exc}")
                        break

                    if not chunk:
                        print("[twitch] Server closed connection.")
                        break

                    buf += chunk
                    while "\n" in buf:
                        line, buf = buf.split("\n", 1)
                        line = line.strip()
                        if not line:
                            continue

                        self._handle_line(line)
            finally:
                self._running = False
                self.stop()

            # ── Reconnect ─────────────────────────────────────────────────
            if not stop_event.is_set():
                print("[twitch] Reconnecting in 3 s …")
                time.sleep(3)

        print("[twitch] Stopping (no reconnect).")

    # ── Line dispatch ─────────────────────────────────────────────────────

    _MSG_RE = re.compile(
        r"^:([^!]+)![^@]+@.+ PRIVMSG #\S+ :(.+)$"
    )

    def _handle_line(self, line: str) -> None:
        # Respond to PING to keep the connection alive
        if line.startswith("PING"):
            self._send(line.replace("PING", "PONG", 1))
            return

        m = self._MSG_RE.match(line)
        if not m:
            return

        username = m.group(1)
        message = m.group(2)

        print(f"[chat] {username}: {message}")

        # Command dispatch
        if message.startswith("!"):
            cmd = message.split()[0].lower()
            handler = COMMANDS.get(cmd)
            if handler:
                try:
                    handler(self, username, message)
                except Exception as exc:
                    print(f"[twitch] Command handler error ({cmd}): {exc}")

    # ── Helpers ───────────────────────────────────────────────────────────

    def _send(self, text: str) -> None:
        if self._sock:
            self._sock.send((text + "\r\n").encode("utf-8"))

    def send_message(self, message: str, channel: str | None = None) -> None:
        """Send a chat message into the bot's joined channel."""
        target = channel or TWITCH_CHANNEL.lower()
        self._send(f"PRIVMSG #{target} :{message}")

    def stop(self) -> None:
        self._running = False
        if self._sock:
            with self._lock:
                try:
                    self._sock.close()
                except Exception:
                    pass
            self._sock = None
        print("[twitch] Disconnected.")


# ── Commands ────────────────────────────────────────────────────────────────

@command("!hello")
def _on_hello(bot, username, message):
    bot.send_message(f"Hello {username}! I'm alive and connected to the OBS Hub.")


@command("!commands")
def _on_commands(bot, username, message):
    bot.send_message("Available commands: !hello, !commands, !png <name>")


# ─────────────────────────────────────────────────────────────────────────────
#  Show a PNG overlay in OBS.
#
#  A separate mini-project subscribes to "show_png" and does the actual OBS
#  work (look up the file, show_source, etc.).  The Twitch bot only emits
#  the event — it knows nothing about the target project.
# ─────────────────────────────────────────────────────────────────────────────

@command("!png")
def _on_png(bot, username, message):
    parts = message.split(maxsplit=1)
    if len(parts) < 2:
        bot.send_message(f"Usage: !png <name>  (e.g. !png cat)")
        return

    name = parts[1].strip()
    emit("show_png", name=name, user=username)
    print(f"[twitch] !png command → emit 'show_png' (name={name})")
