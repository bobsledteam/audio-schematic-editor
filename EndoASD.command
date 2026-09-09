#!/bin/bash
cd "$(dirname "$0")"
if ! python3 -c "import webview" >/dev/null 2>&1; then
  python3 -m pip install -r requirements.txt
fi
exec python3 serve.py
