# Consolidated60 acceptance tests — corrective safety revision

Single authority:SCORECARD.json;60unique rows,52critical/8minor,formal0/60. M30 is FAIL until all allergy criteria including recovery/substitutions pass. Missing authentic catalog is BLOCKED. Automated/simulated transport/physical/independent outcomes separate. All subscenarios required for a grouped row.

Classification change:mandatory disclaimer M18 promoted to critical; M47 narrowed to visual-only usability and minor. All removed safety assertions retained in criticalM23/M28/M45/M60. No safety requirement downgraded.

| ID | Severity | Scenario | All required pass criteria |
|---|---|---|---|
| M01 | critical | Owner starts isolated origin | Private host/token, no public binding, no production SDK or network |
| M02 | critical | Session expiry and STOP | Expiry closes listener/connections; STOP cancels runner |
| M03 | critical | Voice/provider freeze | Microphone and interpretation reject in manual mode; no provider request |
| M04 | critical | Backend PIN session lifecycle | Verify PIN at backend, not client role. Invalid PIN, expiry, logout/relogin, staff switch, revoked grant and forged session/token are denied at each action boundary; no old session can mutate new check. |
| M05 | critical | Authorization, manager approvals and replay | Direct SEND/FIRE/void/comp/discount calls enforce current staff/manager/kitchen grant and owned check; fresh manager code approval exact action/amount/item/revision/reason; wrong/expired/revoked/reused approval or altered request replay denied with zero mutation; same finalized request returns one immutable audit/result. |
| M06 | critical | Logout/login | Unsent checks and exact identities survive; former session cannot mutate new session |
| M07 | critical | Staff/table switching | Changing staff/table cannot attach edits to previous check |
| M08 | minor | Login usability | PIN targets and readable error state usable on iPhone |
| M09 | critical | Catalog completeness | Every current published BOH food/bar/wine/special ID is present or explicitly unavailable |
| M10 | critical | 86 and availability | BOH 86/inactive item cannot be added; status revision is visible |
| M11 | critical | Food price authority | Selected food uses exact BOH price, no seed/demo or inferred price |
| M12 | critical | BOH menu base prices and tax | PF/tasting source prices immutable; NYC8.875% applied only to approved taxable net items; display separate subtotal/tax/tip/final. |
| M13 | critical | Fail-closed price/tax/tip input | Missing price/taxability blocks acceptance; no free item. Tips20/25/40/Custom on tax-inclusive total; Custom >=20% at boundary; reject invalid/negative/nonfinite/stale values. |
| M14 | critical | Wine identity/price | VIN, producer, vintage, size and glass/bottle price match exact BOH record |
| M15 | critical | Beer/spirit pour | Actual BOH SKU and allowed pour produce exact corresponding price |
| M16 | minor | Large cellar performance | Search first/last known SKU in bounded pages; proposed <=2s on owner device |
| M17 | minor | Food/beverage navigation | Categories, search and back navigation retain current unsent check |
| M18 | critical | Critical customer-menu tipping disclaimer | Mandatory tipping disclaimer at top of EVERY actual guest-menu route, including food/wine/PF/tasting/alternate entrypoints; absent/hidden/stale copy fails critical acceptance. Valid tax-inclusive20/25/40/Custom>=20 policy and displayed totals must agree. |
| M19 | critical | Open occupied table | Correct table/check and unsent lines shown; never overwrite occupied check |
| M20 | critical | Guest count lifecycle | Increasing/decreasing guests retains existing occupied position identities |
| M21 | critical | 2 and 2A selection | Separate manual chips/picker entries; distinct ordinary food/beverage lines |
| M22 | critical | 2 and 2A menu coexistence | Two PF menus retained, displayed and totaled as distinct positions |
| M23 | critical | Exact position edits and reorder ownership | Owned unsent move/modifier/replace/reorder retains exact2/2A/3, check/line identity and guest allergy lookup; no carried suffix or phantom. Safety aspects removed from visual-only M47 remain critical here. |
| M24 | critical | Table/shared item | Shared line stays shared across editing, totals and structured payload |
| M25 | minor | Priority/seat labels | Labels remain consistent in check, picker and review screens |
| M26 | minor | Viewport readability | Portrait/landscape/keyboard/long-check remain readable; blocking controls tested elsewhere |
| M27 | critical | Manual Add/confirm rapid double-tap | Real BOH item/quantity added to exact owned check. Rapid double-tap Add/confirm and retry while pending yield one operation/line/menu, not two charges; direct duplicate request tested, not only disabled button. |
| M28 | critical | Critical course/identity after editing | Starter/main/dessert assignment and reorder/replace retain intended course and stable line/check/position without changing wrong guest or charge. Reordering safety remains critical here and M60. |
| M29 | critical | Allergy changes including AFTER SEND | Table/guest restrictions appear before confirmation and remain scoped. Allergy added after local approved SEND creates durable safety change/notification for affected intents, invalidates stale FIRE/overrides and requires acknowledgment; fired history retained, never falsely unsent. |
| M30 | critical | Complete exact-position allergy safety and recovery | Separate2/2A/3 editor+modifier warnings; every transition resets suffix and rejects phantom; table restrictions and legacy map retained; removal/reopen/reload/cold recovery preserves allergies; substitutions and kitchen allergy notes retain exact guest identity. C1 pass alone cannot accept row while C2/C3 fail. |
| M31 | critical | Explicit override policy | Only authorized role can acknowledge conflict; cancellation makes no mutation |
| M32 | critical | Required temperature | Missing/invalid BOH temperature rejected; allowed value retained |
| M33 | critical | Modifiers and prices | Each option and repeated change uses exact BOH adjustment once; no accumulation drift |
| M34 | critical | Kitchen note | Preserve text and allergen note on the exact item/check through editing |
| M35 | critical | Complete PF menu | Manual starter/main create one menu with exact included selections |
| M36 | critical | Incomplete/None PF course | BOH-permitted None explicit; missing required choices cannot silently submit |
| M37 | critical | PF temperature | Pork/main temperature remains on included choice without price inference |
| M38 | critical | PF upcharges | Actual selected option upcharges once; replacement removes previous surcharge |
| M39 | critical | Choose dessert later | Manual dessert updates same menu; correct price; no new menu or duplicate |
| M40 | critical | Change dessert twice | Only latest selection/surcharge retained, with prior fired state protected |
| M41 | critical | Skip dessert | None state remains explicit; no phantom charge or course |
| M42 | critical | Gelato scoops | Exact BOH scoop count/flavors/allergens retained; incomplete choice rejected |
| M43 | critical | Tasting menu construction | All BOH courses/temperature/options included, actual price, no hardcoded ID price |
| M44 | critical | Extras and pairings | Actual BOH included-vs-extra rules and pairing price; no invented fee |
| M45 | critical | Totals integrity, NYC tax/tip and adjustments | Recompute integer-cent subtotal, approved adjustments/net taxable basis,8.875%tax,tax-inclusive check,20/25/40/Custom tip and final after quantity/void/comp/discount/split. Reject custom <20%; no duplicate adjustment or stale tip; zero balance and rounding verified. Incorporates Claude M63. |
| M46 | critical | Owned edits plus manager comps/discounts | Owned unsent modify/replace retains identity/modifiers/notes; comps/percent/fixed discounts require valid manager approval (also manager initiator), reason and append-only audit; original BOH prices retained, no negative net amount; repeat requests exactly once. |
| M47 | minor | Visual-only reorder usability | Row resequencing/readability/navigation presents stable order clearly. This minor row excludes safety correctness: exact item/check/seat ownership is critical M23, course/charges critical M28/M45, serialized safety critical M60. |
| M48 | critical | Unsent erase and manager-approved sent-item void | Unsent selected PF removal scoped to exact position. Sent void is separate reversal requiring manager code+reason+identity/time/item/check audit, retains original fired history and kitchen link, recalculates tax/tip totals exactly once. Incorporates Claude M61/M62. |
| M49 | critical | Split by selected lines/seat | Exact 2/2A ownership and cent totals preserved across resulting checks |
| M50 | minor | Split/check lookup usability | Correct check displayed and easy return; no silent editing of another check |
| M51 | critical | Table transfer/combine/split | Occupied destinations protected; no item/seat/check loss or duplicated price |
| M52 | minor | Receipt/check presentation | Read-only print preview lists exact names/positions/status/totals; physical print disabled |
| M53 | critical | Durable allergy/check reload recovery | Real full-page reload/cold backend restart restores complete structured lines/PF/modifiers, exact2/2A allergies/substitutions/notes and revisions. No reset-fixture or reconstructed display text substitute; serialized/ingested allergy loss fails. |
| M54 | critical | Offline/retry/request reconciliation | Clear offline/pending state; reconcile same stable operationId after reload/timeout, no lost allergy/check or duplicate; stale/expired authorization cannot be replayed; late allergy revision cancels stale confirmation. |
| M55 | critical | Two-client concurrency | Detect stale revision; never silently overwrite current check |
| M56 | critical | SEND authorization and rapid/replay idempotency | Current active server/manager SEND allowed; kitchen denied; direct unauthorized/expired/revoked/foreign-check calls denied. Rapid double-tap/concurrent/retried local intent records one acknowledged effect with exact IDs. |
| M57 | critical | FIRE authorization, late-allergy and replay gates | Active scoped server/manager or explicitly granted kitchen may FIRE; direct bypass/stale session/revoked grant rejected. Pending choice, current allergy revision, exact2/2A and already-fired state checked; delayed or forged ACK cannot bypass safety; double taps/replays one effect. |
| M58 | critical | Post-fire edit protection | Fired/sent courses cannot be reset, repriced, erased or re-FIREd by edit |
| M59 | critical | Failure/acknowledgment recovery | No false sent/fired flag before acknowledgment; retry exactly once |
| M60 | critical | Complete authorized manual service with final totals | Food/beverages/exact2/2A/PF/allergies/edits/recovery/local approved kitchen intent agree, then manager-approved void/comp/discount, NYCtax,tax-inclusive tip choices/minimum, policy disclaimer atop every actual customer-menu surface and final display. Never actual settlement/kitchen in current lab. |

Six owner-supplied revision themes:recovery;criticaldisclaimer;authorization/replay;doubletap;post-SEND allergies;complete M30 gate. Original Claude review attachment was not supplied; no verbatim-review claim. M61–M63 themes remain folded into M05/M45/M46/M48.
