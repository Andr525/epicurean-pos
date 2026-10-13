# Narrow allergen matching correction

Review branch: `review/manual-pos-mobile-ordering-iteration1`; parent `f873663`.

One shared symmetric comparator now treats Nuts/Nut as a broad category overlapping Tree Nut and Peanut in either direction. Tree Nut and Peanut remain separate. Labels normalize case, whitespace, hyphens/underscores, `(s)`, Tree Nuts/treenuts, Peanuts/groundnuts, Egg/Eggs and sulfite/sulphite spellings. Unknown labels retain normalized exact comparison. No recipe inference, note-based exemption, override, catalog, price or navigation changes.

The comparator is used by ordinary item checks, guest picker warnings, exact-position menu/action guards, lab check warnings and kitchen note label lookup. Existing mutation boundaries all reach these guards; no direct-call exemption was added. Original labels remain stored and displayed unchanged.

## Reproduce

From the repository root, with existing `test/node_modules` installed:

```sh
node test/manual-allergen-matching.mjs
node test/manual-allergy-paths.mjs
GUEST_NUT_LABEL=Nuts node test/manual-allergy-paths.mjs
node test/REPRO-C1-phantom-3A.mjs
node lab/test/security.mjs
```

The focused test has 17 cases: 11 bidirectional/equivalent conflict cases with unchanged-order assertions at position 2A, five specific-category compatibility cases, and one actual BOH-priced beverage addition at 2A. Peanut/broad item variants are deliberately synthetic metadata probes without invented products or prices; they do not establish authentic peanut-dish catalog acceptance. The authentic BOH Tree Nut metadata stays unchanged in the full boundary suite, repeated with broad Nuts recorded for the guest.

`POS_SOURCE_COMMIT=f873663 GUEST_NUT_LABEL=Nuts node test/manual-allergy-paths.mjs` fails on the previous implementation with “Direct call bypassed conflict.” This is retained as baseline evidence.

## Results and limits

All 12 existing manual/security suites pass, including C1, exact-position recovery/notes, split/merge safety, mobile opt-in and workflow checks. Both specific Tree Nut and broad Nuts runs of the 12-group mutation-boundary suite pass. Chromium screen suite: 5 passed. Chromium mobile workflow: 16 passed, 0 failed. Raw results are in `evidence/allergen-matching-review/`.

Browser reproduction (from `lab`, with existing Playwright and `/usr/bin/chromium`):

```sh
XDG_CONFIG_HOME=/tmp/epicurean-browser-config XDG_CACHE_HOME=/tmp/epicurean-browser-cache LAB_MANUAL=1 node test/screens.mjs
XDG_CONFIG_HOME=/tmp/epicurean-browser-config XDG_CACHE_HOME=/tmp/epicurean-browser-cache node test/manual-mobile.mjs
```

These are local function tests and emulated Chromium screen tests, not a physical iPhone result, durable database recovery or kitchen delivery. Authentic standalone-food/pairing catalog acceptance remains blocked where records are unavailable. Formal acceptance remains 0/60 pending independent verification. The previously documented voice-engine test failure is pre-existing and was not addressed or rerun; no Voice feature development occurred. No Firebase, emulator, paid API, production deployment or kitchen transaction was used. Await Claude's independent review.
