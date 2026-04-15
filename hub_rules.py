"""
hub_rules.py
============
Central cross-project coordination policy.

This is THE single place to define which projects must pause/resume when
another project starts playing.  No mini-project should ever encode this
knowledge internally — the hub owns it.

How to add a rule
-----------------
    coordinator.add_rule(CoordinationRule(
        requester="my_project",   # project that wants to play
        pause=["specific_song"],  # projects that must pause first
        # resume_on_finish=True is the default — they resume when requester finishes
    ))

Import order
------------
This module is imported by main.py AFTER _discover_projects() so that all
ProjectInterface singletons are already registered before rules are checked
at runtime.  The rules themselves are just data — registration order doesn't
matter for correctness, but it keeps startup clean.
"""

from coordinator import coordinator, CoordinationRule

# ── tik_tok ───────────────────────────────────────────────────────────────────
# When a TikTok clip starts, pause the music player.
# Music resumes automatically when the clip finishes.
coordinator.add_rule(CoordinationRule(
    requester="tik_tok",
    pause=["specific_song"],
))

# ── Future rules go here ──────────────────────────────────────────────────────
# Uncomment / add as projects are brought into the coordinator workflow.
#
# coordinator.add_rule(CoordinationRule(
#     requester="love_me",
#     pause=["specific_song"],
# ))
#
# coordinator.add_rule(CoordinationRule(
#     requester="sound_effects",
#     pause=["specific_song"],
#     resume_on_finish=False,   # SFX are short; don't auto-resume between clips
# ))
