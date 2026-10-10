# Epicurean Master — certificate-free screen test

Review-only isolated POS UI with synthetic accounts/checks and a hash-verified BOH catalog snapshot. No production changes, paid APIs, microphone, real kitchen orders or personal data. HTTP is unencrypted: use only your private trusted home Wi-Fi, never a guest/public network; do not enter real credentials. The capability URL is not protection against someone monitoring that Wi-Fi.

## One Mac command

With Node 22 installed, update this review branch, then from its `lab` folder run:

```bash
bash mac/start-session.sh --owner-approved PRIVATE_MAC_IP
```

Use the Mac Wi-Fi IPv4 address from System Settings → Network → Wi-Fi → Details → TCP/IP. The script installs nothing, creates no certificates and inspects no device. It prints the exact `http://PRIVATE_MAC_IP:9443/?access=...` URL. It binds only that private IP, with a $0/60-minute authorization. Listener and active connections automatically close at expiry; Ctrl-C stops early. Its temporary approval file is removed on normal exit. No npm install is necessary to host.

Keep Mac/iPhone on the same private Wi-Fi. Open the printed URL in iPhone Safari. Tap **Run screen suite** once; tap **STOP** to cancel. The first run uses rendered POS controls and scripted interpretation. Microphone controls/capture and the audio endpoint are disabled. No certificate profile or trust setting is needed. USB is optional for Inspector diagnostics, not page access. If needed enable iPhone Safari Web Inspector, connect USB, accept owner pairing and select only this lab tab in Mac Safari Develop. Inspector does not provide full remote control or automatic phone screenshots.

## Automatic checks and preserved failures

Manual BOH menu/price, multi-course correction, confirmation without duplicates, missing-price rejection, guest conversation, logout/login, separate 2/2A and later dessert. Screen suite records selectors/actions, rendered text and structured check state in Mac `lab/artifacts`. Do not enter personal data; evidence is controlled fixtures, not a general PII scrubber. Phone screenshots/system dialogs/native touch/microphone behavior remain manual/unverified.

The three genuine POS failures are explicitly isolated in the test results: obscured pricing selector after login, rejection of simultaneous 2 and 2A, and later dessert rejected. No prices/products are invented and no kitchen transactions occur. Source POS is unchanged. Tests deliberately exit 1 when those defects reproduce.

## Security changes after Claude review

All SEND/FIRE entry points, including the six previously missing functions, are blocked with non-writable guards; direct invocation is tested. External networking/Firebase and payments remain disabled. Exact Host/Origin, local token, LAN capability cookie, body bounds, route allowlist and CSP remain active. Screen-only mode blocks microphone via permissions policy, runtime and server endpoint. The server automatically closes at expiry, rather than only rejecting requests.

CA generation is removed from this test path. `mac/make-cert.sh` is disabled; LAN HTTPS is refused. Generated cloud lab keys were deleted. No new CA private key exists to retain, constrain, sync or back up. **CA address restrictions and iOS enforcement have NOT been verified**; HTTPS/microphone testing cannot proceed until independent verification and separate approval. The former certificate instructions are withdrawn. If you already created certificates on your Mac, delete only the old lab `certs` directory (including ca.key/server.key), remove any installed Epicurean temporary CA profile from the iPhone, and remove corresponding synced/backup copies through your own backup controls. Nothing here accesses your backup or deletes personal files. Ordinary file deletion is not a guarantee of forensic erasure.

## Development verification

Node 22, `npm ci --ignore-scripts --no-audit --no-fund`. Installed Chromium required; `CHROMIUM_PATH` defaults to /usr/bin/chromium. `npm test` includes mock audio on cloud loopback only. `LAB_DOM_ONLY=1 npm run test:screens` runs the phone-facing button without an external control driver. Chromium viewport emulation is not physical Safari. Security tests exercise denial and actual expiry listener closure using a short deadline.

Independent review still required: Claude's new security review, actual iOS Safari HTTP/cookie/DOM behavior, owner Mac launcher/firewall behavior and the three retained POS defects. Physical HTTPS/iOS name-constraint enforcement is a separate blocked milestone. No staging/production deployment is authorized.
