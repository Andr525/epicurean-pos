# C2/C3 isolated repair candidate

Review branch: `review/manual-pos-allergy-recovery-notes`, based on `1cd022e`. Formal acceptance remains **0/60**, with 52 critical tests. Claude verification is pending. Historical review documents describe their original commits; this document describes the new candidate.

## Diagnosis and changes

C2: `persistCheck` previously saved guest lines/totals and position labels but omitted the session allergy map, kitchen note and substitution map. `ingestOpenChecks` could not restore those fields. The check projection now deep-copies those fields, restores present fields, and persists allergy toggles and kitchen-note edits through the existing persistence boundary. Legacy records missing safety fields do not clear existing restrictions. Check transfer also preserves substitutions.

C3: substitution controls enumerated numeric seats, and lookup could fall back between a numeric seat and its A label. Controls now enumerate the check's registered exact identities. Explicit-position checks never fall back between 2 and 2A. Legacy numeric-only checks retain their existing compatibility path. Course projections use exact guest restrictions plus table restrictions, preserve operator notes, and replace generated safety notes when updated. A pure kitchen-note builder includes check ID, table restrictions, each exact position, effective restrictions and substitution notes. Course payloads include exact position and structured restriction context. Building notes does not send them.

No BOH fixture, item, price, Voice source or permission policy changed. Existing SEND/FIRE paths were not executed against a backend. Immutable lab transport guards remain in place.

## Reproduction

Use Node 22 and repository lockfiles (`npm ci --prefix test`, `npm ci --prefix lab`) when dependencies are absent. Run from the repository root:

```sh
node test/manual-allergy-recovery-notes.mjs
node test/REPRO-C1-phantom-3A.mjs
node test/REPRO-C2-C3-allergy-open.mjs
node test/manual-allergy-identity.mjs
node test/service-workflow.mjs
node test/fine-dining-check.mjs
node test/table-geometry.mjs
node test/handheld-refine.mjs
node lab/test/security.mjs
```

For browser checks with installed Chromium, run from `lab`:

```sh
XDG_CONFIG_HOME=/tmp/epicurean-browser-config XDG_CACHE_HOME=/tmp/epicurean-browser-cache LAB_MANUAL=1 node test/screens.mjs
```

The new permanent test uses actual POS functions and tracked authentic BOH welcome-course metadata. It saves a check to a temporary local JSON file, closes the first runtime, loads the record into a fresh runtime and checks table/2/2A/3 restrictions. It verifies separate editor controls, substitution changes/removal, course restriction context, operator-note retention and pure kitchen-note content. A second cold load checks removal persistence. Temporary files are deleted. Synthetic staff and note strings are explicitly LAB data, not catalog records.

Negative control: `POS_SOURCE_COMMIT=1cd022e node test/manual-allergy-recovery-notes.mjs` fails because the baseline saved record omits its allergy map; the candidate passes the same assertions.

See `lab/docs/evidence/allergy-recovery-notes/` for command outputs and browser report. The browser suite covers catalog/menu and C1/exact allergy controls; the new C2/C3 cold-load and note assertions run in JSDOM, not on a physical phone. Existing service tests simulate in-memory workflow, not authorized kitchen delivery.

## Remaining limits and unresolved defects

- **No durable database recovery claim.** Firebase and emulator were not accessed or started. Local JSON proves serialization/rehydration only. Database acknowledgments, network failures, concurrent/stale snapshots, split-check/table safety ownership and full unsent-order recovery remain unverified.
- **No kitchen delivery claim.** Structured note construction is tested; kitchen consumption, acknowledgment, authorization/replay and allergies introduced after SEND require approved isolated transport testing. Existing premature acknowledgment concerns remain unresolved.
- Physical iPhone testing and independent Claude verification have not occurred for this commit. C1 still passes the owner-described reconstructed scenario; Claude's original attachment was not supplied or reviewed.
- M30 remains PARTIAL/BLOCKED until all criteria pass; missing authentic catalog records remain BLOCKED. Tax/tip, manager-adjustment/audit and other inventory gaps remain outside this focused allergy repair.
- `test/voice-engine.mjs` has the documented pre-existing source-freeze failure on earlier commits. It was not repaired or used as acceptance evidence; no Voice development resumed.
- Firestore isolation design remains design-only and awaits Claude approval plus explicit owner authorization before implementation.

After publication, stop for independent review. No deployment, device access, paid API or live kitchen action is requested by this revision.
