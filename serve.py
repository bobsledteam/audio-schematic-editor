#!/usr/bin/env python3
"""Endo Audio Schematic Editor — desktop application entry point.

Serves the UI locally and opens it in a native window (pywebview).
Falls back to the system browser if the desktop shell is unavailable.
"""

from __future__ import annotations

import mimetypes
import os
import re
import socket
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

APP_TITLE = 'Endo Audio Schematic Editor'
PREFERRED_PORT = 8765

# Ensure common web types are registered (Python's defaults can miss .js on some builds).
for _ext, _mime in (
    ('.js', 'text/javascript'),
    ('.mjs', 'text/javascript'),
    ('.css', 'text/css'),
    ('.json', 'application/json'),
    ('.svg', 'image/svg+xml'),
    ('.wasm', 'application/wasm'),
    ('.map', 'application/json'),
    ('.woff', 'font/woff'),
    ('.woff2', 'font/woff2'),
):
    mimetypes.add_type(_mime, _ext)

# Frozen builds need updater on sys.path (MEIPASS).
if getattr(sys, 'frozen', False):
    _meipass = getattr(sys, '_MEIPASS', None)
    if _meipass and _meipass not in sys.path:
        sys.path.insert(0, _meipass)
else:
    _here = os.path.dirname(os.path.abspath(__file__))
    if _here not in sys.path:
        sys.path.insert(0, _here)


def get_root():
    """UI root: persistent update overlay if present, else frozen/bundle/source."""
    try:
        from updater import serve_root

        return str(serve_root())
    except Exception:
        if getattr(sys, 'frozen', False):
            return sys._MEIPASS
        return os.path.dirname(os.path.abspath(__file__))


ROOT = get_root()


def refresh_serve_root() -> str:
    """Re-resolve ROOT after an update install (overlay may be new)."""
    global ROOT
    ROOT = get_root()
    try:
        os.chdir(ROOT)
    except Exception:
        pass
    return ROOT


def app_bundle_path() -> str | None:
    """Endo ASD.app bundle when launched from the Mac launcher."""
    env = os.environ.get('ENDO_ASD_APP_BUNDLE', '').strip()
    if env and os.path.isdir(env):
        return env
    # Prefer source tree sibling (not update overlay)
    src = os.path.dirname(os.path.abspath(__file__))
    sibling = os.path.join(src, 'Endo ASD.app')
    if os.path.isdir(sibling):
        return sibling
    sibling = os.path.join(ROOT, 'Endo ASD.app')
    if os.path.isdir(sibling):
        return sibling
    return None


def app_icon_path() -> str | None:
    """Platform-native Endo+ASD icon for the desktop shell / Dock / taskbar."""
    candidates: list[str] = []
    bundle = app_bundle_path()
    if sys.platform == 'darwin':
        if bundle:
            candidates.append(os.path.join(bundle, 'Contents', 'Resources', 'AppIcon.icns'))
        candidates.append(os.path.join(ROOT, 'assets', 'app-icon.icns'))
        candidates.append(os.path.join(ROOT, 'assets', 'app-icon.png'))
    elif sys.platform.startswith('win'):
        candidates.append(os.path.join(ROOT, 'assets', 'app-icon.ico'))
        candidates.append(os.path.join(ROOT, 'assets', 'app-icon.png'))
    else:
        candidates.append(os.path.join(ROOT, 'assets', 'app-icon.png'))
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    return None


def apply_mac_dock_icon() -> None:
    """Keep the Endo+ASD Dock icon while the process is running (not Python's)."""
    if sys.platform != 'darwin':
        return
    icon = app_icon_path()
    if not icon:
        return
    try:
        import AppKit
    except ImportError:
        return
    try:
        app = AppKit.NSApplication.sharedApplication()
        try:
            app.setActivationPolicy_(AppKit.NSApplicationActivationPolicyRegular)
        except Exception:
            pass
        img = AppKit.NSImage.alloc().initByReferencingFile_(icon)
        if img is None:
            return
        try:
            size = img.size()
            if size.width <= 0 or size.height <= 0:
                return
        except Exception:
            pass
        app.setApplicationIconImage_(img)
    except Exception:
        pass


# Match modern macOS window fillets (Big Sur+)
_MAC_CORNER_RADIUS = 10.0
_MAC_BG_RGB = (0x10 / 255.0, 0x10 / 255.0, 0x14 / 255.0)  # #101014


def _mac_ns_color(r: float, g: float, b: float, a: float = 1.0):
    import AppKit

    return AppKit.NSColor.colorWithCalibratedRed_green_blue_alpha_(r, g, b, a)


def _mac_fullscreen(ns) -> bool:
    import AppKit

    try:
        mask = ns.styleMask()
        full = getattr(AppKit, 'NSWindowStyleMaskFullScreen', 1 << 14)
        return bool(mask & full)
    except Exception:
        return False


def _apply_mac_content_fillets(window) -> None:
    """Round the WKWebView / content view so dark fills don't square-cut the chrome."""
    import AppKit

    ns = getattr(window, 'native', None)
    if ns is None:
        return

    radius = 0.0 if _mac_fullscreen(ns) else _MAC_CORNER_RADIUS
    try:
        content = ns.contentView()
    except Exception:
        return
    if content is None:
        return

    views = [content]
    try:
        views.extend(list(content.subviews() or []))
    except Exception:
        pass

    for view in views:
        try:
            view.setWantsLayer_(True)
            layer = view.layer()
            if layer is None:
                continue
            layer.setCornerRadius_(radius)
            layer.setMasksToBounds_(True)
        except Exception:
            continue

    try:
        ns.invalidateShadow()
    except Exception:
        pass


def apply_native_mac_window(window) -> None:
    """Dark aqua chrome, system drop shadow, and corner fillets like native Mac apps."""
    if sys.platform != 'darwin':
        return
    try:
        import AppKit
    except ImportError:
        return

    apply_mac_dock_icon()

    ns = getattr(window, 'native', None)
    if ns is None:
        return

    try:
        full = getattr(AppKit, 'NSWindowStyleMaskFullSizeContentView', None)
        if full is None:
            full = AppKit.NSFullSizeContentViewWindowMask
        ns.setStyleMask_(ns.styleMask() | full)
    except Exception:
        pass

    try:
        ns.setTitlebarAppearsTransparent_(True)
        ns.setTitleVisibility_(AppKit.NSWindowTitleHidden)
    except Exception:
        pass

    try:
        dark = AppKit.NSAppearance.appearanceNamed_(AppKit.NSAppearanceNameDarkAqua)
        ns.setAppearance_(dark)
        AppKit.NSApp.setAppearance_(dark)
    except Exception:
        pass

    try:
        bg = _mac_ns_color(*_MAC_BG_RGB)
        ns.setBackgroundColor_(bg)
        ns.setOpaque_(True)
        ns.setHasShadow_(True)
        # pywebview paints the titlebar with the light system window color — restain dark
        try:
            theme_frame = ns.contentView().superview()
            if theme_frame is not None:
                subs = theme_frame.subviews()
                if subs is not None and subs.count() > 0:
                    subs.lastObject().setBackgroundColor_(bg)
        except Exception:
            pass
        ns.invalidateShadow()
    except Exception:
        pass

    _apply_mac_content_fillets(window)


def _on_desktop_before_show(window) -> None:
    apply_native_mac_window(window)


def _call_on_mac_main(fn) -> None:
    """AppKit view/window changes must run on the Cocoa main thread."""
    try:
        from PyObjCTools import AppHelper

        AppHelper.callAfter(fn)
    except Exception:
        fn()


def _sync_mac_fullscreen_class(window) -> None:
    """Toggle CSS class so traffic-light padding is removed in true fullscreen."""
    ns = getattr(window, 'native', None)
    if ns is None:
        return
    full = 'true' if _mac_fullscreen(ns) else 'false'
    try:
        window.evaluate_js(
            f"document.documentElement.classList.toggle('desktop-mac-fullscreen', {full});"
        )
    except Exception:
        pass


def _on_desktop_loaded(window) -> None:
    # WKWebView becomes contentView after first navigation — re-apply fillets then.
    if sys.platform == 'darwin':
        _call_on_mac_main(lambda: apply_native_mac_window(window))
    try:
        # desktop-win | desktop-mac for CSS; both get desktop-shell
        plat = 'desktop-win' if sys.platform.startswith('win') else (
            'desktop-mac' if sys.platform == 'darwin' else 'desktop-linux'
        )
        window.evaluate_js(
            f"document.documentElement.classList.add('desktop-shell','{plat}');"
        )
    except Exception:
        pass
    if sys.platform == 'darwin':
        _sync_mac_fullscreen_class(window)


def _on_desktop_shown(window) -> None:
    if sys.platform == 'darwin':
        _call_on_mac_main(apply_mac_dock_icon)
        _sync_mac_fullscreen_class(window)


def _on_desktop_resized(window, *_args, **_kwargs) -> None:
    if sys.platform == 'darwin':
        _call_on_mac_main(lambda: _apply_mac_content_fillets(window))
        _sync_mac_fullscreen_class(window)


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **getattr(SimpleHTTPRequestHandler, 'extensions_map', {}),
        '.html': 'text/html',
        '.htm': 'text/html',
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.wasm': 'application/wasm',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.map': 'application/json',
        '': 'application/octet-stream',
    }

    def __init__(self, *args, **kwargs):
        # Always serve from current ROOT (overlay after updates).
        super().__init__(*args, directory=get_root(), **kwargs)

    def log_message(self, format, *args):
        pass

    def end_headers(self):
        path = (self.path or '').split('?', 1)[0]
        # Desktop shell should always pick up UI edits during development.
        if path.endswith('.html') or path == '/' or path == '' or path.startswith('/__endo/'):
            self.send_header('Cache-Control', 'no-store')
        else:
            self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def _send_json(self, payload: dict, status: int = 200) -> None:
        import json as _json

        body = _json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = (self.path or '').split('?', 1)[0]
        if path == '/__endo/update/check':
            try:
                from updater import check_for_update

                self._send_json(check_for_update())
            except Exception as exc:
                self._send_json({'ok': False, 'status': 'error', 'message': str(exc)}, 500)
            return
        if path == '/__endo/update/local':
            try:
                from updater import local_build, local_channel

                self._send_json({'ok': True, 'localBuild': local_build(), 'channel': local_channel()})
            except Exception as exc:
                self._send_json({'ok': False, 'message': str(exc)}, 500)
            return
        return super().do_GET()

    def do_POST(self):
        path = (self.path or '').split('?', 1)[0]
        if path == '/__endo/update/install':
            try:
                from updater import install_update

                result = install_update()
                if result.get('ok') and result.get('restartRequired'):
                    refresh_serve_root()
                self._send_json(result)
            except Exception as exc:
                self._send_json({'ok': False, 'status': 'error', 'message': str(exc)}, 500)
            return
        self.send_error(404, 'Not Found')


def pick_port(preferred: int = PREFERRED_PORT) -> int:
    for port in (preferred, 0):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(('127.0.0.1', port))
            except OSError:
                if port == 0:
                    raise
                continue
            return sock.getsockname()[1]
    raise RuntimeError('Could not bind a local port')


def force_browser() -> bool:
    """Prefer system browser (e.g. Cursor preview) when set."""
    for key in ('ENDO_ASD_BROWSER', 'GUITAR_WIRING_BROWSER'):
        if os.environ.get(key, '').strip().lower() in ('1', 'true', 'yes'):
            return True
    return False


def open_system_browser(url: str) -> None:
    import time
    import webbrowser

    time.sleep(0.4)
    webbrowser.open(url)


def desktop_dir() -> Path:
    """User Desktop folder (macOS / Windows / Linux)."""
    home = Path.home()
    for name in ('Desktop', 'desktop'):
        candidate = home / name
        if candidate.is_dir():
            return candidate
    # OneDrive Desktop (Windows)
    one = home / 'OneDrive' / 'Desktop'
    if one.is_dir():
        return one
    return home / 'Desktop'


class AppJsApi:
    """Bridge for Bugtest Desktop writes + update channel (Windows-first)."""

    def save_text_to_desktop(self, filename: str, text: str) -> str:
        raw = str(filename or 'Bugtest.txt').replace('\\', '/').split('/')[-1]
        safe = re.sub(r'[^\w.\-]+', '_', raw).strip('._') or 'Bugtest.txt'
        if not safe.lower().endswith('.txt'):
            safe = f'{safe}.txt'
        target = desktop_dir() / safe
        target.parent.mkdir(parents=True, exist_ok=True)
        # Unique if the half-hour slot already has a report
        if target.exists():
            stem = target.stem
            suffix = target.suffix
            n = 2
            while True:
                alt = target.with_name(f'{stem}-{n}{suffix}')
                if not alt.exists():
                    target = alt
                    break
                n += 1
        target.write_text(str(text if text is not None else ''), encoding='utf-8')
        return str(target)

    def check_for_update(self) -> dict:
        from updater import check_for_update

        return check_for_update()

    def install_update(self) -> dict:
        from updater import install_update

        result = install_update()
        if result.get('ok') and result.get('restartRequired'):
            refresh_serve_root()
        return result

    def local_build(self) -> int:
        from updater import local_build

        return int(local_build())


def run_desktop_window(url: str) -> bool:
    """Open a native app window. Returns False if pywebview is unavailable."""
    try:
        import webview
    except ImportError:
        return False

    apply_mac_dock_icon()

    window = webview.create_window(
        APP_TITLE,
        url,
        width=1440,
        height=900,
        min_size=(960, 640),
        background_color='#101014',
        shadow=True,
        js_api=AppJsApi(),
    )
    if window is not None:
        window.events.before_show += _on_desktop_before_show
        window.events.loaded += _on_desktop_loaded
        window.events.shown += _on_desktop_shown
        window.events.resized += _on_desktop_resized

    icon = app_icon_path()
    if icon:
        webview.start(icon=icon)
    else:
        webview.start()
    return True


def main() -> None:
    os.chdir(ROOT)
    apply_mac_dock_icon()
    port = pick_port()
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    url = f'http://127.0.0.1:{port}'

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    print(f'{APP_TITLE}', flush=True)
    print(f'Local UI: {url}', flush=True)

    try:
        if force_browser():
            print('Opening in system browser (ENDO_ASD_BROWSER=1).', flush=True)
            open_system_browser(url)
            print('Press Ctrl+C to quit.', flush=True)
            threading.Event().wait()
        elif run_desktop_window(url):
            pass
        else:
            print(
                'Desktop window requires pywebview. Install with:\n'
                '  python3 -m pip install -r requirements.txt\n'
                'Opening in system browser for now.',
                flush=True,
            )
            open_system_browser(url)
            print('Press Ctrl+C to quit.', flush=True)
            threading.Event().wait()
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
