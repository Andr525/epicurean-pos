// Phase 0 data-integrity regression tests (see DATA-INTEGRITY.md).
// One item is ordered through the real POS screens with nested modifiers, a custom instruction,
// a seat allergy and a documented override, employee identity and an unknown future metadata field.
// The COMPLETE records (ticket, check, line) captured before payment are deep-compared with the
// records after (1) a normal settlement, (2) ticket paid / check write rejected → fresh-device recovery,
// (3) check closed / ticket write rejected → fresh-device recovery. Comparisons are structural:
// every key at every depth, with an explicit, minimal list of fields payment is allowed to change.
// Offline only: CLEARLY IDENTIFIED mock Firestore and MOCK card SDK; no real payment.
// Usage: PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... [LABEL=..] node record-integrity.mjs [filterRegex]
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {launch, exportBoh, openPos, ui, MOCK_CARD_SDK, POS_ROOT} from './lib.mjs';
const HERE = new URL('.', import.meta.url).pathname;
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const label = process.env.LABEL || 'unlabelled';
const rev = () => { try { return execFileSync('git', ['-C', POS_ROOT, 'rev-parse', '--short', 'HEAD'], {encoding: 'utf8'}).trim() + (execFileSync('git', ['-C', POS_ROOT, 'status', '--porcelain', '--', 'index.html'], {encoding: 'utf8'}).trim() ? '+wip' : ''); } catch { return 'n/a'; } };
const browser = await launch();
const boh = await exportBoh(browser);
const results = [];
const clone = v => JSON.parse(JSON.stringify(v));

// ---- structural comparison: every differing path, at any depth ----
function diff(a, b, path = '', out = []) {
  if (a === b) return out;
  const ta = Array.isArray(a) ? 'array' : a === null ? 'null' : typeof a, tb = Array.isArray(b) ? 'array' : b === null ? 'null' : typeof b;
  if (ta !== tb || (ta !== 'object' && ta !== 'array')) { out.push(path || '.'); return out; }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const p = ta === 'array' ? `${path}[${k}]` : (path ? path + '.' + k : k);
    if (!(k in a) || !(k in b)) out.push(p + (k in a ? ' (removed)' : ' (added)')); else diff(a[k], b[k], p, out);
  }
  return out;
}
const allowed = (paths, patterns) => paths.filter(p => !patterns.some(re => re.test(p)));
// A record is complete if the full original line appears unchanged in the row, either nested as one
// object (any key) or field-by-field at the top level.
const holdsRecord = (row, rec) => !!row && (Object.values(row).some(v => v && typeof v === 'object' && !Array.isArray(v) && diff(v, rec).length === 0) || Object.keys(rec).every(k => diff(row[k], rec[k]).length === 0));
// Paths of the original record that are missing or different in the row (extra fields in the row are fine).
const missingFromRow = (row, rec) => { if (!row) return ['(no row)']; const nested = Object.values(row).find(v => v && typeof v === 'object' && !Array.isArray(v) && v.lineId === rec.lineId); return diff(nested || row, rec).filter(p => !/\(removed\)$/.test(p)).map(p => p.replace(/ \(added\)$/, ' (missing)')); };
const normalize = (v, ids) => JSON.parse(JSON.stringify(v, (k, x) => typeof x === 'string' && ids[x] ? ids[x] : (typeof x === 'number' && x > 1e12 ? 'TS' : x)));

async function device(seed) { const o = await openPos(browser, {seed, extraHead: MOCK_CARD_SDK}); return {o, u: ui(o.page), p: o.page}; }
async function faultAfterReceipt(p, failWrites) {
  await p.evaluate(fw => {
    const original = __MOCK_DB__.collection.bind(__MOCK_DB__); window.__receiptCommits = 0;
    __MOCK_DB__.collection = function (name) {
      const c = original(name); if (name !== 'payments') return c;
      const doc = c.doc; c.doc = function (id) { const ref = doc(id), set = ref.set; ref.set = function (data, opts) { return set(data, opts).then(r => { if (!window.__receiptCommits++) window.__MOCK_FAIL_WRITES__ = fw; return r; }); }; return ref; };
      return c;
    };
  }, failWrites);
}

async function scenario(id, title, mode) {
  if (only && !only.test(id)) return null;
  const r = {id, title, checks: []}, ctxs = [];
  const check = (name, problems) => r.checks.push({name, pass: problems.length === 0, problems: problems.slice(0, 40)});
  let closed = null, ids = {};
  try {
    const d1 = await device(boh); ctxs.push(d1.o); const {u, p} = d1;
    await u.pin('3001');
    // Unrelated order on table 2 (must not change at all).
    await u.seat('2'); await u.openCategory('c_ent'); await u.tile('Seared Tuna'); await u.choose('Medium Rare'); await u.send();
    // Table 1, position 2A flagged Dairy; burger with nested modifiers and a custom instruction.
    await u.seat('1'); await u.ev(() => { STATE.activeSeat = '2A'; toggleAllergy('2A', 'Dairy', 1); });
    await u.openCategory('c_ent'); await u.tile('House Hamburger'); await u.choose('Medium'); await u.choose('Fries'); await u.chooseRe(/^Extra Cheese/); await u.chooseRe(/^Bacon/);
    await p.locator('#mod-notes').fill('no onions; sauce on the side'); await p.locator('#mod-notes').dispatchEvent('input');
    await u.addToOrder(); const overridden = await u.sendAnyway(); // documented allergy override
    // Metadata a future app version could add: nested objects and arrays, on the line and on the check.
    await u.ev(() => {
      const l = STATE.currentOrder.find(x => x.name === 'House Hamburger');
      l.futureMeta = {schema: 9, audit: [{at: 1700000000000, by: '3001', action: 'upsell-offered', tags: ['a', 'b']}], nested: {deep: {flag: true, list: [1, {x: 'y'}]}}};
      const c = STATE.checks[activeCheckId()]; c.futureCheckMeta = {source: 'future', history: [{n: 1}, {n: 2, sub: {ok: true}}]}; persistCheck(c);
    });
    const line = await u.ev(() => { const l = JSON.parse(JSON.stringify(STATE.currentOrder.find(x => x.name === 'House Hamburger'))); Object.keys(l).forEach(k => { if (k[0] === '_') delete l[k]; }); return l; });
    check('setup: line has the instruction, nested modifiers, override and owner', [
      ...(line.notes === 'no onions; sauce on the side' ? [] : ['notes']), ...(JSON.stringify((line.modifierSelections || []).map(m => m.name)) === JSON.stringify(['Medium', 'Fries', 'Extra Cheese', 'Bacon']) ? [] : ['modifierSelections=' + JSON.stringify((line.modifierSelections || []).map(m => m.name))]),
      ...(overridden && line.allergyOverride && line.allergyOverride.byCode === '3001' ? [] : ['allergyOverride']), ...(line.ownerCode === '3001' ? [] : ['ownerCode'])]);
    await u.send(); await u.tapTable('1');
    const cid = await u.ev(() => activeCheckId());
    // Another system adds fields to the ticket and the check after this device last wrote them.
    await u.ev(cid => {
      const d = __MOCK_DB__.__dump(); const [tid, t] = Object.entries(d.orders).find(([, o]) => (o.items || []).some(i => i.name === 'House Hamburger'));
      t.kitchenAudit = {bumpedBy: 'KDS-2', marks: [{at: 1700000000001, station: 'Grill'}]}; t.items.forEach(i => { i.kdsState = {cooked: true, by: 'line-cook'}; }); __MOCK_DB__.__rawSet('orders', tid, t);
      const c = d.checks[cid]; c.externalAudit = {reviewer: 'manager', notes: ['comp declined']}; __MOCK_DB__.__rawSet('checks', cid, c);
    }, cid);
    const before = await u.db();
    const ticketId = Object.entries(before.orders).find(([, o]) => (o.items || []).some(i => i.lineId === line.lineId))[0];
    const tBefore = before.orders[ticketId], cBefore = before.checks[cid];
    const unrelatedBefore = {orders: Object.fromEntries(Object.entries(before.orders).filter(([, o]) => String(o.table) === '2')), checks: Object.fromEntries(Object.entries(before.checks).filter(([, c]) => String(c.table) === '2'))};
    // Before payment the ticket item and the open check row must already hold the complete line record.
    check('ticket item holds the complete line record', holdsRecord(tBefore.items.find(i => i.lineId === line.lineId), line) ? [] : missingFromRow(tBefore.items.find(i => i.lineId === line.lineId), line));
    const rowBefore = (cBefore.guest.items || []).find(i => i.lineId === line.lineId);
    check('open check row holds the complete line record', holdsRecord(rowBefore, line) ? [] : missingFromRow(rowBefore, line));

    // ---- payment (real payment screen), then the scenario's failure and fresh-device recovery
    if (mode !== 'normal') await faultAfterReceipt(p, mode === 'A' ? ['checks/*'] : ['orders/*']);
    await u.pay();
    let after = await u.db(); let tokens = await u.ev(() => window.__mockTokenized || 0);
    if (mode !== 'normal') {
      const d2 = await device(after); ctxs.push(d2.o); await d2.u.pin('3001');
      const b = d2.p.locator('#settlement-banner button', {hasText: /Finish settlement/i});
      if (await b.count()) { await b.first().click(); await d2.p.waitForFunction(() => !STATE._settling, null, {timeout: 15000}); await d2.p.waitForTimeout(400); }
      else { await d2.p.evaluate(() => selectTable('1')); await d2.p.waitForTimeout(300); const pay = d2.p.locator('button[onclick^="openPayment"]:visible'); if (await pay.count()) { await pay.first().click(); await d2.p.waitForTimeout(500); await d2.p.locator('#charge-btn').click().catch(() => {}); await d2.p.waitForTimeout(1200); } }
      after = await d2.u.db(); tokens += await d2.u.ev(() => window.__mockTokenized || 0);
    }
    const receipts = Object.values(after.payments || {});
    check('exactly one receipt, settlement complete, card tokenized once in total', [
      ...(receipts.length === 1 ? [] : ['receipts=' + receipts.length]), ...(receipts[0] && receipts[0].settlement === 'complete' ? [] : ['settlement=' + (receipts[0] && receipts[0].settlement)]), ...(tokens === 1 ? [] : ['tokenized=' + tokens])]);
    const tAfter = after.orders[ticketId], cAfter = after.checks[cid];
    // Ticket: only the paid line's payment-state fields and the ticket's paid status may change.
    check('ticket: nothing but payment state changed (deep)', allowed(diff(tBefore, tAfter), [/^items\[\d+\]\.(paid|paidCheckId|paymentId) \(added\)$/, /^status$/, /^paidAt( \(added\))?$/]));
    check('ticket: the paid line is marked paid by this receipt', tAfter.items.filter(i => i.lineId === line.lineId).every(i => i.paid === true && i.paymentId === receipts[0].paymentId) ? [] : ['paid flags']);
    // Check: only closure fields may change; the itemized record (guest) must be exactly as before payment.
    check('closed check: nothing but closure fields changed (deep, incl. guest items)', allowed(diff(cBefore, cAfter), [/^status$/, /^updatedAt$/, /^closedAt( \(added\))?$/, /^paymentIds( \(added\)|\[\d+\]( \(added\))?)?$/]));
    const rowAfter = ((cAfter.guest || {}).items || []).find(i => i.lineId === line.lineId);
    check('closed check row holds the complete line record', holdsRecord(rowAfter, line) ? [] : missingFromRow(rowAfter, line));
    check('closed check row keeps instruction, nested modifiers, override, owner, future metadata', [
      ['notes', 'no onions; sauce on the side'], ['modifierSelections', line.modifierSelections], ['allergyOverride', line.allergyOverride], ['ownerCode', '3001'], ['futureMeta', line.futureMeta]]
      .filter(([k, v]) => !(rowAfter && (diff(rowAfter[k], v).length === 0 || Object.values(rowAfter).some(n => n && typeof n === 'object' && diff(n[k], v).length === 0)))).map(([k]) => k));
    check('unrelated table 2 order and check unchanged (deep)', diff(unrelatedBefore, {orders: Object.fromEntries(Object.keys(unrelatedBefore.orders).map(k => [k, after.orders[k]])), checks: Object.fromEntries(Object.keys(unrelatedBefore.checks).map(k => [k, after.checks[k]]))}));
    ids = {[line.lineId]: 'LINE', [cid]: 'CHECK', [ticketId]: 'TICKET', [receipts[0] && receipts[0].paymentId]: 'PAYMENT'};
    closed = {check: normalize(cAfter, ids), ticket: normalize(tAfter, ids)};
    const errs = ctxs.flatMap(o => o.errors); check('no uncaught page errors', errs);
  } catch (e) { r.checks.push({name: 'ERROR', pass: false, problems: [String(e.message).split('\n')[0].slice(0, 200)]}); }
  for (const o of ctxs) await o.context.close().catch(() => {});
  r.pass = r.checks.length > 0 && r.checks.every(c => c.pass); results.push(r);
  console.log((r.pass ? 'PASS ' : 'FAIL ') + id + ' ' + title);
  for (const c of r.checks) if (!c.pass) console.log('   ✗ ' + c.name + ': ' + c.problems.join(', '));
  return closed;
}

const normal = await scenario('DI-1', 'Normal settlement preserves the complete itemized and audit record', 'normal');
const a = await scenario('DI-2', 'Ticket paid, check write rejected → fresh-device recovery preserves the complete record', 'A');
const b = await scenario('DI-3', 'Check closed, ticket write rejected → fresh-device recovery preserves the complete record', 'B');
if (!only || only.test('DI-4')) {
  const r = {id: 'DI-4', title: 'Recovered settlements have the same financial and audit outcome as a normal settlement', checks: []};
  for (const [name, x] of [['ticket write rejected', a], ['check write rejected', b]]) {
    const p = normal && x ? [...diff(normal.check, x.check).map(s => 'check.' + s), ...diff(normal.ticket, x.ticket).map(s => 'ticket.' + s)] : ['scenario did not complete'];
    r.checks.push({name: 'recovery after ' + name + ' equals normal settlement (deep, ids/timestamps normalized)', pass: p.length === 0, problems: p.slice(0, 40)});
  }
  r.pass = r.checks.every(c => c.pass); results.push(r);
  console.log((r.pass ? 'PASS ' : 'FAIL ') + r.id + ' ' + r.title); for (const c of r.checks) if (!c.pass) console.log('   ✗ ' + c.name + ': ' + c.problems.join(', '));
}
if (!only || only.test('DI-5')) {
  // Invariant 4: a receipt whose itemized snapshot is incomplete (here: an older receipt with only a
  // reduced item list) stays pending with an explicit error; recovery writes nothing and charges nothing.
  const r = {id: 'DI-5', title: 'Incomplete receipt snapshot: settlement stays pending with an explicit error, nothing is overwritten', checks: []}, ctxs = [];
  const check = (name, problems) => r.checks.push({name, pass: problems.length === 0, problems: problems.slice(0, 40)});
  try {
    const d1 = await device(boh); ctxs.push(d1.o);
    await d1.u.pin('3001'); await d1.u.seat('1'); await d1.u.openCategory('c_des'); await d1.u.tile('Chocolate Studio Torte');
    await d1.u.send(); await d1.u.tapTable('1');
    await faultAfterReceipt(d1.p, ['checks/*', 'orders/*']); await d1.u.pay();
    const recorded = await d1.u.db();
    const [pid, rc] = Object.entries(recorded.payments)[0];
    rc.snapshot = {checkId: rc.checkId, items: (rc.snapshot.guest.items || []).map(i => ({lineId: i.lineId, name: i.name, price: i.price, qty: i.qty}))}; // reduced, as older receipts were
    recorded.payments[pid] = rc;
    const d2 = await device(recorded); ctxs.push(d2.o); await d2.u.pin('3001');
    const before = await d2.u.db();
    const b = d2.p.locator('#settlement-banner button', {hasText: /Finish settlement/i}); const shown = await b.count();
    if (shown) { await b.first().click(); await d2.p.waitForFunction(() => !STATE._settling, null, {timeout: 15000}); await d2.p.waitForTimeout(400); }
    const after = await d2.u.db(); const banner = await d2.p.evaluate(() => (document.getElementById('settlement-banner') || {}).innerText || '');
    check('pending settlement is discoverable', shown ? [] : ['no Finish settlement']);
    check('receipt stays pending with an explicit error', [...(after.payments[pid].settlement === 'pending' ? [] : ['settlement=' + after.payments[pid].settlement]), ...(after.payments[pid].settlementError ? [] : ['no settlementError'])]);
    check('staff see the reason', /manager review/i.test(banner) ? [] : ['banner="' + banner.slice(0, 120) + '"']);
    check('check unchanged by the refused recovery (deep)', diff(before.checks, after.checks));
    check('tickets unchanged by the refused recovery (deep)', diff(before.orders, after.orders));
    check('receipt unchanged except settlement status fields', allowed(diff(before.payments[pid], after.payments[pid]), [/^settlement( \(added\))?$/, /^settlementError( \(added\))?$/, /^lastAttemptAt( \(added\))?$/]));
    check('recovery never tokenizes', (await d2.u.ev(() => window.__mockTokenized || 0)) === 0 ? [] : ['tokenized']);
    check('no uncaught page errors', ctxs.flatMap(o => o.errors));
  } catch (e) { r.checks.push({name: 'ERROR', pass: false, problems: [String(e.message).split('\n')[0].slice(0, 200)]}); }
  for (const o of ctxs) await o.context.close().catch(() => {});
  r.pass = r.checks.every(c => c.pass); results.push(r);
  console.log((r.pass ? 'PASS ' : 'FAIL ') + r.id + ' ' + r.title); for (const c of r.checks) if (!c.pass) console.log('   ✗ ' + c.name + ': ' + c.problems.join(', '));
}
const summary = {label, at: new Date().toISOString(), pos: rev(), suite: 'record-integrity', passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results};
fs.appendFileSync(HERE + 'runs.jsonl', JSON.stringify(summary) + '\n');
console.log(`\n${label}: ${summary.passed} passed, ${summary.failed} failed (POS ${summary.pos})`);
await browser.close();
if (summary.failed) process.exitCode = 1;
