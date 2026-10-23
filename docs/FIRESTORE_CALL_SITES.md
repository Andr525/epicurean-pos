# Firestore call sites

Source command, run against `index.html` on `fix/phase1-adapter`. The named adapter lives in `firestore-adapter.js`. Call sites in `index.html` were not retargeted, except `transferCheckTo`, which wraps `retargetKitchenTickets` so a Firestore failure toasts and does not abort the local move.

```
grep -n "fbDb\." index.html
```

## Raw grep

```
1829:  fbDb.collection('checks').doc(check.id).set(check).catch(function(e){ console.warn('Check save:', e); });
3022:  fbDb.collection('boh_shared').doc(docName).onSnapshot(function(doc){
3106:  fbDb.collection('boh_shared').doc('wines').onSnapshot(function(doc){
3123:          fbDb.collection('boh_shared').doc('wines_'+n).onSnapshot(function(s){
3167:  fbDb.collection('boh_shared').doc(id).set(payload,{merge:true});
3181:        if (fbReady) fbDb.collection('boh_shared').doc('bar').set({list:STATE.bar, updatedAt:Date.now()},{merge:true});
3295:  if (!fbReady || !fbDb || !fbDb.collection) return Promise.resolve(false);
3296:  return fbDb.collection('boh_shared').doc('tables').get().then(function(doc){
3314:  fbDb.collection('boh_shared').doc('menu').onSnapshot(function(doc){
3335:  fbDb.collection('boh_shared').doc('menu_photos').onSnapshot(function(doc){
3343:  fbDb.collection('boh_shared').doc('tables').onSnapshot(function(doc){
3349:  fbDb.collection('boh_shared').doc('staff_clock').onSnapshot(function(doc){
3355:  fbDb.collection('boh_shared').doc('guests').onSnapshot(function(doc){
3360:  fbDb.collection('boh_shared').doc('tasting_menus').onSnapshot(function(doc){
3367:  fbDb.collection('boh_shared').doc('prix_fixe_menus').onSnapshot(function(doc){
3374:  fbDb.collection('calls').onSnapshot(snap=>{
3381:  fbDb.collection('orders').onSnapshot(snap=>{
3392:  fbDb.collection('checks').where('status','==','open').onSnapshot(function(snap){
3398:  fbDb.collection('messages').onSnapshot(snap=>{
3470:  if (!fbReady || !fbDb || !fbDb.collection) {
3474:  return fbDb.collection('boh_shared').doc('staff_clock').get().then(function(doc){
5279:      fbDb.collection('calls').doc(cl.id).update({status:'acknowledged'});
6555:  fbDb.collection('boh_shared').doc('voice_vocab_active').onSnapshot(function(doc){
6568:  if (!fbReady || !fbDb || !fbDb.collection) return Promise.resolve(null);
6569:  return fbDb.collection('boh_shared').doc(id).get().then(function(snap){
8771:  if (fbReady) fbDb.collection('orders').add(order).then(function(ref){ publishActiveOrder(order, ref.id); });
9564:  if (!fbReady || !fbDb || !fbDb.collection) return Promise.resolve();
9565:  var ordersJob = fbDb.collection('orders').where('table','==',oldTable).get().then(function(snap){
9574:  var feed=fbDb.collection('boh_shared').doc('active_orders');
9947:    var feedRef = fbDb.collection('boh_shared').doc('active_orders');
10057:  if (fbReady) fbDb.collection('tasting_orders').add(dining);
10103:    if (fbReady) fbDb.collection('orders').add(order).then(function(ref){ publishActiveOrder(order, ref.id); });
10118:      if (fbReady) fbDb.collection('orders').add(pairingOrder).then(function(ref){ publishActiveOrder(pairingOrder, ref.id); });
10217:  if (fbReady) fbDb.collection('orders').add(courseOrder).then(function(ref){ publishActiveOrder(courseOrder, ref.id); });
10850:      await fbDb.collection('payments').add(paymentData);
10855:          await fbDb.collection('orders').doc(o.id).update({status:'paid', paidAt:Date.now()});
10914:  if (fbReady) fbDb.collection('messages').add(msg);
10964:    fbDb.collection('messages').doc(id).update({acked:true}).catch(function(){});
11001:  if (fbReady&&alertedCallId) fbDb.collection('calls').doc(alertedCallId).update({status:'acknowledged'});
```

## Grouped by collection

### `(dynamic)`

| Line | Document | Methods |
| --- | --- | --- |
| 3295 | `—` | — |
| 3470 | `—` | — |
| 6568 | `—` | — |
| 9564 | `—` | — |

### `boh_shared`

| Line | Document | Methods |
| --- | --- | --- |
| 3022 | `docName` | onSnapshot |
| 3106 | `wines` | onSnapshot |
| 3123 | `'wines_'+n` | onSnapshot |
| 3167 | `id` | set |
| 3181 | `bar` | set |
| 3296 | `tables` | get |
| 3314 | `menu` | onSnapshot |
| 3335 | `menu_photos` | onSnapshot |
| 3343 | `tables` | onSnapshot |
| 3349 | `staff_clock` | onSnapshot |
| 3355 | `guests` | onSnapshot |
| 3360 | `tasting_menus` | onSnapshot |
| 3367 | `prix_fixe_menus` | onSnapshot |
| 3474 | `staff_clock` | get |
| 6555 | `voice_vocab_active` | onSnapshot |
| 6569 | `id` | get |
| 9574 | `active_orders` | get, set |
| 9947 | `active_orders` | get, set |

### `calls`

| Line | Document | Methods |
| --- | --- | --- |
| 3374 | `—` | onSnapshot |
| 5279 | `cl.id` | update |
| 11001 | `alertedCallId` | update |

### `checks`

| Line | Document | Methods |
| --- | --- | --- |
| 1829 | `check.id` | set |
| 3392 | `—` | where, onSnapshot |

### `messages`

| Line | Document | Methods |
| --- | --- | --- |
| 3398 | `—` | onSnapshot |
| 10914 | `—` | add |
| 10964 | `id` | update |

### `orders`

| Line | Document | Methods |
| --- | --- | --- |
| 3381 | `—` | onSnapshot |
| 8771 | `—` | add |
| 9565 | `—` | where, get |
| 10103 | `—` | add |
| 10118 | `—` | add |
| 10217 | `—` | add |
| 10855 | `o.id` | update |

### `payments`

| Line | Document | Methods |
| --- | --- | --- |
| 10850 | `—` | add |

### `tasting_orders`

| Line | Document | Methods |
| --- | --- | --- |
| 10057 | `—` | add |
