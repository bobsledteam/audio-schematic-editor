@echo off
title Guitar Wiring Visualiser
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  python serve.py
  goto :end
)

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 serve.py
  goto :end
)

echo Python 3 is required but was not found.
echo Install from https://www.python.org/downloads/ and run again,
echo or download GuitarWiring.exe from the project releases.
pause

:end
