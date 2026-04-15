@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Folder this script lives in: ...\dir_snapshot\
set "TOOL_DIR=%~dp0"
if "%TOOL_DIR:~-1%"=="\" set "TOOL_DIR=%TOOL_DIR:~0,-1%"

rem Parent folder to scan
for %%I in ("%TOOL_DIR%\..") do set "SCAN_DIR=%%~fI"

rem Output path
set "OUTPUT_DIR=%TOOL_DIR%\output"
set "STRUCTURE_FILE=%OUTPUT_DIR%\structure.txt"

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%" >nul 2>&1

rem Overwrite structure file each run
break > "%STRUCTURE_FILE%"

for /r "%SCAN_DIR%" %%F in (*.json *.py) do (
    set "FULL=%%~fF"

    rem Skip anything inside the tool folder itself
    if /I "!FULL:%TOOL_DIR%\=!"=="!FULL!" (
        set "REL=%%~fF"
        set "REL=!REL:%SCAN_DIR%\=!"
        echo !REL!>> "%STRUCTURE_FILE%"
    )
)

echo Structure saved to:
echo %STRUCTURE_FILE%
pause