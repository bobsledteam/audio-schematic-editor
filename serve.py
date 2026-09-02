#!/usr/bin/env python3
"""Local app server for Guitar Wiring Visualiser."""

import os
import sys
import threading
import time
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8765


def get_root():
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


ROOT = get_root()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, format, *args):
        pass


def open_browser(port):
    time.sleep(0.6)
    webbrowser.open(f'http://127.0.0.1:{port}')


def main():
    os.chdir(ROOT)
    port = PORT
    server = HTTPServer(('127.0.0.1', port), Handler)
    url = f'http://127.0.0.1:{port}'

    if os.environ.get('GUITAR_WIRING_OPEN_BROWSER', '1') != '0':
        threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    print(f'Guitar Wiring App running at {url}', flush=True)
    print('Press Ctrl+C to stop.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
