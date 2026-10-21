# Pipeline baseline results

POS commit `cfeceb8` (main). Branch `test/pipeline-baseline`. No `index.html` change, no Firestore network, no deploy.

The assertions describe the behavior the pipeline should have. A FAIL is the baseline defect. Tests were not edited to turn a FAIL into a PASS.

Chrome logs `Failed to load resource: 404` for every missing document. The named adapter treats that 404 as "document does not exist", so those lines are omitted here. Application exceptions are kept.

| Test | PASS/FAIL | Measured value | Console error |
| --- | --- | --- | --- |
| T1 BOH menu write appears in POS state | PASS | 59.8s until Probe Tuna was in POS state |  |
| T2 blocked send must not show sent without an orders doc and active_orders entry | FAIL | toast="Order sent to kitchen" orders=0 active_orders=0 | Failed to load resource: net::ERR_EMPTY_RESPONSE || TypeError: Failed to fetch at http://127.0.0.1:46845/index.html:1455:16 |
| T3 two simultaneous sends both reach active_orders | FAIL | orders docs=2 feed=[Alpha Plate] heldGets=2 |  |
| T4 POS sees all 1200 order documents | FAIL | POS saw 1000 of 1200 (first read 1000) |  |
| T5 stale POS bar write keeps the BOH edit | FAIL | POS state before write=[lager] stored list=[lager] |  |
| T6 transferCheckTo re-tables an open kitchen ticket without throwing | FAIL | threw=yes orders.table=1 active_orders.table=1 sendToast="Order sent to kitchen" | page.evaluate: TypeError: fbDb.collection(...).where(...).get is not a function at retargetKitchenTickets (http://127.0.0.1:46845/index.html:9720:58) at transferCheckTo (http://127.0.0.1:46845/index.html:9790:3) at eval (eval at evaluate (:370:30), <anonymous>:1:9) at UtilityScript.evaluate (<anonymous>:372:16) at UtilityScript.<anonymous> (<anonymous>:1:44) at main (/workspace/test/pipeline.test.mjs:441:22) |
| T7 KDS bump clears the ticket | PASS | bump buttons before=1 after=0 orders.status=cleared kds="✓ All clear — no active orders" |  |
| T8 manual seat, add, SEND appears on KDS | PASS | menuReady=true toast="Order sent to kitchen" kds=shows Probe Tuna |  |

## Exact console errors

### T1 BOH menu write appears in POS state

none

### T2 blocked send must not show sent without an orders doc and active_orders entry

```
Failed to load resource: net::ERR_EMPTY_RESPONSE
TypeError: Failed to fetch
    at http://127.0.0.1:46845/index.html:1455:16
```

### T3 two simultaneous sends both reach active_orders

none

### T4 POS sees all 1200 order documents

none

### T5 stale POS bar write keeps the BOH edit

none

### T6 transferCheckTo re-tables an open kitchen ticket without throwing

```
page.evaluate: TypeError: fbDb.collection(...).where(...).get is not a function
    at retargetKitchenTickets (http://127.0.0.1:46845/index.html:9720:58)
    at transferCheckTo (http://127.0.0.1:46845/index.html:9790:3)
    at eval (eval at evaluate (:370:30), <anonymous>:1:9)
    at UtilityScript.evaluate (<anonymous>:372:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
    at main (/workspace/test/pipeline.test.mjs:441:22)
```

### T7 KDS bump clears the ticket

none

### T8 manual seat, add, SEND appears on KDS

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
