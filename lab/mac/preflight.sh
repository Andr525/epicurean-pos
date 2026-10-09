#!/usr/bin/env bash
# Owner-run local metadata check only. Does not enumerate USB devices, read accounts or change settings.
set -euo pipefail
if [[ "$(uname -s)" != "Darwin" ]]; then echo 'This check is for your Mac; no iPhone access attempted.'; exit 2; fi
printf 'macOS: '; sw_vers -productVersion
if command -v node >/dev/null 2>&1; then node --version; else echo 'Node 22 is required for the local test server. Nothing was installed.'; exit 2; fi
node -e 'if(Number(process.versions.node.split(".")[0])!==22){console.error("Use Node 22 for the pinned test environment");process.exit(2)}'
if [[ -d /Applications/Safari.app ]]; then printf 'Safari: '; /usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' /Applications/Safari.app/Contents/Info.plist; fi
command -v openssl >/dev/null 2>&1 || { echo 'OpenSSL needed for temporary local TLS; nothing installed.'; exit 2; }
echo 'Mac server prerequisites present. No phone access, pairing, certificate trust or Appium setup performed.'
echo 'Do not start LAN serving or change iPhone settings before the scoped owner approval.'
