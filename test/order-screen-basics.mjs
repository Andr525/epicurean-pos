// Voice debug boxes hidden, forced rebuild keeps scroll, unused tables clear after 1 hour.
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
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const out = {};
    out.voiceBoxes = document.querySelectorAll('.voice-test, #voice-pricing-menu').length;
    const c = document.querySelector('#app-content');
    const pane = document.getElementById('add-items-pane');
    pane.scrollTop = pane.scrollHeight; c.scrollTop = c.scrollHeight;
    out.before = [pane.scrollTop, c.scrollTop];
    STATE._catalogFp = 'changed-' + Date.now();
    renderOrder();
    const p2 = document.getElementById('add-items-pane');
    out.after = [p2.scrollTop, document.querySelector('#app-content').scrollTop];
    // idle table sweep
    const a = sessionOf('31'); a.guestCount = 2; a.seatedAt = Date.now() - 61 * 60000; ensureOpenCheck('31');
    const b = sessionOf('32'); b.guestCount = 2; b.seatedAt = Date.now() - 30 * 60000; ensureOpenCheck('32');
    sweepIdleTables();
    out.t31 = !!STATE.tableSessions['31']; out.t32 = !!STATE.tableSessions['32'];
    return out;
  });
  assert.equal(r.voiceBoxes, 0, 'voice debug boxes still on screen');
  assert.ok(r.before[0] > 0 || r.before[1] > 0, 'nothing scrollable');
  assert.deepEqual(r.after, r.before, 'scroll jumped on rebuild: ' + r.before + ' -> ' + r.after);
  assert.equal(r.t31, false, 'table unused >1h still open');
  assert.equal(r.t32, true, 'table unused 30min wrongly cleared');
  console.log('PASS voice hidden, scroll kept, idle sweep ok', JSON.stringify(r));
} catch (error) {
  console.log('FAIL ' + (error && error.message));
  code = 1;
} finally {
  await browser.close();
  await fake.close();
  server.close();
}
process.exit(code);
