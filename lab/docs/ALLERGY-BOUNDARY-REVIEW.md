# Corrective allergy-boundary review

Same branch: `review/manual-pos-mobile-ordering-iteration1`, based on Claude-reviewed `f13ebfa`. No screen redesign. FOOD/DRINKS, persistent check, wine navigation and exact positions remain in the isolated lab. Independent Claude verification is pending.

## Corrections

- Removed **Send anyway**. The ordinary/extra/replacement `commitPendingItem()` boundary rechecks known allergens against the owning exact position and table restrictions before mutating a check. Notes and confirmation flags provide no exception. Shared-position items also consider recorded individual guest restrictions. No authorized allergy-resolution process exists in this build.
- Included-dessert selection checks the actual option plus selected scoop allergens before changing courses, pending flags or totals. Selecting None also checks any entremet it would activate. This closes the Tree Nut dessert/entremet path.
- Course edits check the owning guest, not the currently selected guest. Direct option application, tasting note/temperature edits and course-note saves also enforce the conflict block. Existing PF and tasting add guards remain.
- Pairing lookup requires a published matching pairing record, explicit allergen metadata, a name and a valid price. Missing metadata fails closed; known conflicts use the same guard. The supplied authentic BOH snapshot has **zero published pairings**, so real pairing acceptance remains BLOCKED.
- Position relocation and positive quantity changes recheck the owning/destination guest before mutation. Existing exact-position registration is respected.
- A held legacy buffer is rechecked before commit, closing the stale-allergy bypass without changing speech parsing, providers or conversational behavior. This is shared add-boundary safety, not resumed Voice development.
- Ordinary lines, replacements/extras using that boundary, menu creation and pairing construction carry structured guest safety/substitution context. `substitutionContext.position` is exact; 2 never borrows 2A's note. Context is refreshed when notes/restrictions change, when checks are projected and after merge remapping. Existing table/check safety persistence remains. No durable database claim is made.
- `manual-mobile.js` is absent from the normal POS HTML. Only the isolated manual lab injects it. It requires three explicit boolean flags: manual lab, screen-only, and mobile UI. Unset/partial/string flags or `devControls=1` cannot activate it. The presentation remains otherwise unchanged.
- Excluding `SEED_DRINK_EXTRAS` when `menuLive` is true is **intentional**: these are synthetic fallback records, not published BOH items. Authentic snapshots/IDs/prices/allergen arrays are unchanged. The existing catalog screen test rejects their leakage. Legacy offline demo fallback remains outside this manual-lab acceptance profile.

## Tested coverage and limits

Run `node test/manual-allergy-paths.mjs` from the repository root. It contains twelve grouped regressions, with evidence kinds explicitly recorded:

| Path | Demonstrated behavior | Acceptance limit |
|---|---|---|
| Ordinary pending add, replacement and modification | Tree Nut at2A blocks direct commit, even with notes/confirmation flags; no override button | Authentic PF dish metadata tests the common boundary without inventing a standalone price; standalone food catalog acceptance BLOCKED |
| Shared item / held buffer | A shared Tree Nut item and a stale held2A item cannot commit | Local functions only; no speech/provider test |
| Relocation / quantity | Destination2A Tree Nut blocks moving a compatible source guest's menu; quantity growth after recorded restrictions is blocked | Local unsent lines only |
| Prix-fixe extra | Authentic Tree Nut dessert metadata cannot commit through the extra boundary | No extra-price/catalog acceptance claim; legacy extra pricing remains unverified |
| Included dessert | Actual Tree Nut dessert blocks before course/price mutation; None cannot activate conflicting entremet | Authentic priced PF created before restrictions were recorded; no SEND/FIRE |
| Selected dessert scoops | Authentic hazelnut/pistachio metadata blocks scoop selection before mutation | Controlled fixture omits entremet to isolate the scoop check; not catalog editing |
| PF/tasting add | Actual BOH Tree Nut metadata blocks menu addition regardless of notes | Positive compatible menus covered by existing UI/unit regressions |
| Course edit/direct option application | Actual Tree Nut main cannot replace a course at2A while2 is selected | Owning runtime required; no backend authorization claim |
| Tasting/course notes and temperatures | Tree Nut notes cannot resolve conflict; Fish temperature edit uses owning2A restrictions | Local course boundaries, no kitchen delivery |
| Pairing missing record/metadata | No unknown pairing or incomplete metadata creates a line | Authentic pairing publication missing: BLOCKED |
| Pairing conflict guard | Synthetic adversarial transport metadata copied from an authentic Tree Nut dish is rejected; no price/product is invented or added | **Simulated metadata only**, not a real pairing or authentic pairing acceptance |
| Guest substitutions | Allowed authentic priced beverages at2/2A and compatible PF/tasting menus retain their exact notes | Real pairing/standalone-extra positive creation cannot be certified without authentic records/prices |

Negative controls: `POS_SOURCE_COMMIT=f13ebfa node test/manual-allergy-paths.mjs` and `POS_SOURCE_COMMIT=f13ebfa node test/manual-mobile-opt-in.mjs` both fail against the reviewed baseline; the current tests pass.

`node test/manual-mobile-opt-in.mjs` verifies inactive normal HTML and strict lab-only activation. The existing C1, allergy recovery, exact identity, split/merge/late-menu, service workflow, fine dining, geometry, handheld and security suites are rerun. Some existing service regressions simulate local workflow; they are not live kitchen transactions.

Browser reproduction, from `lab` with Node22 and installed Chromium:

```sh
XDG_CONFIG_HOME=/tmp/epicurean-browser-config XDG_CACHE_HOME=/tmp/epicurean-browser-cache LAB_MANUAL=1 node test/screens.mjs
XDG_CONFIG_HOME=/tmp/epicurean-browser-config XDG_CACHE_HOME=/tmp/epicurean-browser-cache node test/manual-mobile.mjs
```

The existing five synthetic-DOM screen scenarios and sixteen trusted-click Chromium checkpoints protect the retained interface. They do **not** establish physical Safari acceptance or turn component allergy tests into complete catalog acceptance. The new path regressions use actual POS functions in JSDOM. Evidence is under `lab/docs/evidence/allergy-boundary-review/`.

## Remaining verification

Formal acceptance remains0/60,52 critical. Claude review, physical iPhone verification, authentic missing catalog/pairing records, durable database/concurrent-client recovery, backend enforcement and kitchen acknowledgment remain pending or BLOCKED. Known-allergen matching is tested; missing allergen declarations are not proof that a product is allergen-free. Pairings specifically fail closed when their declaration is missing. No test certifies chemical/allergy safety beyond supplied BOH metadata.

The documented pre-existing Voice source-freeze failure is retained; no parser/provider tests are used as acceptance for this revision. No production deployment, live Firebase, emulator, real kitchen transaction, device access or paid service occurred. Stop after publication for Claude's next independent review.
