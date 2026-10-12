# Owner-requirement revision: evidence and next steps

Base a529059. Authorized implementation scope: exact-identity allergy UI/lookup and tests only. This review does not implement or certify manager-code boundaries/audit, void/comp/discount, NYCtax/tips/customer disclaimers, Firestore or kernel SEND/FIRE. No Voice changes, no real writes/actions/provider/device access.

Evidence: ../../lab/docs/evidence/manual-owner-revisions/results.json plus allergy screenshot. Node22 LAB_MANUAL=1 node test/screens.mjs from lab:3PASS/0FAIL/0ABORT, real UI with tracked BOH fixtures. M30 now checks exact2/2A independently toggle/remove/reopen and shared table restrictions. Existing catalog and PF cases remain limited smoke, not acceptance-complete data. New unit test test/manual-allergy-identity.mjs checks numeric legacy keys, exact identity lookup, selected allergy identity and invalid identity/allergen mutation guards without a backend. Independent internal verifier reproduced all3scenarios plus unit/security; it is not Claude.

Reproducible commands, Node22 and frozen installs in lab/test:

    node test/manual-allergy-identity.mjs
    node lab/test/security.mjs
    node test/fine-dining-check.mjs
    node test/service-workflow.mjs
    node test/table-geometry.mjs
    node test/handheld-refine.mjs

From lab with installed Chromium: LAB_MANUAL=1 node test/screens.mjs. All listed checks pass. Actual iPhone results remain NOT_RUN for this revision, simulated transport NOT_RUN, and formal accepted0/60. Historical a529059 allergy failure retained in prior evidence. Missing authentic catalog rows are BLOCKED. Source prices/catalogs are unchanged.

Next steps, in order:
1. Claude independently reviews allergy code/tests, owner policy, exact60/52 matrix and FIRESTORE-ISOLATION-DESIGN.md. The M61–M63 mapping reflects owner-described themes; no claim of having reviewed an unavailable full Claude report.
2. Resolve independent findings, rounding/taxability policy and legacy-to-explicit position migration before extending scope. Needed authentic read-only BOH food/cocktail/special/availability/taxability export remains a data gate; do not use demo menu replacements. Owner allergy-override role policy remains separate from FIRE permission.
3. Only after design review and explicit owner approval for the isolated emulator-write profile may the proposed database harness be built/run. No production configuration or live credentials allowed. No database design implementation is started now.
4. After independent verification, owner may run the current no-write repair profile: from lab with Node22, bash mac/start-session.sh --owner-approved PRIVATE_MAC_IP --manual; open printed HTTP origin on trusted home Wi-Fi, tap Run manual audit once (expect3/0/0), STOP/Control+C/close tab. No microphone/certificates/real kitchen/payment. No device action occurs through this cloud agent.

Known limits: in-memory/DOM repair is not durable allergy persistence; numeric legacy records preserve old keys but an explicit schema migration must resolve ambiguous preexisting2/2A mappings rather than infer them. Guest-wide PF allergy warnings remain conservative; specific override authority is not implemented. Tax/tip defaults in current POS still violate finalized policy and payment UI remains sandbox-only; payment is blocked. Proposed rounding examples are contract review items, not live billing changes.

Delivery ends after review-branch publication. Wait for independent verification; do not start Cycle2 database work or resume Voice.
