// Phase 0 payment-recovery regression tests (asymmetric partial writes after a stored receipt).
// TEST A: the ticket is marked paid but the check write is rejected.
// TEST B: the check closes but the ticket update is rejected.
// Each payment is recorded on device 1, then recovered on FRESH browser contexts built only from the
// persisted mock documents (no local state carried over). A first recovery attempt fails again
// (repeated failure); a second fresh device completes it. No step may tokenize the card again.
// Offline only: CLEARLY IDENTIFIED mock Firestore and MOCK card SDK; no real payment.
// Usage: PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... [LABEL=..] node payment-recovery.mjs [filterRegex]
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {launch, exportBoh, openPos, ui, MOCK_CARD_SDK, POS_ROOT} from './lib.mjs';
const HERE = new URL('.', import.meta.url).pathname;
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const label = process.env.LABEL || 'unlabelled';
const rev = () => { try { return execFileSync('git', ['-C', POS_ROOT, 'rev-parse', '--short', 'HEAD'], {encoding: 'utf8'}).trim() + (execFileSync('git', ['-C', POS_ROOT, 'status', '--porcelain', '--', 'index.html'], {encoding: 'utf8'}).trim() ? '+wip' : ''); } catch { return 'n/a'; } };
const browser = await launch();
const boh = await exportBoh(browser);
const TORTE = 'Chocolate Studio Torte';
// The torte costs exactly $10 in this fixture; everything else is the BOH-published data.
const seed10 = () => { const d = JSON.parse(JSON.stringify(boh)); d.boh_shared.menu.items.find(i => i.name === TORTE).price = 10; return d; };
const results = [];

async function device(seed, {failWrites = null} = {}) {
  const head = MOCK_CARD_SDK + (failWrites ? `<script>window.__MOCK_FAIL_WRITES__=${JSON.stringify(failWrites)};</script>` : '');
  const o = await openPos(browser, {seed, extraHead: head});
  return {o, u: ui(o.page), p: o.page};
}
const tokenized = p => p.evaluate(() => window.__mockTokenized || 0);
const db = p => p.evaluate(() => __MOCK_DB__.__dump());
const screenText = p => p.evaluate(() => [document.getElementById('payment-card'), document.getElementById('settlement-banner'), document.getElementById('toast')].map(e => e ? e.innerText : '').join(' | ').replace(/\s+/g, ' '));
// The payment receipt is committed normally; right after it, the chosen document class starts rejecting writes.
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
async function finishSettlement(p) {
  const b = p.locator('#settlement-banner button', {hasText: /Finish settlement/i});
  const shown = await b.count();
  if (shown) { await b.first().click(); await p.waitForFunction(() => !STATE._settling, null, {timeout: 15000}); await p.waitForTimeout(400); return true; }
  // No discoverable settlement: fall back to the older recovery path (Charge on the table) so the
  // financial outcome is still measured; discoverability itself is asserted separately.
  await p.evaluate(() => { selectTable('1'); });
  const g = p.locator('button[onclick="chooseGuestCount(2)"]:visible'); if (await g.count()) await g.first().click();
  await p.waitForTimeout(300);
  const pay = p.locator('button[onclick^="openPayment"]:visible');
  if (await pay.count()) { await pay.first().click(); await p.waitForTimeout(500); const c = p.locator('#charge-btn'); if (await c.count()) { await c.click().catch(() => {}); await p.waitForFunction(() => !Object.values(STATE._payInFlight || {}).some(Boolean)).catch(() => {}); await p.waitForTimeout(500); } }
  return false;
}

async function scenario(id, title, failWrites) {
  if (only && !only.test(id)) return;
  const r = {id, title, checks: []}; const ctxs = [];
  const check = (name, actual, expected) => r.checks.push({name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected});
  try {
    // ---- Device 1: an unrelated table, then the $10 torte at position 2A on table 1, paid with no tip.
    const d1 = await device(seed10()); ctxs.push(d1.o);
    await d1.u.pin('3001');
    await d1.u.seat('2'); await d1.u.openCategory('c_ent'); await d1.u.tile('Seared Tuna'); await d1.u.choose('Medium Rare'); await d1.u.send();
    await d1.u.seat('1'); await d1.u.ev(() => { STATE.activeSeat = '2A'; });
    await d1.u.openCategory('c_des'); await d1.u.tile(TORTE); await d1.u.send(); await d1.u.tapTable('1');
    const before = await d1.u.ev(() => ({cid: activeCheckId(), items: guestCheckItems().map(i => ({lineId: i.lineId, name: i.name, seat: String(i.seat), price: i.price, qty: i.qty}))}));
    check('setup: one $10 torte at 2A on the check', before.items.map(i => [i.name, i.seat, i.price, i.qty]), [[TORTE, '2A', 10, 1]]);
    await faultAfterReceipt(d1.p, failWrites);
    await d1.u.closeOverlays(); await d1.p.locator('button[onclick^="openPayment"]:visible').first().click(); await d1.p.waitForTimeout(500);
    await d1.p.locator('.tip-custom').fill('0'); await d1.p.locator('.tip-custom').dispatchEvent('change'); await d1.p.waitForTimeout(150);
    const label1 = await d1.p.locator('#charge-btn').innerText();
    await d1.p.locator('#charge-btn').click(); await d1.p.waitForFunction(() => !Object.values(STATE._payInFlight || {}).some(Boolean)); await d1.p.waitForTimeout(500);
    const ui1 = await screenText(d1.p);
    check('device 1: charge label is exactly $10.00', /\$10\.00/.test(label1), true);
    check('device 1: card tokenized once', await tokenized(d1.p), 1);
    check('device 1: shows payment recorded / settlement pending, not completed', [/recorded/i.test(ui1), /pending/i.test(ui1), /Payment Successful|Settlement complete/i.test(ui1)], [true, true, false]);
    const recorded = await db(d1.p);
    const receipts1 = Object.values(recorded.payments || {});
    check('device 1: exactly one $10.00 receipt', receipts1.map(x => [x.amount, x.subtotal, x.tip, x.checkId]), [[1000, 1000, 0, before.cid]]);
    const lineId = before.items[0].lineId;

    // ---- Device 2: fresh browser, same write class still failing → recovery is attempted and stays pending.
    const d2 = await device(recorded, {failWrites}); ctxs.push(d2.o);
    await d2.u.pin('3001');
    const found2 = await finishSettlement(d2.p); const ui2 = await screenText(d2.p);
    check('device 2: the pending settlement is discoverable after a restart', found2, true);
    check('device 2: repeated failure stays pending (never reported complete)', [/pending/i.test(ui2), /Settlement complete/i.test(ui2)], [true, false]);
    check('device 2: recovery never tokenizes the card', await tokenized(d2.p), 0);
    const mid = await db(d2.p);

    // ---- Device 3: fresh browser, writes healthy → recovery completes from the stored receipt.
    const d3 = await device(mid); ctxs.push(d3.o);
    await d3.u.pin('3001');
    const found3 = await finishSettlement(d3.p); const ui3 = await screenText(d3.p);
    check('device 3: the pending settlement is still discoverable', found3, true);
    check('device 3: settlement completes', /Settlement complete/i.test(ui3), true);
    check('device 3: recovery never tokenizes the card', await tokenized(d3.p), 0);
    const done = await db(d3.p);
    const receipts = Object.values(done.payments || {});
    check('no additional receipt or charge', receipts.map(x => x.amount), [1000]);
    check('receipt is marked settlement complete', receipts.map(x => x.settlement), ['complete']);
    const chk = done.checks[before.cid];
    check('check is closed (paid)', chk && chk.status, 'paid');
    check('check retains its original item, position, price and qty', ((chk && chk.guest && chk.guest.items) || []).map(i => [i.lineId, i.name, String(i.seat), i.price, i.qty]), [[lineId, TORTE, '2A', 10, 1]]);
    check('check retains its $10 subtotal', chk && chk.guest && chk.guest.totals && chk.guest.totals.subtotal, 10);
    const ticketItem = Object.values(done.orders || {}).flatMap(o => (o.items || []).map(i => ({o, i}))).find(x => x.i.lineId === lineId);
    check('ticket item is marked paid by this receipt', ticketItem && [!!ticketItem.i.paid, ticketItem.i.paymentId === receipts[0].paymentId, ticketItem.o.status], [true, true, 'paid']);
    const unrelated = Object.values(done.orders || {}).filter(o => String(o.table) === '2');
    check('unrelated table 2 ticket stays unpaid', unrelated.flatMap(o => (o.items || []).map(i => [i.name, !!i.paid])), [['Seared Tuna', false]]);
    check('unrelated table 2 check stays open', Object.values(done.checks || {}).filter(c => String(c.table) === '2').map(c => c.status), ['open']);
    // A further fresh device sees nothing left to settle and cannot charge the closed check again.
    const d4 = await device(done); ctxs.push(d4.o); await d4.u.pin('3001');
    check('after completion no settlement is pending', await d4.p.locator('#settlement-banner button', {hasText: /Finish settlement/i}).count(), 0);
    const errs = ctxs.flatMap(o => o.errors); check('no uncaught page errors', errs, []);
    const ext = ctxs.flatMap(o => o.external).filter(h => !/fonts\.(googleapis|gstatic)/.test(h)); check('no external requests', [...new Set(ext)].filter(h => !/squarecdn|square/.test(h)), []);
  } catch (e) { r.checks.push({name: 'ERROR', pass: false, actual: String(e.message).split('\n')[0].slice(0, 200), expected: 'no error'}); }
  for (const o of ctxs) await o.context.close().catch(() => {});
  r.pass = r.checks.length > 0 && r.checks.every(c => c.pass); results.push(r);
  console.log((r.pass ? 'PASS ' : 'FAIL ') + id + ' ' + title);
  for (const c of r.checks) if (!c.pass) console.log('   ✗ ' + c.name + ' expected=' + JSON.stringify(c.expected) + ' actual=' + JSON.stringify(c.actual));
}

await scenario('PR-A', 'Ticket updated, check write rejected → fresh-device recovery keeps the itemized $10 check', ['checks/*']);
await scenario('PR-B', 'Check closed, ticket update rejected → fresh-device recovery marks the ticket paid', ['orders/*']);

const summary = {label, at: new Date().toISOString(), pos: rev(), suite: 'payment-recovery', passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results};
fs.appendFileSync(HERE + 'runs.jsonl', JSON.stringify(summary) + '\n');
console.log(`\n${label}: ${summary.passed} passed, ${summary.failed} failed (POS ${summary.pos})`);
await browser.close();
if (summary.failed) process.exitCode = 1;
