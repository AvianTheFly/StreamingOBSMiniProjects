"""Register one command subscriber for the Hub lifetime; reuse its delivery worker."""
import events
from lib import twitch_chat
from . import api
from .service import Commands
from .jokes import Jokes

REQUIRES_OBS = False


def run(input_queue,stop_event,*,startup_event=None):
    service = Commands(stop_event,twitch_chat.reply,announce=twitch_chat.announce)
    jokes = Jokes(stop_event,service.snapshot,twitch_chat.announce,twitch_chat.status)
    api.register(service,jokes)
    try:
        events.subscribe('twitch.chat.message',service.receive)
        if startup_event: startup_event.set()
        print('[twitch_commands] Ready: personalized commands through Hub chat',flush=True)
        while not stop_event.wait(min(service.wait_seconds(),jokes.wait_seconds())):
            service.tick()
            jokes.tick()
    finally:
        jokes.close()
        service.close()
        events.unsubscribe('twitch.chat.message',service.receive)
        api.register(None)
