# Consolidated 60 manual POS acceptance tests

Source of truth: SCORECARD.json. Exactly60 rows:52critical/8minor. Formal acceptance0/60 until verified. A grouped row passes only when ALL mandatory subscenarios pass. M61–M63 themes are incorporated, not additional denominator rows. Automated, simulated-transport and physical evidence stay separate. BLOCKED authentic catalog tests never earn acceptance.

| ID | Severity | Scenario | Required pass criteria |
|---|---|---|---|
| M01 | critical | Owner starts isolated origin | Private host/token, no public binding, no production SDK or network |
| M02 | critical | Session expiry and STOP | Expiry closes listener/connections; STOP cancels runner |
| M03 | critical | Voice/provider freeze | Microphone and interpretation reject in manual mode; no provider request |
| M04 | critical | Valid and invalid PIN | Valid authorized staff enters; invalid PIN changes no orders; use synthetic staff |
| M05 | critical | Action-boundary permissions and manager audit | Server/manager SEND+FIRE; scoped kitchen FIRE only; kitchen SEND denied. Every void/comp/discount requires fresh valid manager code, immutable manager/initiator/action/time/check/item/reason/before-after audit. Direct calls and stale/revoked grants denied. |
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
| M18 | minor | Customer-menu policy and readability | Top-of-menu tipping disclaimer on every actual customer-menu route; long product/VIN/size readable. Financial correctness remains critical in M13/M45. |
| M19 | critical | Open occupied table | Correct table/check and unsent lines shown; never overwrite occupied check |
| M20 | critical | Guest count lifecycle | Increasing/decreasing guests retains existing occupied position identities |
| M21 | critical | 2 and 2A selection | Separate manual chips/picker entries; distinct ordinary food/beverage lines |
| M22 | critical | 2 and 2A menu coexistence | Two PF menus retained, displayed and totaled as distinct positions |
| M23 | critical | Move item position | Authorized unsent move changes one exact identity without merging checks |
| M24 | critical | Table/shared item | Shared line stays shared across editing, totals and structured payload |
| M25 | minor | Priority/seat labels | Labels remain consistent in check, picker and review screens |
| M26 | minor | Viewport readability | Portrait/landscape/keyboard/long-check remain readable; blocking controls tested elsewhere |
| M27 | critical | Add food/quantity | Actual visible controls create intended item and quantity on exact check |
| M28 | critical | Choose course | Starter/main/dessert course assignment changes only intended unsent line |
| M29 | critical | Table allergy | BOH allergen warning appears before food confirmation and remains attached |
| M30 | critical | Distinct 2/2A allergies and table restrictions | Separate exact-identity editor/inline controls; independent toggles/removal/reopen; table-wide restrictions applied to both; legacy numeric allergy keys retained. No inference of new seats. |
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
| M47 | critical | Move/reorder/course edit | Stable line identities and seat/course maintained after sequence changes |
| M48 | critical | Unsent erase and manager-approved sent-item void | Unsent selected PF removal scoped to exact position. Sent void is separate reversal requiring manager code+reason+identity/time/item/check audit, retains original fired history and kitchen link, recalculates tax/tip totals exactly once. Incorporates Claude M61/M62. |
| M49 | critical | Split by selected lines/seat | Exact 2/2A ownership and cent totals preserved across resulting checks |
| M50 | minor | Split/check lookup usability | Correct check displayed and easy return; no silent editing of another check |
| M51 | critical | Table transfer/combine/split | Occupied destinations protected; no item/seat/check loss or duplicated price |
| M52 | minor | Receipt/check presentation | Read-only print preview lists exact names/positions/status/totals; physical print disabled |
| M53 | critical | Browser reload recovery | Restore full structured unsent items, modifiers, PF selections and stable IDs |
| M54 | critical | Offline recovery/retry | Clear failure state; no lost check or duplicate on approved retry |
| M55 | critical | Two-client concurrency | Detect stale revision; never silently overwrite current check |
| M56 | critical | SEND action authorization and idempotency | Active scoped server/manager may SEND; kitchen cannot. Validate check/line ownership and revisions at boundary; no caller supplied role override; retries produce one local intent. |
| M57 | critical | FIRE permission and course/allergy gating | Server/manager and explicitly authorized active kitchen may FIRE; others/revoked grants denied at boundary. No implicit allergy waiver; pending choice/fired/check/2A identity verified in exact local payload. |
| M58 | critical | Post-fire edit protection | Fired/sent courses cannot be reset, repriced, erased or re-FIREd by edit |
| M59 | critical | Failure/acknowledgment recovery | No false sent/fired flag before acknowledgment; retry exactly once |
| M60 | critical | Complete authorized manual service with final totals | Food/beverages/exact2/2A/PF/allergies/edits/recovery/local approved kitchen intent agree, then manager-approved void/comp/discount, NYCtax,tax-inclusive tip choices/minimum, policy disclaimer atop every actual customer-menu surface and final display. Never actual settlement/kitchen in current lab. |

M61 themes → M48; M62 → M05/M46/M48; M63 → M45. Comps/discounts are critical M46 subscenarios. See OWNER-REQUIREMENTS.md for exact role, audit and money policy.
