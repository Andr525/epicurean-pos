# Manual table-safety repairs and hands-on iPhone pilot

Branch `review/manual-pos-table-safety-pilot`, based on `0545f74`. This cycle repairs the known split-check allergy, late-menu substitution and table-merge allergy paths, preserves C1, and delivers a usable local manual test path. [Open on Mac/iPhone](../../lab/docs/MANUAL-IPHONE-PILOT.md).

## Repairs with reproducible evidence

- **Split safety:** sister checks lacked explicit identities; their snapshots could retain outdated allergy maps. Sister checks inherit registered identities. Allergy/note/substitution edits refresh all open sibling check projections with one table safety revision. Ingestion rejects older safety revisions. Split-by-seat now groups exact 2 versus 2A and updates bound dining check IDs when lines move. Safety data is projected for nonselected tables too. This is local projection/recovery behavior, not a distributed database transaction claim.
- **Late menus:** new dining projections did not receive substitutions saved before the menu was added. They now inherit canonical welcome/entremet maps and regenerate their exact guest/table restrictions. Course editor warnings now use the course's guest, even when another position is selected.
- **Merges:** `destSess.allergies || srcSess.allergies` discarded source restrictions whenever the destination already had a map. Merge now preserves both tables' shared restrictions by union, keeps individual guest restrictions separate, remaps conflicting source base positions to unused numeric bases while retaining A siblings, and updates lines, dining projections and source substitution keys. Mapping is recorded in `check.positionMerge`; legacy numeric allergy aliases do not create phantom guests. Source checks remain marked merged. Shared restrictions conservatively apply across the merged table. Destination split checks retain the complete combined identity set.
- **Manual screen usability:** long menu/check content allowed the nested add-items pane to shrink, leaving second-menu controls behind the fixed Mic bar. Mobile flex sizing now retains scrollable menu content. The permanent screen scenario verifies a second menu can be added at the other exact position and edited unsent.
- **Hands-on launch:** new **Hands-on POS** resets fixtures and hides the lab panel so it does not obscure actual controls. STOP restores lab controls. Existing immutable transport, network, payment and microphone guards are unchanged.

## Tests and scope

Ten local/security test commands passed; five actual-interface Chromium screen scenarios passed (0 failed/0 aborted). Separate Playwright trusted clicks verify hands-on startup, PIN login, table selection, 2A/2 selection and STOP. The five in-page scenarios use synthetic DOM actions. Neither is current physical iPhone evidence.

New permanent `test/manual-table-safety.mjs` covers split exact identities, stale sibling recovery, 2/2A split separation, late-menu inheritance, exact course-editor allergies, collision-safe merge, source runtime remap, merged cold-runtime recovery and legacy aliases. It uses actual POS code and authentic BOH metadata, with declared synthetic staff and notes. It fails against baseline `0545f74` at the missing split identities assertion. Earlier C1, allergy recovery, service workflow, fine dining, geometry, handheld and security suites pass.

From the repository root with Node22 and installed frozen test dependencies:

```sh
node test/manual-table-safety.mjs
node test/REPRO-C1-phantom-3A.mjs
node test/manual-allergy-recovery-notes.mjs
node test/manual-allergy-identity.mjs
node test/REPRO-C2-C3-allergy-open.mjs
node test/service-workflow.mjs
node test/fine-dining-check.mjs
node test/table-geometry.mjs
node test/handheld-refine.mjs
node lab/test/security.mjs
```

From `lab`, with Chromium installed:

```sh
XDG_CONFIG_HOME=/tmp/epicurean-browser-config XDG_CACHE_HOME=/tmp/epicurean-browser-cache LAB_MANUAL=1 node test/screens.mjs
```

Evidence is in `lab/docs/evidence/table-safety-pilot/`. Passing outputs, the negative-control failure, and the actual pre-repair obscured-control browser failure are retained. Screen-runner corrections select one of the POS's two existing Modify toolbars, use the supported `Well Done` modifier, and assert the actual compact `2A WD` display plus structured temperature. No product assertion was disabled to make the suite pass. The documented pre-existing Voice source-freeze failure was not rerun or repaired; Voice development remains paused.

## Remaining blockers in priority order

1. **Critical operational safety:** durable full unsent-order/database recovery; concurrent clients and legacy unversioned snapshot reconciliation; authorized kitchen SEND/FIRE and acknowledgment. No live Firebase/emulator/kitchen was used. Local revision ordering does not establish multi-client conflict resolution or durable acknowledgments. No live orders may be sent from this pilot.
2. **Critical financial/authorization gaps:** manager code/audit for voids, comps and discounts; required NYC tax, tip policy and customer disclaimer; full edit-upcharge/totals integrity. The demonstrated $178 is two authentic $89 menus, not a completed taxed/tipped check.
3. **Catalog blockers:** authentic published ordinary à-la-carte food, cocktail and daily-special records are absent; current 86/stock status is unavailable. Those categories remain BLOCKED. Authentic PF/tasting/wine/beer/spirit snapshots retain original IDs/prices.
4. **Acceptance verification:** current physical iPhone, external Claude, physical split/merge workflows, complete tasting/beverage and recovery/keyboard/scroll testing. Mac launcher shell syntax, local server and expiry/security were checked here; macOS firewall/LAN/device behavior awaits owner testing.

The single matrix remains60 tests/52 critical, formal0/60; M30 is PARTIAL/BLOCKED pending complete durable/transport/physical verification. Historical evidence is retained separately. No deployment, production change, live Firebase, emulator, real kitchen transactions or expense occurred. Stop after publishing for independent review and owner testing.
