# Shared PyInstaller data file list (imported by *.spec).
import os

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

APP_DATAS = [
    (os.path.join(project_root, 'index.html'), '.'),
    (os.path.join(project_root, 'app.js'), '.'),
    (os.path.join(project_root, 'assets.js'), '.'),
    (os.path.join(project_root, 'cad.js'), '.'),
    (os.path.join(project_root, 'engines.js'), '.'),
    (os.path.join(project_root, 'errorreporting.js'), '.'),
    (os.path.join(project_root, 'materials.js'), '.'),
    (os.path.join(project_root, 'gate.js'), '.'),
    (os.path.join(project_root, 'gate.css'), '.'),
    (os.path.join(project_root, 'styles.css'), '.'),
    (os.path.join(project_root, 'update-channel.json'), '.'),
    (os.path.join(project_root, 'updater.py'), '.'),
    (os.path.join(project_root, 'assets'), 'assets'),
]
