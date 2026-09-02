@echo off
setlocal
cd /d "%~dp0.."

echo ============================================
echo  Guitar Wiring Visualiser - Windows Build
echo ============================================
echo.

python -m pip install --upgrade pip pyinstaller
if errorlevel 1 (
  echo Failed to install PyInstaller. Install Python 3 from https://python.org first.
  exit /b 1
)

echo.
echo [1/2] Building GuitarWiring.exe ...
pyinstaller build\GuitarWiring.spec --clean --noconfirm
if errorlevel 1 exit /b 1

echo.
echo [2/2] Building installer ...
where iscc >nul 2>nul
if errorlevel 1 (
  echo Inno Setup not found.
  echo.
  echo Install Inno Setup 6 free from:
  echo   https://jrsoftware.org/isdl.php
  echo Then run this script again.
  echo.
  echo For now, you can share: dist\GuitarWiring.exe
  goto :done
)

iscc build\GuitarWiring.iss
if errorlevel 1 exit /b 1

echo.
echo ============================================
echo  Done! Send your friend:
echo    dist\GuitarWiring-Setup.exe
echo ============================================

:done
echo.
pause
