#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "============================================"
echo " Guitar Wiring Visualiser - macOS Build"
echo "============================================"
echo

python3 -m pip install --upgrade pip pyinstaller

echo
echo "[1/2] Building Guitar Wiring.app ..."
python3 -m PyInstaller build/GuitarWiring-mac.spec --clean --noconfirm

APP_PATH="dist/Guitar Wiring.app"
DMG_PATH="dist/GuitarWiring.dmg"

echo
echo "[2/2] Creating disk image ..."
rm -f "$DMG_PATH"
hdiutil create \
  -volname "Guitar Wiring" \
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
echo "Drag Guitar Wiring.app to Applications, or open the DMG to install."
