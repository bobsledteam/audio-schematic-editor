# -*- mode: python ; coding: utf-8 -*-
# Run from project root: pyinstaller build/EndoASD-mac.spec --clean

import os
import sys

from PyInstaller.utils.hooks import collect_all

block_cipher = None
project_root = os.path.abspath(os.path.join(os.path.dirname(SPEC), '..'))
sys.path.insert(0, os.path.join(project_root, 'build'))
from _datas import APP_DATAS  # noqa: E402

webview_datas, webview_binaries, webview_hiddenimports = collect_all('webview')

a = Analysis(
    [os.path.join(project_root, 'serve.py')],
    pathex=[project_root],
    binaries=webview_binaries,
    datas=APP_DATAS + webview_datas,
    hiddenimports=list(webview_hiddenimports),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='EndoASD',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='EndoASD',
)

app = BUNDLE(
    coll,
    name='Endo ASD.app',
    icon=os.path.join(project_root, 'assets', 'app-icon.icns'),
    bundle_identifier='com.endo.audioschematiceditor',
    info_plist={
        'CFBundleDisplayName': 'Endo Audio Schematic Editor',
        'CFBundleName': 'EndoASD',
        'CFBundleShortVersionString': '1.0.570',
        'CFBundleVersion': '570',
        'NSHighResolutionCapable': True,
        'LSUIElement': False,
    },
)
