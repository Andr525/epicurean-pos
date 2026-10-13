# Current mobile ordering screen revision

Use [iteration1 Mac/iPhone instructions, verification and limits](docs/MOBILE-ORDERING-ITERATION1.md). Branch `review/manual-pos-mobile-ordering-iteration1` retains FOOD/DRINKS, pins the live check and guest allergies during selection, restores category navigation, hides development controls and blocks known PF/tasting conflicts before adding. Physical owner testing pending. Earlier delivery notes follow.

# Current manual POS hands-on pilot

Start here: [Mac/iPhone opening instructions and testable workflow](docs/MANUAL-IPHONE-PILOT.md). Review branch `review/manual-pos-table-safety-pilot` adds split/late-menu/merge allergy regressions and a five-scenario manual screen audit. Formal acceptance remains0/60; durable database and physical verification pending. [Repair evidence](../docs/manual-pos/TABLE-SAFETY-PILOT.md).

The following sections describe earlier deliveries and their historical results.

# Corrective safety review

Current manual audit runs4components, including exactmodifier2/2A/3 warnings. See [corrective RCA and unresolved defects](../docs/manual-pos/CORRECTIVE-SAFETY-REVISION.md). C1candidatepasses; C2recovery and C3substitutions/notes stillfail, so M30isFAIL and formalacceptance0/60. No emulator/Voice development. Historical counts below refer to earliercommits.

# Owner revision of the manual milestone

See [finalized owner policy](../docs/manual-pos/OWNER-REQUIREMENTS.md), [Firestore design awaiting approval](../docs/manual-pos/FIRESTORE-ISOLATION-DESIGN.md), and [revision evidence/next steps](../docs/manual-pos/OWNER-REVISION-VERIFICATION.md). The current repair profile has 3 passing browser checks, including distinct2/2A allergy toggles/table restrictions; formal acceptance remains0/60. Permissions/manager audits, void/comp/discount, tax/tips/disclaimers and database integration are planned, NOT implemented here. Missing authentic catalog cases are BLOCKED.

Historical inventory context follows; its prior2-pass/1-fail counts refer to a529059, not this repair.

# Manual POS priority milestone

Voice development is paused. See [full inventory and two-cycle plan](../docs/manual-pos/INVENTORY-AND-PLAN.md), [60-test matrix](../docs/manual-pos/ACCEPTANCE-MATRIX.md), and the single [scorecard](../docs/manual-pos/SCORECARD.json). Manual profile: add `--manual` to the Mac launcher; `LAB_MANUAL=1 npm run test:screens` runs three actual-POS audit scenarios (2 pass, M30 allergy identity fails). This is not 60 completed acceptance tests. The profile includes tracked BOH beverages/PF/tasting; ordinary published food/cocktail/special exports are still missing. No price or product is invented.

The remainder documents the earlier mixed Voice lab, retained as historical regression context rather than the next development priority.

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

The owner's iPhone run of baseline 044e680 reproduced the three POS failures. This review branch repairs those regressions and extends the page-run suite to ten cases, including no-menu, fired-course and live-persistence guards. See [iPhone repair evidence and next steps](docs/IPHONE-REGRESSION-FIXES.md). Existing-menu Voice dessert edits are deliberately blocked when Firebase is live until its dining persistence is verified. Historic failures remain in evidence; fresh physical acceptance is pending. No catalog or price source was changed, and no kitchen transactions occur.

## Security changes after Claude review

All SEND/FIRE entry points, including the six previously missing functions, are blocked with non-writable guards; direct invocation is tested. External networking/Firebase and payments remain disabled. Exact Host/Origin, local token, LAN capability cookie, body bounds, route allowlist and CSP remain active. Screen-only mode blocks microphone via permissions policy, runtime and server endpoint. The server automatically closes at expiry, rather than only rejecting requests.

CA generation is removed from this test path. `mac/make-cert.sh` is disabled; LAN HTTPS is refused. Generated cloud lab keys were deleted. No new CA private key exists to retain, constrain, sync or back up. **CA address restrictions and iOS enforcement have NOT been verified**; HTTPS/microphone testing cannot proceed until independent verification and separate approval. The former certificate instructions are withdrawn. If you already created certificates on your Mac, delete only the old lab `certs` directory (including ca.key/server.key), remove any installed Epicurean temporary CA profile from the iPhone, and remove corresponding synced/backup copies through your own backup controls. Nothing here accesses your backup or deletes personal files. Ordinary file deletion is not a guarantee of forensic erasure.

## Development verification

Node 22, `npm ci --ignore-scripts --no-audit --no-fund`. Installed Chromium required; `CHROMIUM_PATH` defaults to /usr/bin/chromium. `npm test` includes mock audio on cloud loopback only. `LAB_DOM_ONLY=1 npm run test:screens` runs the phone-facing button without an external control driver. Chromium viewport emulation is not physical Safari. Security tests exercise denial and actual expiry listener closure using a short deadline.

Independent review still required: Claude's new security review, actual iOS Safari HTTP/cookie/DOM behavior, owner Mac launcher/firewall behavior and the three retained POS defects. Physical HTTPS/iOS name-constraint enforcement is a separate blocked milestone. No staging/production deployment is authorized.
