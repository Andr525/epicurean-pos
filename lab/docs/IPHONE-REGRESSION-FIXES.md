# iPhone-confirmed POS regression repairs — review only

Baseline: 044e680. Owner reported actual iPhone 17 Pro + MacBook Air Safari automatic suite 4 passed / 3 failed / 0 aborted, including visible 2/2A, pricing selector, fixed Mic dock and “Dish is not an allowed choice…” error. That physical result confirms the baseline failures; it does not validate this revised code.

## Code evidence and repair

- Layout: orderTopHtml puts pricing and confirmation after the check, while .voice-dock is fixed at bottom. Existing available scroll space can end beneath that dock. Reserve bottom scroll space in #order-top and app-content, keep dock fixed, and give pricing a 44px target. Tests still hit-test actual control centers before clicking; no obscured-control assertion was disabled.
- Positions: validate formerly compared op.seat's suffix against the one femalePositions flag for its numeric seat. seatHasPrixFixe formerly compared only numeric seats. Both made 2 and 2A exclusive even when the check explicitly authorized both. Use check.positionIdentities with the existing legacy fallback; bind active identity to the check; render distinct chips/picker entries; retain numeric seat plus explicit seatPriority in constructors, check rows, dining objects, rendered tokens and structured kitchen items. Speech cannot create a seat. Existing legacy manual seat toggles remain available when no explicit identities exist.
- Dessert/error: menuChoice explicitly discarded courses whose BOH mode was later, even though pfGuestChoiceMode allows them and buildPrixFixeSelections supports later dessert. Accept exactly one actual BOH option for the course, then fill the pending included-dessert slot on an owned unsent menu. Confirm remains mandatory. Retain original line/menu identity and original base price; add only the actual BOH option surcharge. No standalone price or new menu is inferred. Preserve notes and all unrelated selections/dining objects. No SEND/FIRE is invoked.

The original prix-fixe error came from course-mode filtering, not evidence of a wrong BOH menu/price. No catalog/pricing source changed. Dessert without an existing complete menu remains rejected with a specific appetizer/main instruction. Already selected/skipped, sent, or any fired menu stays protected; unsupported dessert modifiers stay manual.

## Explicit live limitation

The existing architecture writes new tasting_orders with .add but does not retain a reliable document-reference update path for later edits. This milestone does not guess a document ID or silently leave a live dessert update unsynchronized: when Firebase is live, Voice directs existing-menu dessert edits to the manual POS. The isolated screen pilot supports the corrected operation. Live persistence, real authentication/providers, seat-specific allergy editing and physical microphone acceptance require separate verification before any deployment. Numeric allergy controls remain conservative shared restrictions; Voice does not weaken them or invent separate allergies.

## Validation

- Security checks pass, including transaction guards and actual listener expiry.
- Page-button DOM suite: 10 passed, 0 failed, 0 aborted, including prior three regressions plus no-menu, fired-fixture and live-persistence rejection. Fault injections simulate existing state only; no FIRE or Firebase call is made.
- Fine-dining check, manual service workflow, Voice service and mocked server conversational session regressions pass.
- Independent internal verifier reproduced the core screen fixes; this is not Claude's audit or physical validation.
- Full cloud browser suite: 11 passed / 0 failed / 0 aborted, including recorder restart; zero external requests, exceptions or sent orders.
- Mock microphone uses a deterministic synthetic tone so default fake-device intermittent silence does not mask capture tests. It proves capture/session plumbing only, not ASR or noise/voice understanding.

Evidence: docs/evidence/iphone-regression-fixes. Historic failure reports remain intact. Claude should review the diff from 044e680 to review/iphone-pos-regression-fixes and independently rerun the tests. No merge/deployment or external message/issue was sent.

## Next owner test after Claude review

On the Mac, update/select review/iphone-pos-regression-fixes, then from lab with Node22 run:

    bash mac/start-session.sh --owner-approved PRIVATE_MAC_IP

Open the printed HTTP capability URL in iPhone Safari on the same trusted home Wi-Fi, keep the phone in portrait, tap Run screen suite once. Expected 10 passed / 0 failed / 0 aborted. Reports save automatically under Mac lab/artifacts. STOP cancels; Control+C closes the server; close only the test tab. No certificate/microphone/provider activation is needed. HTTP is unencrypted and suitable only for controlled synthetic fixtures on trusted home Wi-Fi. Send the report and a POS-tab screenshot if any case fails, rather than repeating individual dishes.
