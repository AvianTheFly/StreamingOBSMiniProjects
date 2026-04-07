# obs/obs_config.py
# OBS WebSocket settings — loaded from environment variables.
# Create a .env file at the project root from .env.example.

import os

OBS_HOST     = os.environ.get("OBS_HOST", "localhost")
OBS_PORT     = int(os.environ.get("OBS_PORT", "4455"))
OBS_PASSWORD = os.environ.get("OBS_PASSWORD", "")
