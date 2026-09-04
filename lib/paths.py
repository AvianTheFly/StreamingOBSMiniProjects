from __future__ import annotations

import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MINI_PROJECTS_DIR = PROJECT_ROOT / "mini projects"
DOCS_DIR = PROJECT_ROOT / "docs"
ARCHIVE_DIR = PROJECT_ROOT / "archive"
ENV_FILE = PROJECT_ROOT / ".env"


def ensure_import_paths() -> None:
    """Make the hub and mini-project packages importable from scripts/tools."""
    for path in (PROJECT_ROOT, MINI_PROJECTS_DIR):
        if path.is_dir() and str(path) not in sys.path:
            sys.path.insert(0, str(path))


def load_project_env() -> None:
    """Load the root .env file when python-dotenv is available."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(ENV_FILE)


def display_name_from_key(key: str) -> str:
    return key.replace("_", " ").replace("-", " ").title()
