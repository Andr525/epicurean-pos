> Historical f13ebfa delivery. Current corrective coverage and limits: [allergy-boundary review](ALLERGY-BOUNDARY-REVIEW.md). The mobile presentation is now explicitly isolated-lab-only; f13ebfa did not cover all add/edit paths.

# Mobile ordering — iteration 1

Review branch: `review/manual-pos-mobile-ordering-iteration1`, based on `f4346d7`. Actual POS with unchanged, hash-verified BOH snapshots; no deployment or live service. Owner physical verification is pending.

## Open on your iPhone

On your Mac, with Node22 installed, run from the existing POS checkout:

```sh
git fetch origin
git switch review/manual-pos-mobile-ordering-iteration1
cd lab
bash mac/start-session.sh --owner-approved MAC_WIFI_IP --manual
```

Replace `MAC_WIFI_IP` with System Settings → Wi-Fi → Details → TCP/IP → IPv4 Address. Keep Mac and iPhone on the same private trusted home Wi-Fi. No USB, certificate, npm installation or paid service is needed to host. USB/Safari Web Inspector remains optional diagnostics, not full remote phone control.

Open the complete **HTTP URL printed in Terminal**, including its fresh `?access=` token, in iPhone Safari. This is local HTTP; no public/cloud URL has been deployed. Tap **Hands-on POS**, enter fixture PIN **5000**, then **Table Service → 14**. Use only controlled test notes, not real credentials or guest information.

Start with position **2**, then FOOD → Prix Fixe. Select the published appetizer and main and required temperature, then **Add to Order**. The compact check remains above the selector, shows the added menu immediately with position, included courses, authoritative menu price and UNSENT status, and can expand via **Full check** without discarding choices. Repeat at **2A**. Use existing position tokens and **Modify** to edit an unsent course.

Swipe the subcategory strip horizontally. FOOD contains À la carte, Prix Fixe, Tasting Menu, Appetizers, Mains, Sides, Desserts and Specials. DRINKS contains Wine List, Wines by the Glass, Champagne/Sparkling, Cocktails, Spirits, Beer, Non-Alcoholic, Coffee and Tea. Categories lacking usable published records are visible but unavailable. Wine List offers **Next wines / Previous wines** so the entire catalog is reachable, plus the existing search. Select position **3** to explore the authentic $115 tasting menu.

For the allergy test, flag **Tree Nut** at **2A**, then open a new prix-fixe selector for that position. The authentic entremet carries Tree Nut in BOH metadata. A prominent conflict appears before Add; Add is blocked and the check stays unchanged, even if a note says to replace granola or says “confirmed safe.” No ingredient/allergen data is inferred from that text. A legitimate safe alternative requires a verified BOH arrangement. Keep 2 and 2A restrictions separate.

**STOP** cancels the automated audit and restores test controls. **Hands-on POS** resets fixtures. **Control+C** in Mac Terminal closes the server; close the iPhone tab. Automatic shutdown occurs after60 minutes. Refresh/reset is not durable order recovery. SEND/FIRE, payment, printing, microphone and external networking remain blocked, including direct transport invocation.

## Verified here

- Ten local/security suites pass, including permanent C1, split/merge/late-menu and new allergy/menu-safety regressions.
- Five existing synthetic-DOM screen scenarios pass. Their selectors use the new navigation; the unsent temperature edit now targets a guest whose recorded restrictions do not conflict with that dish. The other guest's conflict is independently tested, not overridden to keep a test green.
- A separate trusted-click Chromium iPhone-emulation workflow passes16 checkpoints: persistent check in PF, allergy editor, drinks, modifiers and tasting; immediate 2/2A guest/course/price/UNSENT results; full-check expansion preserving radio choices; pre-add Tree Nut blocking despite notes; portrait/landscape; hidden development controls; full Wine List coverage of3,612 records across73 rendered pages (72 native Next clicks). No external requests, browser errors, Firebase readiness or sent orders.
- Numeric BOH tasting ID128 was rejected by strict string lookup, and the tasting/temperature buttons generated malformed quoted handlers. Both are repaired and tested. Full wine browsing no longer depends solely on scroll events on a nested pane.
- A native category assertion exposed hardcoded `SEED_DRINK_EXTRAS` being appended despite BOH-authoritative mode. Those seed extras are now excluded when `menuLive` is true; the category test verifies missing non-alcoholic/coffee/cocktail records stay unavailable. Offline legacy demo fallback remains outside this isolated profile.
- Floating toast feedback is shown inline in the compact header, so it does not cover the check or allergy warning. Summary updates preserve navigation elements instead of replacing them when transient status changes. Oversized tiles/controls and modal scroll space are reduced for mobile.

Reproduce from repository root with Node22 and installed frozen dependencies:

```sh
node test/manual-mobile-safety.mjs
node test/manual-table-safety.mjs
node test/REPRO-C1-phantom-3A.mjs
node test/manual-allergy-recovery-notes.mjs
node test/manual-allergy-identity.mjs
node test/service-workflow.mjs
node test/fine-dining-check.mjs
node test/table-geometry.mjs
node test/handheld-refine.mjs
node lab/test/security.mjs
```

From `lab`, with Chromium installed:

```sh
XDG_CONFIG_HOME=/tmp/epicurean-browser-config XDG_CACHE_HOME=/tmp/epicurean-browser-cache LAB_MANUAL=1 node test/screens.mjs
XDG_CONFIG_HOME=/tmp/epicurean-browser-config XDG_CACHE_HOME=/tmp/epicurean-browser-cache node test/manual-mobile.mjs
```

Results and actual browser screenshots: `lab/docs/evidence/mobile-ordering-iteration1/`. Synthetic DOM, trusted Chromium clicks and physical iPhone evidence remain distinct. The new native workflow is a developer regression, not automatic remote control of the owner's phone. The owner-run **Run manual audit (5)** still provides structured local evidence; physical screenshots, keyboard and Safari browser chrome need owner observation.

## Limits and next review

- Standalone À la carte/appetizers/mains/sides/desserts/specials and cocktails/non-alcoholic/coffee/tea exports are missing. PF course choices remain available within the priced menu. Spirits with coffee-like names are not presented as coffee/non-alcoholic products. Champagne/Sparkling uses available BOH category/type/region metadata; wines without that classification remain reachable in Wine List/by the Glass. No new wine identity, dish, price or allergen was created. Mobile individual-item search uses published catalog records; it does not expose the legacy extra-plate fee path as a substitute for missing à-la-carte prices.
- Coconut–lime sorbet remains **entremet-only**, excluded from the extra-dessert sale list. BOH records/prices are unchanged. Free-text substitutions remain kitchen instructions, not certified allergen removal.
- No current physical Safari certification, durable DB/multi-client recovery, kitchen acknowledgment, manager audit, tax/tip acceptance or real checkout claim. Formal acceptance remains0/60. Existing Voice source-freeze failure remains documented; no Voice feature development resumed. Voice Test/Pricing Basis are hidden in the opted-in isolated manual lab; the normal POS does not load this presentation module; underlying functions remain. Explicit `devControls=1` is a developer opt-in, not permission to access providers.
- Next iteration should resolve the owner's observed navigation/keyboard/course-edit defects in this concrete build. The third iteration should verify complete manual workflows and remaining safety gates, subject to authentic catalog availability and separate authorization for any isolated backend testing. Three iterations are a target, not an acceptance guarantee.

Stop after publishing this first delivery for owner testing. No production, live Firebase, emulator, kitchen transaction, device access or expense occurred.
