# Inventory delivery verification

POS behavior source baseline: 75ba5d8. This delivery modifies only lab/docs/catalog snapshots, not index.html, pricing or Voice implementation.

Reproduction: Node22; npm ci --ignore-scripts --no-audit --no-fund in lab and test. From lab, LAB_MANUAL=1 node test/screens.mjs. Chromium at /usr/bin/chromium or CHROMIUM_PATH. EXPECT EXIT1: two pass, one genuine critical failure M30. Evidence and screenshots: ../../lab/docs/evidence/manual-inventory. source.manualCatalogProvenance records exact cellar/dining hashes and source commits. Local fixture people/checks are synthetic; products/prices are tracked BOH records. Published ordinary menu/current availability are unavailable, not simulated as invented replacements.

Independent internal verifier reproduced the same catalog/PF passes and missing-2A allergy failure, confirmed 60 unique matrix IDs (52 critical/8 minor), and security guards. This verifier is not Claude; Claude's external review is pending.

Fresh regression runs pass:
- node lab/test/security.mjs (including manual-mode microphone/provider denial)
- node test/fine-dining-check.mjs
- node test/service-workflow.mjs
- node test/table-geometry.mjs
- node test/handheld-refine.mjs

No Voice benchmark was run or developed in this cycle. Existing legacy test profile remains separate. No real Firebase authentication/durability, kitchen authorization, device gestures, production data revision or physical iPhone success is certified. Formal acceptance count remains zero, with one reproduced critical failure and two partial smoke results. No network/provider/Firebase write/SEND/FIRE occurred during manual audit; local JSON/screenshots are evidence only.

The initial owner iPhone evidence is solely the reported 044e680 mixed suite. It is not claimed as physical verification of this manual inventory delivery or repaired 75ba5d8.
