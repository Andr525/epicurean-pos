// POS floor display and guest-count corrections: regression tests, driven through the real POS
// touch controls against a dining room published by the real BOH (offline mock Firestore; clearly
// identified mock card SDK). Each test is meant to be run on the approved base and on the fix.
// Usage: PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... [POS_ROOT=..] [BOH_ROOT=..] [LABEL=..] node floor-guest-count.mjs [filterRegex]
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {launch, exportBoh, openPos, ui, MOCK_CARD_SDK, POS_ROOT, BOH_ROOT} from './lib.mjs';
const HERE = new URL('.', import.meta.url).pathname;
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const label = process.env.LABEL || 'unlabelled';
const rev = r => { try { return execFileSync('git', ['-C', r, 'rev-parse', '--short', 'HEAD'], {encoding: 'utf8'}).trim() + (execFileSync('git', ['-C', r, 'status', '--porcelain', '--', 'index.html'], {encoding: 'utf8'}).trim() ? '+wip' : ''); } catch (e) { return '?'; } };
const browser = await launch();
const boh = await exportBoh(browser);

// BOH's dining room plus the objects the POS must NOT draw: a booth (inside the station), a sideboard,
// decor, and a waiter station with its boundary box (as BOH publishes it in boh_shared/tables.stations).
const T_ = boh.boh_shared.tables;
const extra = [
  {id: 'bk1', type: 'couch', num: 'Booth', seats: 4, x: 120, y: 150, w: 150, h: 60, status: 'open', server: ''},
  {id: 'sb1', type: 'station', x: 400, y: 300, w: 80, h: 60, label: 'Sideboard'},
  {id: 'pl1', type: 'plant', x: 860, y: 300, w: 44, h: 44, label: ''},
  {id: 'dr1', type: 'door', x: 860, y: 400, w: 50, h: 50, label: 'Door'},
  {id: 'lb1', type: 'label', x: 300, y: 460, w: 120, h: 34, label: 'Window side'},
  {id: 'ch1', type: 'chair', x: 330, y: 80, w: 44, h: 48, label: 'Chair'},
  {id: 'ls1', type: 'lshape', x: 40, y: 480, w: 140, h: 140, label: ''},
  {id: 'cv1', type: 'curve', x: 600, y: 480, w: 120, h: 60, label: ''}
];
T_.roomObjs.main = T_.roomObjs.main.concat(extra);
T_.stations = [{id: 'st_main_1', number: 1, name: '1', room: 'main', x: 40, y: 50, w: 320, h: 300, tableIds: ['t1', 't2', 't3', 't4', 'bk1'], server: 'Andre Mendoza', serverId: 's1', serverCode: '3001'}];
const SHOWN = o => ({table: 1, stool: 1, outdoor: 1}[o.type] || {wall: 1, lshape: 1, curve: 1}[o.type]);
const mainTables = T_.roomObjs.main.filter(o => ['table', 'stool', 'outdoor'].includes(o.type));
const cap = n => (mainTables.find(o => String(o.num) === String(n)) || {}).seats;

const results = [];
async function T(id, title, fn, {card = false, seed = null} = {}) {
  if (only && !only.test(id)) return;
  const o = await openPos(browser, {seed: seed || boh, extraHead: card ? MOCK_CARD_SDK : ''});
  const u = ui(o.page); const r = {id, title};
  try { const out = await fn(u, o.page, o); r.pass = !!out.pass; r.evidence = out.evidence; }
  catch (e) { r.pass = false; r.evidence = 'ERROR: ' + String(e.message).split('\n')[0].slice(0, 200); }
  r.pageErrors = o.errors.slice(0, 3); r.external = [...new Set(o.external)].filter(h => !/fonts\.(googleapis|gstatic)/.test(h));
  if (r.pageErrors.length) r.pass = false;
  if (r.external.length) { r.pass = false; r.evidence += ' | EXTERNAL REQUEST ' + r.external.join(','); }
  await o.context.close(); results.push(r);
  console.log((r.pass ? 'PASS ' : 'FAIL ') + id + ' ' + title + ' :: ' + r.evidence + (r.pageErrors.length ? ' | pageErrors=' + r.pageErrors.join(';') : ''));
}
const floorDom = u => u.ev(() => {
  const c = document.getElementById('floor-canvas');
  return {
    seat: [...c.querySelectorAll('.floor-obj.seatable')].map(e => ({n: e.dataset.table, l: parseFloat(e.style.left), t: parseFloat(e.style.top), w: parseFloat(e.style.width), h: parseFloat(e.style.height), couch: !!e.querySelector('.f-couch')})),
    walls: c.querySelectorAll('.f-wall,.floor-lshape,.f-curve').length,
    clutter: [...c.querySelectorAll('.f-couch,.f-station,.floor-station,.floor-poly,.f-bar,.f-host,.floor-furn,.f-plant,.f-door,.f-zone,.floor-label,.f-chair,.f-exit')].map(e => e.className),
    text: c.innerText.split(/\s+/).filter(Boolean)
  };
});
// The "Table tools" menu entries (⋮ menu on phones): call the same function each menu button calls.
const MENU = {'Combine tables': 'openCombineSheet', 'Split combined tables': 'splitSelectedCombined'};
async function overflow(p, text) { await p.evaluate(fn => window[fn](), MENU[text]); await p.waitForTimeout(400); }

// ---- 1. Floor: original numbered tables and walls only ----
await T('F1', 'Floor shows only the numbered tables (exact positions/sizes) and walls; no booth, sideboard or decor', async (u) => {
  await u.pin('3001'); await u.floor(); await u.ev(() => setFloorFilter('room:main'));
  const f = await floorDom(u);
  const tables = f.seat.filter(s => !s.couch);
  let dx = null, dy = null, exact = tables.length === mainTables.length;
  for (const s of tables) { const o = mainTables.find(x => String(x.num) === s.n); if (!o) { exact = false; continue; } if (dx === null) { dx = s.l - o.x; dy = s.t - o.y; } if (Math.abs(s.l - o.x - dx) > 0.5 || Math.abs(s.t - o.y - dy) > 0.5 || s.w !== o.w || s.h !== o.h) exact = false; }
  const wallsWant = T_.roomObjs.main.filter(o => ['wall', 'lshape', 'curve'].includes(o.type)).length;
  return {pass: exact && f.walls === wallsWant && !f.clutter.length && !f.seat.some(s => s.couch), evidence: `${tables.length}/${mainTables.length} tables exact=${exact}; walls ${f.walls}/${wallsWant}; not-allowed objects drawn: ${f.clutter.length ? f.clutter.join(' ') : 'none'}`};
});
await T('F2', 'Floor shows no station boundaries, waiter names, station labels or seat counts', async (u) => {
  await u.pin('3001'); await u.floor(); await u.ev(() => setFloorFilter('room:main'));
  const f = await floorDom(u); const txt = f.text.join(' ');
  const nums = new Set(mainTables.map(o => String(o.num)).concat(['Booth']));
  return {pass: f.text.every(t => nums.has(t)) && !/seat|Andre|Mendoza|Station/i.test(txt) && !f.clutter.some(c => /station|poly/.test(c)), evidence: 'floor text: ' + txt};
});
await T('F3', 'My Station (3001) shows exactly the station\'s tables; the booth inside it is not counted', async (u, p) => {
  await u.pin('3001'); await u.floor();
  const tab = await p.locator('.floor-room-tab', {hasText: 'My station'}).innerText();
  await p.locator('.floor-room-tab', {hasText: 'My station'}).click(); await p.waitForTimeout(500);
  const full = await u.ev(() => [...document.querySelectorAll('#floor-canvas .floor-obj.seatable')].filter(e => !/opacity:\s*0\.28/.test(e.getAttribute('style'))).map(e => e.dataset.table).sort());
  // Andre's tables: station 1's four tables + table 11, which BOH assigns to Andre directly. Never the booth.
  const mine = mainTables.filter(o => ['t1', 't2', 't3', 't4'].includes(o.id) || o.server === 'Andre Mendoza').length;
  return {pass: new RegExp('My station \\(' + mine + '\\)', 'i').test(tab) && JSON.stringify(full) === JSON.stringify(['1', '2', '3', '4']), evidence: `tab "${tab}" (expected ${mine}: station tables 1-4 + table 11 assigned to Andre); station view full-opacity tables ${full.join(',')}`};
});
// ---- 2. Combining: never a seating capacity; the waiter confirms ----
await T('F4', 'Combine sheet lists tables without seating capacities and never offers the booth', async (u, p) => {
  await u.pin('3001'); await u.seat('1', 2);
  await overflow(p, 'Combine tables'); const s = await u.sheetText();
  return {pass: /Table 2/.test(s) && !/seats?\b/i.test(s) && !/Booth/.test(s), evidence: s.slice(0, 220)};
});
await T('F5', 'Combining seated tables (2 + 3 guests): waiter confirms; count is never the capacity', async (u, p) => {
  await u.pin('3001'); await u.seat('1', 2); await u.floor(); await u.seat('2', 3);
  await u.ev(() => { STATE.selectedTable = '1'; });
  await overflow(p, 'Combine tables'); await p.locator('.chip', {hasText: /^Table 2(\s|$)/}).first().click(); await p.waitForTimeout(600);
  const sheet = await u.sheetText(); const toast = await u.toast();
  const before = await u.ev(() => sessionOf('1').guestCount);
  const keep = p.locator('#combine-keep-guests'); const offered = await keep.count() ? await keep.innerText() : '';
  await p.locator('button[onclick="confirmCombinedGuests(6)"]').click().catch(() => {}); await p.waitForTimeout(400);
  const after = await u.ev(() => ({sess: sessionOf('1').guestCount, chk: (STATE.checks[sessionOf('1').checkId] || {}).guestCount}));
  return {pass: /Keep 5 guests/.test(offered) && before === 5 && after.sess === 6 && after.chk === 6 && !/seats?\b/i.test(toast), evidence: `capacity ${cap(1)}+${cap(2)}=${cap(1) + cap(2)}; sheet "${sheet.slice(0, 90)}"; offered "${offered}"; count before confirm ${before}; waiter chose 6 → session ${after.sess}, check ${after.chk}; toast "${toast}"`};
});
await T('F6', 'Combining two empty tables seats nobody; opening asks the waiter for the guest count', async (u, p) => {
  await u.pin('3001'); await u.floor();
  await u.ev(() => { STATE.selectedTable = '7'; }); await overflow(p, 'Combine tables'); await p.locator('.chip', {hasText: /^Table 8(\s|$)/}).first().click(); await p.waitForTimeout(600);
  const noSheet = !(await p.locator('#combine-keep-guests').count());
  await u.floor(); await u.tapTable('7');
  const asked = await p.locator('.count-grid button[onclick^="chooseGuestCount"]').count();
  await p.locator('button[onclick="chooseGuestCount(3)"]').click(); await p.waitForTimeout(400);
  return {pass: noSheet && asked === 12 && await u.ev(() => sessionOf('7').guestCount) === 3, evidence: `capacity ${cap(7)}+${cap(8)}; confirm sheet shown=${!noSheet}; picker buttons ${asked}; chosen 3 → ${await u.ev(() => sessionOf('7').guestCount)}`};
});
await T('F7', 'Separating combined tables keeps the guest count (not the table capacity)', async (u, p) => {
  await u.pin('3001'); await u.seat('1', 2); await u.floor(); await u.seat('2', 3);
  await u.ev(() => { STATE.selectedTable = '1'; }); await overflow(p, 'Combine tables'); await p.locator('.chip', {hasText: /^Table 2(\s|$)/}).first().click(); await p.waitForTimeout(600);
  if (await p.locator('#combine-keep-guests').count()) await p.locator('#combine-keep-guests').click(); await p.waitForTimeout(300);
  const combined = await u.ev(() => sessionOf('1').guestCount);
  await u.ev(() => { STATE.selectedTable = '1'; }); await overflow(p, 'Split combined tables');
  const after = await u.ev(() => sessionOf('1').guestCount);
  return {pass: after === combined && after !== cap(1), evidence: `combined ${combined}; after separating ${after}; table 1 capacity ${cap(1)}`};
});
await T('F8', 'Combining and separating never change the BOH layout; tables return to their original positions', async (u, p) => {
  await u.pin('3001'); await u.seat('1', 2); await u.floor(); await u.seat('2', 3);
  const docBefore = JSON.stringify((await u.db()).boh_shared.tables);
  await u.ev(() => { STATE.selectedTable = '1'; }); await overflow(p, 'Combine tables'); await p.locator('.chip', {hasText: /^Table 2(\s|$)/}).first().click(); await p.waitForTimeout(600);
  if (await p.locator('#combine-keep-guests').count()) await p.locator('#combine-keep-guests').click();
  const during = await u.ev(() => (STATE.roomObjs.main || []).filter(o => SEATABLE[o.type]).map(o => ({n: String(tableKey(o)), g: o._bohGeom})));
  await u.ev(() => { STATE.selectedTable = '1'; }); await overflow(p, 'Split combined tables');
  const back = await u.ev(() => (STATE.roomObjs.main || []).filter(o => SEATABLE[o.type]).map(o => ({n: String(tableKey(o)), x: o.x, y: o.y, w: o.w, h: o.h, hidden: !!o.hidden})));
  const writes = await u.ev(() => __MOCK_DB__.log.filter(l => l.c === 'boh_shared').map(l => l.id));
  const ok = back.every(b => { const o = T_.roomObjs.main.find(x => String(x.num) === b.n); return o && b.x === o.x && b.y === o.y && b.w === o.w && b.h === o.h && !b.hidden; }) && during.every(d => { const o = T_.roomObjs.main.find(x => String(x.num) === d.n); return o && d.g && d.g.x === o.x && d.g.y === o.y && d.g.w === o.w && d.g.h === o.h && d.g.seats === (o.seats || 2); });
  return {pass: ok && JSON.stringify((await u.db()).boh_shared.tables) === docBefore && !writes.includes('tables'), evidence: `geometry kept while combined and restored after separating=${ok}; boh_shared writes by POS: ${writes.join(',') || 'none'}`};
});
await T('F9', 'Combined table: order, send and pay still work (mock card)', async (u, p) => {
  await u.pin('3001'); await u.seat('1', 2); await u.floor(); await u.seat('2', 3);
  await u.ev(() => { STATE.selectedTable = '1'; }); await overflow(p, 'Combine tables'); await p.locator('.chip', {hasText: /^Table 2(\s|$)/}).first().click(); await p.waitForTimeout(600);
  if (await p.locator('#combine-keep-guests').count()) await p.locator('#combine-keep-guests').click();
  await u.floor(); await u.tapTable('1'); await u.openCategory('c_des'); await u.tile('Chocolate Studio Torte'); await u.send(); await u.floor(); await u.tapTable('1');
  const paid = await u.pay();
  const db = await u.db(); const checks = Object.values(db.checks || {}); const pays = Object.values(db.payments || {});
  return {pass: pays.length === 1 && checks.some(c => c.table === '1' && c.status === 'paid'), evidence: `payments ${pays.length}; checks ${checks.map(c => c.table + ':' + c.status + ':' + c.guestCount).join(' ')}; ${paid.label}`};
}, {card: true});
// ---- 3. Table opened with an order from another device ----
async function otherDevice(dropChecks) {
  const a = await openPos(browser, {seed: boh}); const ua = ui(a.page);
  await ua.pin('3001'); await ua.seat('5', 4); await ua.openCategory('c_des'); await ua.tile('Chocolate Studio Torte'); await ua.send();
  const dump = await ua.db(); await a.context.close();
  if (dropChecks) delete dump.checks;
  return dump;
}
const withCheck = await otherDevice(false), ordersOnly = await otherDevice(true);
await T('F10', 'Order from another device (with its check): the recorded 4 guests are kept, not capacity ' + cap(5), async (u, p) => {
  await u.pin('3002'); await u.floor(); await u.tapTable('5');
  const g = await u.ev(() => ({state: STATE.guestCount, sess: sessionOf('5').guestCount}));
  return {pass: g.state === 4 && g.sess === 4, evidence: `opened on this device: ${JSON.stringify(g)}; order says ${Object.values(withCheck.orders)[0].guestCount}; capacity ${cap(5)}`};
}, {seed: withCheck});
await T('F11', 'Order from another device (check not yet on this device): the order\'s 4 guests are used', async (u, p) => {
  await u.pin('3002'); await u.floor(); await u.tapTable('5');
  const g = await u.ev(() => ({state: STATE.guestCount, sess: sessionOf('5').guestCount}));
  return {pass: g.state === 4 && g.sess === 4, evidence: `opened on this device: ${JSON.stringify(g)}; order says ${Object.values(ordersOnly.orders)[0].guestCount}; capacity ${cap(5)}`};
}, {seed: ordersOnly});
await T('F12', 'BOH seating capacities and the complete layout stay unchanged in the POS data', async (u, p) => {
  await u.pin('3001'); await u.floor();
  // seats compared where BOH has a capacity (the approved POS gives other objects a default in memory only)
  const live = await u.ev(() => { const out = {}; Object.keys(STATE.roomObjs).forEach(r => { out[r] = (STATE.roomObjs[r] || []).map(o => ({id: o.id, type: o.type, seats: SEATABLE[o.type] ? o.seats : undefined, x: o.x, y: o.y, w: o.w, h: o.h})); }); return {objs: out, stations: STATE.stations.map(s => ({id: s.id, tableIds: s.tableIds}))}; });
  const want = {}; Object.keys(T_.roomObjs).forEach(r => { want[r] = T_.roomObjs[r].map(o => ({id: o.id, type: o.type, seats: ['table', 'stool', 'outdoor', 'couch'].includes(o.type) ? o.seats : undefined, x: o.x, y: o.y, w: o.w, h: o.h})); });
  const same = JSON.stringify(live.objs) === JSON.stringify(want);
  return {pass: same && JSON.stringify((await u.db()).boh_shared.tables) === JSON.stringify(T_) && live.stations.some(s => s.id === 'st_main_1'), evidence: `every object incl. booth/sideboard/decor kept with seats and geometry=${same}; mock boh_shared/tables unchanged`};
});

const summary = {label, suite: 'floor-guest-count', at: new Date().toISOString(), pos: rev(POS_ROOT), boh: rev(BOH_ROOT), passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results};
fs.appendFileSync(HERE + 'runs.jsonl', JSON.stringify(summary) + '\n');
console.log(`\n${label}: ${summary.passed} passed, ${summary.failed} failed (POS ${summary.pos}, BOH ${summary.boh})`);
await browser.close();
