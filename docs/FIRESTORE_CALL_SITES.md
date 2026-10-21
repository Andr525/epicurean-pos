# Firestore call sites

Source command, run against `index.html` at `cfeceb8` (POS main). The file was not modified.

```
grep -n "fbDb\." index.html
```

## Raw grep

```
1984:  fbDb.collection('checks').doc(check.id).set(check).catch(function(e){ console.warn('Check save:', e); });
3177:  fbDb.collection('boh_shared').doc(docName).onSnapshot(function(doc){
3261:  fbDb.collection('boh_shared').doc('wines').onSnapshot(function(doc){
3278:          fbDb.collection('boh_shared').doc('wines_'+n).onSnapshot(function(s){
3322:  fbDb.collection('boh_shared').doc(id).set(payload,{merge:true});
3336:        if (fbReady) fbDb.collection('boh_shared').doc('bar').set({list:STATE.bar, updatedAt:Date.now()},{merge:true});
3450:  if (!fbReady || !fbDb || !fbDb.collection) return Promise.resolve(false);
3451:  return fbDb.collection('boh_shared').doc('tables').get().then(function(doc){
3469:  fbDb.collection('boh_shared').doc('menu').onSnapshot(function(doc){
3490:  fbDb.collection('boh_shared').doc('menu_photos').onSnapshot(function(doc){
3498:  fbDb.collection('boh_shared').doc('tables').onSnapshot(function(doc){
3504:  fbDb.collection('boh_shared').doc('staff_clock').onSnapshot(function(doc){
3510:  fbDb.collection('boh_shared').doc('guests').onSnapshot(function(doc){
3515:  fbDb.collection('boh_shared').doc('tasting_menus').onSnapshot(function(doc){
3522:  fbDb.collection('boh_shared').doc('prix_fixe_menus').onSnapshot(function(doc){
3529:  fbDb.collection('calls').onSnapshot(snap=>{
3536:  fbDb.collection('orders').onSnapshot(snap=>{
3547:  fbDb.collection('checks').where('status','==','open').onSnapshot(function(snap){
3553:  fbDb.collection('messages').onSnapshot(snap=>{
3625:  if (!fbReady || !fbDb || !fbDb.collection) {
3629:  return fbDb.collection('boh_shared').doc('staff_clock').get().then(function(doc){
5434:      fbDb.collection('calls').doc(cl.id).update({status:'acknowledged'});
6710:  fbDb.collection('boh_shared').doc('voice_vocab_active').onSnapshot(function(doc){
6723:  if (!fbReady || !fbDb || !fbDb.collection) return Promise.resolve(null);
6724:  return fbDb.collection('boh_shared').doc(id).get().then(function(snap){
8926:  if (fbReady) fbDb.collection('orders').add(order).then(function(ref){ publishActiveOrder(order, ref.id); });
9719:  if (!fbReady || !fbDb || !fbDb.collection) return;
9720:  fbDb.collection('orders').where('table','==',oldTable).get().then(function(snap){
9727:  var feed=fbDb.collection('boh_shared').doc('active_orders');
10091:    var feedRef = fbDb.collection('boh_shared').doc('active_orders');
10201:  if (fbReady) fbDb.collection('tasting_orders').add(dining);
10247:    if (fbReady) fbDb.collection('orders').add(order).then(function(ref){ publishActiveOrder(order, ref.id); });
10262:      if (fbReady) fbDb.collection('orders').add(pairingOrder).then(function(ref){ publishActiveOrder(pairingOrder, ref.id); });
10361:  if (fbReady) fbDb.collection('orders').add(courseOrder).then(function(ref){ publishActiveOrder(courseOrder, ref.id); });
10994:      await fbDb.collection('payments').add(paymentData);
10999:          await fbDb.collection('orders').doc(o.id).update({status:'paid', paidAt:Date.now()});
11058:  if (fbReady) fbDb.collection('messages').add(msg);
11108:    fbDb.collection('messages').doc(id).update({acked:true}).catch(function(){});
11145:  if (fbReady&&alertedCallId) fbDb.collection('calls').doc(alertedCallId).update({status:'acknowledged'});
```

## Grouped by collection

### `(dynamic)`

| Line | Document | Methods |
| --- | --- | --- |
| 3450 | `—` | — |
| 3625 | `—` | — |
| 6723 | `—` | — |
| 9719 | `—` | — |

### `boh_shared`

| Line | Document | Methods |
| --- | --- | --- |
| 3177 | `docName` | onSnapshot |
| 3261 | `wines` | onSnapshot |
| 3278 | `'wines_'+n` | onSnapshot |
| 3322 | `id` | set |
| 3336 | `bar` | set |
| 3451 | `tables` | get |
| 3469 | `menu` | onSnapshot |
| 3490 | `menu_photos` | onSnapshot |
| 3498 | `tables` | onSnapshot |
| 3504 | `staff_clock` | onSnapshot |
| 3510 | `guests` | onSnapshot |
| 3515 | `tasting_menus` | onSnapshot |
| 3522 | `prix_fixe_menus` | onSnapshot |
| 3629 | `staff_clock` | get |
| 6710 | `voice_vocab_active` | onSnapshot |
| 6724 | `id` | get |
| 9727 | `active_orders` | get, set |
| 10091 | `active_orders` | get, set |

### `calls`

| Line | Document | Methods |
| --- | --- | --- |
| 3529 | `—` | onSnapshot |
| 5434 | `cl.id` | update |
| 11145 | `alertedCallId` | update |

### `checks`

| Line | Document | Methods |
| --- | --- | --- |
| 1984 | `check.id` | set |
| 3547 | `—` | where, onSnapshot |

### `messages`

| Line | Document | Methods |
| --- | --- | --- |
| 3553 | `—` | onSnapshot |
| 11058 | `—` | add |
| 11108 | `id` | update |

### `orders`

| Line | Document | Methods |
| --- | --- | --- |
| 3536 | `—` | onSnapshot |
| 8926 | `—` | add |
| 9720 | `—` | where, get |
| 10247 | `—` | add |
| 10262 | `—` | add |
| 10361 | `—` | add |
| 10999 | `o.id` | update |

### `payments`

| Line | Document | Methods |
| --- | --- | --- |
| 10994 | `—` | add |

### `tasting_orders`

| Line | Document | Methods |
| --- | --- | --- |
| 10201 | `—` | add |
