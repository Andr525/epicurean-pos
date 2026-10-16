# Phase 0 review: manual POS (`phase0/pos-critical-fixes`, base `cfeceb8`)

**Scope:** targeted corrections only. No new tender or tax system, no real payment processing.
**Tests:** offline, against a clearly labelled in-memory mock Firestore and a mock card SDK (`test/acceptance/`).

## Commits
1. `ed025a6` — Harness, plus a baseline that reproduces the original defects.
2. `8bc7733` — Phase 0 fixes:
   - modifier pricing and rules
   - price snapshot
   - split checks
   - tasting tile
   - table transfer
   - allergies
   - sessions
3. Hardening commit for the owner's conditions (#2 split payments, #3 table transfer). This commit sits on top of the two above.

## Invariants to check (`index.html`)
| # | Invariant | Where |
|---|---|---|
| 1 | Line price = base + Σ selected option `up`, in cents. BOH `required`/`min`/`max`/`multi` enforced. | `attachFoodModifiers`, `pickMod`, `applyModPricing`, `modifiersReady` |
| 2 | A sent line is billed at its sent price. The menu price is used only when a legacy line has no price. | `guestCheckItems` |
| 3a | A payment charges integer cents recomputed from the check at charge time, not from the button. A mismatch re-opens the payment screen. | `processPayment` |
| 3b | A payment marks paid **only its own `lineIds`** and closes only its own check. Other checks are never touched. | `markCheckLinesPaid(cid, key, lineIds)`, `closeCheckById` |
| 3c | Even split: every share but the last is rounded down; the last takes the remainder, so the shares sum exactly to the check. The split is frozen to `totalCents` and `lineIds` when the first share is paid. A changed check refuses further shares. | `payShareCents`, `processPayment` |
| 3d | No duplicate processing, enforced three ways: (1) a per-check in-flight lock; (2) a stale Charge, after success or for another check, is refused; (3) a deterministic idempotency key `pay_<check>_<n>_<share#>_<hash(lineIds,subtotal)>` is written with `doc(key).set`, an existing doc means "already processed", and a failed pre-read aborts the charge. | `processPayment` |
| 3e | Money is displayed to the cent. | `posTotalMoney` |
| 5a | A move reads `orders`, `tasting_orders` and `checks` fresh from the cloud (paginated, read-only `collection().get()`) **before** changing anything. If that read fails: "move not done", nothing changes. | `transferReadAll`, `transferCheckTo` |
| 5b | Every open cloud doc of the old table is moved, including tickets other devices sent that this device hasn't polled yet. The writes are awaited, then a verify read runs. "Moved to table N" appears only when nothing is left on the old table. Otherwise a "Move not complete" sheet lists what remains, with **Retry move**. | `moveCloudDocs`, `verifyTransfer`, `reportTransfer`, `retryTableMove` |
| 5c | Cloud offline: the move is refused. The only option is an explicit "Move only this device's orders (not verified)", which reports itself as NOT verified. | `transferCheckTo(n, {offlineOk:true})` |
| 6 | Unverified or empty allergens are unknown, not safe. Seat flags, kitchen note and overrides are stored on the check, the line and the kitchen ticket. | `allergenRisk`, `persistCheck`, `kitchenItemsFrom` |
| 9 | Unsent lines are parked per owner at logout. The Order tab asks for a table. | `parkCurrentLines`, `rehydrateMyLines`, `switchTab` |

## Tests
- **Phase 0 acceptance:** `test/acceptance/phase0-acceptance.mjs`, 28 checks driven through the real POS touch controls, with data published by the real BOH. Ledger: `runs.jsonl`.
- **Mock additions:**
  - `__MOCK_FAIL_WRITES__`
  - `__MOCK_DB__.__rawSet`: another device writes without notifying this one, which mimics the 60 s poll
  - `collection().get()`
- **Existing tests changed:**
  - `test/service-workflow.mjs`: moves run with `fbReady=false`. They now assert the refusal, then use `{offlineOk:true}`.
  - `test/voice-engine.mjs`: voice on a flagged seat holds unverified items.

## Known limits (not fixed in Phase 0)
- **Polling window.** A device still showing the old table may send a ticket to it until its next poll (up to 60 s). The move's verify read catches only tickets sent before it runs. A full fix needs real-time listeners or transactions (Phase 3).
- **Pre-charge read of `payments/{key}`.** The production Firestore rules are not in this repo. If they deny that read, charges fail closed. Verify the rules before deploying.
- **Read-then-write races** (check moves, payment key) aren't transactional; that also needs Phase 3.
- **`test/voice-engine.mjs` guard.** It requires `beginAddItem`, `sendOrder` and `fireDiningCourse` to be byte-identical to `origin/main`. Phase 0 must change them, so the guard fails by design. Every functional assertion in that file passes. Updating the guard is the owner's decision.
