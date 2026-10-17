# Harbor Lane TEST POS: owner manual testing

This is the real POS screen from the approved commit, running entirely on your computer.

- **Fictional data only.** The restaurant ("Harbor Lane Bistro"), menu, staff and tables are invented.
- **Mock cloud.** The database lives inside your browser. It never contacts Firebase.
- **Mock card.** Payments are simulated. No card is needed and nothing is charged.
- **No network.** The page is blocked from making network connections.
- **Approved logic, unchanged.** The POS code is the approved build. The test build changes only what `BUILD-MANIFEST.json` lists: it removes the production cloud and payment scripts and plugs in the mock cloud.

## 1. Open it
1. Unzip `harbor-lane-test-pos.zip`. Keep the files together in the folder.
2. Start it:
   - **Mac:** double-click `Start Test POS (Mac).command`. The first time, macOS may ask you to allow it: right-click → **Open**. A Terminal window opens and stays open while you test. Your browser then opens http://127.0.0.1:8765/index.html.
   - **Windows:** double-click `Start Test POS (Windows).bat`. It needs Python; if you don't have it, use the next option.
   - **Without the launcher:** open `index.html` directly in **Google Chrome** (double-click it, or drag it into Chrome).
3. **To stop:** close the Terminal or command window.

The address `127.0.0.1` means "this computer only". Nothing is put on the internet.

**Touchscreen:** use a touch-screen laptop or monitor, or Chrome's device mode: View → Developer → Developer Tools, then the phone/tablet icon. The POS layout is the same as on the iPad.

## 2. Test logins (PIN)
| PIN | Employee | Role |
|---|---|---|
| 3101 | Jordan Reyes | Food Master (Station 1: tables 1–6) |
| 3102 | Sam Patel | Food Master (Station 2: tables 7–12) |
| 4101 | Casey Morgan | Server (order only) |
| 5101 | Taylor Brooks | Manager |
| 1101 | Riley Chen | Kitchen |

**Known POS defect (not a test-build issue):** the approved POS still accepts a 4-digit PIN it doesn't know and signs in with a generic role name, e.g. "Food Master". This is audit item P63, scheduled for the security phase. Use the PINs above.

## 3. Starting sample data
| Table | What's there |
|---|---|
| **3** | 2 guests (Jordan). Sent: Tuna Crudo; Harbor Burger, Medium, Fries, Aged Cheddar, note "No onions, pickles on the side". |
| **5** | 4 guests (Jordan). Seat 2 flagged **Shellfish**. Sent: Crispy Calamari on seat 2 (allergy warning overridden and recorded), Salmon, Risotto. **Unsent draft:** Dark Chocolate Tart on seat 4, owned by Jordan. |
| **8** | 2 guests (Sam). Sent: Ribeye, Medium Rare; Truffle Fries. |
| **Free tables** | 1, 2, 4, 6, 7, 9–12, bar B1–B4, patio P1–P2. |

**Menu items with built-in test cases:**
- **Harbor Burger:** allergens *not verified*, so a flagged seat always warns. It has an optional multi-select of add-ons with upcharges.
- **Grilled Ribeye:** allergens unknown.
- **Market Greens Salad:** tree-nut garnish options.
- **Catch of the Day:** two required choices that share the same name.
- **Oysters:** marked 86 (not available).

## 4. The TEST tab
The gold **TEST** tab on the right edge opens the test panel. Drag it up or down if it is ever in the way. It is part of the test build only, not the POS.

| Button | What it does |
|---|---|
| **Open another device (new tab)** | Every tab is a separate POS device on the same mock cloud. Changes appear on the other tabs. |
| **Next payment: check write fails** | The card is approved and the receipt is stored, but closing the check fails. |
| **Next payment: ticket write fails** | The same, but marking the kitchen ticket paid fails. |
| **Kitchen SEND fails** | Sending to the kitchen is refused. |
| **Cloud offline** | Every read and write fails. |
| **Clear simulated failure** | Back to normal (this tab only). |
| **Download mock database** | Saves the current test data as a JSON file, for a bug report. |
| **Reset all test data** | Returns to the starting sample data, on every tab. |

Simulated failures apply only to the tab where you set them, so you can recover from another tab ("a fresh device").

## 5. Suggested checks
1. **Order with modifiers:** table 1, Harbor Burger with Medium and two add-ons. The price is $22 + the upcharges, and the note appears on the line.
2. **Allergy:** flag a seat (e.g. Dairy), then add the burger. You get a warning, and "Send anyway" records your name. Then SEND.
3. **Split and pay:**
   - On table 3, open Split and move an item to a new check, or choose EVEN /2.
   - Pay one check with the mock card.
   - The other check keeps its items. Shares are exact to the cent.
4. **Move table:** move table 8 to table 4. The tickets, allergies and guests follow.
5. **Another employee's draft:** sign in as 3102 on table 5. It can't be charged while Jordan's tart is unsent. Sign in as 3101 to see it again.
6. **Payment recovery:**
   1. TEST → **Next payment: check write fails**, then pay a table. The screen says *payment recorded — settlement pending*.
   2. TEST → **Open another device**. Sign in on the new tab.
   3. Tap **Finish settlement** on the banner. The check closes with all its items and notes, and the card is not charged again (the TEST panel counts card authorizations per tab).
7. **Kitchen send failure:** TEST → **Kitchen SEND fails**, then SEND. You get "NOT sent", the items stay, and SEND works again after **Clear**.

## Not available in this test build
- Voice ordering: it needs the production speech service, which this build blocks.
- Photo upload.
- Real card readers or real payment processing.
- Tax: the approved POS doesn't calculate it yet (Phase 1).

**What you may notice on screen that is the approved POS itself, not the test build:**
- On a check, the "Tab · + Item · Split · …" and "Balance Due" rows show as plain small buttons. The approved build renders it the same way.
- The "Epicurean POS" title on the sign-in screen is the app's built-in branding.

## Notes
- **Data stays in this browser** for this address. Using another browser, or a private window, gives you a separate, fresh test restaurant.
- **The bundled set menus:** the prix fixe and tasting menus keep generic dish names (e.g. "Smoked Salmon"), because the POS code recognizes them for temperatures and course firing. Their names, prices, pairings, links and translations are fictional.
