"""Run independent shutdown actions even when one backend resource fails."""
from collections.abc import Callable


def run_cleanup(owner: str, *actions: Callable[[], None]) -> None:
    for action in actions:
        try:
            action()
        except Exception as exc:
            name = getattr(action, '__name__', type(action).__name__)
            print(f"[{owner}] Cleanup failed in {name}: {exc}")
