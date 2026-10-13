@echo off
cd /d "%~dp0"
py -3.11 -B -X utf8 footage_manager/find_moments.py --scan --wait %*
pause
