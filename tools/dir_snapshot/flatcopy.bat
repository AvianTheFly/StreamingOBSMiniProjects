@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Folder this script lives in: ...\dir_snapshot\
set "TOOL_DIR=%~dp0"
if "%TOOL_DIR:~-1%"=="\" set "TOOL_DIR=%TOOL_DIR:~0,-1%"

rem Parent folder to scan
for %%I in ("%TOOL_DIR%\..") do set "SCAN_DIR=%%~fI"

rem Output folders
set "OUTPUT_DIR=%TOOL_DIR%\output"
set "FLAT_DIR=%OUTPUT_DIR%\flat_files"

rem Reset only this script's output
if exist "%FLAT_DIR%" rmdir /s /q "%FLAT_DIR%"
mkdir "%FLAT_DIR%" >nul 2>&1

for /r "%SCAN_DIR%" %%F in (*.py *.json) do (
    set "FULL=%%~fF"

    rem Skip anything inside the tool folder itself
    if /I "!FULL:%TOOL_DIR%\=!"=="!FULL!" (
        rem Immediate parent folder name of the file
        for %%P in ("%%~dpF.") do (
            echo Copying: %%~nxF from %%~nP
            copy /y "%%~fF" "%FLAT_DIR%\%%~nF(%%~nP)%%~xF" >nul
        )
    )
)

echo.
echo Done. Flat copies are in:
echo %FLAT_DIR%
pause