@echo off
cd /d "%~dp0"
echo Harbor Lane TEST POS - http://127.0.0.1:8765  (close this window to stop)
start "" "http://127.0.0.1:8765/index.html"
py -m http.server 8765 --bind 127.0.0.1 || python -m http.server 8765 --bind 127.0.0.1
