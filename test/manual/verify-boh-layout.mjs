// Verifies the read-only BOH layout export and the test kit's "Import BOH Layout".
// Runs the REAL BOH (deployed main branch snapshot) and the built test kit in Chromium with every
// outside request blocked. The floor plan used here is built inside BOH with BOH's own editor
// functions (addFloorObj / persistFloorLocal); the owner's real layout is not available to the test.
// Usage: PLAYWRIGHT_MODULE=… CHROMIUM_PATH=… node verify-boh-layout.mjs <kitDir> <bohMainDir> [wifi-test-ip]
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const [KIT, BOH, IP = '192.0.2.2'] = process.argv.slice(2);
const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'boh-layout-verify-'));
const results = [];
const check = (name, pass, detail = '') => { results.push({name, pass: !!pass, detail}); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + String(detail).slice(0, 300) : '')); };
const note = (name, detail) => { results.push({name, note: true, detail}); console.log('NOTE ' + name + ' :: ' + detail); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MIME = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css'};
function serve(root, port) {
  return new Promise(res => { const s = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store'}); r.end(b); }); }).listen(port, '127.0.0.1', () => res(s)); });
}
const STRIP = ['serverCode', 'code', 'pin', 'passcode', 'password', 'pass', 'token', 'secret', 'apiKey', 'guestName', 'guestId', 'guestPhone', 'phone', 'email', 'vip', 'notes', 'note', 'guestNote', 'turns', '_demoTurns'];
const scrub = v => Array.isArray(v) ? v.map(scrub) : (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !STRIP.includes(k)).map(([k, x]) => [k, scrub(x)])) : v);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SHOW_TABLE = {table: 1, stool: 1, outdoor: 1}, SHOW_WALL = {wall: 1, lshape: 1, curve: 1};
const omit = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox']});
async function newPage(base, opts = {}) {
  const context = await browser.newContext({acceptDownloads: true, ...opts});
  const page = await context.newPage();
  const external = [], errors = [], dialogs = [];
  await page.route('**/*', rt => { const u = rt.request().url(); if (u.startsWith(base) || u.startsWith('blob:') || u.startsWith('data:')) return rt.continue(); external.push(u); return rt.abort(); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  return {context, page, external, errors, dialogs};
}

// ================= A. EXPORT on the real BOH =================
const bohSrv = await serve(BOH, 9821), kitSrv = await serve(KIT, 9822);
const BOH_URL = 'http://127.0.0.1:9821/', KIT_URL = 'http://127.0.0.1:9822/';
const helper = fs.readFileSync(path.join(KIT, 'BOH Layout Export.html'), 'utf8');
const bookmarklet = (helper.match(/id="export-button" href="([^"]+)"/) || [])[1] || '';
check('helper page contains the drag-to-bookmarks button with the export code', bookmarklet.startsWith('javascript:') && decodeURIComponent(bookmarklet).includes('epicurean-boh-layout-export'), bookmarklet.length + ' chars');
check('export code makes no writes (no setItem/removeItem/clear/fbSetDoc/fetch/XMLHttpRequest calls in its source)', !/setItem|removeItem|\.clear\(|fbSetDoc|fetch\(|XMLHttpRequest|sendBeacon/.test(decodeURIComponent(bookmarklet)));

const boh = await newPage(BOH_URL);
await boh.page.goto(BOH_URL + 'index.html'); await boh.page.waitForTimeout(2500);
// Build an "original-like" floor plan with BOH's own editor (every palette object, 3 waiter stations, guest details).
const built = await boh.page.evaluate(() => {
  const errs = [];
  const add = (room, t, props) => { FLOOR.room = room; try { addFloorObj(t); } catch (e) { errs.push(t + ': ' + e.message); } const a = curObjs(); const o = a[a.length - 1]; Object.assign(o, props); return o; };
  const main = 'main';
  // BOH's starting floor already has tables 1-12 in "main"; add one of every other palette object.
  const kinds = ['table-round', 'table-square', 'table-rect', 'couch', 'couch', 'chair', 'bar', 'host', 'station', 'kiosk', 'wall-h', 'wall-v', 'lshape', 'curve', 'door', 'plant', 'stage', 'kitchen', 'privateroom', 'store', 'label'];
  const added = kinds.map((k, i) => add(main, k, {x: 60 + (i % 7) * 120, y: 560 + Math.floor(i / 7) * 120}));
  const T = n => (STATE.roomObjs.main || []).find(o => String(o.num) === String(n));
  T(5).rot = 45; T(6).seats = 10; added[0].num = '13A';
  // guest details on tables (must NOT reach the export or the test kit)
  Object.assign(T(1), {guestName: 'Real Guest Example', vip: true, notes: ['Shellfish allergy, anniversary'], turns: [{time: '7:30 PM', name: 'Real Reservation Name', party: 4, vip: false, notes: 'window'}]});
  T(2).server = 's2'; // a table assigned directly to a waiter (BOH stores the staff id)
  // waiter stations: a box around tables 1-4 (Andre, s1), a polygon around 5-6 (Paco, s2), and one in Private (Andre again)
  add(main, 'waiterstation', {x: 40, y: 50, w: 320, h: 300, server: 's1'});
  add(main, 'waiterstation', {x: 400, y: 90, w: 400, h: 160, server: 's2', points: [{x: 400, y: 90}, {x: 800, y: 90}, {x: 800, y: 250}, {x: 400, y: 250}]});
  add('private', 'waiterstation', {x: 150, y: 150, w: 360, h: 220, server: 's1'});
  add('bar', 'wall-h', {x: 100, y: 60, w: 400, h: 12});
  persistFloorLocal(); // BOH's own save to this browser (what a device holds after editing)
  return {errs, staff: STATE.staff.map(s => ({id: s.id, name: s.name, code: s.code}))};
});
check('test floor plan built with BOH\'s own editor functions', !built.errs.length, built.errs.join('; ') || 'tables 1-13A, booths, sideboard, bar, walls, decor, 3 waiter stations');
await boh.page.reload(); await boh.page.waitForTimeout(2500); // BOH boots from its saved copy, as on the owner's Mac

const snapshot = () => boh.page.evaluate(() => ({ls: Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])), state: JSON.stringify({rooms: STATE.rooms, roomObjs: STATE.roomObjs, stations: STATE.stations, staff: STATE.staff})}));
const truth = await boh.page.evaluate(() => ({ // what BOH itself publishes to boh_shared/tables when it saves the floor
  published: {rooms: cloneJson(STATE.rooms), roomObjs: physicalRoomObjs(STATE.roomObjs), stations: cloneJson(mergeStationSync(computeStations(), STATE.stations))},
  editor: stripDemoTurnsFromRooms(STATE.roomObjs)
}));
await boh.page.evaluate(() => { // count any write while the export runs (instrumentation of the test page only)
  window.__writes = [];
  const w = window.__writes;
  for (const m of ['setItem', 'removeItem', 'clear']) { const o = Storage.prototype[m]; Storage.prototype[m] = function () { w.push(m + ' ' + (arguments[0] || '')); return o.apply(this, arguments); }; }
  if (typeof window.fbSetDoc === 'function') { const f = window.fbSetDoc; window.fbSetDoc = function () { w.push('fbSetDoc ' + arguments[0] + '/' + arguments[1]); return f.apply(this, arguments); }; }
  const ff = window.fetch; window.fetch = function () { w.push('fetch ' + arguments[0]); return ff.apply(this, arguments); };
});
const before = await snapshot(); const extBefore = boh.external.length;
await boh.page.evaluate(href => { const a = document.createElement('a'); a.id = '__bm'; a.href = href; a.textContent = 'bm'; document.body.appendChild(a); }, bookmarklet);
const [download] = await Promise.all([boh.page.waitForEvent('download', {timeout: 15000}), boh.page.click('#__bm')]);
await boh.page.waitForTimeout(1000);
const exportPath = path.join(OUT, download.suggestedFilename()); await download.saveAs(exportPath);
await boh.page.evaluate(() => document.getElementById('__bm').remove());
const after = await snapshot();
const writes = await boh.page.evaluate(() => window.__writes);
check('export downloads one file named boh-layout-YYYY-MM-DD-HHMM.json', /^boh-layout-\d{4}-\d\d-\d\d-\d{4}\.json$/.test(download.suggestedFilename()), download.suggestedFilename());
check('export is read-only: no storage writes, no Firebase writes, no network requests', !writes.length && boh.external.length === extBefore, JSON.stringify(writes));
check('export is read-only: BOH browser storage identical before/after', eq(before.ls, after.ls), Object.keys(before.ls).length + ' keys');
check('export is read-only: BOH floor plan, stations and staff in memory identical before/after', before.state === after.state);
check('export shows a confirmation with the counts', boh.dialogs.some(m => /BOH layout exported/.test(m) && /rooms/.test(m) && /waiter stations/.test(m)), boh.dialogs.join(' | ').replace(/\n+/g, ' '));
const exp = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
const expText = JSON.stringify(omit(exp, ['removed'])); // "removed" only lists the names and counts of fields left out
check('export "published" equals exactly what BOH publishes to boh_shared/tables (minus PINs/guest details)', eq(exp.published, scrub(truth.published)));
let geomOk = true, missing = [];
for (const r of Object.keys(truth.editor)) for (const o of truth.editor[r]) {
  const e = (exp.editorRoomObjs[r] || []).find(x => x.id === o.id);
  if (!e) { missing.push(r + '/' + o.id); geomOk = false; continue; }
  for (const k of ['type', 'num', 'shape', 'seats', 'x', 'y', 'w', 'h', 'rot', 'points', 'label', 'server', 'status']) if (!eq(o[k], e[k])) { geomOk = false; missing.push(r + '/' + o.id + '.' + k); }
}
const allObjs = Object.values(truth.editor).flat();
check('export keeps every room, wall, table, booth, object and station box with identical geometry, numbers, shapes, seats', geomOk && eq(exp.published.rooms, truth.published.rooms), missing.slice(0, 5).join(', ') || `${allObjs.length} objects in ${truth.published.rooms.length} rooms`);
check('export keeps waiter station assignments (station → tables → waiter)', exp.published.stations.length === 3 && exp.published.stations.every((s, i) => eq(s.tableIds, truth.published.stations[i].tableIds) && s.server === truth.published.stations[i].server && s.tableIds.length > 0), exp.published.stations.map(s => `#${s.number} ${s.server}: ${s.tableIds.length} tables`).join('; '));
const pins = built.staff.map(s => s.code).filter(Boolean);
check('export contains no employee PINs or credential fields', !/"(serverCode|code|pin|passcode|password|token|secret|apiKey)"\s*:/.test(expText) && !pins.some(p => expText.includes('"' + p + '"')), 'removed: ' + JSON.stringify(exp.removed.fields));
check('export contains no guest details', !/Real Guest Example|Real Reservation Name|Shellfish allergy/.test(expText) && !/"(guestName|vip|notes|turns)"\s*:/.test(expText));
check('export summary counts are right', exp.summary.rooms === truth.published.rooms.length && exp.summary.stations === 3 && exp.summary.booths === 2 && exp.summary.tables === allObjs.filter(o => SHOW_TABLE[o.type]).length && exp.summary.walls === allObjs.filter(o => SHOW_WALL[o.type]).length, JSON.stringify(omit(exp.summary, ['objectTypes'])));
const noBoh = await newPage(KIT_URL); await noBoh.page.goto(KIT_URL + 'BOH%20Layout%20Export.html'); await noBoh.page.click('#export-button'); await noBoh.page.waitForTimeout(400);
check('clicking the button outside BOH only explains what to do (nothing downloaded or changed)', noBoh.dialogs.some(m => /Open your Epicurean BOH page first/.test(m)));
await noBoh.context.close();

// ================= B. IMPORT in the test kit =================
const SEED = (() => { const s = fs.readFileSync(path.join(KIT, 'seed.js'), 'utf8'); return JSON.parse(s.slice(s.indexOf('=') + 1).trim().replace(/;$/, '')); })();
const kit = await newPage(KIT_URL, {viewport: {width: 1280, height: 900}});
const P = kit.page, ev = (f, a) => P.evaluate(f, a);
await P.goto(KIT_URL + 'index.html'); await P.waitForTimeout(1500);
const dbBefore = await ev(() => __MOCK_DB__.__dump());
await ev(() => HLTEST.toggle()); await P.waitForTimeout(200);
check('TEST panel shows the fictional floor plan and the Import BOH Layout button', /Fictional sample floor plan/.test(await P.locator('#hltest-panel').innerText()) && await P.locator('#hltest-panel button', {hasText: 'Import BOH Layout'}).count() === 1);
const [chooser] = await Promise.all([P.waitForEvent('filechooser'), P.locator('#hltest-panel button', {hasText: 'Import BOH Layout'}).click()]);
await chooser.setFiles(exportPath); await P.waitForTimeout(500);
const review = await P.locator('#hltest-layout-review').innerText().catch(() => '');
const shownTables = allObjs.filter(o => SHOW_TABLE[o.type]).length;
check('import validates the file and shows rooms, tables and stations before applying', new RegExp(`${exp.summary.rooms}\\s*rooms · ${shownTables}\\s*tables · 3\\s*stations`).test(review.replace(/\n/g, ' ')), review.replace(/\s+/g, ' ').slice(0, 260));
check('nothing changes until Apply is pressed', eq(await ev(() => __MOCK_DB__.__dump()), dbBefore) && await ev(() => localStorage.getItem('HLTEST_BOH_LAYOUT_V1')) === null);
await P.locator('#hltest-panel button', {hasText: 'Apply this floor plan'}).click(); await P.waitForTimeout(2000);
const db = await ev(() => __MOCK_DB__.__dump()); const doc = db.boh_shared.tables;
check('mock boh_shared/tables rooms are the original rooms', eq(doc.rooms, exp.published.rooms));
let objOk = true, objBad = [];
for (const r of Object.keys(exp.published.roomObjs)) {
  const want = exp.published.roomObjs[r].filter(o => SHOW_TABLE[o.type] || SHOW_WALL[o.type]);
  const got = doc.roomObjs[r] || [];
  if (want.length !== got.length) { objOk = false; objBad.push(r + ' count ' + got.length + '/' + want.length); continue; }
  want.forEach((o, i) => { if (!eq(omit(o, ['server']), omit(got[i], ['server']))) { objOk = false; objBad.push(r + '/' + o.id); } });
}
check('mock floor plan = the original tables and walls, every field and coordinate unchanged', objOk, objBad.join(', ') || Object.keys(doc.roomObjs).map(r => r + ':' + doc.roomObjs[r].length).join(' '));
const kinds = [...new Set(Object.values(doc.roomObjs).flat().map(o => o.type))].sort();
check('booths, sideboards, bar counter, doors, plants, labels, zones and station boxes are not in the POS floor plan', kinds.every(k => SHOW_TABLE[k] || SHOW_WALL[k]), kinds.join(','));
const fictionalNames = new Set(SEED.boh_shared.staff_clock.list.map(p => p.name));
const stOk = doc.stations.length === exp.published.stations.length && doc.stations.every(s => { const o = exp.published.stations.find(x => x.id === s.id); return o && eq(omit(s, ['server', 'serverId', 'serverCode']), omit(o, ['server', 'serverId', 'serverCode'])); });
check('stations keep their original ids, numbers, rooms, boxes, polygons and tables', stOk);
const byId = Object.fromEntries(doc.stations.map(s => [s.id, s]));
const andre = exp.published.stations.filter(s => s.serverId === 's1').map(s => byId[s.id].server);
check('station waiters are fictional; the same original waiter maps to the same fictional waiter', doc.stations.every(s => fictionalNames.has(s.server)) && andre.length === 2 && andre[0] === andre[1] && byId[exp.published.stations.find(s => s.serverId === 's2').id].server !== andre[0], doc.stations.map(s => `#${s.number}→${s.server} ${s.serverCode}`).join('; '));
const t2 = doc.roomObjs.main.find(o => String(o.num) === '2');
check('a table assigned directly to a waiter in BOH maps to that waiter\'s fictional stand-in', t2.server === byId[exp.published.stations.find(s => s.serverId === 's2').id].server, t2.server);
const docText = JSON.stringify(db);
check('no real employee names, PINs or guest details in the test kit', !built.staff.some(s => docText.includes(s.name)) && !/Real Guest Example|Real Reservation|Shellfish allergy, anniversary/.test(docText));
check('fictional employees kept', eq(db.boh_shared.staff_clock.list.map(p => p.name), SEED.boh_shared.staff_clock.list.map(p => p.name)));
const otherSame = Object.keys(dbBefore).filter(c => c !== 'boh_shared').every(c => eq(dbBefore[c], db[c])) && Object.keys(dbBefore.boh_shared).filter(k => !['tables', 'staff_clock'].includes(k)).every(k => eq(dbBefore.boh_shared[k], db.boh_shared[k]));
check('fictional orders, checks, payments, menu and every other document unchanged', otherSame, Object.keys(dbBefore).join(','));

// POS screens with the imported plan
const u = (await import(pathToFileURL(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../acceptance/lib.mjs')))).ui(P);
const st1 = doc.stations.slice().sort((a, b) => a.number - b.number)[0];
const waiter = SEED.boh_shared.staff_clock.list.find(p => p.name === st1.server);
await u.pin(waiter.code); await u.floor(); await P.waitForTimeout(500);
await ev(() => setFloorFilter('room:main')); await P.waitForTimeout(500);
const floor = await ev(() => {
  const c = document.getElementById('floor-canvas');
  const seat = [...c.querySelectorAll('.floor-obj.seatable')].map(e => ({n: e.dataset.table, l: parseFloat(e.style.left), t: parseFloat(e.style.top), w: parseFloat(e.style.width), h: parseFloat(e.style.height)}));
  return {seat, walls: c.querySelectorAll('.f-wall,.floor-lshape,.f-curve').length, clutter: c.querySelectorAll('.f-couch,.f-station,.floor-station,.floor-poly,.f-bar,.f-host,.floor-furn,.f-plant,.f-door,.f-zone,.floor-label,.f-chair,.f-exit').length, text: c.innerText.split(/\s+/).filter(Boolean), screen: document.getElementById('app-content').innerText};
});
const mainTables = doc.roomObjs.main.filter(o => SHOW_TABLE[o.type]);
let posOk = floor.seat.length === mainTables.length, dx = null, dy = null;
for (const s of floor.seat) { const o = mainTables.find(x => String(x.num) === s.n); if (!o) { posOk = false; continue; } if (dx === null) { dx = s.l - o.x; dy = s.t - o.y; } if (Math.abs(s.l - o.x - dx) > 0.5 || Math.abs(s.t - o.y - dy) > 0.5 || s.w !== o.w || s.h !== o.h) posOk = false; }
check('POS floor shows the original numbered tables at their exact positions and sizes', posOk, floor.seat.length + ' tables; offset ' + dx + ',' + dy);
check('POS floor shows the walls', floor.walls === doc.roomObjs.main.filter(o => SHOW_WALL[o.type]).length, floor.walls + ' walls');
check('POS floor shows no booths, sideboards, station lines or decorative objects', floor.clutter === 0);
check('POS floor shows only table numbers (no waiter names, station labels or seat counts)', floor.text.every(t => mainTables.some(o => String(o.num) === t)) && !/seats?\b/i.test(floor.text.join(' ')) && ![...fictionalNames].some(n => floor.text.join(' ').includes(n)), floor.text.join(' '));
await P.locator('.floor-room-tab', {hasText: 'My station'}).click(); await P.waitForTimeout(600);
const mine = await ev(() => ({filter: STATE.floorFilter, st: (focusedStation() || {}).id, full: [...document.querySelectorAll('#floor-canvas .floor-obj.seatable')].filter(e => !/opacity:\s*0\.28/.test(e.getAttribute('style'))).map(e => e.dataset.table).sort()}));
const wantNums = st1.tableIds.map(id => String((Object.values(doc.roomObjs).flat().find(o => o.id === id) || {}).num)).sort();
check(`My station (${waiter.name}) shows exactly the tables of original station ${st1.number}`, mine.st === st1.id && eq(mine.full, wantNums), 'shown ' + mine.full.join(',') + ' / station ' + wantNums.join(','));
await ev(() => setFloorFilter('room:main')); await P.waitForTimeout(400);
const freeNum = String((await ev(() => (STATE.roomObjs.main || []).filter(o => SEATABLE[o.type] && /^\d+$/.test(String(tableKey(o))) && !tableIsBusy(tableKey(o), o)).map(o => String(tableKey(o)))))[0]);
await u.tapTable(freeNum);
const picker = await ev(() => ({sheet: !!document.querySelector('.count-grid'), buttons: document.querySelectorAll('.count-grid button[onclick^="chooseGuestCount"]').length}));
check('opening a table asks the waiter for the number of guests (no automatic capacity)', picker.sheet && picker.buttons === 12, 'table ' + freeNum);
await P.locator('button[onclick="chooseGuestCount(3)"]').click(); await P.waitForTimeout(500);
check('the chosen guest count is used, not the BOH seating capacity', await ev(t => sessionOf(t).guestCount, freeNum) === 3, 'capacity ' + (mainTables.find(o => String(o.num) === freeNum) || {}).seats + ', chosen 3');
// combine two tables with the existing Combine sheet, then separate them
const docBeforeCombine = JSON.stringify((await ev(() => __MOCK_DB__.__dump())).boh_shared.tables);
const other = String(mainTables.map(o => String(o.num)).find(n => n !== freeNum && /^\d+$/.test(n) && !(n === '1')));
await ev(() => openCombineSheet()); await P.waitForTimeout(300);
const chipText = await P.locator('.chip', {hasText: new RegExp('^Table ' + other + '\\b')}).first().innerText();
await P.locator('.chip', {hasText: new RegExp('^Table ' + other + '\\b')}).first().click(); await P.waitForTimeout(700);
const comb = await ev(() => ({combines: STATE.tableCombines.length, gc: STATE.guestCount, geom: (STATE.roomObjs.main || []).filter(o => SEATABLE[o.type]).map(o => ({n: String(tableKey(o)), boh: o._bohGeom}))}));
const docAfterCombine = JSON.stringify((await ev(() => __MOCK_DB__.__dump())).boh_shared.tables);
check('existing table combining works with the imported plan', comb.combines === 1);
check('combining never changes the stored original BOH positions (boh_shared/tables unchanged)', docAfterCombine === docBeforeCombine);
check('POS keeps each table\'s original BOH geometry while combined', comb.geom.every(g => { const o = mainTables.find(x => String(x.num) === g.n); return o && g.boh && g.boh.x === o.x && g.boh.y === o.y && g.boh.w === o.w && g.boh.h === o.h; }));
note('approved POS: combining sets the guest count to the combined BOH capacity, and the Combine sheet lists seat capacities', `guest count after combining = ${comb.gc} (was 3); chip "${chipText}" — unchanged approved POS behaviour, not changed in the test kit`);
const keep = String(Math.min(Number(freeNum), Number(other)));
await ev(k => splitCombinedTable(k), keep); await P.waitForTimeout(600);
const split = await ev(() => (STATE.roomObjs.main || []).filter(o => SEATABLE[o.type]).map(o => ({n: String(tableKey(o)), x: o.x, y: o.y, w: o.w, h: o.h, hidden: !!o.hidden})));
check('after separating, every table is back at its original BOH position', split.every(s => { const o = mainTables.find(x => String(x.num) === s.n); return o && s.x === o.x && s.y === o.y && s.w === o.w && s.h === o.h && !s.hidden; }) && JSON.stringify((await ev(() => __MOCK_DB__.__dump())).boh_shared.tables) === docBeforeCombine);
check('POS screens: no page errors and no outside requests', !kit.errors.length && !kit.external.length, JSON.stringify(kit.errors.concat(kit.external)).slice(0, 200));

// Reset keeps the imported plan; invalid files are rejected; Remove goes back to fictional
await ev(() => { HLTEST.reset(); HLTEST.reset(); }); await P.waitForTimeout(2000); // two-tap confirmation
const afterReset = await ev(() => __MOCK_DB__.__dump());
check('"Reset all test data" restores fictional orders but keeps the imported floor plan', eq(omit(afterReset.boh_shared.tables, ['updatedAt']), omit(doc, ['updatedAt'])) && Object.keys(SEED).filter(c => c !== 'boh_shared').every(c => eq(afterReset[c], SEED[c])));
const bad = {
  'not JSON': '{"rooms": [',
  'not a layout file': JSON.stringify({hello: 1}),
  'no rooms': JSON.stringify({...exp, published: {...exp.published, rooms: []}}),
  'table without position': JSON.stringify({...exp, published: {...exp.published, roomObjs: {...exp.published.roomObjs, main: exp.published.roomObjs.main.map((o, i) => i === 0 ? omit(o, ['x']) : o)}}}),
  'table without number': JSON.stringify({...exp, published: {...exp.published, roomObjs: {...exp.published.roomObjs, main: exp.published.roomObjs.main.map((o, i) => i === 0 ? {...o, num: ''} : o)}}}),
  'no tables (walls only)': JSON.stringify({...exp, published: {...exp.published, roomObjs: {main: exp.published.roomObjs.main.filter(o => SHOW_WALL[o.type])}}}),
  'stations not a list': JSON.stringify({...exp, published: {...exp.published, stations: {a: 1}}}),
  'newer export version': JSON.stringify({...exp, version: 2}),
  'empty file': ''
};
const keyBefore = await ev(() => localStorage.getItem('HLTEST_BOH_LAYOUT_V1')), dbB = await ev(() => JSON.stringify(__MOCK_DB__.__dump()));
const rejected = [];
for (const [label, text] of Object.entries(bad)) {
  await ev(([t, n]) => HLTEST.layoutCheck(t, n), [text, label + '.json']); await P.waitForTimeout(100);
  const txt = await P.locator('#hltest-panel').innerText();
  if (/File rejected — nothing was changed/.test(txt) && !(await P.locator('#hltest-panel button', {hasText: 'Apply this floor plan'}).count())) rejected.push(label);
  await ev(() => HLTEST.layoutCancel());
}
check('invalid or incomplete files are rejected with a reason', rejected.length === Object.keys(bad).length, 'rejected: ' + rejected.join(', '));
check('a rejected file changes nothing', keyBefore === await ev(() => localStorage.getItem('HLTEST_BOH_LAYOUT_V1')) && dbB === await ev(() => JSON.stringify(__MOCK_DB__.__dump())));
const raw = {rooms: exp.published.rooms, roomObjs: exp.published.roomObjs, stations: exp.published.stations.map(s => ({...s, serverCode: '3001'}))};
await ev(([t]) => HLTEST.layoutCheck(t, 'firebase-console-export.json'), [JSON.stringify(raw)]); await P.waitForTimeout(100);
const rawOk = await P.locator('#hltest-panel button', {hasText: 'Apply this floor plan'}).count() === 1;
await P.locator('#hltest-panel button', {hasText: 'Apply this floor plan'}).click(); await P.waitForTimeout(1800);
const rawDoc = (await ev(() => __MOCK_DB__.__dump())).boh_shared.tables;
check('a plain boh_shared/tables document (e.g. Firebase console export) is accepted; real PINs are replaced', rawOk && rawDoc.stations.every(s => s.serverCode !== '3001' && fictionalNames.has(s.server)));
await ev(() => { HLTEST.toggle(); }); await P.waitForTimeout(100);
await ev(() => { HLTEST.layoutRemove(); HLTEST.layoutRemove(); }); await P.waitForTimeout(1800); // two-tap confirmation
const removed = await ev(() => ({doc: __MOCK_DB__.__dump().boh_shared.tables, key: localStorage.getItem('HLTEST_BOH_LAYOUT_V1')}));
check('"Remove imported layout" goes back to the fictional floor plan', removed.key === null && eq(removed.doc, SEED.boh_shared.tables));
await kit.context.close();

// ================= C. iPhone: layout file in the kit folder, served by the iPhone launcher =================
const kit2 = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-copy-')); fs.cpSync(KIT, kit2, {recursive: true});
const port = 8795;
const startServer = () => { const p = spawn('python3', [path.join(kit2, 'iphone-test-server.py'), IP, String(port)], {env: {...process.env, HLTEST_NO_OPEN: '1'}}); let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d); return {p, out: () => out}; };
let srv = startServer(); await sleep(1500);
const noFile = await (await fetch(`http://${IP}:${port}/boh-layout.js`)).text();
check('iPhone launcher with no layout file offers nothing', /__BOH_LAYOUT_FROM_MAC__ = null/.test(noFile) && /No BOH layout file in this folder/.test(srv.out()));
await fetch(`http://${IP}:${port}/__stop`, {method: 'POST'}).catch(() => {}); await sleep(800);
fs.copyFileSync(exportPath, path.join(kit2, path.basename(exportPath)));
srv = startServer(); await sleep(1500);
check('iPhone launcher finds the layout file in the kit folder', srv.out().includes('BOH layout file found: ' + path.basename(exportPath)));
const BASE = `http://${IP}:${port}/`;
const ph = await newPage(BASE, {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
await ph.page.goto(BASE + 'index.html'); await ph.page.waitForTimeout(1500);
await ph.page.locator('#hltest-tab').click(); await ph.page.waitForTimeout(300);
const macBtn = ph.page.locator('#hltest-panel button', {hasText: 'Use BOH layout from the Mac'});
check('iPhone: TEST tab offers "Use BOH layout from the Mac"', await macBtn.count() === 1, await macBtn.innerText().catch(() => ''));
await macBtn.tap(); await ph.page.waitForTimeout(400);
const phReview = await ph.page.locator('#hltest-layout-review').innerText().catch(() => '');
await ph.page.locator('#hltest-panel button', {hasText: 'Apply this floor plan'}).tap(); await ph.page.waitForTimeout(2000);
const phDoc = await ph.page.evaluate(() => __MOCK_DB__.__dump().boh_shared.tables);
check('iPhone: the same file gives the same floor plan as on the Mac', /rooms/.test(phReview) && eq(omit(phDoc, ['updatedAt']), omit(doc, ['updatedAt'])));
await ui_iphone(ph.page);
async function ui_iphone(page) {
  const uu = (await import(pathToFileURL(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../acceptance/lib.mjs')))).ui(page);
  await uu.pin(waiter.code); await uu.floor(); await page.waitForTimeout(600);
  const n = await page.evaluate(() => document.querySelectorAll('#floor-canvas .floor-obj.seatable').length);
  check('iPhone: POS opens the original floor plan after signing in', n > 0, n + ' tables on the first room view (' + await page.evaluate(() => STATE.floorFilter) + ')');
  await page.screenshot({path: path.join(OUT, 'iphone-floor.png')});
}
check('iPhone: no page errors and no outside requests', !ph.errors.length && !ph.external.length, JSON.stringify(ph.errors.concat(ph.external)).slice(0, 200));
await fetch(`http://${IP}:${port}/__stop`, {method: 'POST'}).catch(() => {}); await sleep(500);
srv.p.kill();
await browser.close(); bohSrv.close(); kitSrv.close();
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const failed = results.filter(r => r.pass === false).length, passed = results.filter(r => r.pass).length;
console.log(`\n${passed} passed, ${failed} failed  (export file and screenshots: ${OUT})`);
process.exit(failed ? 1 : 0);
