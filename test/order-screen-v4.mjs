// Nov 2 night: free courses per seat off the bill, SEND/SEND DRINKS/HOLD, MAIN prompt after PF, GF pasta, overview ticket.
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
    const ids = checkPositionIdentities(); out.ids = ids;
    setActivePositionIdentity(ids[0]);
    const pfid = EPICUREAN_SCALINI.prixFixe.id;
    openPrixFixeSelector(pfid);
    // choose the first real option of every guest-choice course (pasta for primi)
    const pf = findPrixFixeMenu(pfid);
    out.courses = (pf.courses || []).map((c, ci) => ci + ':' + (c.course || c.name) + ':' + ((c.options || []).length));
    confirmPrixFixe(pfid);
    setActivePositionIdentity(ids[1]);
    openPrixFixeSelector(pfid); confirmPrixFixe(pfid);
    out.orders = STATE.activeTastingOrders.length;
    out.billText = [...document.querySelectorAll('.ts-check-lines .working-line')].map((e) => e.textContent.replace(/\s+/g, ' ')).join(' | ');
    out.freeRows = [...document.querySelectorAll('.free-row')].map((e) => e.textContent.replace(/\s+/g, ' '));
    // per-seat modify: only that seat's input, KC for that seat only
    openPositionSubSheet('welcome', ids[0]);
    out.inputs = document.querySelectorAll('.pos-sub-input').length;
    document.querySelector('#sheet-overlay.show .ghost-btn').click();
    savePositionSubs('welcome');
    out.kc0 = positionSubForSeat('welcome', 1, true);
    out.kc1 = positionSubForSeat('welcome', 2, false);
    // buttons
    out.barBefore = [...document.querySelectorAll('.send-bar .sb-send')].map((b) => b.textContent + '|' + b.className);
    return out;
  });
  console.log(JSON.stringify(r));
  assert.equal(r.inputs, 1, 'sub sheet should show one seat');
  assert.match(r.kc0, /KC/, 'KC not saved for seat 1A: ' + r.kc0);
  assert.ok(!r.kc1, 'KC leaked to seat 2: ' + r.kc1);
  assert.ok(!/Smoked Salmon|Zucchini|sorbet/i.test(r.billText), 'free items on bill: ' + r.billText);
  assert.ok(r.freeRows.length >= 2, 'free rows per seat: ' + r.freeRows);
  assert.ok(r.barBefore.some((t) => /^SEND \(/.test(t) && !/drinks/.test(t)), 'green SEND: ' + r.barBefore);
  const r2 = await page.evaluate(() => {
    const out = {};
    const ids = checkPositionIdentities();
    const pfid = EPICUREAN_SCALINI.prixFixe.id;
    // back-and-forth: remove seat 2 PF then re-enter with a gluten allergy + pasta
    const to2 = STATE.activeTastingOrders.find((o) => orderPositionIdentity(o) === ids[1]);
    removeSeatPrixFixe(to2.id);
    out.afterRemove = STATE.activeTastingOrders.length;
    toggleAllergy(ids[1], 'Gluten');
    setActivePositionIdentity(ids[1]);
    openPrixFixeSelector(pfid);
    const pf = findPrixFixeMenu(pfid);
    let picked = null;
    (pf.courses || []).forEach((c, ci) => (c.options || []).forEach((o, oi) => {
      if (!picked && /fusilli/i.test(o.name)) { picked = { ci, oi, name: o.name, allergens: o.allergens }; }
    }));
    out.picked = picked;
    document.querySelector('input[name="pf-course-' + picked.ci + '"][value="' + picked.oi + '"]').checked = true;
    confirmPrixFixe(pfid);
    out.strip = (document.querySelector('.allergy-warn') || {}).textContent || '';
    out.hasGf = !!document.querySelector('.allergy-warn .gf-btn');
    out.addedBefore = STATE.activeTastingOrders.length;
    allergyGlutenFree();
    const to = STATE.activeTastingOrders.find((o) => orderPositionIdentity(o) === ids[1]);
    out.gfNotes = to ? diningCourses(to).map((c) => c.modNote || '').filter((n) => /GLUTEN-FREE PASTA/.test(n)) : [];
    out.alertTickets = STATE.orders.filter((o) => o.allergyOverride).length;
    // second pasta/appetizer for the same seat -> MAIN or APPETIZER + size
    const apps = listPrixFixeExtraDishes().filter((x) => x.kind === 'app' && !(x.allergens || []).some((a) => /gluten|wheat/i.test(a)));
    beginAddPrixFixeExtra(apps[0].key);
    out.sheet = (document.querySelector('#sheet-overlay.show .sheet') || {}).textContent || '';
    beginAddPrixFixeExtra(apps[0].key, 'M-A'); commitPendingItem();
    const ln = STATE.currentOrder[STATE.currentOrder.length - 1];
    out.line = ln.name + ':' + ln.price + ':' + ln.serviceCourse;
    // drinks: purple, hold (yellow), release
    const neg = STATE.menuItems.find((i) => /negroni/i.test(i.name));
    STATE.currentOrder.push({ lineId: genId(), table: '22', seat: 1, seatPriority: false, course: 1, held: false, qty: 1, id: neg.id, name: neg.name, price: neg.price, station: neg.station, checkId: activeCheckId(), category: neg.category || 'cocktails' });
    renderOrder();
    out.bar1 = [...document.querySelectorAll('.send-bar .sb-send')].map((b) => b.textContent);
    toggleHoldLine(STATE.currentOrder[STATE.currentOrder.length - 1].lineId);
    out.bar2 = [...document.querySelectorAll('.send-bar .sb-send')].map((b) => b.textContent);
    out.holdBtn = !!document.querySelector('.hold-btn.on');
    toggleHoldLine(STATE.currentOrder[STATE.currentOrder.length - 1].lineId);
    sendFromBar('drinks');
    out.drinkTickets = STATE.orders.filter((o) => !o.overview && !o.isKitchenNote && (o.items || []).some((i) => /negroni/i.test(i.name))).length;
    out.foodLeft = STATE.currentOrder.length;
    sendFromBar('food');
    const ov = STATE.orders.filter((o) => o.overview);
    out.overview = ov.map((o) => (o.items || []).map((i) => i.seat + ':' + i.station + ':' + i.name + '|' + (i.notes || '')));
    out.barAfter = [...document.querySelectorAll('.send-bar .sb-send')].map((b) => b.textContent);
    out.billAfter = [...document.querySelectorAll('.ts-check-lines .working-line')].map((e) => e.textContent.replace(/\s+/g, ' ')).join(' | ');
    return out;
  });
  console.log(JSON.stringify(r2));
  assert.equal(r2.afterRemove, 1, 'seat order not removed');
  assert.ok(r2.hasGf, 'no Gluten-free pasta button: ' + r2.strip);
  assert.ok(r2.gfNotes.length >= 1, 'GF modifier missing: ' + JSON.stringify(r2.gfNotes));
  assert.equal(r2.alertTickets, 0, 'GF pasta should not raise allergy override');
  assert.match(r2.sheet, /MAIN course/, 'no main prompt: ' + r2.sheet);
  assert.match(r2.line, /appetizer size.*:\d+:3$/, r2.line);
  assert.ok(r2.bar1.some((t) => /SEND DRINKS \(1\)/.test(t)), 'purple drinks button: ' + r2.bar1);
  assert.ok(!r2.bar2.some((t) => /DRINKS/.test(t)) && r2.holdBtn, 'hold: ' + r2.bar2);
  assert.equal(r2.drinkTickets, 1, 'drink not sent');
  assert.ok(r2.overview.length >= 1 && r2.overview.flat().some((t) => /fusilli/i.test(t) && /GLUTEN-FREE PASTA/.test(t)), 'overview: ' + JSON.stringify(r2.overview));
  assert.ok(!r2.overview.flat().some((t) => /negroni/i.test(t)), 'drink in overview ticket');
  assert.ok(!/NOTHING|KITCHEN/i.test(r2.barAfter.join(' ')), 'bar after: ' + r2.barAfter);
  assert.ok(!/ORDER TAKEN|ALLERGY OVERRIDE|ASK KITCHEN|ORDER CANCELLED/i.test(r2.billAfter), 'tickets leaked onto bill: ' + r2.billAfter);
  await page.evaluate(() => { const x=checkPositionIdentities(); toggleHoldLine((STATE.currentOrder.find(l=>l.pfExtra)||{}).lineId); renderOrder(); });
  const r5 = await page.evaluate(() => {
    const out = {};
    const rows0 = document.querySelectorAll('.free-row').length;
    const to = STATE.activeTastingOrders[0];
    const idx = diningCourses(to).findIndex((c) => /zucchini/i.test(c.choice || c.name || ''));
    openFreeCourseSheet(to.id, idx);
    document.getElementById('free-sub-input').value = 'grilled asparagus';
    saveFreeCourseSub(to.id, idx);
    out.sub = diningCourses(to)[idx].modNote;
    out.rowText = [...document.querySelectorAll('.free-row')].map((e) => e.textContent.replace(/\s+/g, ' ')).find((t) => /asparagus/.test(t)) || '';
    const before = STATE.orders.length;
    fireFreeOne(to.id, idx);
    out.fired = diningCourses(to)[idx].fired === true;
    const others = diningCourses(to).filter((c, i) => i !== idx && /salmon|shrimp/i.test(c.choice || c.name || '')).every((c) => !c.fired);
    out.othersHeld = others;
    out.rows0 = rows0;
    return out;
  });
  assert.ok(r5.rows0 >= 3, 'one free row per dish for the whole table: ' + r5.rows0);
  assert.match(r5.sub, /SUB: grilled asparagus/);
  assert.match(r5.rowText, /asparagus/);
  assert.ok(r5.fired && r5.othersHeld, 'fire one free course only: ' + JSON.stringify(r5));
  const r4 = await page.evaluate(() => { const a = extraPlateFeeByKind('main'); STATE.serviceSettings = { extraAppetizer: 35, extraMain: 50, extraDessert: 30 }; return [a, extraPlateFeeByKind('app'), extraPlateFeeByKind('main'), extraPlateFeeByKind('des')]; });
  assert.deepEqual(r4, [46, 35, 50, 30], 'prices must follow BOH service_settings: ' + r4);
  const writes = fake.requests ? fake.requests.filter((q) => /boh_shared\/(bar|wines)/.test(q.path || q.url || '') && /PATCH|PUT|POST/.test(q.method || '')) : [];
  assert.equal(writes.length, 0, 'POS wrote to BOH bar/wines');
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  console.log('PASS free courses per seat, KC per seat, clean bill, SEND label');
} catch (error) {
  console.log('FAIL ' + (error && error.stack || error));
  code = 1;
} finally {
  await browser.close();
  server.close();
  await fake.close();
  process.exit(code);
}
