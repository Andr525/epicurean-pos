# Harbor Lane TEST POS: owner manual testing

This is the real POS screen from the approved commit, running entirely on your computer.

- **Fictional data only.** The restaurant ("Harbor Lane Bistro"), menu, staff, guests and orders are invented. The sample floor plan is invented too, until you import your own BOH floor plan (section 1c).
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

## 1a. On your iPhone: easiest way (QR code)
1. Unzip `harbor-lane-test-pos.zip`. Make sure the Mac and the iPhone are on the same home Wi-Fi.
2. On the Mac, double-click **`Start iPhone POS Test.command`**. The first time, right-click → **Open**.
   - If macOS asks *"Do you want the application python3 to accept incoming network connections?"*, choose **Allow**.
3. A window opens on the Mac with a large QR code and the address underneath.
4. On the iPhone, open the **Camera**, point it at the QR code, and tap the yellow link. The POS opens in **Safari**.
5. To stop, press **Stop Testing** in the QR window (or close that window, or the Terminal window).

If something is wrong, a dialog explains it: no home Wi-Fi found, or the test port is busy (close other test windows and try again).

## 1b. On your iPhone: typing the address
1. Make sure the Mac and the iPhone are on the same home Wi-Fi.
2. On the Mac, double-click **`Start Test POS for iPhone (Mac).command`**. The first time, right-click → **Open**.
   - If macOS asks *"Do you want the application python3 to accept incoming network connections?"*, choose **Allow**.
   - The window prints the exact address, for example `http://192.168.1.23:8765/index.html`. It shows the Mac's Wi-Fi address, so the numbers differ per network.
3. On the iPhone, open **Safari** and type that address exactly, including `http://` and `:8765`.
4. Optional: tap Share → **Add to Home Screen** to open it like an app.
5. To stop, close the window on the Mac.

Notes:
- The iPhone keeps **its own** test data, separate from the Mac's browser. To test a second device, open another tab in Safari, or use the TEST panel's **Open another device**. Reset works per device.
- This server listens only on the Mac's Wi-Fi address. Only devices on your home network can reach it; nothing is published on the internet.
- **If the iPhone can't connect:**
  - Check that both devices are on the same Wi-Fi, not a guest network.
  - Check the Mac's firewall: System Settings → Network → Firewall must allow python3.
  - Some routers block devices from seeing each other ("client isolation"). If so, use the Mac's own browser instead.

## 1c. Use your ORIGINAL BOH floor plan
**Export it from BOH (one time, read-only):**
1. On the Mac, double-click **`BOH Layout Export.html`** in this folder. Open it in the **same browser** you use for BOH (e.g. Firefox).
2. Show the bookmarks bar (Firefox: View → Toolbars → Bookmarks Toolbar; Safari: View → Show Favorites Bar). **Drag** the gold **📐 Export BOH layout** button onto it.
3. Open your BOH as usual, check the dining room looks right, then click **📐 Export BOH layout** on the bookmarks bar.
4. A message shows the rooms, tables, booths, walls and waiter stations, and a file `boh-layout-….json` is saved in **Downloads**.

It only reads. It changes nothing in BOH, in the browser's storage or in Firebase. It leaves out employee PINs and guest details.

**Load it into the test POS:**
1. Move the `boh-layout-….json` file into this **harbor-lane-test-pos** folder.
2. Double-click **`Start iPhone POS Test.command`** and scan the QR code (section 1a).
3. In the POS on the iPhone: tap the gold **TEST** tab → **📐 Use BOH layout from the Mac**. Check the numbers of rooms, tables and stations, then tap **Apply this floor plan**.
   - In any other browser running the kit, use **TEST → 📐 Import BOH Layout (choose file)** instead.
   - Each device (each browser) keeps its own test data, so apply it once on each device you test with.
4. A file that isn't a complete BOH layout is rejected with the reason, and nothing changes.

**What the POS shows:**
- Your original numbered tables in their exact positions, shapes and sizes, plus the walls.
- No booths, sideboards, bar counters, doors, plants, labels, station lines, waiter names or seat counts.
- Waiter stations still work behind the scenes. Each original waiter is replaced by a fictional test waiter, shown in the TEST panel (e.g. Station 1 → Jordan Reyes, PIN 3101). Sign in with that PIN and tap **My station**.

Fictional employees, orders and mock payments stay as they are. **Reset all test data** keeps your imported floor plan; **Remove imported layout** goes back to the fictional one.

## 2. Test logins (PIN)
| PIN | Employee | Role |
|---|---|---|
| 3101 | Jordan Reyes | Food Master (sample floor: Station 1, tables 1–6) |
| 3102 | Sam Patel | Food Master (sample floor: Station 2, tables 7–12) |
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

With your own floor plan imported, these sample orders stay on tables 3, 5 and 8 if your floor has those numbers.

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
| **Import BOH Layout / Use BOH layout from the Mac** | Loads your exported floor plan (section 1c). |
| **Remove imported layout** | Back to the fictional sample floor plan. |
| **Reset all test data** | Returns to the starting sample data, on every tab. Keeps an imported floor plan. |

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
