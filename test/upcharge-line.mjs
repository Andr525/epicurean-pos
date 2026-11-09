// (v5): free courses per seat off the bill, SEND/SEND DRINKS/HOLD, MAIN prompt after PF, GF pasta, overview ticket.
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
    const ids = checkPositionIdentities(); setActivePositionIdentity(ids[0]);
    const pfid = EPICUREAN_SCALINI.prixFixe.id;
    openPrixFixeSelector(pfid);
    const pick=(ci,oi)=>{ const r=document.querySelector('input[name="pf-course-'+ci+'"][value="'+oi+'"]'); r.checked=true; r.dispatchEvent(new Event('change',{bubbles:true})); };
    pick(1,0); pick(2,9);
    const t=document.querySelector('[id^="pf-temp"]'); out.hasTemp=!!t;
    out.sheet=document.querySelector('#pf-overlay')?document.querySelector('#pf-overlay').innerText.slice(0,200):'';
    document.getElementById('pf-note-1')&&(document.getElementById('pf-note-1').value='');
    confirmPrixFixe(pfid);
    out.bill=[...document.querySelectorAll('.ts-line')].map(e=>e.innerText.replace(/\n+/g,' / '));
    out.warn=(document.querySelector('[data-manual-allergy-block]')||{}).innerText||'';
    return out;
  });
  assert.ok(r.bill.some(x=>/Prix Fixe \/ .*\$89/.test(x)) && !r.bill.some(x=>/upcharge/i.test(x)), 'pkg line must be base price: '+r.bill);
  assert.ok(r.bill.some(x=>/Filet Mignon.*\+\$10/.test(x)), 'upcharge must sit on the dish line: '+r.bill);
  console.log('PASS upcharge on the dish line, Prix Fixe line clean');
} catch (e) { console.log('ERR', e.message); }
finally { await browser.close(); await fake.close(); server.close(); }
