# Pipeline baseline results

POS commit `cfeceb8` (main) is what `test/pipeline-baseline` (`32bdc41`) measured. This file on `fix/phase1-adapter` adds the After Phase 1 column from the same assertions. No live Firestore network and no deploy.

The assertions describe the behavior the pipeline should have. They were not edited to turn a FAIL into a PASS. T2, T3, and T5 are still expected to fail in Phase 1.

Chrome logs `Failed to load resource: 404` for every missing document. The named adapter treats that 404 as "document does not exist", so those lines are omitted here. Application exceptions are kept.

| Test | Baseline (32bdc41) | After Phase 1 | Baseline measured | After Phase 1 measured |
| --- | --- | --- | --- | --- |
| T1 BOH menu write appears in POS state | PASS | PASS | 59.8s until Probe Tuna was in POS state | 4.6s until Probe Tuna was in POS state |
| T2 blocked send must not show sent without an orders doc and active_orders entry | FAIL | FAIL | toast="Order sent to kitchen" orders=0 active_orders=0 | toast="Order sent to kitchen" orders=0 active_orders=0 |
| T3 two simultaneous sends both reach active_orders | FAIL | FAIL | orders docs=2 feed=[Alpha Plate] heldGets=2 | orders docs=2 feed=[Alpha Plate] heldGets=2 |
| T4 POS sees all 1200 order documents | FAIL | PASS | POS saw 1000 of 1200 (first read 1000) | POS saw 1200 of 1200 (first read 1200) |
| T5 stale POS bar write keeps the BOH edit | FAIL | FAIL | POS state before write=[lager] stored list=[lager] | POS state before write=[lager] stored list=[lager] |
| T6 transferCheckTo re-tables an open kitchen ticket without throwing | FAIL | PASS | threw=yes orders.table=1 active_orders.table=1 sendToast="Order sent to kitchen" | threw=no orders.table=2 active_orders.table=2 sendToast="Order sent to kitchen" |
| T7 KDS bump clears the ticket | PASS | PASS | bump buttons before=1 after=0 orders.status=cleared kds="✓ All clear — no active orders" | bump buttons before=1 after=0 orders.status=cleared kds="✓ All clear — no active orders" |
| T8 manual seat, add, SEND appears on KDS | PASS | PASS | menuReady=true toast="Order sent to kitchen" kds=shows Probe Tuna | menuReady=true toast="Order sent to kitchen" kds=shows Probe Tuna |

## PASS/FAIL changes

- T4 POS sees all 1200 order documents: FAIL → PASS
- T6 transferCheckTo re-tables an open kitchen ticket without throwing: FAIL → PASS

T1 stayed PASS. The measured wait is the menu poll, so that number changed when the poll became 5 seconds. T2, T3, T5, T7, and T8 kept the same PASS/FAIL. T2 still fails with the same toast and zero documents; its console stack now points at `firestore-adapter.js` because that is where `fetch` runs.

## Exact console errors

### T1 BOH menu write appears in POS state

Baseline:

none

After Phase 1:

none

### T2 blocked send must not show sent without an orders doc and active_orders entry

Baseline:

```
Failed to load resource: net::ERR_EMPTY_RESPONSE
TypeError: Failed to fetch
    at http://127.0.0.1:46845/index.html:1455:16
```

After Phase 1:

```
Failed to load resource: net::ERR_EMPTY_RESPONSE
TypeError: Failed to fetch
    at http://127.0.0.1:35239/firestore-adapter.js:101:18
```

### T3 two simultaneous sends both reach active_orders

Baseline:

none

After Phase 1:

none

### T4 POS sees all 1200 order documents

Baseline:

none

After Phase 1:

none

### T5 stale POS bar write keeps the BOH edit

Baseline:

none

After Phase 1:

none

### T6 transferCheckTo re-tables an open kitchen ticket without throwing

Baseline:

```
page.evaluate: TypeError: fbDb.collection(...).where(...).get is not a function
    at retargetKitchenTickets (http://127.0.0.1:46845/index.html:9720:58)
    at transferCheckTo (http://127.0.0.1:46845/index.html:9790:3)
    at eval (eval at evaluate (:370:30), <anonymous>:1:9)
    at UtilityScript.evaluate (<anonymous>:372:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
    at main (/workspace/test/pipeline.test.mjs:441:22)
```

After Phase 1:

none

### T7 KDS bump clears the ticket

Baseline:

none

After Phase 1:

none

### T8 manual seat, add, SEND appears on KDS

Baseline:

none

After Phase 1:

none

## Blocked external hosts

These were aborted and not allowed to connect:

```
fonts.googleapis.com https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap
www.gstatic.com https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js
www.gstatic.com https://www.gstatic.com/firebasejs/10.13.1/firebase-auth-compat.js
www.gstatic.com https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore-compat.js
sandbox.web.squarecdn.com https://sandbox.web.squarecdn.com/v1/square.js
fonts.googleapis.com https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap
```
