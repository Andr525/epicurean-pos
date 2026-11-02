// Food tabs, drink hold/send + pending warning, coffee station, note composer, allergy block.
// Offline: fake Firestore on localhost, Firebase/Square/fonts stubbed, iPhone 14 viewport.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startFakeFirestore } from './fake-firestore.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const fake = await startFakeFirestore();
const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
let code = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript((fsRoot) => {
    Object.defineProperty(window, 'FIRESTORE_ROOT', { configurable: false, enumerable: true, get() { return fsRoot; }, set() {} });
    const user = { uid: 't', getIdToken() { return Promise.resolve('x'); } };
    const auth = { currentUser: null, signInAnonymously() { auth.currentUser = user; return Promise.resolve({ user }); } };
    window.firebase = { initializeApp() { return {}; }, firestore() { return {}; }, auth() { return auth; } };
  }, fake.root);
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (u.pathname.includes('/firebasejs/') || u.hostname.endsWith('squarecdn.com')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    if (u.hostname.includes('fonts')) return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  fake.put('boh_shared', 'menu', { cats: [{ id: 'c1', name: 'Cat1' }], items: [{ id: 'i1', name: 'Probe Dish', price: 10, cat: 'c1', station: 'Grill' }], modGroups: [] });
  fake.put('boh_shared', 'bar', { list: [
    { id: 'b1', name: 'Negroni', kind: 'Cocktail', price: 18, visible: true },
    { id: 'b2', name: 'Cappuccino', kind: 'Coffee', price: 6, visible: true }
  ] });
  fake.put('boh_shared', 'tasting_menus', { list: [] });
  fake.put('boh_shared', 'prix_fixe_menus', { list: [] });
  const page = await ctx.newPage();
  await page.goto(origin + '/index.html');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    finishLogin({ name: 'Max Rodriguez', code: '3001', role: 'Food Master' });
    const s = sessionOf('22'); s.guestCount = 2; s.seatedAt = Date.now(); ensureOpenCheck('22'); selectTable('22');
  });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(async () => {
    const out = {};
    out.tabs = [...document.querySelectorAll('.period-tab')].map((e) => e.textContent);
    out.tiles = [...document.querySelectorAll('.ts-tile')].map((e) => e.textContent);
    const ids = checkPositionIdentities();
    toggleAllergy(ids[0], 'Tree Nut');
    const d = listPrixFixeExtraDishes().find((x) => /pignoli/i.test(x.name));
    beginAddPrixFixeExtra(d.key);
    const before = STATE.currentOrder.length;
    commitPendingItem();
    out.allergyAdded = STATE.currentOrder.length - before;
    out.allergyWarn = !!document.querySelector('.manual-preadd-warning');
    out.addAnywayBtn = !!document.querySelector('.allergy-choice .primary-btn');
    allergyAddAnyway();
    out.afterOverride = STATE.currentOrder.length - before;
    out.alert = STATE.orders.filter((o) => o.allergyOverride).map((o) => o.items[0].name);
    closeSheet();
    return out;
  });
  assert.deepEqual(r.tabs, ['Food', 'Drinks'], 'tabs: ' + r.tabs);
  assert.ok(!r.tiles.some((t) => /^FOOD$|^DRINKS$/.test(t)), 'big root boxes still shown');
  assert.equal(r.allergyAdded, 0, 'pignoli dish was added for a nut-allergy seat');
  assert.ok(r.allergyWarn && r.addAnywayBtn, 'no allergy warning with Add anyway button');
  assert.equal(r.afterOverride, 1, 'Add anyway did not add the dish');
  assert.ok(r.alert.length === 1 && /ALLERGY OVERRIDE/.test(r.alert[0]), 'no allergy alert ticket: ' + r.alert);
  await page.waitForTimeout(13000);
  const r2 = await page.evaluate(() => {
    const out = {};
    const items = STATE.menuItems.filter((i) => /negroni|cappuccino/i.test(i.name));
    out.stations = items.map((i) => i.name + ':' + i.station);
    items.forEach((i) => STATE.currentOrder.push({ lineId: genId(), table: '22', seat: 1, seatPriority: false, course: 1, held: false, qty: 1, id: i.id, name: i.name, price: i.price, station: i.station, checkId: activeCheckId(), category: i.category }));
    renderOrder();
    out.banner = (document.querySelector('.pending-banner') || {}).textContent;
    out.fire = [...document.querySelectorAll('.course-fire-row button')].map((e) => e.textContent);
    holdCourse(1);
    out.afterHold = [...document.querySelectorAll('.course-fire-row button')].map((e) => e.textContent);
    out.heldBanner = (document.querySelector('.pending-banner') || {}).textContent;
    openNoteComposer();
    out.composer = !!document.getElementById('free-note-text');
    document.getElementById('free-note-text').value = 'no salmon, birthday';
    pickNoteTarget('Bar'); pickNoteSeat(checkPositionIdentities()[0]);
    sendFreeNote();
    out.note = STATE.orders.filter((o) => o.isKitchenNote).map((o) => o.items[0].name + '|' + o.items[0].station);
    return out;
  });
  assert.ok(r2.stations.some((x) => /Cappuccino:Coffee/.test(x)) && r2.stations.some((x) => /Negroni:Bar/.test(x)), 'stations ' + r2.stations);
  assert.match(r2.banner, /1 drink · 1 coffee/, 'pending banner: ' + r2.banner);
  assert.ok(r2.fire.some((t) => /SEND DRINKS TO BAR/.test(t)) && r2.fire.some((t) => /HOLD DRINKS/.test(t)), 'fire row: ' + r2.fire);
  assert.ok(r2.afterHold.some((t) => /SEND HELD DRINKS TO BAR/.test(t)), 'after hold: ' + r2.afterHold);
  assert.match(r2.heldBanner, /2 held/, 'held banner: ' + r2.heldBanner);
  assert.ok(r2.composer, 'note composer has no text box');
  assert.ok(r2.note.some((n) => /SEAT .* NOTE — no salmon, birthday\|Bar/.test(n)), 'note: ' + r2.note);
  console.log('PASS tabs, allergy block, drink hold/send, pending warning, coffee station, note composer');
} catch (error) {
  console.log('FAIL ' + (error && error.message));
  code = 1;
} finally {
  await browser.close();
  await fake.close();
  server.close();
}
process.exit(code);
