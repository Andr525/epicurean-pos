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
    // GF checkbox must auto-pick its dish (nothing chosen yet)
    const gfBox = [...document.querySelectorAll('input[id^="pf-gf-1-"]')][0];
    gfBox.checked = true; gfBox.dispatchEvent(new Event('change',{bubbles:true}));
    const oi = gfBox.id.split('-')[3];
    out.gfAutoPicked = document.querySelector('input[name="pf-course-1"][value="'+oi+'"]').checked;
    const r0 = document.querySelector('input[name="pf-course-1"][value="0"]'); r0.checked = true; r0.dispatchEvent(new Event('change',{bubbles:true}));      // appetizer 1
    // tap a second appetizer: first must stay selected and a question must appear
    const second = document.querySelector('input[name="pf-course-1"][value="2"]');
    second.click();
    out.firstStays = document.querySelector('input[name="pf-course-1"][value="0"]').checked && !second.checked;
    out.q1 = (document.querySelector('[data-pf-aam-panel]')||{}).textContent;
    pfAamStep2('main');
    out.q2 = (document.querySelector('[data-pf-aam-panel]')||{}).textContent;
    pfAamSet('main','main');
    out.badge = (document.getElementById('pf-aam-badge-2')||{}).textContent;
    document.getElementById('pf-note-1').value = 'no cheese on top';
    confirmPrixFixe(pfid);
    const to = STATE.activeTastingOrders[STATE.activeTastingOrders.length-1];
    out.sels = diningCourses(to).filter(c=>!c.auto&&!c.noneChoice).map(c=>[c.course,c.choice,c.serviceCourse,c.upcharge,c.modNote||'',diningCourseLabel(c)].join('|'));
    out.price = STATE.currentOrder[STATE.currentOrder.length-1].price;
    out.billText = [...document.querySelectorAll('.ts-check-lines .working-line')].map(e=>e.textContent.replace(/\s+/g,' ')).join(' | ');
    out.rowBtns = [...document.querySelectorAll('.ts-row-actions button')].map(b=>b.textContent).join(',');
    out.labels = [...document.querySelectorAll('.ts-course-label')].map(e=>e.textContent).join(',');
    // modify sheet: allergy flag + free text
    const idx = diningCourses(to).findIndex(c=>c.appAsMain);
    openCourseNoteSheet(to.id, idx);
    out.chips = document.querySelectorAll('.note-allergen').length;
    document.querySelector('.note-allergen[value="Dairy"]').checked = true;
    document.getElementById('course-mod-note').value = 'cut in half please';
    saveCourseNote(to.id, idx);
    out.noteSaved = diningCourses(to)[idx].modNote;
    // move the new main to the appetizers
    openMoveSheet(diningLineKey(to.id, idx));
    setSelectedServiceCourse(2);
    out.afterMove = diningCourses(to)[idx].serviceCourse + ' ' + diningCourseLabel(diningCourses(to)[idx]);
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

  const r3 = await page.evaluate(async () => {
    const out = {};
    const ids = checkPositionIdentities();
    toggleAllergy(ids[1], 'Gluten'); // seat 2 already had the earlier test; ensure a fresh seat check
    out.filled = ['Porcini ravioli','Butternut squash agnolotti','Soft egg yolk raviolo','Spaghettini "Arrabbiata"'].map(n => n+':'+isFilledPastaName(n)+':'+canMakeGfPasta(n));
    // simulate a gluten conflict on a filled pasta
    const conflicts=[{name:'Porcini ravioli',hits:['Gluten']}];
    out.cannot = cannotBeGlutenFree(conflicts[0]);
    // BOH flag lets it through
    STATE.prixFixeMenus=(STATE.prixFixeMenus||[]).concat([{id:'zz',name:'zz',courses:[{label:'Primi',options:[{name:'Porcini ravioli',gfOk:true}]}]}]);
    out.cannotWithFlag = cannotBeGlutenFree(conflicts[0]);
    out.canWithFlag = canMakeGfPasta('Porcini ravioli');
    return out;
  });
  console.log(JSON.stringify(r3));
  assert.deepEqual(r3.filled, ['Porcini ravioli:true:false','Butternut squash agnolotti:true:false','Soft egg yolk raviolo:true:false','Spaghettini "Arrabbiata":false:true']);
  assert.ok(r3.cannot && !r3.cannotWithFlag && r3.canWithFlag, 'BOH gfOk flag must unlock filled pasta');
  console.log(JSON.stringify(r1)); console.log(JSON.stringify(r2));
  assert.ok(r1.gfAutoPicked, 'GF checkbox must select its dish');
  assert.ok(r1.firstStays, 'first appetizer must stay selected');
  assert.match(r1.q1, /MAIN course/); assert.match(r1.q2, /What size/);
  assert.match(r1.badge, /\(main size\)/);
  assert.ok(r1.sels.some(s=>/\(main size\)/.test(s) && /\|3\|\d+\|/.test(s) && /\|Main$/.test(s)), 'second appetizer should be the Main, included: '+r1.sels);
  assert.ok(r1.sels.some(s=>/^Primi\|/.test(s) && /no cheese on top/.test(s)), 'first appetizer kept + message: '+r1.sels);
  assert.ok(r1.price>=89 && r1.price<=99, "price "+r1.price);
  assert.match(r1.billText, /\(main size\)/, 'second appetizer must show on the bill: '+r1.billText);
  assert.match(r1.rowBtns, /Modify,Move/);
  assert.match(r1.labels, /APPETIZER,MAIN/);
  assert.ok(r1.chips>=8 && /\u26A0 NO DAIRY \u00B7 cut in half please/.test(r1.noteSaved), 'allergy flags + free text: '+r1.noteSaved);
  assert.match(r1.afterMove, /^2 Appetizer/);
  assert.match(r2.askBtn, /Ask kitchen: make without Gluten/);
  assert.ok(r2.mods.some(m=>/WITHOUT GLUTEN/.test(m)) && /WITHOUT GLUTEN/.test(r2.noteSheet), 'ask-kitchen tag / note window');
  assert.ok(r2.ticket.some(t=>/ASK KITCHEN/.test(t)));
  console.log('PASS v5: second appetizer as main, per-dish note, ask kitchen, move dish');
} finally { await browser.close(); server.close(); fake.close && fake.close(); }
