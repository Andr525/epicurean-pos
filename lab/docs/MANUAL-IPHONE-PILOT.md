# Open the real manual POS safely on your iPhone

Review branch: `review/manual-pos-table-safety-pilot`. This serves the actual POS locally on your Mac with synthetic staff/tables and hash-verified BOH snapshots. No Firebase, emulator, kitchen transport, payments, printing, microphone or paid API. It creates no certificates and deploys nothing. This is HTTP screen testing on your private trusted home Wi-Fi; enter only fixture PIN 5000 and controlled test notes.

## Mac

1. Use Node **22** (check `node --version`). In your existing `epicurean-pos` checkout, run:

```sh
git fetch origin
git switch review/manual-pos-table-safety-pilot
cd lab
```

Do not overwrite local changes if Git refuses the switch. Hosting requires no npm installation.

2. Find your Mac's Wi-Fi IPv4 address in System Settings → Wi-Fi → Details → TCP/IP. Keep Mac and iPhone on the same private Wi-Fi. Replace `MAC_WIFI_IP` below with that address:

```sh
bash mac/start-session.sh --owner-approved MAC_WIFI_IP --manual
```

This owner-run command starts a local, $0, 60-minute session bound to that private address. If macOS asks about incoming connections, allow this local Node server only on your trusted network. Do not open router ports or disable your firewall. Keep Terminal open.

3. Terminal prints the **exact** URL: `http://MAC_WIFI_IP:9443/?access=SESSION_TOKEN`. The token changes each session. No working public/cloud URL has been established; do not use the production URL. Copy the entire printed URL to your iPhone, including `?access=`.

## iPhone

1. Open the printed URL in Safari. No app/profile/certificate installation is needed.
2. Tap **Hands-on POS** to hide the testing panel and start a fresh fixture session. Enter **5000** on the POS keypad.
3. Open **Table service**, then table **14** (table **15** is also available). Select position **2** or **2A** with the position chips.
4. Scroll down to **Prix Fixe**, select the authentic $89 Scalini Fedeli menu, choose appetizer and main, select the offered temperature when required, then confirm **Add to Order** in that selector. This adds an unsent menu; it is not SEND/FIRE. For a repeatable example, use the available linguini pescatore and roasted pork chop, Medium. Add another menu at the other position. The browser screen test proves two menus total $178 before unimplemented tax/tip calculations.
5. Use the allergy strip **Edit** button for independent Fish at 2, Dairy at 2A, or table restrictions. Save and reopen. Use the welcome-course **Modify** button to enter separate substitution notes at 2 and 2A. These are operator instructions, not catalog replacements validated by BOH.
6. To edit an unsent main, tap its position token to select that guest's course, then **Modify** in the check toolbar. Change the offered pork temperature from Medium to Well Done and save. The check uses **WD** for Well Done and **M** for Medium. Check the correct guest's token. Do not tap FIRE, SEND, Send note, Pay or Print; they are blocked in this lab.

## Automatic run and stopping

- Tap **Run manual audit (5)** for five actual-interface scenarios: authentic catalog projection, manual menu/price, exact allergy controls, C1 phantom-position/warnings, and a complete two-position menu/allergy/substitution/unsent temperature-edit flow. Each scenario resets fixtures. It saves structured results and screen text under the Mac's `lab/artifacts/` directory. The in-page runner uses synthetic DOM actions, not full remote phone control.
- **STOP** cancels automated work and reveals lab controls. **Hands-on POS** resets local test data. Browser refresh also resets the fixture; it does not demonstrate durable order recovery.
- In Mac Terminal press **Control+C**, then close the iPhone test tab. Server and connections also close automatically after 60 minutes. Reopening after expiry requires a new launcher session and URL.
- If Safari cannot open the URL, check that it contains `http://`, the current Mac Wi-Fi IP and full token, Terminal is still running, and both devices share the trusted network. VPN/client-isolation/firewall rules may prevent LAN access. USB does not supply page networking.

USB/Web Inspector is optional, not required for this test. To inspect only this lab tab, connect your own iPhone by USB, enable Safari Web Inspector on iPhone, enable Safari developer features on Mac, approve your own pairing prompt, then choose this lab tab in Mac Safari's Develop menu. Inspector does not provide full remote phone control. No tool in this delivery accesses your device or personal applications.

## What is available versus blocked

- **Screen-verified:** table/position selection, both 2 and 2A menu lines, authentic $89 prix-fixe choices, temperature modifiers, allergy editor, exact substitution notes and unsent course temperature edits. C1 still passes. Five synthetic screen scenarios and a separate trusted-click Chromium hands-on startup smoke pass; current physical iPhone results are **NOT_RUN**.
- **Local-function regressions:** split checks preserve exact identities and table safety; 2/2A split separately; stale sibling snapshots cannot replace a newer safety revision; late menus inherit substitutions; table merges preserve allergies with explicit source-position remapping. These are not yet physical split/merge screen acceptance.
- **Available authentic snapshots:** $89 prix fixe, $115 regional tasting, 3,612 wine records and 107 beer/spirit records. Tasting and all beverage interaction paths are available for exploration but are not certified by the new end-to-end screen scenario. Prices/catalog snapshots are unchanged; no current availability/86 claim.
- **Unavailable real categories:** published ordinary à-la-carte food, cocktails and daily specials. No authentic export for those categories was supplied. Standalone dishes without BOH à-la-carte prices cannot be sold as individually priced food. No replacement prices or placeholder products are added.
- **Critical blockers:** durable unsent-order/database recovery and concurrent-client conflict resolution; authorized SEND/FIRE and kitchen acknowledgment; manager approval/audit for voids/comps/discounts; required NYC tax/tip totals/disclaimer. This is a safe workflow pilot, not an operational restaurant checkout.
- **Pending verification:** Claude review, physical Safari scrolling/keyboard/touch behavior, complete tasting/beverage/edit-upcharge flows and Mac LAN/firewall behavior. HTTP cannot test microphone capture. The earlier Voice source-freeze test failure remains documented; Voice development is paused.
