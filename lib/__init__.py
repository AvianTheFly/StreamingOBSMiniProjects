"""Shared library code for the streaming hub and mini projects.

Mini projects should keep their own config and tiny launch surface, then reuse
cross-project behavior from here:

- lib.shared_media: generic media playback framework
- lib.hotkeys: backward-compatible hotkey map loading
- lib.project_settings: richer editor settings for categories and display names
- lib.paths: root paths, import bootstrap, and .env loading
- lib.project_registry: mini-project discovery for the hub and editor
- lib.sync: asset directory to OBS scene synchronization
"""
