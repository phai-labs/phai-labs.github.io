"""Serve the built site for internal review, behind HTTP Basic Auth.

    python scripts/preview-server.py [--port 8087] [--dir _site] [--user phai] [--pass xxxx]

Prints the credentials it is using. Pair it with a tunnel to get a link that
colleagues elsewhere can open:

    ssh -R 80:localhost:8087 nokey@localhost.run

Everything stays on this machine; closing either window ends the preview.
"""
import argparse
import base64
import functools
import http.server
import mimetypes
import os
import secrets
import socketserver
import sys

mimetypes.add_type("video/webm", ".webm")
mimetypes.add_type("video/mp4", ".mp4")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/svg+xml", ".svg")


class Handler(http.server.SimpleHTTPRequestHandler):
    token = ""
    realm = "PhAI Labs preview"

    def _unauthorized(self):
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="%s", charset="UTF-8"' % self.realm)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write("需要用户名和密码 / credentials required\n".encode("utf-8"))

    def _authorised(self):
        header = self.headers.get("Authorization", "")
        if not header.startswith("Basic "):
            return False
        return secrets.compare_digest(header[6:].strip(), self.token)

    def do_GET(self):
        if not self._authorised():
            return self._unauthorized()
        return super().do_GET()

    def do_HEAD(self):
        if not self._authorised():
            return self._unauthorized()
        return super().do_HEAD()

    def end_headers(self):
        # a preview should never be cached or indexed
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Robots-Tag", "noindex, nofollow, noarchive")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "GET" in (args[0] if args else ""):
            sys.stderr.write("  %s\n" % (args[0] if args else ""))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8087)
    ap.add_argument("--dir", default="_site")
    ap.add_argument("--user", default="phai")
    ap.add_argument("--password", default=None)
    a = ap.parse_args()

    root = os.path.abspath(a.dir)
    if not os.path.isdir(root):
        sys.exit("找不到目录：%s（先运行 pnpm build）" % root)

    password = a.password or ("phai-" + secrets.token_urlsafe(6))
    Handler.token = base64.b64encode(("%s:%s" % (a.user, password)).encode("utf-8")).decode("ascii")

    print("=" * 62)
    print("  目录      %s" % root)
    print("  本机地址  http://localhost:%d/" % a.port)
    print("  用户名    %s" % a.user)
    print("  密码      %s" % password)
    print("=" * 62)
    print("  外网访问：另开一个终端运行")
    print("    ssh -R 80:localhost:%d nokey@localhost.run" % a.port)
    print("  它会打印一个 https 地址，连同上面的用户名密码一起发给同事。")
    print("  关闭本窗口即停止服务。")
    print("=" * 62, flush=True)

    handler = functools.partial(Handler, directory=root)
    with Server(("0.0.0.0", a.port), handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止。")


if __name__ == "__main__":
    main()
