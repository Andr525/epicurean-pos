# POS floor display and guest-count corrections: review notes

**Branch:** `review/pos-floor-guest-count-corrections`
**Base:** approved Phase 0 POS `d2ff60f`
**Files:** `index.html` and tests. No BOH change, no data migration, no Firebase change.

## Owner requirements
1. **Floor display:** the floor shows the original numbered tables and the wall lines only. No booths, sideboards, decor, waiter station boundaries or waiter names.
2. **Combining:** combining tables never changes the guest count automatically. The waiter chooses or confirms it.
3. **Combine screen:** it shows no seating capacities.
4. **Opening a table:** a table with an existing order (e.g. from another device) keeps the guest count recorded on that order, never the BOH capacity.

BOH capacities and the complete layout data stay unchanged. These rules apply only to what the POS displays and to its guest count.

## Changes (`index.html`)

| Area | Before | After |
|---|---|---|
| `visibleFloorObjects()` and `renderTables()` | Drew every object except station boxes: booths (`couch`), sideboards (`station`), bar, host, doors, plants, labels, zones, chairs. | Only tables (`table`, `stool`, `outdoor`) and walls (`wall`, `lshape`, `curve`) are drawn: new `isFloorTable()` / `shownOnFloor()`. Other objects stay in `STATE.roomObjs` and `boh_shared/tables`, unchanged. |
| My Station count, station crop box (`stationTablesBox`) | Counted a booth inside a station. | Counts and crops on the drawn tables only. Station data (`tableIds`, boxes, polygons) is untouched. |
| `openCombineSheet()` / `combineCandidates()` | "Table 2 · 2 seats", and the booth offered. | "Table 2". Booths are not offered, matching `listTableNums()` (Move table). |
| `combineTables()` | Guest count = combined BOH capacity; toast "· N seats". | The guests already seated at both tables (`recordedGuestCount`) are carried over, and a **confirm sheet** opens ("Keep N guests" or tap 1–12). Combining two empty tables seats nobody; the normal guest picker appears when the table is opened. Toast without seats. |
| `splitCombinedTable()` | Reset the guest count to the kept table's capacity. | The guest count is left as it is. |
| `selectTable()` | `sess.guestCount \|\| obj.seats \|\| 2`. `sessionOf()` creates new sessions with a default of 2, so a table whose check hadn't reached this device showed **2**. | `recordedGuestCount(t)` is used: open check → this device's seated session → newest open kitchen order (`orders[].guestCount`). It is never the capacity. Otherwise the existing session value is kept. |

Untouched:
- **Combining internals:** combine/separate geometry (`applyCombineToObject`, `_bohGeom`, `restoreOrigGeom`) and `mergeChecksIntoTable`.
- **Stations:** station membership (`stationTableIds`, `tableInStation`).
- **Orders, checks, payments and settlement.**
- **BOH data:** the POS still never writes `boh_shared/tables`.

## Tests

### `test/acceptance/floor-guest-count.mjs`
The real BOH (`6968066`) publishes into the mock cloud. The real POS screens are tapped. Every outside request is blocked. The card SDK is a mock.

| Test | Base `d2ff60f` | Fix |
|---|---|---|
| F1 Only tables and walls drawn, at their exact positions and sizes | FAIL (host, booth, sideboard, plant, door, label, chair drawn) | PASS |
| F2 No station lines, waiter names, labels or seat counts | FAIL ("Host Sideboard 🌿 🚪 WINDOW SIDE") | PASS |
| F3 My Station = station tables + directly assigned table; booth not counted | FAIL ("My station (6)", booth highlighted) | PASS (5) |
| F4 Combine sheet: no capacities, no booth | FAIL ("Table 2 · 2 seats") | PASS |
| F5 Combine 2 + 3 seated guests → confirm sheet "Keep 5 guests"; waiter's choice saved to the session and check | FAIL (no confirmation; toast "· 4 seats") | PASS |
| F6 Combining empty tables seats nobody; opening asks | PASS | PASS |
| F7 Separating keeps the guest count | FAIL (reset to capacity 2) | PASS |
| F8 Combining/separating never change `boh_shared/tables`; original geometry kept and restored | PASS | PASS |
| F9 Combined table: order, send and pay (mock card) | PASS | PASS |
| F10 Another device's order, with its check: 4 guests kept (capacity 6) | PASS | PASS |
| F11 Another device's order, check not yet on this device: 4 guests from the order | FAIL (2) | PASS |
| F12 BOH capacities and the full layout (booth, sideboard, decor) unchanged in POS data | PASS | PASS |

Totals: base 5 passed / 7 failed; fix 12 passed / 0 failed. Both runs are recorded in `runs.jsonl`.

### Existing suites, on the fix
- `phase0-acceptance.mjs`: 28/28.
- `record-integrity.mjs`: 5/5.
- `payment-recovery.mjs`: 2/2.
- **`test/*.mjs`:** 13/14 pass. `voice-engine.mjs` fails on both base and fix. Its unchanged-function guard flags `beginAddItem`, a Phase 0 change still awaiting the owner's decision. This change doesn't touch that function.

## Notes for review
- **Booths in the floor view:** booths (`couch`) were tappable seat objects. With this change they are not drawn, so an order on a booth would be reachable only through check history. BOH creates booths with the number "Booth", and the owner treats them as furniture.
- **Combined guest count:** it is the sum of the guests recorded at both tables, carried over until the waiter confirms or changes it. Dismissing the sheet keeps that sum (never a capacity).
- **Tests and the Table tools menu:** the tests open "Table tools → Combine tables / Split combined tables" by calling the functions those buttons call. At the harness's iPad viewport the phone ⋮ menu isn't laid out. Every sheet and chip after that is tapped.
