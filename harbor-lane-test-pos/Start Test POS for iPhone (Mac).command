#!/bin/bash
# Harbor Lane TEST POS — serve the test kit to devices on YOUR home Wi-Fi only (e.g. your iPhone).
# Same files, same fictional data, mock cloud and mock card, same no-network policy inside the page.
# The server listens only on this Mac's Wi-Fi address; nothing is published on the internet.
cd "$(dirname "$0")"
PORT=8765
IP=""
for IF in en0 en1 en2 en3; do IP=$(ipconfig getifaddr "$IF" 2>/dev/null); [ -n "$IP" ] && break; done
if [ -z "$IP" ]; then
  echo "Could not find this Mac's Wi-Fi address. Turn Wi-Fi on, join your home network, and try again."
  read -n 1 -s -r -p "Press any key to close."; exit 1
fi
URL="http://$IP:$PORT/index.html"
echo ""
echo "  Harbor Lane TEST POS (fictional data, mock payments)"
echo ""
echo "  On your iPhone (same Wi-Fi), open Safari and go to:"
echo ""
echo "      $URL"
echo ""
echo "  On this Mac you can use the same address."
echo "  Only devices on your home network can reach it. Close this window to stop the server."
echo ""
(sleep 1; open "$URL") &
python3 -m http.server "$PORT" --bind "$IP"
