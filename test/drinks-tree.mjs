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
  await page.evaluate(() => setMenuFamily('drinks'));
  await page.waitForTimeout(500);
  const names = async () => page.evaluate(() => Array.from(document.querySelectorAll('.wine-row, .ts-tile')).map(e => e.textContent));
  const chips = await page.evaluate(() => Array.from(document.querySelectorAll('.drink-group')).map(e => e.textContent));
  console.log('chips', JSON.stringify(chips));
  assert.ok(chips.some(c => /^Cocktails/.test(c)), 'no Cocktails chip');
  assert.ok(chips.some(c => /^Wine List/.test(c)), 'no Wine List chip');
  assert.ok(chips.some(c => /^Mocktails/.test(c)), 'no Mocktails chip');
  assert.ok(chips.some(c => /^Champagne/.test(c)), 'no Champagne chip');
  await page.evaluate(() => setDrinkGroup('cocktails'));
  let n = (await names()).join('|');
  assert.ok(/Negroni/.test(n) && /Old Fashioned/.test(n) && !/Garden Spritz/.test(n) && !/Wine 1/.test(n), 'cocktails list wrong: ' + n);
  await page.evaluate(() => setDrinkGroup('mocktails'));
  n = (await names()).join('|');
  assert.ok(/Garden Spritz/.test(n) && !/Negroni/.test(n), 'mocktails wrong: ' + n);
  await page.evaluate(() => setDrinkGroup('wine'));
  n = (await names()).join('|');
  assert.ok(/Wine 1/.test(n) && !/Negroni/.test(n), 'wine list wrong');
  // VIN entry
  await page.evaluate(() => { const i = document.getElementById('pos-item-find'); i.value = 'VIN 1007'; onAddItemsSearchInput(i); });
  n = (await names()).join('|');
  assert.ok(/Wine 7\b/.test(n) && !/Wine 8\b/.test(n), 'VIN lookup wrong: ' + n);
  console.log('PASS drinks tree + VIN lookup');
} catch (error) {
  console.log('FAIL ' + (error && error.message));
  code = 1;
} finally {
  await browser.close();
  await fake.close();
  server.close();
}
process.exit(code);
