@echo off
setlocal

cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
    echo Python launcher "py" was not found.
    echo Install Python 3.11 or run this from a shell with py available.
    pause
    exit /b 1
)

py -3.11 -c "import faster_whisper, sounddevice" >nul 2>nul
if errorlevel 1 (
    echo Python 3.11 is available, but the voice dependencies are not installed there.
    echo Expected this command to work:
    echo   py -3.11 -c "import faster_whisper, sounddevice"
    pause
    exit /b 1
)

echo Starting hub. The browser will open when the UI server is ready...
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0Open Hub UI.ps1"

py -3.11 hub.py %*
pause
