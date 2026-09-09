#!/bin/bash
# Portable Windows bugtest zip — assemble on any OS; EndoASD.exe needs a Windows build.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="dist/EndoASD-Windows-Bugtest"
ZIP="dist/EndoASD-Windows-Bugtest.zip"
rm -rf "$OUT"
mkdir -p "$OUT/assets"

cp -f index.html app.js assets.js cad.js engines.js errorreporting.js materials.js \
  gate.js gate.css styles.css serve.py updater.py update-channel.json requirements.txt \
  "$OUT/"
cp -f EndoASD.bat "$OUT/EndoASD.bat"
cp -f build/BUGTEST-WINDOWS.txt "$OUT/README.txt"
cp -R assets/. "$OUT/assets/"

if [[ -f dist/EndoASD.exe ]]; then
  cp -f dist/EndoASD.exe "$OUT/"
fi

rm -f "$ZIP"
(
  cd dist
  zip -r -q "EndoASD-Windows-Bugtest.zip" "EndoASD-Windows-Bugtest"
)

echo "Windows portable package:"
echo "  $OUT"
echo "  $ZIP"
echo "Note: EndoASD.exe requires a Windows PyInstaller build (build/build-windows.bat or GitHub Actions)."
