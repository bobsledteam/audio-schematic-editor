@echo off
title Endo Audio Schematic Editor
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  python -c "import webview" >nul 2>nul
  if errorlevel 1 python -m pip install -r requirements.txt
  python serve.py
  goto :end
)

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 -c "import webview" >nul 2>nul
  if errorlevel 1 py -3 -m pip install -r requirements.txt
  py -3 serve.py
  goto :end
)

echo Python 3 is required but was not found.
echo Install from https://www.python.org/downloads/ and run again,
echo or download EndoASD.exe from the project releases.
pause

:end
