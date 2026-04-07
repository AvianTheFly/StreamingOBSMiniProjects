# shared.py  (root — sits alongside obs_hub/main.py)
#
# Shared primitives available to every sub-project via a plain `import shared`.
# The root directory is always on sys.path because obs_hub/main.py inserts it.

import threading

# ── Cross-project import lock ─────────────────────────────────────────────────
#
# Sub-projects that import modules using bare names (e.g. "config") via
# sys.path manipulation MUST hold this lock for the entire
#
#     insert-path → evict-stale-modules → import → remove-path
#
# sequence.  Without the lock those four steps are NOT atomic and two
# projects running in concurrent threads can each see the other's cached
# "config" module.
#
# Usage inside a sub-project's run():
#
#     import shared
#     with shared.project_import_lock:
#         sys.path.insert(0, _HERE_STR)
#         for _stale in ("config", "player", ...):
#             sys.modules.pop(_stale, None)
#         from config import FOO, BAR
#         from player import MyClass
#         if _HERE_STR in sys.path:
#             sys.path.remove(_HERE_STR)

project_import_lock: threading.Lock = threading.Lock()