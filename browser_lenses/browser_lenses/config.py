from __future__ import annotations

PTT_KEY = "`"
RECORD_TIMEOUT_SECONDS: float = 10.0
DEBUG_PORT: int = 9222
INITIAL_STARTUP_DELAY_SECONDS: float = 1.5
TAB_OPEN_DELAY_SECONDS: float = 0.8

BROWSER_CANDIDATES = [
    r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe",
    r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe",
    r"%LocalAppData%\Microsoft\Edge\Application\msedge.exe",
    r"%ProgramFiles%\Google\Chrome\Application\chrome.exe",
    r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe",
    r"%LocalAppData%\Google\Chrome\Application\chrome.exe",
    r"%ProgramFiles%\Chromium\Application\chrome.exe",
    r"%ProgramFiles(x86)%\Chromium\Application\chrome.exe",
]

LENS_COMMANDS = {
    "frog_hat": {
        "url": "https://lens.snap.com/experience/9579e910-1cf0-49c5-b54f-aff631cd6ba7",
        "aliases": [
            "frog hat",
            "froghead",
            "frog at",
            "froghat",
        ],
    },
    "watermelon_warrior": {
        "url": "https://lens.snap.com/experience/0f9403fb-16b1-4d7c-9d53-695b0e1f93cd",
        "aliases": [
            "watermelon warrior",
            "water melon warrior",
            "watermelon worrier",
            "water melon worrier",
            "wter melon warrior",
            "water melon",
        ],
    },
}
