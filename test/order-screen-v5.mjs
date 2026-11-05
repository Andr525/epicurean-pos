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
  const r1 = await page.evaluate(async () => {
    const out = {};
    const ids = checkPositionIdentities(); setActivePositionIdentity(ids[0]);
    const pfid = EPICUREAN_SCALINI.prixFixe.id;
    openPrixFixeSelector(pfid);
    const pf = findPrixFixeMenu(pfid);
    out.aamSrc = (pf.courses||[]).map((c,ci)=>pfAamSource(pf,ci));
    out.aamBlock = !!document.querySelector('.pf-aam');
    // first appetizer: option 0 ; main slot: second appetizer (option 1 of course 1) via aam
    document.querySelector('input[name="pf-course-1"][value="0"]').checked = true;
    const mainCi = out.aamSrc.findIndex(v=>v>=0);
    const aamRadio = document.querySelector('input[name="pf-course-'+mainCi+'"][value^="a"]');
    aamRadio.checked = true; aamRadio.dispatchEvent(new Event('change',{bubbles:true}));
    out.askShown = document.getElementById('pf-aam-ask-'+mainCi).style.display;
    // try to confirm without answering -> should refuse
    const before = STATE.currentOrder.length; confirmPrixFixe(pfid);
    out.refused = STATE.currentOrder.length===before;
    document.querySelector('input[name="pf-aam-when-'+mainCi+'"][value="main"]').checked = true;
    document.querySelector('input[name="pf-aam-size-'+mainCi+'"][value="app"]').checked = true;
    document.getElementById('pf-note-1').value = 'no cheese on top';
    confirmPrixFixe(pfid);
    const to = STATE.activeTastingOrders[STATE.activeTastingOrders.length-1];
    out.sels = diningCourses(to).filter(c=>!c.auto&&!c.noneChoice).map(c=>[c.course,c.choice,c.serviceCourse,c.upcharge,c.modNote||'',diningCourseLabel(c)].join('|'));
    out.price = STATE.currentOrder[STATE.currentOrder.length-1].price;
    out.rowBtns = [...document.querySelectorAll('.ts-row-actions button')].map(b=>b.textContent).join(',');
    out.labels = [...document.querySelectorAll('.ts-course-label')].map(e=>e.textContent).join(',');
    // move the second appetizer-as-main to appetizers
    const idx = diningCourses(to).findIndex(c=>c.appAsMain);
    openMoveSheet(diningLineKey(to.id, idx));
    out.moveSheet = document.querySelector('#sheet-overlay .sheet').textContent.replace(/\s+/g,' ').slice(0,120);
    setSelectedServiceCourse(2);
    out.afterMove = diningCourses(to)[idx].serviceCourse + ' ' + diningCourseLabel(diningCourses(to)[idx]);
    out.labels2 = [...document.querySelectorAll('.ts-course-label')].map(e=>e.textContent).join(',');
    return out;
  });
  const r2 = await page.evaluate(async () => {
    const out = {};
    const ids = checkPositionIdentities();
    toggleAllergy(ids[1], 'Gluten'); setActivePositionIdentity(ids[1]);
    const pfid = EPICUREAN_SCALINI.prixFixe.id;
    openPrixFixeSelector(pfid);
    const pf = findPrixFixeMenu(pfid);
    let pk=null;
    (pf.courses||[]).forEach((c,ci)=>pfCourseMode(c)==='choose'&&(c.options||[]).forEach((o,oi)=>{ if(!pk && (o.allergens||[]).some(a=>/gluten/i.test(a))) pk={ci,oi,name:o.name}; }));
    out.pk=pk;
    document.querySelector('input[name="pf-course-'+pk.ci+'"][value="'+pk.oi+'"]').checked=true;
    confirmPrixFixe(pfid);
    out.warn=(document.querySelector('.allergy-warn')||{}).textContent;
    out.askBtn=(document.querySelector('.allergy-warn .ask-btn')||{}).textContent;
    allergyAskKitchen();
    await new Promise(r=>setTimeout(r,400));
    const to=STATE.activeTastingOrders.find(o=>orderPositionIdentity(o)===ids[1]);
    out.mods=diningCourses(to).map(c=>c.modNote||'').filter(Boolean);
    out.noteSheet=!!document.getElementById('course-mod-note') && document.getElementById('course-mod-note').value;
    out.ticket=STATE.orders.filter(o=>o.allergyOverride).map(o=>o.items[0].name+' :: '+o.items[0].notes);
    return out;
  });

  console.log(JSON.stringify(r1)); console.log(JSON.stringify(r2));
  assert.ok(r1.aamBlock && r1.askShown==='block', 'second-appetizer-as-main block missing');
  assert.ok(r1.refused, 'must refuse until when/size answered');
  assert.ok(r1.sels.some(s=>/appetizer size/.test(s) && /\|3\|0\|/.test(s) && /\|Main$/.test(s)), 'appetizer dish should be the Main slot, size noted, included in price: '+r1.sels);
  assert.ok(r1.sels.some(s=>/no cheese on top/.test(s)), 'per-dish message missing');
  assert.equal(r1.price, 89);
  assert.match(r1.rowBtns, /Note,Move/);
  assert.match(r1.labels, /APPETIZER,MAIN/);
  assert.match(r1.afterMove, /^2 Appetizer/);
  assert.match(r2.askBtn, /Ask kitchen: make without Gluten/);
  assert.ok(r2.mods.some(m=>/WITHOUT GLUTEN/.test(m)) && /WITHOUT GLUTEN/.test(r2.noteSheet), 'ask-kitchen tag / note window');
  assert.ok(r2.ticket.some(t=>/ASK KITCHEN/.test(t)));
  console.log('PASS v5: second appetizer as main, per-dish note, ask kitchen, move dish');
} finally { await browser.close(); server.close(); fake.close && fake.close(); }
