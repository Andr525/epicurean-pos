# POS item and payment record integrity

## Root cause (measured at `4785297`)
There was no single complete business record of an item. Each stage of the lifecycle built its own hand-written field list from the previous stage's output, so every later stage could only lose information. Each bug fix then added a field to one of those lists.

The data was captured with an offline probe. One burger was ordered with four modifier selections, a custom instruction, a seat allergy plus a documented override, and an owner. The table counts how many of the committed line's 161 leaf values still appear at each stage.

| Stage | Where it is built | Line values kept |
|---|---|---|
| Committed line (`STATE.currentOrder`) | `beginAddItem`, `pickMod`/`applyModPricing`, `commitPendingItem`, `confirmAllergyOverride`, `stampLineOwners` | 161 / 161 |
| Saved draft on the check (`unsentLines`) | `persistCheck` → `unsentLinesForDoc` (whole clone) | 161 / 161 |
| Kitchen ticket item (`orders/{id}.items[]`) | `sendOrder` → `kitchenItemsFrom` (hand-picked fields) | 137 / 161 |
| Open check row (`checks/{id}.guest.items[]`) | `persistCheck` → `guestCheckItems` (hand-picked fields) | 17 / 161 |
| Payment snapshot (`payments/{id}.snapshot.items[]`) | `paymentSnapshot`, built from `guestCheckItems` and cut further | 6 / 161 |
| Closed check row (normal and both recoveries) | `settleCheckFromReceipts` writes the snapshot | 5–7 / 161 |

- **The ticket item** loses `ownerCode`, `ownerName`, the `mods` map, `verified`, `category`, `catIds`, `description`, `dietaryFlags`, the surcharge fields, the wine fields and any unknown field.
- **The check row** additionally loses `modifiers`, `modifierSelections`, `allergens`, `basePrice`, `station`, `cookTime`, `selectedMod` and the menu item `id`.
- **The payment snapshot** additionally loses `notes` (the special instructions), `allergyOverride`, `serviceCourse`, `extraPlate` and the ticket position fields.
- **The closed check** stored that reduced snapshot as its item history. This happened on the normal path too, not only in recovery.

Check-level fields (allergies, kitchen note, staff, positions) survived settlement, because the settlement starts from the cloud document.

### Other copy and persistence points examined
- **`writeOrderItems` / `assignLineToCheck`**: rewrite a ticket's whole `items` array from this device's copy, so a concurrent change to other items on that ticket (for example by the kitchen display) can be overwritten. **Not changed here**; recorded as a limitation.
- **`persistCheck`**: writes the whole check document from this device's copy. A field another system added since this device last read the check is lost when this device next saves (`ingestOpenChecks` reduces this for allergies and notes). **Not changed here**; recorded as a limitation. Settlement itself no longer goes through this path.
- **`moveCloudDocs`**: writes the whole check from this device's copy. Same limitation.
- **`publishActiveOrder`**: the kitchen feed is a display projection.
- **`printCheck` and the order screen**: display only; they persist nothing.

## Data-integrity invariants (permanent)
1. **A completed or recovered payment preserves the complete itemized check.**
   - Every line keeps its complete original record: instructions, modifier selections, prices, positions, allergy flags and overrides, employee identifiers, timestamps, audit metadata, and fields this version does not know about.
   - The check keeps all of its own fields.
2. **Recovery never replaces a complete record with a partial reconstruction.** The closed check's itemized record is the snapshot taken when the payment was recorded. That snapshot is built by the same function that writes the open check, never from unpaid-only items. A field missing from the cloud copy is filled from the snapshot and never deleted.
3. **Fields unrelated to the operation survive unchanged, including nested objects and arrays.** Settlement changes only:
   - on the check: `status`, `closedAt`, `paymentIds` and `updatedAt` (and `evenSplit` for split payments);
   - on the ticket: the paid line's `paid`, `paidCheckId` and `paymentId`, plus the ticket's `status` and `paidAt`.
4. **An incomplete original record means settlement stays pending with an explicit error.**
   - A payment is refused before tokenization if its complete record cannot be captured.
   - A receipt whose snapshot is missing or incomplete stays `settlement:'pending'` with a `settlementError`, and nothing is overwritten.
5. **A recovered transaction has the same financial and audit outcome as a normal one.** Both use the same settlement function and the same snapshot. The tests compare them structurally.
6. **Recovery never creates a second charge or alters unrelated orders.** No recovery step tokenizes; only the receipt's own check and lines are touched.

### Representation rules
- **One canonical record per item.** It is the committed line deep-cloned, minus keys beginning with `_` (device-local transient state such as `_sending`).
  - It travels unchanged as `record` on every kitchen ticket item and every check row.
  - Projection fields stay alongside it so the kitchen display, iPad and printer formats keep working.
- **Operational state stays outside the record.** Paid status, check assignment and kitchen states (`kdsState`) are kept next to the record, never inside it.
- **The payment snapshot is whole objects, never a field list:**
  - the check's complete `guest` record, exactly as the open check stores it;
  - the check document without `guest`;
  - each ticket document without its items;
  - a map from each line to its ticket.

## Tests
- `record-integrity.mjs`:
  - **DI-1:** normal settlement.
  - **DI-2:** ticket paid, check write rejected, then recovery on a fresh device.
  - **DI-3:** check closed, ticket write rejected, then recovery on a fresh device.
  - **DI-4:** the recovered outcome equals the normal one.
  - All comparisons are deep and structural, with an explicit list of the only fields payment may change.
- `payment-recovery.mjs`: PR-A and PR-B. Recovery from both asymmetric partial writes, including a repeated failure, with no second charge.
