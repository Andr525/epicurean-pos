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
    const ids = checkPositionIdentities();
    const pfid = EPICUREAN_SCALINI.prixFixe.id;
    const pf = findPrixFixeMenu(pfid);
    function pickAll(skipLater){
      (pf.courses||[]).forEach((c,ci)=>{ const m=pfCourseMode(c); if (m==='choose' || (m==='later' && !skipLater)) { const r=document.querySelector('input[name="pf-course-'+ci+'"]:not([value="none"])'); if (r) { r.checked=true; r.dispatchEvent(new Event('change',{bubbles:true})); } } });
    }
    // seat 1: dessert picked in the selector BEFORE the savory items exist
    setActivePositionIdentity(ids[0]); openPrixFixeSelector(pfid);
    out.laterRadios = [...document.querySelectorAll('.pf-course-select')].filter(e=>/later/i.test(e.querySelector('label').textContent)).map(e=>e.querySelectorAll('input[type=radio]').length);
    pickAll(false); confirmPrixFixe(pfid); closeSheet();
    const to1 = seatDiningOrder();
    out.dessert1 = diningCourses(to1).filter(c=>pfCourseKind(String(c.course||''))==='des' && !isEntremetCourse(c)).map(c=>c.choice||c.name);
    out.dessertIsDish = dessertIsDish(to1);
    // seat 1 again: panel instead of a block
    openPrixFixeSelector(pfid);
    out.panel = (document.getElementById('pf-overlay').innerText||'').slice(0,160);
    openExtraDishesPanel('des');
    const dishBtn = document.querySelector('.xp-dish');
    out.extraDessertBtn = dishBtn && dishBtn.innerText.replace(/\s+/g,' ');
    closePfSelector();
    // sorbet: free panel must not list it while a dessert dish is chosen
    renderOrder();
    out.sorbetInPanel = /Pre-dessert/.test((document.querySelector('.free-panel')||{}).innerText||'');
    out.sorbetAllergens = diningCourses(to1).filter(isEntremetCourse).map(c=>c.allergens);
    out.nextIsNotSorbet = !isEntremetCourse(diningCourses(to1)[nextDiningFire(to1).idx]||{});
    { const cs=diningCourses(to1); const di=cs.findIndex(c=>!isEntremetCourse(c)&&!c.headingOnly&&pfCourseKind(String(c.course||''))==='des'&&(c.choice||c.name)); out.fireDessert=fireDiningCourse(to1,true,di); out.sorbetFired=cs.filter(isEntremetCourse).map(c=>!!c.fired); out.dessertFired=!!cs[di].fired; }
    // seat 2 with no dessert dish -> sorbet appears and can fire alone
    setActivePositionIdentity(ids[1]); openPrixFixeSelector(pfid); pickAll(true);
    const noneR=[...document.querySelectorAll('.pf-course-select')].filter(e=>/later/i.test(e.querySelector('label').textContent))[0]; if(noneR){ const r=noneR.querySelector('input[value="none"]'); if(r){r.checked=true;} }
    confirmPrixFixe(pfid); closeSheet(); renderOrder();
    out.sorbetListed2 = /Pre-dessert/.test((document.querySelector('.free-panel')||{}).innerText||'');
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  // void
  const v = await page.evaluate(async () => {
    const o={};
    STATE.serviceSettings = Object.assign({}, STATE.serviceSettings, {managerVoid:true, voidNeedsCode:true});
    o.mgrCodes = allStaffForLogin().filter(s=>String(s.code)[0]==='5').map(s=>s.code).slice(0,2);
    openVoidSheet('void'); o.sheet=!!document.getElementById('void-code');
    pickVoidReason(document.querySelector('.void-chip'), 'Test order');
    document.getElementById('void-code').value='3111'; confirmVoid(); o.wrongKept = tableServiceState('22')!=='empty';
    document.getElementById('void-code').value=o.mgrCodes[0]; confirmVoid();
    o.after = tableServiceState('22');
    o.saved = Object.values(STATE.checks).filter(c=>c.table==='22').map(c=>c.status+':'+c.voidReason);
    return o;
  });
  console.log(JSON.stringify(v));
  // pay then reseat
  const p = await page.evaluate(async () => {
    const o={};
    selectTable('7'); chooseGuestCount(2); ensureOpenCheck('7');
    const st=tableServiceState('7'); o.beforePay=st;
    STATE.selectedTable='7'; markPaid('cash', 0);
    o.afterPay = tableServiceState('7');
    closePayment && closePayment();
    selectTable('7'); o.sheetShown = !!document.querySelector('.count-grid');
    o.checks = Object.values(STATE.checks).filter(c=>c.table==='7').map(c=>c.status);
    return o;
  });
  console.log(JSON.stringify(p));
} catch(e){ console.error(e); code=1; }
await browser.close(); server.close(); await fake.close?.(); process.exit(code);
