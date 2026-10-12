# First 60 manual POS acceptance tests

Source of truth: SCORECARD.json. 52 critical, 8 minor. No formal acceptance credit yet. M30 already fails reproducibly; M09/M35 have partial smoke evidence. Remaining exact scenarios and applicable physical evidence are pending. Existing simulations and the owner’s previous phone run are separate evidence.

| ID | Severity | Area | Scenario | Pass criterion |
|---|---|---|---|---|
| M01 | critical | Safety | Owner starts isolated origin | Private host/token, no public binding, no production SDK or network |
| M02 | critical | Safety | Session expiry and STOP | Expiry closes listener/connections; STOP cancels runner |
| M03 | critical | Safety | Voice/provider freeze | Microphone and interpretation reject in manual mode; no provider request |
| M04 | critical | Auth | Valid and invalid PIN | Valid authorized staff enters; invalid PIN changes no orders; use synthetic staff |
| M05 | critical | Auth | Staff roles | Server/manager permissions enforced at action boundary, not only hidden buttons |
| M06 | critical | Auth | Logout/login | Unsent checks and exact identities survive; former session cannot mutate new session |
| M07 | critical | Auth | Staff/table switching | Changing staff/table cannot attach edits to previous check |
| M08 | minor | UI | Login usability | PIN targets and readable error state usable on iPhone |
| M09 | critical | Catalog | Catalog completeness | Every current published BOH food/bar/wine/special ID is present or explicitly unavailable |
| M10 | critical | Catalog | 86 and availability | BOH 86/inactive item cannot be added; status revision is visible |
| M11 | critical | Price | Food price authority | Selected food uses exact BOH price, no seed/demo or inferred price |
| M12 | critical | Price | PF/tasting price authority | Each menu uses its actual BOH price and selected option surcharges |
| M13 | critical | Price | Missing or malformed price | Reject unpriced/invalid item; do not turn absence into free item |
| M14 | critical | Price | Wine identity/price | VIN, producer, vintage, size and glass/bottle price match exact BOH record |
| M15 | critical | Price | Beer/spirit pour | Actual BOH SKU and allowed pour produce exact corresponding price |
| M16 | minor | UI | Large cellar performance | Search first/last known SKU in bounded pages; proposed <=2s on owner device |
| M17 | minor | UI | Food/beverage navigation | Categories, search and back navigation retain current unsent check |
| M18 | minor | UI | Long catalog readability | Long names/VIN/size readable without changing selected product |
| M19 | critical | Tables | Open occupied table | Correct table/check and unsent lines shown; never overwrite occupied check |
| M20 | critical | Tables | Guest count lifecycle | Increasing/decreasing guests retains existing occupied position identities |
| M21 | critical | Positions | 2 and 2A selection | Separate manual chips/picker entries; distinct ordinary food/beverage lines |
| M22 | critical | Positions | 2 and 2A menu coexistence | Two PF menus retained, displayed and totaled as distinct positions |
| M23 | critical | Positions | Move item position | Authorized unsent move changes one exact identity without merging checks |
| M24 | critical | Positions | Table/shared item | Shared line stays shared across editing, totals and structured payload |
| M25 | minor | UI | Priority/seat labels | Labels remain consistent in check, picker and review screens |
| M26 | minor | UI | Viewport readability | Portrait/landscape/keyboard/long-check remain readable; blocking controls tested elsewhere |
| M27 | critical | Manual order | Add food/quantity | Actual visible controls create intended item and quantity on exact check |
| M28 | critical | Manual order | Choose course | Starter/main/dessert course assignment changes only intended unsent line |
| M29 | critical | Allergies | Table allergy | BOH allergen warning appears before food confirmation and remains attached |
| M30 | critical | Allergies | Seat 2 vs 2A allergy | Distinct guest restrictions never silently merge, disappear or move |
| M31 | critical | Allergies | Explicit override policy | Only authorized role can acknowledge conflict; cancellation makes no mutation |
| M32 | critical | Modifiers | Required temperature | Missing/invalid BOH temperature rejected; allowed value retained |
| M33 | critical | Modifiers | Modifiers and prices | Each option and repeated change uses exact BOH adjustment once; no accumulation drift |
| M34 | critical | Notes | Kitchen note | Preserve text and allergen note on the exact item/check through editing |
| M35 | critical | PF | Complete PF menu | Manual starter/main create one menu with exact included selections |
| M36 | critical | PF | Incomplete/None PF course | BOH-permitted None explicit; missing required choices cannot silently submit |
| M37 | critical | PF | PF temperature | Pork/main temperature remains on included choice without price inference |
| M38 | critical | PF | PF upcharges | Actual selected option upcharges once; replacement removes previous surcharge |
| M39 | critical | PF | Choose dessert later | Manual dessert updates same menu; correct price; no new menu or duplicate |
| M40 | critical | PF | Change dessert twice | Only latest selection/surcharge retained, with prior fired state protected |
| M41 | critical | PF | Skip dessert | None state remains explicit; no phantom charge or course |
| M42 | critical | PF | Gelato scoops | Exact BOH scoop count/flavors/allergens retained; incomplete choice rejected |
| M43 | critical | Tasting | Tasting menu construction | All BOH courses/temperature/options included, actual price, no hardcoded ID price |
| M44 | critical | PF | Extras and pairings | Actual BOH included-vs-extra rules and pairing price; no invented fee |
| M45 | critical | Editing | Quantity and subtotal | Quantity changes, currency rounding and removal agree between screen/state |
| M46 | critical | Editing | Modify/replace item | Exact owned unsent line changed; original removed; no duplicate or note loss |
| M47 | critical | Editing | Move/reorder/course edit | Stable line identities and seat/course maintained after sequence changes |
| M48 | critical | Editing | Erase PF/menu | Only selected menu/bound unsent courses removed; other positions retained |
| M49 | critical | Checks | Split by selected lines/seat | Exact 2/2A ownership and cent totals preserved across resulting checks |
| M50 | minor | UI | Split/check lookup usability | Correct check displayed and easy return; no silent editing of another check |
| M51 | critical | Checks | Table transfer/combine/split | Occupied destinations protected; no item/seat/check loss or duplicated price |
| M52 | minor | UI | Receipt/check presentation | Read-only print preview lists exact names/positions/status/totals; physical print disabled |
| M53 | critical | Persistence | Browser reload recovery | Restore full structured unsent items, modifiers, PF selections and stable IDs |
| M54 | critical | Persistence | Offline recovery/retry | Clear failure state; no lost check or duplicate on approved retry |
| M55 | critical | Persistence | Two-client concurrency | Detect stale revision; never silently overwrite current check |
| M56 | critical | Kitchen | SEND authorization/idempotency | Role/check validated; only chosen unsent items; same intent cannot duplicate |
| M57 | critical | Kitchen | FIRE/course gating | BOH course/choice/allergy guards; exact 2/2A/line identity in kitchen payload |
| M58 | critical | Kitchen | Post-fire edit protection | Fired/sent courses cannot be reset, repriced, erased or re-FIREd by edit |
| M59 | critical | Kitchen | Failure/acknowledgment recovery | No false sent/fired flag before acknowledgment; retry exactly once |
| M60 | critical | End-to-end | Complete multi-guest manual service | Food, beverages, 2/2A, PF, allergies, editing, recovery and local approved kitchen intent all agree |
