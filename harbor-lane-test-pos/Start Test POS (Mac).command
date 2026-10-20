#!/bin/bash
cd "$(dirname "$0")"
echo "Harbor Lane TEST POS — http://127.0.0.1:8765  (close this window to stop)"
(sleep 1; open "http://127.0.0.1:8765/index.html") &
python3 -m http.server 8765 --bind 127.0.0.1
