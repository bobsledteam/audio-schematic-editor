#!/usr/bin/env python3
"""Local app server for Guitar Wiring Visualiser."""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

PORT = 8765
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, format, *args):
        pass


def main():
    os.chdir(ROOT)
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Guitar Wiring App running at http://127.0.0.1:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
