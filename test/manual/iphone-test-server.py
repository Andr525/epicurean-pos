#!/usr/bin/env python3
"""Harbor Lane TEST POS — local Wi-Fi server for iPhone testing (test kit only).

Serves THIS folder (the isolated test POS: fictional data, mock cloud, mock card) on the Mac's
private Wi-Fi address only, opens a QR window on the Mac, and stops when you press Stop Testing,
close the QR window, or close the Terminal window. Python standard library only.
Usage: python3 iphone-test-server.py <private-ipv4> [first-port]
"""
import http.server, ipaddress, json, os, socket, socketserver, subprocess, sys, threading, time

KIT = os.path.dirname(os.path.abspath(__file__))
PORTS = 5            # first-port … first-port+4 are tried before giving up
GRACE = 10           # seconds after the QR window closes (allows a reload) before stopping
STALE = 30 * 60      # stop if the QR window has not been seen for 30 minutes


def alert(title, message):
    """Clear error for the owner: Terminal text plus a macOS dialog (when available)."""
    print('\n  ' + title + '\n  ' + message.replace('\n', '\n  ') + '\n', flush=True)
    script = 'display dialog %s with title %s buttons {"OK"} default button "OK" with icon stop' % (json.dumps(message, ensure_ascii=False), json.dumps(title, ensure_ascii=False))
    try:
        subprocess.run(['osascript', '-e', script], timeout=600, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


def port_in_use(ip, port):
    """True if something already answers on ip:port (another test window, or any other program)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((ip, port)) == 0


def private_ipv4(text):
    try:
        ip = ipaddress.ip_address(text)
    except ValueError:
        return False
    return ip.version == 4 and ip.is_private and not ip.is_loopback and not ip.is_link_local


class State:
    last_seen = time.time()
    closing_at = None
    stopping = False


class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = 'HarborLaneTestPOS'

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=KIT, **kw)

    def log_message(self, fmt, *args):  # quiet: only errors reach the Terminal
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _control(self):
        path = self.path.split('?')[0]
        if path == '/__info':
            State.last_seen, State.closing_at = time.time(), None
            return self._json({'url': self.server.pos_url, 'running': True}) or True
        if path == '/__alive':
            State.last_seen, State.closing_at = time.time(), None
            return self._json({'ok': True}) or True
        if path == '/__closing':
            State.closing_at = time.time()
            return self._json({'ok': True}) or True
        if path == '/__stop':
            self._json({'stopped': True})
            State.stopping = True
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return True
        return False

    def do_GET(self):
        if not self._control():
            super().do_GET()

    def do_POST(self):
        if not self._control():
            self.send_error(405)


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True   # restart on the same port right after stopping (an active server still blocks it)


def watchdog(server):
    while not State.stopping:
        time.sleep(1)
        now = time.time()
        if State.closing_at and now - State.closing_at > GRACE:
            print('  The QR window was closed — stopping the test server.', flush=True)
            break
        if now - State.last_seen > STALE:
            print('  The QR window has not been open for 30 minutes — stopping the test server.', flush=True)
            break
    State.stopping = True
    server.shutdown()


def main():
    if len(sys.argv) < 2 or not private_ipv4(sys.argv[1]):
        alert('iPhone POS Test', 'This Mac does not have a home Wi-Fi (private network) address.\n\n'
              'Turn Wi-Fi on, join your home network, and try again.\n'
              'The test POS is never served on a public or internet address.')
        return 2
    ip = sys.argv[1]
    first = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
    server = None
    for port in range(first, first + PORTS):
        if port_in_use(ip, port):
            continue
        try:
            server = Server((ip, port), Handler)
            break
        except OSError:
            continue
    if server is None:
        alert('iPhone POS Test', 'Could not start the test server: ports %d–%d on %s are already in use or blocked.\n\n'
              'Close any other "iPhone POS Test" or "Test POS" Terminal window and try again. '
              'If it still fails, restart the Mac.' % (first, first + PORTS - 1, ip))
        return 3
    port = server.server_address[1]
    server.pos_url = 'http://%s:%d/index.html' % (ip, port)
    qr_url = 'http://%s:%d/iphone-qr.html' % (ip, port)
    print('\n  Harbor Lane TEST POS — fictional data, mock payments, nothing published online\n'
          '\n  iPhone URL:  %s\n'
          '\n  A QR window is opening on this Mac. Scan it with the iPhone camera.\n'
          '  To stop: press "Stop Testing" in that window, close it, or close this Terminal window.\n' % server.pos_url, flush=True)
    threading.Thread(target=watchdog, args=(server,), daemon=True).start()
    if os.environ.get('HLTEST_NO_OPEN') != '1':
        try:
            subprocess.Popen(['open', qr_url])
        except Exception:
            print('  Open this address on the Mac to see the QR code: ' + qr_url, flush=True)
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    server.server_close()
    print('  Test server stopped. You can close this window.', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
