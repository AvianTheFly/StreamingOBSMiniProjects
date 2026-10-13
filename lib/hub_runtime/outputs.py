"""Hub startup policy for OBS outputs, using the shared output transport."""


def start_capture(stop_event):
    """Start replay capture once per startup; leave later manual stops alone."""
    if stop_event.is_set():
        return
    from obs.outputs import start_replay_buffer
    try:
        start_replay_buffer()
        print('  Replay buffer: Running')
    except Exception as exc:
        # Capture failure must not prevent the rest of the Hub from starting.
        print(f'  [WARNING] Replay buffer could not start: {exc}. Use Start replay buffer in the Hub to retry.')
