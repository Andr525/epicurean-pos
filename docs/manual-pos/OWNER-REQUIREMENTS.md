# Finalized owner requirements — manual POS revision

Requirements supplied by owner following review of a529059. This document is implementation criteria, not a claim that the current POS satisfies it. Only the separate-position allergy repair is implemented in this delivery; permissions, manager approvals, financial adjustments/tax/tips/disclaimers and durable audit require the following cycles. Voice remains frozen. No deployment/live write/paid service/real kitchen authorization is granted by this specification.

## Staff permissions at action boundaries

| Action | Server | Manager | Kitchen |
|---|---|---|---|
| SEND | Allowed for active scoped staff | Allowed for active scoped staff | Denied |
| FIRE | Allowed subject to course/allergy/idempotency checks | Same | Only active kitchen identity with explicit server-verified FIRE grant; otherwise denied |
| Void, comp, discount | Valid fresh manager-code approval required | Valid fresh manager-code approval required even for manager initiator | Same manager-code requirement if an initiation UI is allowed; never an implicit role privilege |

Server/backend must verify identity, role/grant, check/item ownership, revision and action on every direct invocation as well as UI clicks. Hiding a control is not enforcement. An occasional kitchen FIRE grant is explicit, scoped, revocable and checked per request, not a client-set boolean. FIRE permission does not waive unresolved allergy or course constraints. Owner has not finalized allergy-override roles: that case remains BLOCKED rather than inventing authority.

Manager approval binds manager identity, initiator identity, action (void/comp/discount), check/item IDs, expected revision, approved adjustment, required nonempty reason, server time, unique request/approval IDs and before/after amounts. Verify manager active status and code at the boundary, rate-limit failed attempts, consume approval once, and never store/display codes in audit evidence. Repeated identical request IDs return the same result/audit, not a second adjustment; different action/item/reason requires a new approval. Audit is append-only, immutable to POS clients. A denied/failed action changes no item, totals, sent/fired state or approval consumption.

Void sent items by a distinct reversal/status event: retain original line, fired history and kitchen linkage. Never treat unsent erase as sent-item void or reset fired flags. Comps and discounts preserve original BOH item/menu prices; store authorized adjustment records and derive chargeable balances. An adjustment cannot drive any line/check below zero. Any kitchen void intent remains isolated until explicitly authorized for live use.

## Tax, tips and totals

NYC rate: exactly 8.875% on taxable net sales. Use integer cents and rational rate 8875/100000, not floating-point accumulation. Maintain subtotal, authorized adjustments/net subtotal, taxable basis, tax, check total including tax, tip, final total as distinct values. Display subtotal, tax, tip and final total separately; expose adjustment lines. BOH prices remain unchanged. Taxability/exemptions must come from genuine approved catalog/configuration, never guessed item records. Unknown classification is BLOCKED for acceptance. Any different tax treatment of comps/discounts must be represented by the approved policy, not implied by strings or UI state.

Proposed reproducible rounding contract for implementation review: round tax once at check-level taxable net cents, half-up to one cent; percent adjustments half-up at their explicit line/check scope. Allocate split cents with deterministic largest-remainder allocation, preserving the original total exactly. Merchant-funded comps/discounts reduce the net taxable basis under the proposed test policy; classification/policy review precedes tax-engine acceptance. No tax engine is built in this revision.

Tips: choices 20%, 25%, 40%, Custom; basis is check total INCLUDING tax after approved adjustments. Validate Custom at the boundary in cents; minimum is ceil(checkTotalCents*20/100), so it cannot fall below 20% through rounding. Proposed preset 20% uses that same minimum; 25/40 half-up, never below minimum. Reject negative/nonfinite/malformed values and custom below minimum; do not silently accept or carry a stale amount. After void/comp/discount/quantity/tax/split changes, recompute preset tips or revalidate a custom tip; show changed totals and require confirmation before settlement. Full zero check has zero minimum tip; no phantom tax/tip/charge.

Pure arithmetic examples use existing BOH PF price 89, not invented products:
- Taxable subtotal 89.00 → tax 7.90 → check 96.90 → 20% tip 19.38 → final 116.28.
- Approved 10% merchant discount 8.90 → net 80.10 → tax 7.11 → check 87.21 → minimum 20% tip 17.45 (round upward for strict minimum) → final 104.66.
- Approved full comp/void leaves original price/audit intact but chargeable basis/tax/check/tip/final all zero under that test policy.

Top of EVERY customer-menu surface: a visible tipping-policy disclaimer, not only the payment modal. Proposed copy: “Tips are calculated on the check total including tax. Tip options are 20%, 25%, 40%, or Custom. Custom tips must be at least 20%.” Inventory all actual guest menu routes before rollout; this delivery does not add the disclaimer to another app or claim it is displayed. Label tip as tip, not an invented mandatory service charge. Payment gateway/capture remains outside this test authorization.

## Consolidated matrix and evidence

Keep M01–M60 only, 52 critical/8 minor; every grouped test passes only when every mandatory subscenario passes. Owner-described Claude M61–M63 themes map into existing critical rows: sent-item void → M48; manager/audit trails → M05/M46/M48; totals integrity → M45. Manager comps/discounts → M46; tax → M12/M13/M45; tip validation → M13/M45/M60; customer disclaimer → M18 with financial correctness still critical. Cross-reference retained without adding M61–M63 as extra denominator rows.

Automated browser results, simulated transport/emulator results, independent disposition and physical iPhone results are separate fields. Missing authentic BOH records produce BLOCKED, never PASS. Formal accepted stays 0/60 until verified. Source review and limited smoke evidence do not certify manager controls, tax, persistence or kitchen safety.
