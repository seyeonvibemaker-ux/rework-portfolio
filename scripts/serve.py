# 로컬 미리보기: cleanUrls 흉내 (/services -> /services/index.html)
import http.server, os
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = super().translate_path(path)
        if not os.path.exists(p) and os.path.exists(p + '.html'): return p + '.html'
        return p
http.server.ThreadingHTTPServer(('127.0.0.1', 5180), H).serve_forever()
