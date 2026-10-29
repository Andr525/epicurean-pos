# Current corrective revision

See CORRECTIVE-SAFETY-REVISION.md for C1 candidate repair, C2/C3 unresolved reproductions and new RCA. M30 remains compositeFAIL, formal0/60. Current manual smoke has4passing components, not a completed allergy/persistence acceptance row. Matrix nowpromotesmandatorydisclaimerM18 tocritical andnarrowsM47 tovisual-onlyminor, preserving52critical/8minor. UpdatedFirestoretencontracts are DESIGNONLY, not an approved/built transport. Historical owner-revision inventory follows; earlierM30pass refers only to its narrow editor/helper coverage.

# Manual POS milestone inventory and delivery plan — owner revision

Historical inventory baseline75ba5d8 and a529059. Current revision implements only the separate 2/2A allergy repair and stronger tests. OWNER-REQUIREMENTS.md controls staff/tax/tip/adjustment policy; FIRESTORE-ISOLATION-DESIGN.md is a proposal for Claude approval before any emulator build. Voice development is paused. “Implemented” means a code path exists; it does not mean reliable or accepted.

## Implemented / evidence / missing or broken

| Capability | Actual source | Current assessment |
|---|---|---|
| PIN/staff/hub/table login | finishLogin, staff_clock load, openTableService | Fixture login/navigation passed automated; owner's 044e680 phone suite entered PIN/table. Real permission enforcement unverified. |
| Floor/stations/occupied tables | floor gestures, tableHasOrder, stationsAreBohOnly | Code exists and geometry regressions exist; full occupied-table acceptance pending. |
| BOH food/categories | loadBohMenu, boh_shared/menu snapshot | Implemented. Published document unavailable in this checkout; SEED_ITEMS are demo data, not acceptance catalog. |
| Bottle/wine/glass/beer/spirit | mapWineToPos, mapBarToPos, rebuildPosCatalog | Tracked BOH snapshot: 3612 bottles, 18 beers, 89 spirits; Scalini 21 BTG. Projection smoke passes; not live availability verification. |
| Cocktails/daily specials/86 | bar snapshot, daily-special filter, itemIsEightySixed | Code exists; current published records not available. Missing acceptance data; no substitute products/prices allowed. |
| Ordinary manual add/modifiers/course | beginAddItem, pickMod, setPendingCourse, confirmAdd | Real code retained; ordinary food screens not yet covered by current lab data. Price-from-dollar-text path requires critical regression. |
| Exact positions 2/2A | checkPositionIdentities, constructors, seat picker/tokens | Repaired on previous review branch; PF simulated coexistence passes. Ordinary food, moves/splits, receipt and kitchen identity not accepted yet. No fresh owner test of 75ba5d8. |
| PF/None/temperatures/extra/upcharges | openPrixFixeSelector, confirmPrixFixe, buildPrixFixeSelections | Manual PF screen smoke passes; fine-dining regressions pass. All actual BOH upcharges, None and repeat edit flows need matrix tests. |
| Tasting menus/pairings | addTasting, temperature sheets, startDiningFromCheckLine | Actual tracked tasting id tm_scalini_128 has price 115: ID text is not price authority. Code exists, full acceptance unverified. |
| Later dessert/gelato | openDessertSelector, confirmDessert | Manual code exists. Repeated dessert selection adds surcharge to totalPrice: critical price-drift scenario required; no production reproduction claimed. |
| Allergies/override/notes | openAllergyEditor, toggleAllergy, guestAllergyHits | The a529059 numeric editor failure is repaired in this revision: exact2/2A toggles/editor/inline selection, legacy numeric storage and table-wide restrictions tested. Expanded browser and unit checks pass; physical/durable verification pending. Allergy-override authority remains blocked, not inferred from FIRE permissions. |
| Editing/removal/order/course | modifySelectedLine, beginModifyLine, moveSelectedLine, erasePrixFixeLine | Substantial real implementation and manual workflow regression coverage; exact matrix scenarios pending. |
| Split/transfer/combine | splitBySeat, splitEven, transferCheckTo, mergeChecksIntoTable | Implemented; source unit regressions pass. Occupied/2A/concurrency/rounding not accepted. |
| Check persistence | persistCheck, guestCheckItems, ingestOpenChecks | Firebase .set when fbReady, guest projection omits full menu structure; no durable offline unsent restore established. Refresh and conflict tests blocked on approved isolated durable transport. Do not claim observed live loss. |
| Kitchen SEND | sendOrder, kitchenItemsFrom, publishActiveOrder | Actual real order path retained but blocked in lab. Unit simulations are not authorized kitchen acceptance. Backend/rules/permissions not verified. |
| Kitchen course FIRE | fireDiningCourse | Payload lacks exact seat/check/line ownership; mutates fired state before asynchronous .add acknowledgment. Critical source risks, positive/negative fault tests required with isolated recording transport. |
| Payment/printing | processPayment, printCheck | Payment code explicitly simulates success after tokenization; not real processing acceptance. Outside first milestone's payment scope. All payment/print actions blocked; only read-only receipt representation planned. |
| Local containment | lab/server, containment/bootstrap | Exact host/origin/token, bounded routes, no SDK/external requests, expiry, mic/Voice disabled in manual profile. No Firebase writes or SEND/FIRE invoked. HTTP unencrypted; trusted home Wi-Fi and synthetic guest/staff only. |

## Current test environment: full application, incomplete published-data coverage

The manual profile serves the existing index.html and actual scripts, not a new ordering implementation. It loads hash-verified tracked BOH wine/bar, PF and tasting records. It clears demo food fallbacks rather than inventing an ordinary menu. Every module of the POS remains present, but external writes and kitchen/payment actions are disabled. The runner currently has THREE manual audit checks (catalog projection, real manual PF controls, and distinct allergy controls): baseline two pass/one allergy failure; current repaired profile passes all three, not sixty completed tests.

This is not yet a complete acceptance environment: published BOH ordinary-food/cocktail/daily-special documents, current availability and real staff policies are missing. Needed next: a sanitized read-only export of those actual records with revision/hash, and an independently reviewed isolated durable transport/recording kitchen boundary. No production read credentials, Firebase writes, real transactions, emulators with writes, paid API or deployment is enabled by this plan. Unknowns remain blocked in the scorecard, not passed. Local JSON evidence writes are permitted test artifacts, not Firebase writes.

## Measurable acceptance and scorecard

SCORECARD.json is the only active scorecard; ACCEPTANCE-MATRIX.md is its initial readable projection. Sixty IDs: 52 critical + 8 minor. Critical acceptance requires 52/52 reproducible passes, independent reviewer reproduction, no unresolved critical source finding and the applicable physical iPhone checks. Minor failures reported separately, never used to dilute critical denominator. This initial inventory does not claim 60/60 implemented or 0 application capabilities working: formal accepted count is zero until exact tests and evidence are linked.

Each result needs test ID, source commit/catalog revisions, environment, inputs and initial state, actual visible screen assertion plus structured check assertion, expected price derived from BOH, pass/fail/blocked with reason, artifacts and independent disposition. Screens must use controls and hit testing; fixture/fault injections must be labeled. Retries retain first failure. No test passes solely because a matching product exists or because a source string/assertion passes. Kitchen tests need ownership, authorization and failure/acknowledgment checks, not just buttons. Persistence needs a real reload and two clients, not resetting a JavaScript object.

Evidence levels stay separate: source inspection; function/DOM simulation; real browser pixels; actual iPhone; independently reproduced. A phone UI test does not prove Firebase durability/server authorization. Screen screenshots do not prove correct structured payloads. Claude independently reviews inventory/claims/tests; internal verifier is additional evidence, not Claude. ChatGPT can coordinate owners using this same JSON scorecard, with no parallel green tally.

## Two development cycles

Cycle1 (revised48–80 engineering hours; this review delivers the allergy-first slice): obtain authentic permitted BOH export/revisions/taxability; complete exact position/allergy and manual editing/price scenarios M01–M38; build and test integer-cent financial oracle for NYCtax, approved adjustments and tax-inclusive tip minimum; specify action-boundary role/manager approvals and customer-menu disclaimer coverage. Extend M45–M48 critical financial scenarios in the same 60-row matrix. No permission/tax/void/comp/discount feature is claimed complete now. Durable audit/action integration is blocked until the design and isolated-write profile are approved. Cycle1 can produce failclosed UI/code and local arithmetic tests without a Firebase emulator, paid gateway or live kitchen.

Cycle2 (revised64–96 engineering hours after approval prerequisites): implement the approved emulator-only backend/Rules/transaction/outbox design and complete persistence/concurrency, manager approval/audit, sent-item void/comp/discount, totals recalculation and authorized LOCAL kitchen simulation; M39–M60 and regressions from cycle1. Explicit owner authorization for isolated emulator writes is required in addition to Claude design review. No real SEND/FIRE/Firebase writes/payment or production deploy. Finish batched physical screen/lifecycle checks only with owner authorization; keep simulated-transport and iPhone results distinct. Missing catalog/design approvals pause affected scenarios as BLOCKED. These are engineering estimates, not a promise of 60/60 after two cycles.

At each cycle end update the single scorecard with commit/artifact links, counts and limits. For a critical defect observed in both cycles, provide source-backed root cause, failed prior remedy, revised design, additional regression and bounded revised estimate. Do not silently rename it, reset its age or weaken criteria. Report blocked evidence separately from observed defects.

Voice stays frozen until manual acceptance. Later proposed benchmark: 200 fixed, independently labeled whole-order utterances, >=190 completely correct orders and zero unauthorized/unsafe actions; corrections/restarts/noise/interruptions/guest gating included. A partly correct order scores incorrect. No new Voice implementation or paid activation in these cycles.

## Reproduce this inventory delivery

Node22; frozen installs in lab and test. `LAB_MANUAL=1 node test/screens.mjs` from lab runs the three manual audit checks (current expectation exit0: three pass; no formal acceptance claim). `node lab/test/security.mjs` tests containment; manual service/fine-dining/geometry/handheld regressions run from repo root. Chromium required for screenshots. First manual catalog profile evidence is supplemental smoke only; price/menu claims must not exceed covered cases.

On Mac, after review, from lab: `bash mac/start-session.sh --owner-approved PRIVATE_MAC_IP --manual`. This starts a 60-minute local HTTP manual session. Its Run manual smoke button executes only those three checks; microphone and interpretation reject. Open only the printed local origin, use synthetic accounts, Stop/Control+C and close tab after testing. No new owner device access is exercised in cloud.
