#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "============================================"
echo " Endo ASD — macOS bugtest package"
echo "============================================"
echo

python3 -m pip install --upgrade pip -r requirements-build.txt

echo
echo "[1/2] Building Endo ASD.app (PyInstaller) ..."
python3 -m PyInstaller build/EndoASD-mac.spec --clean --noconfirm

APP_PATH="dist/Endo ASD.app"
DMG_PATH="dist/EndoASD-mac-Bugtest.dmg"

echo
echo "[2/2] Creating disk image ..."
rm -f "$DMG_PATH"
hdiutil create \
  -volname "Endo ASD" \
  -srcfolder "$APP_PATH" \
  -ov -format UDZO \
  "$DMG_PATH" >/dev/null

echo
echo "============================================"
echo " Done!"
echo "   App:  $APP_PATH"
echo "   DMG:  $DMG_PATH"
echo "============================================"
echo
echo "Gate password: froge"
echo "After pushing git, set gitUrl in update-channel.json for Check update."
echo
