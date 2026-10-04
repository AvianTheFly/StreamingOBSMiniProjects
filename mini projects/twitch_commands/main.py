"""Register one command subscriber for the Hub lifetime; reuse its delivery worker."""
import events
from lib import twitch_chat
from . import api
from .service import Commands

REQUIRES_OBS = False


def run(input_queue,stop_event,*,startup_event=None):
    service = Commands(stop_event,twitch_chat.reply)
    api.register(service)
    try:
        events.subscribe('twitch.chat.message',service.receive)
        if startup_event: startup_event.set()
        print('[twitch_commands] Ready: personalized commands through Hub chat',flush=True)
        stop_event.wait()
    finally:
        service.close()
        events.unsubscribe('twitch.chat.message',service.receive)
        api.register(None)
