"""Assemble one tracker worker; register/unregister all runtime subscriptions."""
import events
from . import api
from .collector import Collector
from .service import Tracker

REQUIRES_OBS = False


def run(input_queue, stop_event, *, startup_event=None):
    from lib import twitch_chat
    def reply(channel,text,parent,*,allowed):
        return twitch_chat.reply(channel,text,parent,allowed=lambda:not stop_event.is_set() and allowed())
    tracker = Tracker(reply=reply)
    collector = Collector(tracker, stop_event)
    api.register(tracker)
    events.subscribe('twitch.chat.message',tracker.enqueue_chat)
    try:
        if startup_event:
            startup_event.set()
        print('[league_stats] Ready: automatic history and trusted viewer helpers',flush=True)
        collector.run()
    finally:
        events.unsubscribe('twitch.chat.message',tracker.enqueue_chat)
        api.unregister(tracker)
