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
    const s = sessionOf('22'); s.guestCount = 4; ensureOpenCheck('22');
    const ids = checkPositionIdentities(); out.ids = ids;
    toggleAllergy(ids[1], 'Gluten');
    const pfid = EPICUREAN_SCALINI.prixFixe.id;
    for (const id of ids) {
      setActivePositionIdentity(id);
      openPrixFixeSelector(pfid);
      const pf = findPrixFixeMenu(pfid);
      (pf.courses||[]).forEach((c,ci)=>{ if (pfCourseMode(c)==='choose') { const r=document.querySelector('input[name="pf-course-'+ci+'"]'); if (r && !r.checked) { r.checked=true; r.dispatchEvent(new Event('change',{bubbles:true})); } } });
      confirmPrixFixe(pfid);
      const ack=document.querySelector('.allergy-warn .ask-btn, .allergy-warn .gf-btn'); if (ack) ack.click();
      closeSheet && closeSheet();
    }
    renderOrder();
    out.free = (document.querySelector('.free-panel')||{}).innerText;
    out.freeRows = document.querySelectorAll('.free-row').length;
    out.dots = document.querySelectorAll('.ts-dots').length;
    out.inlineBtns = document.querySelectorAll('.ts-row-actions:not(.compact)').length;
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await page.screenshot({ path: '/home/claude/scratch/pos-v6.png', fullPage: false });
  await page.evaluate(()=>{ const d=document.querySelector('.ts-dots'); if(d) d.click(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/home/claude/scratch/pos-v6b.png' });
  // back arrow must leave the table
  const b = await page.evaluate(()=>{ handheldBack(); const a=STATE.activeTab; handheldBack(); return [a, STATE.activeTab]; });
  console.log('back taps ->', JSON.stringify(b));
} catch(e){ console.error(e); code=1; }
await browser.close(); server.close(); await fake.close?.(); process.exit(code);
