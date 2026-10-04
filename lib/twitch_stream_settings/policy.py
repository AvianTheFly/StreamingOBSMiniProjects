"""Dashboard switch policy, separate from browser and Hub lifetimes."""
import re

SETTINGS = ('Store past broadcasts', 'Always Publish VODs', 'Stream Rewind')


def channel_name(value):
    value = value.strip().lower()
    if not re.fullmatch(r'[a-z0-9_]{1,25}', value):
        raise ValueError('Set TWITCH_CHANNEL to your Twitch channel login in .env.')
    return value


def ensure_enabled(page, stop):
    """Only enable exact named switches; ambiguous or missing controls fail closed."""
    changed = []
    for label in SETTINGS:
        if stop.is_set():
            raise RuntimeError('Check cancelled.')
        # Twitch labels its native checkbox inputs. Role fallback covers switches.
        control = page.get_by_label(label, exact=True)
        if control.count() != 1:
            control = page.get_by_role('switch', name=label, exact=True)
        if control.count() != 1:
            raise RuntimeError(f'Twitch dashboard control unavailable: {label}.')
        if not control.is_checked():
            control.set_checked(True, timeout=5000)
            changed.append(label)
        if not control.is_checked():
            raise RuntimeError(f'Twitch did not enable {label}.')
    return changed
