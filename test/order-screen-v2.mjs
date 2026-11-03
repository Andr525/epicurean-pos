// Waiter flow: persistent SEND bar, per-guest prix fixe pricing, a la carte tiles, scroll holds, one-tap clear from map.
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
  fake.put('boh_shared', 'tasting_menus', { list: [] });
  fake.put('boh_shared', 'prix_fixe_menus', { list: [] });
  const page = await ctx.newPage();
  await page.goto(origin + '/index.html');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    finishLogin({ name: 'Max Rodriguez', code: '3001', role: 'Food Master' });
    const s = sessionOf('22'); s.guestCount = 2; s.seatedAt = Date.now(); ensureOpenCheck('22'); selectTable('22');
  });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const out = {};
    const pf = (STATE.prixFixeMenus && STATE.prixFixeMenus[0]) || SEED_PRIX_FIXE_MENUS[0];
    function pick(names) {
      openPrixFixeSelector(pf.id);
      const m = findPrixFixeMenu(pf.id);
      (m.courses || []).forEach((c, ci) => {
        const radios = [...document.querySelectorAll('input[name="pf-course-' + ci + '"]')];
        if (!radios.length) return;
        let idx = 0;
        if (names) { const k = (c.options || []).findIndex((o) => names.some((w) => new RegExp(w, 'i').test(o.name))); if (k >= 0) idx = k; }
        (radios.find((x) => x.value === String(idx)) || radios[0]).checked = true;
        const o = (c.options || [])[idx];
        if (o && o.askTemp) { const t = document.querySelector('input[name="pf-temp-' + ci + '-' + idx + '"]'); if (t) t.checked = true; }
      });
      confirmPrixFixe(pf.id);
    }
    setActiveSeat(1); pick(['raviolo', 'mignon|giambotta']);
    setActiveSeat(2); pick(null);
    out.pkgRows = [...document.querySelectorAll('.working-pkg')].map((e) => e.textContent);
    const bar = document.querySelector('.send-bar');
    const br = bar && bar.getBoundingClientRect();
    out.barVisible = !!bar && br.bottom <= innerHeight + 1 && br.height > 40;
    out.barText = bar && bar.textContent;
    out.stayHold = !!document.querySelector('.toast-check-actions .stay, .toast-check-actions .send');
    // scroll holds across re-render
    const c = document.getElementById('app-content'); const k = c.querySelector('.ts-check');
    c.scrollTop = c.scrollHeight; k.scrollTop = k.scrollHeight;
    const b = [c.scrollTop, k.scrollTop];
    refreshOrderView(); refreshOrderView();
    const c2 = document.getElementById('app-content'); const k2 = c2.querySelector('.ts-check');
    out.scrollBefore = b; out.scrollAfter = [c2.scrollTop, k2.scrollTop];
    // a la carte
    setMenuFamily('food');
    out.tiles = [...document.querySelectorAll('.ts-tile')].map((e) => e.textContent);
    return out;
  });
  assert.deepEqual(r.pkgRows.map((t) => t.replace(/\s+/g, ' ')), ['1Prix Fixe (+$18 upcharge)✕ 1A$107', '1Prix Fixe✕ 2$89'], 'prix fixe rows: ' + JSON.stringify(r.pkgRows));
  assert.ok(r.barVisible && /SEND \(2\)/.test(r.barText), 'send bar: ' + r.barText);
  assert.equal(r.stayHold, false, 'Stay/Send buttons should be gone from the check');
  assert.deepEqual(r.scrollAfter, r.scrollBefore, 'scroll moved ' + r.scrollBefore + ' -> ' + r.scrollAfter);
  assert.ok(r.tiles.some((t) => /Appetizers · \$32/.test(t)) && r.tiles.some((t) => /Mains · \$46/.test(t)) && r.tiles.some((t) => /Desserts · \$27/.test(t)), 'a la carte tiles: ' + r.tiles);
  // one-tap clear from the map
  await page.evaluate(() => { STATE.rooms = [{ id: 'r1', name: 'Main' }]; STATE.roomObjs = { r1: [{ id: 'o22', type: 'table', num: '22', x: 40, y: 40, w: 90, h: 90, seats: 4, shape: 'square' }] }; backToFloor(); STATE.floorFilter = 'all'; renderTables(); });
  await page.waitForTimeout(800);
  const box = await page.evaluate(() => { const x = document.querySelector('.tbl-clear'); if (!x) return null; const q = x.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; });
  assert.ok(box, 'no clear button on the table');
  await page.touchscreen.tap(box.x, box.y);
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => !!STATE.tableSessions['22']), false, 'table 22 not cleared');
  console.log('PASS send bar, prix fixe pricing, scroll, a la carte tiles, map clear');
} catch (error) {
  console.log('FAIL ' + (error && error.message));
  code = 1;
} finally {
  await browser.close();
  await fake.close();
  server.close();
}
process.exit(code);
