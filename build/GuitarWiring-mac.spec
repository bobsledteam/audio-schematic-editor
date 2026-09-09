# -*- mode: python ; coding: utf-8 -*-
# Run from project root: pyinstaller build/GuitarWiring-mac.spec --clean

import os

block_cipher = None
project_root = os.path.abspath(os.path.join(os.path.dirname(SPEC), '..'))

a = Analysis(
    [os.path.join(project_root, 'serve.py')],
    pathex=[project_root],
    binaries=[],
    datas=[
        (os.path.join(project_root, 'index.html'), '.'),
        (os.path.join(project_root, 'app.js'), '.'),
        (os.path.join(project_root, 'assets.js'), '.'),
        (os.path.join(project_root, 'cad.js'), '.'),
        (os.path.join(project_root, 'styles.css'), '.'),
        (os.path.join(project_root, 'assets'), 'assets'),
    ],
    hiddenimports=[],
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
    name='GuitarWiring',
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
    name='GuitarWiring',
)

app = BUNDLE(
    coll,
    name='Guitar Wiring.app',
    icon=None,
    bundle_identifier='com.guitarwiring.visualiser',
    info_plist={
        'CFBundleDisplayName': 'Guitar Wiring',
        'CFBundleShortVersionString': '1.0.0',
        'CFBundleVersion': '1.0.0',
        'NSHighResolutionCapable': True,
    },
)
