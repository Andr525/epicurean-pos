#!/bin/bash
# Start iPhone POS Test — Harbor Lane TEST POS (fictional data, mock database, mock payments).
# Double-click on the Mac. Finds this Mac's active home Wi-Fi address, starts the isolated test server
# on that address only, and opens a window with a large QR code to scan with the iPhone camera.
# Nothing is published on the internet. Uses only software already on the Mac.
cd "$(dirname "$0")" || exit 1

fail() {
  echo ""; echo "  $1"; echo ""
  osascript -e "display dialog \"$1\" with title \"iPhone POS Test\" buttons {\"OK\"} default button \"OK\" with icon stop" >/dev/null 2>&1
  exit "${2:-1}"
}

# python3 ships with macOS developer tools (the existing test launcher already uses it).
PY=""
for c in /usr/bin/python3 /usr/local/bin/python3 /opt/homebrew/bin/python3 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import http.server' >/dev/null 2>&1; then PY="$c"; break; fi
done
[ -n "$PY" ] || fail "python3 is not available on this Mac, so the local test server cannot start. The original launcher needs it too." 4

is_private() { case "$1" in 10.*|192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[0-1].*) return 0;; *) return 1;; esac; }

# 1) the interface that carries the default route (the active network), 2) the usual Wi-Fi/Ethernet ports.
IP=""
DEF_IF=$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')
for IF in $DEF_IF en0 en1 en2 en3 en4 en5; do
  CAND=$(ipconfig getifaddr "$IF" 2>/dev/null)
  if [ -n "$CAND" ] && is_private "$CAND"; then IP="$CAND"; break; fi
done
[ -n "$IP" ] || fail "No home Wi-Fi connection found. Turn Wi-Fi on and join your home network (the same one as your iPhone), then double-click this launcher again." 2

exec "$PY" iphone-test-server.py "$IP" 8765
