#!/usr/bin/env python3
"""Local preview that resolves extensionless URLs like GitHub Pages does (/about -> about.html).

    python3 tools/serve.py [PORT] [DIR]    # DIR defaults to dist/ if built, else legacy/
"""
import http.server, os, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else ((REPO / "dist") if (REPO / "dist").is_dir() else (REPO / "legacy"))


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def translate_path(self, path):
        p = super().translate_path(path)
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if not os.path.exists(p) and not clean.endswith("/") and os.path.isfile(p + ".html"):
            return p + ".html"
        return p

    def send_error(self, code, *a, **k):
        if code == 404 and (ROOT / "404.html").is_file():
            body = (ROOT / "404.html").read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().send_error(code, *a, **k)


print(f"serving {ROOT} at http://localhost:{PORT}/")
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
