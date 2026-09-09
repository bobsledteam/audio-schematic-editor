@echo off
REM Build Windows bugtest packages (run on Windows with Python 3 + optional Inno Setup).
REM Produces:
REM   dist\EndoASD.exe
REM   dist\EndoASD-Setup.exe        (Inno, if iscc is installed)
REM   dist\EndoASD-Windows-Bugtest\  (portable folder)
REM   dist\EndoASD-Windows-Bugtest.zip

setlocal EnableExtensions
cd /d "%~dp0.."

echo ============================================
echo  Endo ASD — Windows bugtest package
echo ============================================
echo.

python -m pip install --upgrade pip -r requirements-build.txt
if errorlevel 1 (
  echo Failed to install build dependencies.
  echo Install Python 3 from https://python.org and re-run.
  exit /b 1
)

echo.
echo [1/3] PyInstaller EndoASD.exe ...
pyinstaller build\EndoASD.spec --clean --noconfirm
if errorlevel 1 exit /b 1

echo.
echo [2/3] Portable bugtest folder ...
set PORTABLE=dist\EndoASD-Windows-Bugtest
if exist "%PORTABLE%" rmdir /s /q "%PORTABLE%"
mkdir "%PORTABLE%"
mkdir "%PORTABLE%\assets"

copy /y index.html "%PORTABLE%\" >nul
copy /y app.js "%PORTABLE%\" >nul
copy /y assets.js "%PORTABLE%\" >nul
copy /y cad.js "%PORTABLE%\" >nul
copy /y engines.js "%PORTABLE%\" >nul
copy /y errorreporting.js "%PORTABLE%\" >nul
copy /y materials.js "%PORTABLE%\" >nul
copy /y gate.js "%PORTABLE%\" >nul
copy /y gate.css "%PORTABLE%\" >nul
copy /y styles.css "%PORTABLE%\" >nul
copy /y serve.py "%PORTABLE%\" >nul
copy /y updater.py "%PORTABLE%\" >nul
copy /y update-channel.json "%PORTABLE%\" >nul
copy /y requirements.txt "%PORTABLE%\" >nul
copy /y EndoASD.bat "%PORTABLE%\EndoASD.bat" >nul
copy /y build\BUGTEST-WINDOWS.txt "%PORTABLE%\README.txt" >nul
xcopy /e /i /y assets "%PORTABLE%\assets" >nul

if exist "dist\EndoASD.exe" (
  copy /y "dist\EndoASD.exe" "%PORTABLE%\EndoASD.exe" >nul
)

powershell -NoProfile -Command "Compress-Archive -Path '%PORTABLE%\*' -DestinationPath 'dist\EndoASD-Windows-Bugtest.zip' -Force"
if errorlevel 1 (
  echo Zip step failed — folder is still at %PORTABLE%
)

echo.
echo [3/3] Inno Setup installer (optional) ...
where iscc >nul 2>nul
if errorlevel 1 (
  echo Inno Setup not found — skipping Setup.exe
  echo Install from https://jrsoftware.org/isdl.php for a friend-ready installer.
  goto :done
)

iscc build\EndoASD.iss
if errorlevel 1 exit /b 1

:done
echo.
echo ============================================
echo  Windows packages ready in dist\
echo    EndoASD.exe
echo    EndoASD-Windows-Bugtest\  and .zip
echo    EndoASD-Setup.exe   (if Inno installed)
echo ============================================
echo.
echo After you push git, set gitUrl in update-channel.json so Check update works.
echo.
pause
