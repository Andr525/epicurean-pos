// Wine by the glass: 2 oz and 6 oz bill their own price. (derived from drinks-tree)
// Drinks are a category tree fed from BOH data (wines by VIN, cocktails, mocktails ...).
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
  const wines = [];
  for (let i = 1; i <= 60; i++) wines.push({ id: 'w' + i, vin: String(1000 + i), name: 'Wine ' + i, producer: 'P', bottlePrice: 80 + i, region: i % 10 === 0 ? 'Champagne' : 'Tuscany', visible: true });
  fake.put('boh_shared', 'wines', { list: wines });
  fake.put('boh_shared', 'bar', { list: [
    { id: 'b1', name: 'Negroni', kind: 'Cocktail', price: 18, visible: true },
    { id: 'b2', name: 'Old Fashioned', kind: 'Cocktail', price: 19, visible: true },
    { id: 'b3', name: 'Garden Spritz', kind: 'Mocktail', price: 12, visible: true },
    { id: 'b4', name: 'Peroni', kind: 'Beer', price: 9, visible: true },
    { id: 'b5', name: 'Macallan 12', kind: 'Spirit', price: 24, visible: true },
    { id: 'b6', name: 'Espresso', kind: 'Coffee', price: 5, visible: true }
  ] });
  fake.put('boh_shared', 'btg_pours', { prices: { btg_white_fiano: { p6: 21, p2: 9 } } });
  fake.put('boh_shared', 'tasting_menus', { list: [] });
  fake.put('boh_shared', 'prix_fixe_menus', { list: [] });
  const page = await ctx.newPage();
  await page.goto(origin + '/index.html');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    finishLogin({ name: 'Max Rodriguez', code: '3001', role: 'Food Master' });
    const s = sessionOf('22'); s.guestCount = 2; s.seatedAt = Date.now(); ensureOpenCheck('22'); selectTable('22');
  });
  await page.waitForTimeout(8000);
  console.log(await page.evaluate(() => JSON.stringify({mi:(STATE.menuItems||[]).length, seed:typeof SEED_ITEMS, live:STATE.menuLive, err:window.__err})));
  await page.evaluate(() => setMenuFamily('drinks'));
  const run = async (id, opt) => page.evaluate(({id, opt}) => {
    beginAddItem(id);
    const mi = STATE.pendingItem.modifiers.findIndex(m => m.group === 'Pour');
    const opts = STATE.pendingItem.modifiers[mi].options;
    const o = opts.find(x => x.indexOf(opt) >= 0);
    pickMod(mi, o);
    const line = (STATE.currentOrder || []).slice(-1)[0] || {};
    return { opts, price: line.price, mod: line.selectedMod, mods: line.mods };
  }, {id, opt});
  const a = await run('btg_white_walch', '2 oz');
  console.log(JSON.stringify(a));
  assert.equal(a.price, 8, '2 oz must bill $8, got ' + a.price);
  assert.equal(a.mod, '2 oz');
  const b = await run('btg_white_walch', '6 oz');
  assert.equal(b.price, 25, '6 oz must bill $25');
  assert.equal(b.mod, '6 oz');
  const c = await run('btg_white_fiano', '2 oz');
  assert.equal(c.price, 9, 'BOH 2 oz override must be used, got ' + c.price);
  const d = await run('btg_white_fiano', '6 oz');
  assert.equal(d.price, 21, 'BOH 6 oz override must be used, got ' + d.price);
  console.log('PASS wine pours bill their own price');
  // drink Modify = free text only; gluten-free pasta ticked = no warning, else Ask kitchen only
  const e = await page.evaluate(() => {
    const out = {};
    const line = STATE.currentOrder.slice(-1)[0];
    openLineNoteSheet(line.lineId);
    out.chips = document.querySelectorAll('.note-allergen').length;
    out.area = !!document.getElementById('line-mod-note');
    closeSheet();
    const ids = checkPositionIdentities();
    toggleAllergy(ids[0], 'Gluten');
    const sel = [{ course: 'Primi', choice: 'Rigatoni "Amatriciana"', name: 'Rigatoni "Amatriciana"', allergens: ['Gluten'] }];
    STATE._gfPasta = ['Rigatoni "Amatriciana"'];
    out.warnWithGf = manualMenuAllergyWarning(sel, ids[0]);
    STATE._gfPasta = null;
    out.warnNoGf = manualMenuAllergyWarning(sel, ids[0]);
    out.btns = [...document.querySelectorAll('.allergy-choice button')].map(b => b.textContent);
    return out;
  });
  console.log(JSON.stringify(e));
  assert.equal(e.chips, 0, 'drink Modify must not show allergy chips');
  assert.ok(e.area, 'drink Modify needs a text box');
  assert.equal(e.warnWithGf, false, 'GF pasta ticked: no warning');
  assert.equal(e.warnNoGf, true);
  assert.ok(e.btns.length === 2 && /Make gluten-free|Ask kitchen/.test(e.btns[0]) && /Cancel/.test(e.btns[1]), 'buttons: ' + e.btns);
  console.log('PASS drink modify is text only; allergy prompt simplified');

} catch (error) {
  console.log('FAIL ' + (error && error.message));
  code = 1;
} finally {
  await browser.close();
  await fake.close();
  server.close();
}
process.exit(code);
