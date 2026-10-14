# Manual allergy modifications and simulated kitchen review

Review branch: `review/manual-pos-mobile-ordering-iteration1`, based on approved `aff7137`. Candidate for independent Claude review; formal acceptance stays **0/60**.

## Delivered behavior

The existing real POS interface and hash-verified BOH catalog remain in use. This is an explicitly opt-in, manual/screen-only lab adapter. Normal `index.html`, BOH recipes/prices, floor-map geometry, Firebase configuration and kitchen integration are unchanged. The adapter is absent from normal pages; both literal lab flags are required. It refuses mutation if Firebase is enabled. SEND/FIRE, kitchen messages, printing and payment operations remain blocked by the existing immutable lab guards.

Prix-fixe conflict checks and preview warnings use the exact guest and selected choices, plus automatic dishes actually included at that stage. Unselected options and pending later courses do not generate conflicts. Dessert selection checks its actual option/scoops and the entremet it activates. Skipping dessert still checks any entremet the existing POS activates; it is not an allergy bypass. All original BOH allergen labels remain attached.

A conflicting selection first opens **Request modified preparation — NOT approved**. Each conflicting dish has quick NO NUTS / NO DAIRY / REMOVE TOPPING buttons and its own instruction field. Instructions are required before saving an unsent request. Requests identify table, check, exact position, course and dish. A dish/option/course token prevents instruction assignment by name alone. The guest cross-contact disclosure can be recorded, but it changes no preparation permission. Compatible dishes with allergy-related instructions also queue review. Every safety record explicitly has `allergenFreeCertified: false` and `simulationOnly: true`.

The compact check retains **Review / Change Item** controls. Open the ordered dish to view its restrictions, instructions, status and local audit history. Reasons are required for simulated kitchen decisions, recorded as `SIMULATED LAB Kitchen reviewer` with time, revision, check/table/position/course and decision. This actor is a fixture, not an authenticated kitchen employee.

## Lab state transitions

| Trigger | State/result |
| --- | --- |
| Compatible item with no allergy modification | Draft; eligible for simulated preparation only |
| Conflicting item with explicit per-dish instructions | Awaiting kitchen review; no preparation |
| Guest informed recorded | Disclosure audit only; no state override |
| Simulated kitchen rejects | Rejected; no preparation; Change Item available |
| Simulated kitchen approves with reason | Approved for modified preparation; original warnings remain; no allergen-free certification |
| Simulated start | Preparing; no real FIRE/SEND is invoked |
| Cancel after preparation starts | Cancellation requested; incomplete until kitchen acknowledgment |
| Simulated acknowledgment | Canceled; Change Item becomes available |
| Replacement | Original snapshot retained in audit; exact position/course preserved; BOH prices/upcharges recalculated; replacement checked again |
| Allergies change after approval | Old approval is ineligible; no simulated start until fresh review |

Preparation edits/deletions through the wrapped mutation boundaries roll back if acknowledgment is missing. Ordinary unsent cancellations need no preparation acknowledgment. A canceled item remains represented until replacement or explicit unsent removal; this is not a financial void/comp/payment workflow. Fixed prix-fixe menu pricing remains authoritative.

## Regression evidence

Development validation ran on Node 24.19.0 / Linux Chromium with iPhone 17 Pro viewport emulation. The owner Mac launcher still requires its existing Node 22 preflight; macOS/iOS behavior of this revision remains unverified.

- 14 new real-POS function regression groups pass: selected-course warnings, requests, disclosure, exact 2/2A identities, rejection, preparation/cancellation acknowledgment, lower-level mutation rollback, stale review context, repeated decision rejection, real menu upcharges/totals, extra dishes, tasting requests and lab opt-in.
- Six new trusted Chromium click workflow checkpoints pass; captured screenshots and structured state show zero sent orders, `fbReady=false`, `fbDb=null`, no external requests and no browser exceptions.
- Twelve existing core manual/allergy/function suites pass, including the C1 phantom-position reproduction, allergy recovery/notes, split/merge, financial projection, 94 matching cases and the default 24 Tree Nut/Nuts boundary groups. Those core tests retain the normal POS hard-block policy and are distinct from the explicitly scoped lab review workflow.
- Existing security and offline QR suites pass.
- Existing five actual-interface screen cases and 16 mobile navigation/check/wine-pagination checkpoints pass. The C1 screen case now requires the exact Position + NO FISH/NO DAIRY + explicit review panel instead of the previous rejection wording; its phantom-position and zero-add assertions remain. The mobile allergy case now selects an actual conflicting BOH appetizer instead of relying on a deferred entremet warning. No safety assertion was removed to accommodate a bypass.

Raw logs, source hashes, structured snapshots and screenshots are in `evidence/manual-allergy-review/`. These are automated/simulated results, not physical acceptance. The pre-existing `test/voice-engine.mjs` failure remains documented and was not rerun or repaired. No Voice development occurred.

## Reproduce independently

From the repository root using existing test dependencies:

```sh
node test/manual-allergy-review.mjs
node test/manual-allergen-matching.mjs
node test/manual-allergy-paths.mjs
node test/REPRO-C1-phantom-3A.mjs
node test/manual-allergy-recovery-notes.mjs
node test/manual-table-safety.mjs
node lab/test/security.mjs
node lab/test/session-qr.mjs
```

From `lab`, with existing Playwright and Chromium:

```sh
XDG_CONFIG_HOME=/tmp/epicurean-browser-config XDG_CACHE_HOME=/tmp/epicurean-browser-cache node test/allergy-review.mjs
XDG_CONFIG_HOME=/tmp/epicurean-browser-config XDG_CACHE_HOME=/tmp/epicurean-browser-cache LAB_MANUAL=1 node test/screens.mjs
XDG_CONFIG_HOME=/tmp/epicurean-browser-config XDG_CACHE_HOME=/tmp/epicurean-browser-cache node test/manual-mobile.mjs
```

## Limits and next verification

1. Kitchen decisions, reviewer identity and preparation/cancellation acknowledgments are simulated. Real restaurant authorization, kitchen policy enforcement and transport integration are not implemented or claimed. A simulation never enables the existing SEND/FIRE guards.
2. Requests, decisions and original-item audit snapshots are in-memory/local check projections and captured regression artifacts. No durable database recovery or persistence across a full page reload/server restart is claimed. Hands-on reset intentionally discards the fixture session.
3. Fixed tasting courses have no authentic published replacement options in the available BOH snapshot. These replacements are **BLOCKED** rather than borrowing prix-fixe choices or inventing a tasting-menu price policy. Tasting modification requests/review states are testable.
4. Authentic standalone à-la-carte food, cocktails, specials, non-alcoholic, coffee/tea and pairing records remain unavailable. Existing PF/extras/tasting and BOH wines/BTG/beer/spirits remain usable. No missing records or prices were manufactured; sorbet remains entremet-only.
5. Await independent Claude review of request scope, mutation rollback, allergen retention, audit snapshots and pricing. Then obtain owner authorization for a new physical session. The existing Mac launcher/QR path is unchanged; no physical session or production deployment was started for this delivery.
