// Phase 0 acceptance: one end-to-end check per corrected defect, driven through the real
// POS touch controls against data published by the real BOH. Offline; mock Firestore;
// CLEARLY IDENTIFIED mock card SDK (no real authorization, no card data).
// Usage: PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... [POS_ROOT=..] [BOH_ROOT=..] [LABEL=..] node phase0-acceptance.mjs [filterRegex]
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {launch, exportBoh, openPos, ui, MOCK_CARD_SDK, POS_ROOT, BOH_ROOT} from './lib.mjs';
const HERE = new URL('.', import.meta.url).pathname;
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const label = process.env.LABEL || 'unlabelled';
const rev = r => { try { return execFileSync('git', ['-C', r, 'rev-parse', '--short', 'HEAD'], {encoding: 'utf8'}).trim() + (execFileSync('git', ['-C', r, 'status', '--porcelain', '--', 'index.html', 'menu-manager.js'], {encoding: 'utf8'}).trim() ? '+wip' : ''); } catch { return 'n/a'; } };
const browser = await launch();
const boh = await exportBoh(browser);
const results = [];
async function T(id, defect, title, fn, {card = false, seed = null} = {}) {
  if (only && !only.test(id)) return;
  const o = await openPos(browser, {seed: seed ? seed(JSON.parse(JSON.stringify(boh))) : boh, extraHead: card ? MOCK_CARD_SDK : ''});
  const u = ui(o.page); const r = {id, defect, title};
  try { const out = await fn(u, o.page, o); r.pass = !!out.pass; r.evidence = out.evidence; }
  catch (e) { r.pass = false; const m = String(e.message); r.evidence = 'ERROR: ' + m.split('\n')[0].slice(0, 160) + ((m.match(/waiting for (locator\([^\n]*)/) || [])[1] ? ' @ ' + m.match(/waiting for (locator\([^\n]*)/)[1].slice(0, 160) : ''); }
  r.pageErrors = o.errors.slice(0, 3); r.external = [...new Set(o.external)].filter(h => !/fonts\.(googleapis|gstatic)/.test(h));
  if (r.pageErrors.length) r.pass = false;
  if (r.external.length) { r.pass = false; r.evidence += ' | EXTERNAL REQUEST ' + r.external.join(','); }
  await o.context.close(); results.push(r);
  console.log((r.pass ? 'PASS ' : 'FAIL ') + id + ' ' + title + ' :: ' + r.evidence + (r.pageErrors.length ? ' | pageErrors=' + r.pageErrors.join(';') : ''));
}
const cents = n => Math.round(Number(n) * 100);
async function burger(u, addOns) { await u.openCategory('c_ent'); await u.tile('House Hamburger'); await u.choose('Medium'); await u.choose('Fries'); for (const a of addOns) await u.chooseRe(new RegExp('^' + a)); }

// ---- 1. Modifier pricing and rules ----
await T('D1a', 1, 'Burger $24 + Extra Cheese $1.50 = $25.50', async (u) => {
  await u.pin('3001'); await u.seat('1'); await burger(u, ['Extra Cheese']); await u.addToOrder().catch(() => {});
  const l = await u.lines(); return {pass: l.length === 1 && cents(l[0].price) === 2550, evidence: JSON.stringify(l.map(x => x.name + ' $' + x.price))};
});
await T('D1b', 1, 'Optional add-on group can be skipped ($24)', async (u) => {
  await u.pin('3001'); await u.seat('1'); await burger(u, []); await u.addToOrder();
  const l = await u.lines(); return {pass: l.length === 1 && cents(l[0].price) === 2400, evidence: JSON.stringify(l.map(x => x.name + ' $' + x.price + ' [' + x.mods + ']'))};
});
await T('D1c', 1, 'Multi-select add-ons: cheese + bacon = $27.50', async (u) => {
  await u.pin('3001'); await u.seat('1'); await burger(u, ['Extra Cheese', 'Bacon']); await u.addToOrder();
  const l = await u.lines(); return {pass: l.length === 1 && cents(l[0].price) === 2750 && /Extra Cheese/.test(l[0].mods) && /Bacon/.test(l[0].mods), evidence: JSON.stringify(l)};
});
await T('D1d', 1, 'Required temperature still enforced (Wagyu)', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await u.openCategory('c_ent'); await u.tile('Wagyu Ribeye');
  const b = p.getByRole('button', {name: /^(Add to order|Add & keep ordering)$/}); if (await b.count()) await b.first().click().catch(() => {}); await p.waitForTimeout(200);
  const before = (await u.lines()).length; await u.choose('Medium Rare'); const b2 = p.getByRole('button', {name: /^(Add to order|Add & keep ordering)$/}); if (await b2.count()) await b2.first().click(); await p.waitForTimeout(300);
  const l = await u.lines(); return {pass: before === 0 && l.length === 1 && cents(l[0].price) === 5800, evidence: `lines before temperature=${before}; after=${JSON.stringify(l.map(x => x.name + ' $' + x.price + ' [' + x.mods + ']'))}`};
});
// ---- 2. Price snapshot after send ----
await T('D2', 2, 'Sent burger keeps $25.50 after BOH price change to $30', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await burger(u, ['Extra Cheese']); await u.addToOrder().catch(() => {}); await u.send();
  await u.ev(() => { const d = __MOCK_DB__.__dump().boh_shared.menu; d.items.find(i => i.id === 'm4').price = 30; return __MOCK_DB__.collection('boh_shared').doc('menu').set(d); }); await p.waitForTimeout(700);
  await u.floor(); await u.tapTable('1');
  const items = await u.checkItems(); const o = Object.values((await u.db()).orders || {})[0];
  return {pass: items.length === 1 && cents(items[0].price) === 2550 && o && cents(o.items[0].price) === 2550 && /Extra Cheese/.test(o.items[0].selectedMod || ''), evidence: `menu now $30; check=${JSON.stringify(items.map(i => i.name + ' $' + i.price))}; ticket=${o && o.items.map(i => i.name + ' $' + i.price + ' [' + (i.selectedMod || '') + ']')}`};
});
// ---- 3. Split checks and payments ----
async function torteAndTuna(u) { await u.openCategory('c_des'); await u.tile('Chocolate Studio Torte'); await u.openCategory('c_ent'); await u.tile('Seared Tuna'); await u.choose('Medium Rare'); const b = u; }
await T('D3a', 3, 'Paying the split-off tuna check leaves the torte unpaid on the other check', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await torteAndTuna(u); await p.getByRole('button', {name: /^(Add to order|Add & keep ordering)$/}).first().click().catch(() => {}); await u.send(); await u.tapTable('1');
  await u.selectLine('Seared Tuna'); await u.split(); await p.locator('button[onclick="splitSelected()"]').click(); await p.waitForTimeout(400); await u.closeSheets(); await u.closeOverlays();
  const view = await u.ev(() => ({id: activeCheckId(), items: guestCheckItems().map(i => i.name)}));
  const r = await u.pay();
  await u.floor(); await u.tapTable('1');
  const checks = await u.ev(() => tableCheckIds('1').map(id => ({id, items: guestCheckItems(id).map(i => i.name + ' $' + i.price)})));
  const d = await u.db(); const items = Object.values(d.orders || {}).flatMap(o => (o.items || []).map(i => i.name + ':' + (i.paid ? 'paid' : 'unpaid')));
  const torteOpen = checks.some(c => c.items.some(x => /Torte \$12/.test(x)));
  const paidCheck = Object.values(d.checks || {}).find(c => c.id === view.id);
  return {pass: view.items.join() === 'Seared Tuna' && torteOpen && items.includes('Chocolate Studio Torte:unpaid') && items.includes('Seared Tuna:paid') && paidCheck && paidCheck.status === 'paid', evidence: `paid ${view.items} (${r.label}); open checks=${JSON.stringify(checks)}; order items=${items}; paid check status=${paidCheck && paidCheck.status}`};
}, {card: true});
await T('D3b', 3, 'Even split /2: two shares close the check; remaining balance shown; next table not split', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await u.openCategory('c_des'); await u.tile('Chocolate Studio Torte'); await u.send(); await u.tapTable('1');
  const r1 = await u.pay({even: 2}); await u.floor(); await u.tapTable('1');
  const mid = await u.ev(() => Object.values(__MOCK_DB__.__dump().checks).map(c => c.status + ':' + JSON.stringify(c.evenSplit || null)));
  const r2 = await u.pay({even: 2});
  const d = await u.db(); const pays = Object.values(d.payments || {}).map(x => x.amount);
  await u.seat('2'); await u.openCategory('c_des'); await u.tile('Chocolate Studio Torte'); await u.send(); await u.tapTable('2');
  await p.locator('button[onclick^="openPayment"]').first().click(); await p.waitForTimeout(400);
  const t2 = await p.locator('#charge-btn').innerText();
  const firstCheck = Object.values(d.checks || {}).find(c => String(c.table) === '1' && (c.guest && c.guest.items || []).length);
  return {pass: r1.label.includes('7.08') && /Remaining/i.test(r2.screen) && pays.length === 2 && pays[0] + pays[1] === 1416 && firstCheck && firstCheck.status === 'paid' && t2.includes('14.16'), evidence: `share1 ${r1.label}; after share1 ${mid}; share2 screen "${r2.screen.match(/Remaining[^C]*/i)?.[0] || 'no remaining line'}" ${r2.label}; payments=${pays}; table1 check=${firstCheck && firstCheck.status}; table2 first charge=${t2}`};
}, {card: true});
await T('D3c', 3, 'Split by seat twice does not duplicate checks', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await u.ev(() => setActiveSeat(1)); await u.openCategory('c_des'); await u.tile('Chocolate Studio Torte');
  await p.locator('button[onclick="setActiveSeat(2)"]').first().click(); await u.openCategory('c_des'); await u.tile('Chocolate Studio Torte'); await u.send(); await u.tapTable('1');
  await u.split(); await p.locator('button[onclick="splitBySeat()"]').click(); await p.waitForTimeout(300); const a = await u.ev(() => tableCheckIds('1').length);
  await u.split(); await p.locator('button[onclick="splitBySeat()"]').click(); await p.waitForTimeout(300); const b = await u.ev(() => tableCheckIds('1').length);
  const per = await u.ev(() => tableCheckIds('1').map(id => guestCheckItems(id).length));
  return {pass: a === b && per.filter(n => n > 0).length === 2, evidence: `checks after 1st=${a}, after 2nd=${b}, items per check=${per}`};
});
await T('D3d', 3, 'A sent line moved to another check stays there after the next orders poll', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await torteAndTuna(u); await p.getByRole('button', {name: /^(Add to order|Add & keep ordering)$/}).first().click().catch(() => {}); await u.send(); await u.tapTable('1');
  await u.selectLine('Seared Tuna'); await u.split(); await p.locator('button[onclick="splitSelected()"]').click(); await p.waitForTimeout(300); await u.closeSheets(); await u.closeOverlays();
  const before = await u.ev(() => guestCheckItems().map(i => i.name));
  await u.ev(() => { const k = Object.keys(__MOCK_DB__.__dump().orders)[0]; return __MOCK_DB__.collection('orders').doc(k).update({kdsPing: Date.now()}); }); await p.waitForTimeout(700);
  const after = await u.ev(() => guestCheckItems().map(i => i.name));
  return {pass: before.join() === 'Seared Tuna' && after.join() === 'Seared Tuna', evidence: `new check before poll=${before}; after poll=${after}`};
});
// ---- 4. Tasting tile ----
await T('D4', 4, 'Tasting tile (touch) adds the tasting menu and opens temperatures', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); const plus = p.locator('button', {hasText: '+ Item'}); if (await plus.count()) await plus.first().click();
  await p.locator(`button[onclick*="filterCat('__tasting__')"]`).first().click(); await p.waitForTimeout(300);
  await p.locator('[onclick^="addTastingMenu"]').first().click(); await p.waitForTimeout(600);
  const sheet = await u.sheetText(); const l = await u.lines();
  await p.locator('label.chip', {hasText: /^\s*Medium Rare\s*$/}).first().click().catch(() => {});
  await p.getByRole('button', {name: 'Confirm', exact: true}).first().click(); await p.waitForTimeout(400);
  const after = await u.sheetText(); const temps = await u.ev(() => JSON.stringify((STATE.activeTastingOrders || []).map(o => diningCourses(o).filter(c => c.selectedTemp).map(c => c.selectedTemp))));
  return {pass: l.some(x => /Tasting|Scalini/i.test(x.name)) && /Temperature/i.test(sheet) && !/Temperatures/.test(after) && /Medium Rare/.test(temps), evidence: `lines=${JSON.stringify(l.map(x => x.name + ' $' + x.price))}; sheet="${sheet.slice(0, 60)}"; after Confirm sheet="${after.slice(0, 40)}"; temps=${temps}`};
});
// ---- 5. Table transfer ----
await T('D5', 5, 'Move table 1→2 moves sent tickets, guests, allergies and positions', async (u, p) => {
  await u.pin('3001'); await u.seat('1', 3); await p.locator('button[onclick*=\'toggleAllergy("1","Fish"\']').first().click(); await u.openCategory('c_des'); await u.tile('Chocolate Studio Torte'); await u.sendAnyway(); await u.send(); await u.tapTable('1');
  await u.openCategory('c_ent'); await u.tile('Seared Tuna'); await u.choose('Medium Rare'); await u.sendAnyway(); // an unsent line too (seat 1 is Fish-flagged: warning confirmed)
  const how = await u.tap('button[onclick="openMoveTableSheet()"]:visible'); await p.waitForTimeout(300); await p.waitForTimeout(400);
  await p.locator('[onclick*="transferCheckTo"]').filter({hasText: /^\s*(Table\s*)?2\b/}).first().click(); await p.waitForTimeout(800);
  const d = await u.db(); const orders = Object.values(d.orders || {}).map(o => o.table);
  const s = await u.ev(() => { const x = sessionOf('2'); return x && {guests: x.guestCount, allergies: x.allergies}; });
  const items2 = await u.ev(() => { STATE.selectedTable = '2'; return guestCheckItems().map(i => i.name + ':' + i.status); });
  const feed = JSON.stringify((d.boh_shared || {}).active_orders || {});
  return {pass: orders.length > 0 && orders.every(t => String(t) === '2') && s && s.guests === 3 && (s.allergies['1'] || []).includes('Fish') && items2.includes('Chocolate Studio Torte:sent') && items2.includes('Seared Tuna:unsent') && !/"table":"1"/.test(feed), evidence: `ticket tables=${orders}; session2=${JSON.stringify(s)}; table 2 check=${items2}; Move button ${how}; toast=${(await u.toast()).slice(0, 60)}`};
});
// ---- 6. Allergies ----
await T('D6a', 6, 'Fish flag + Ceviche: warning, override recorded on line, check and kitchen ticket', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await p.locator('button[onclick*=\'toggleAllergy("1","Fish"\']').first().click();
  await u.openCategory('c_cev'); await u.tile('Peruvian Ceviche'); const add = p.getByRole('button', {name: /^(Add to order|Add & keep ordering)$/}); if (await add.count()) await add.first().click(); else await u.choose('No Salt');
  await p.waitForTimeout(300); const warn = await u.sheetText(); const ok = await u.sendAnyway(); const l = await u.lines();
  await u.send(); const d = await u.db(); const o = Object.values(d.orders || {}).find(x => (x.items || []).some(i => /Ceviche/.test(i.name)));
  const it = o && o.items.find(i => /Ceviche/.test(i.name)); const chk = Object.values(d.checks || {})[0];
  return {pass: /Allergy warning/i.test(warn) && ok && l[0] && l[0].override && it && it.allergyOverride && (it.guestAllergies || []).includes('Fish') && o.seatAllergies && chk && chk.allergies && (chk.allergies['1'] || []).includes('Fish') && ((chk.guest && chk.guest.items) || []).some(i => /Ceviche/.test(i.name) && i.allergyOverride), evidence: `check item override=${JSON.stringify(((chk && chk.guest && chk.guest.items) || []).filter(i => /Ceviche/.test(i.name)).map(i => !!i.allergyOverride))}; warning="${warn.slice(0, 80)}"; line override=${JSON.stringify(l[0] && l[0].override)}; ticket item=${JSON.stringify(it && {guestAllergies: it.guestAllergies, allergenStatus: it.allergenStatus, override: !!it.allergyOverride})}; ticket seatAllergies=${JSON.stringify(o && o.seatAllergies)}; check allergies=${JSON.stringify(chk && chk.allergies)}`};
});
await T('D6b', 6, 'Dairy flag + Wagyu with UNVERIFIED/empty allergens: warns as unverified', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await p.locator('button[onclick*=\'toggleAllergy("1","Dairy"\']').first().click();
  await u.openCategory('c_ent'); await u.tile('Wagyu Ribeye'); await u.choose('Medium'); const add = p.getByRole('button', {name: /^(Add to order|Add & keep ordering)$/}); if (await add.count()) await add.first().click(); else await u.choose('Fries');
  await p.waitForTimeout(300); const warn = await u.sheetText(); const added = (await u.lines()).length;
  return {pass: /Allergy warning/i.test(warn) && /unverified|not verified/i.test(warn) && added === 0, evidence: `sheet="${warn.slice(0, 140)}"; lines added before confirm=${added}`};
});
await T('D6c', 6, 'No allergen-free claim for unverified items (dietary labels marked unverified)', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await u.openCategory('c_ent'); await u.tile('Wagyu Ribeye'); const sheet = await u.sheetText();
  return {pass: /Gluten-Free/.test(sheet) ? /unverified/i.test(sheet) : true, evidence: `sheet="${sheet.slice(0, 200)}"`};
});
await T('D6d', 6, 'Seat allergies survive reload (restored from the check document)', async (u, p, o) => {
  await u.pin('3001'); await u.seat('1'); await p.locator('button[onclick*=\'toggleAllergy("1","Shellfish"\']').first().click(); await p.waitForTimeout(300);
  const dump = await u.db();
  const o2 = await openPos(browser, {seed: dump}); const u2 = ui(o2.page); await u2.pin('3001'); await u2.floor(); await u2.tapTable('1');
  const a = await u2.ev(() => { const s = sessionOf('1'); return s && s.allergies; }); await o2.context.close();
  return {pass: a && (a['1'] || []).includes('Shellfish'), evidence: `restored allergies=${JSON.stringify(a)}`};
});
// ---- 9. Sessions ----
await T('D9a', 9, 'Logout: next employee does not inherit unsent lines; owner gets them back', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await u.openCategory('c_des'); await u.tile('Chocolate Studio Torte');
  await u.ev(() => logout()); await p.waitForTimeout(300); await u.pin('3002');
  const paco = await u.ev(() => STATE.currentOrder.length); await u.floor(); await u.tapTable('1'); const notice = await u.toast(); const pacoLines = await u.ev(() => unsentFor('1').length);
  await u.ev(() => logout()); await p.waitForTimeout(300); await u.pin('3001'); await u.floor(); await u.tapTable('1');
  const andre = await u.ev(() => unsentFor('1').map(i => i.name));
  return {pass: paco === 0 && pacoLines === 0 && andre.includes('Chocolate Studio Torte'), evidence: `Paco in-memory lines=${paco}, Paco table-1 unsent=${pacoLines}, notice="${notice.slice(0, 70)}"; Andre after return=${andre}`};
});
await T('D9b', 9, 'Order tab without a table asks to choose one (no check created)', async (u, p) => {
  await u.pin('3001'); const how = await u.tap('button[onclick="switchTab(\'order\')"]:visible'); await p.waitForTimeout(500);
  const tab = await u.ev(() => STATE.activeTab); const checks = Object.keys((await u.db()).checks || {}).length; const t = await u.toast();
  return {pass: tab !== 'order' && checks === 0 && /table/i.test(t), evidence: `Order nav ${how}; tab=${tab} checks created=${checks} toast="${t.slice(0, 60)}"`};
});
// ---- Regression smoke on existing working functions (from the audit) ----
await T('R1', 'reg', 'Login, floor from BOH, seat, add torte $12, send ticket', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await u.openCategory('c_des'); await u.tile('Chocolate Studio Torte'); const l = await u.lines(); await u.send();
  const o = Object.values((await u.db()).orders || {}); const tables = await u.ev(() => document.querySelectorAll('[class*="f-table"]').length);
  return {pass: l.length === 1 && cents(l[0].price) === 1200 && o.length === 1 && tables >= 12, evidence: `line=${JSON.stringify(l.map(x => x.price))} orders=${o.length} floor tables=${tables}`};
});
await T('R2', 'reg', 'Single full payment with tip (mock SDK) closes the check', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await u.openCategory('c_des'); await u.tile('Chocolate Studio Torte'); await u.send(); await u.tapTable('1');
  const r = await u.pay({tip: '20%'}); const d = await u.db(); const pay = Object.values(d.payments || {})[0];
  return {pass: r.label.includes('14.40') && pay && pay.amount === 1440 && Object.values(d.checks).some(c => c.status === 'paid') && Object.values(d.orders).every(o => o.status === 'paid'), evidence: `${r.label}; payment=${pay && pay.amount}; checks=${Object.values(d.checks).map(c => c.status)}; orders=${Object.values(d.orders).map(o => o.status)}`};
}, {card: true});
await T('R3', 'reg', '86 item blocked; required temperature; prix fixe adds $89', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await u.openCategory('c_ent'); await u.tile('Seared Tuna'); const pend = await u.ev(() => !!STATE.pendingItem);
  await u.closeSheets(); await u.ev(() => { STATE.pendingItem = null; }); const plus = p.locator('button', {hasText: '+ Item'}); if (await plus.count()) await plus.first().click();
  await p.locator(`button[onclick*="filterCat('__prixfixe__')"]`).first().click(); await p.waitForTimeout(300); await u.tap('[onclick*="openPrixFixeSelector"]:visible'); await p.waitForTimeout(300);
  await p.getByRole('button', {name: 'Add to Order'}).first().click().catch(() => {}); await p.waitForTimeout(300); const g = await u.ev(() => checkTotals().grand);
  return {pass: !pend && g === 89, evidence: `86 tuna opened sheet=${pend}; grand after prix fixe=${g}`};
}, {seed: d => { d.boh_shared.menu.items.find(i => i.id === 'm6').available = false; return d; }});
await T('R4', 'reg', 'Clear accidental table + change guest count + messages', async (u, p) => {
  await u.pin('3001'); await u.seat('1'); await p.locator('button[onclick="openPartySheet()"]').first().click(); await p.locator('button[onclick="chooseGuestCount(4)"]').first().click().catch(() => {}); await p.waitForTimeout(300);
  const g = await u.ev(() => sessionOf('1').guestCount); await p.locator('button[onclick="clearAccidentalTable()"]').first().click(); await p.waitForTimeout(300);
  const st = Object.values((await u.db()).checks || {}).map(c => c.status);
  return {pass: g === 4 && st.includes('void'), evidence: `guests=${g} check statuses=${st}`};
});

const summary = {label, at: new Date().toISOString(), pos: rev(POS_ROOT), boh: rev(BOH_ROOT), passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results};
fs.appendFileSync(HERE + 'runs.jsonl', JSON.stringify(summary) + '\n');
console.log(`\n${label}: ${summary.passed} passed, ${summary.failed} failed (POS ${summary.pos}, BOH ${summary.boh})`);
await browser.close();
