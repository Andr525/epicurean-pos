import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'index.html');
const src = fs.readFileSync(htmlPath, 'utf8');

function loadPos() {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const scalini = fs.readFileSync(path.join(root, 'scalini-dining.js'), 'utf8');
  html = html.replace(/<script src="https:[^"]+"><\/script>/g, '');
  html = html.replace(/<script src="scalini-dining\.js[^"]*"><\/script>/, '<script>' + scalini + '</script>');
  html = html.replace(/<script src="cellar\.js[^"]*"><\/script>/, '');
  const vc = new VirtualConsole();
  vc.on('jsdomError', () => {});
  vc.on('error', () => {});
  vc.on('warn', () => {});
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1/epicurean-pos/',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    virtualConsole: vc
  });
  return dom.window;
}

function extractDecl(text, needle) {
  const start = text.indexOf(needle);
  if (start < 0) throw new Error('missing ' + needle);
  const brace = text.indexOf('{', start);
  let depth = 0;
  for (let j = brace; j < text.length; j++) {
    if (text[j] === '{') depth++;
    else if (text[j] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, j + 1);
    }
  }
  throw new Error('unclosed ' + needle);
}

function seedTable(w, opts) {
  opts = opts || {};
  w.STATE.currentServer = { name: 'Test', role: 'manager', code: '5000' };
  w.STATE.selectedTable = '4';
  w.STATE.activeSeat = 1;
  w.STATE.guestCount = opts.guests || 2;
  w.STATE.currentOrder = [];
  w.STATE.orders = [];
  w.STATE.checks = {};
  w.STATE.selectedLineIds = {};
  w.STATE.activeTastingOrders = [];
  w.STATE.tableSessions = {};
  w.STATE.viewCheckId = null;
  w.STATE.menuOpen = true;
  w.STATE.menuFamily = 'food';
  w.STATE.menuSearch = '';
  w.STATE._replaceLineId = null;
  w.STATE._replaceCtx = null;
  const sess = w.sessionOf('4');
  sess.guestCount = opts.guests || 2;
  sess.femalePositions = {};
  sess.checkId = null;
  w.fbReady = false;
}

function dummyTastingIds() {
  return ['tm_chef7', 'tm_choc5', 'tm1', 'tm2'];
}

function regionalFrom(list) {
  return (list || []).find((t) => t && t.id === 'tm_scalini_128');
}

const w = loadPos();

// 1. mergeScaliniList always keeps Regional Tasting @ $115
const emptyMerged = w.mergeScaliniList([], w.SEED_TASTING_MENUS, dummyTastingIds());
const emptyHit = regionalFrom(emptyMerged);
assert.ok(emptyHit, 'tm_scalini_128 missing from empty Firestore merge');
assert.equal(emptyHit.name, 'Scalini Fedeli Regional Tasting');
assert.equal(Number(emptyHit.price), 115);
assert.notEqual(emptyHit.active, false);

const deadMerged = w.mergeScaliniList(
  [{ id: 'tm_scalini_128', active: false, price: 0, version: 99999999, courses: [] }],
  w.SEED_TASTING_MENUS,
  dummyTastingIds()
);
const deadHit = regionalFrom(deadMerged);
assert.ok(deadHit, 'tm_scalini_128 dropped when live is inactive');
assert.equal(deadHit.id, 'tm_scalini_128');
assert.equal(deadHit.name, 'Scalini Fedeli Regional Tasting');
assert.equal(Number(deadHit.price), 115);
assert.ok(deadHit.courses && deadHit.courses.length, 'seed courses not overlaid');
const salmon = (deadHit.courses || []).find((c) => /forestiere|forrestiere|sf_m_forestiere/i.test((c.name || '') + (c.dishId || '')));
const filet = (deadHit.courses || []).find((c) => /giambotta|sf_m_giambotta/i.test((c.name || '') + (c.dishId || '')));
assert.ok(salmon && salmon.askTemp === 'salmon', 'Forestiere askTemp missing');
assert.ok(filet && filet.askTemp === 'steak', 'Giambotta askTemp missing');

// 2. addTastingMenu hydrates predetermined courses
seedTable(w);
w.STATE.tastingMenus = w.mergeScaliniList([], w.SEED_TASTING_MENUS, dummyTastingIds());
w.ensureOpenCheck('4');
w.addTastingMenu('tm_scalini_128');
const tasting = (w.STATE.activeTastingOrders || [])[0];
assert.ok(tasting, 'dining order not started');
const courses = w.diningCourses(tasting);
const byName = (re) => courses.find((c) => re.test([c.name, c.choice, c.dishId, c.course].join(' ')));
const welcomeSalmon = byName(/smoked salmon/i);
const zucchini = byName(/zucchini/i);
const porcini = byName(/porcini/i);
const agnolotti = byName(/agnolotti/i);
const forestiere = byName(/forestiere|forrestiere|sf_m_forestiere/i);
const giambotta = byName(/giambotta|filet/i);
const sorbet = byName(/sorbet|entremet/i);
const dolce = byName(/^dolce$/i) || courses.find((c) => c.later || c.mode === 'later');
assert.ok(welcomeSalmon && welcomeSalmon.auto && welcomeSalmon.fireEach);
assert.ok(zucchini && zucchini.auto && zucchini.fireEach);
assert.equal(welcomeSalmon.choice, welcomeSalmon.name);
assert.ok(porcini && porcini.choice && !/^\s*$/.test(porcini.choice));
assert.ok(agnolotti && agnolotti.choice);
assert.equal(forestiere.askTemp, 'salmon');
assert.equal(giambotta.askTemp, 'steak');
assert.ok(!welcomeSalmon.askTemp);
assert.ok(!porcini.askTemp);
assert.ok(sorbet && (sorbet.entremets || sorbet.mode === 'entremets'));
assert.ok(dolce && (dolce.later || dolce.mode === 'later'));
courses.filter((c) => c && !c.headingOnly && c.mode !== 'later' && c.mode !== 'choose').forEach((c) => {
  assert.ok(String(c.choice || '').trim(), 'blank choice on predetermined ' + (c.name || c.course));
});

// 3. start sheet asks only salmon + filet temps
const sheet = w.document.getElementById('sheet-overlay');
assert.ok(sheet && sheet.classList.contains('show'), 'temp sheet not opened');
const sheetHtml = sheet.innerHTML;
assert.match(sheetHtml, /data-ask="salmon"/);
assert.match(sheetHtml, /data-ask="steak"/);
assert.equal(/name="pf-course-/.test(sheetHtml), false);
assert.equal(/Porcini/.test(sheetHtml), false);
assert.equal(/Agnolotti/.test(sheetHtml), false);
assert.equal(/Zucchini/.test(sheetHtml), false);
assert.equal(/choose this course/i.test(sheetHtml), false);
w.closeSheet();

// 4. compact working check: no display headings, seps, on-row Modify|FIRE
const checkHtml = w.workingCheckHtml();
['WELCOME', '1 COMPLIMENTARY', 'COMPLIMENTARY', 'APPETIZER', 'MAIN', 'DESSERT', 'DRINKS', 'PRE-DESSERT'].forEach((label) => {
  assert.equal(checkHtml.includes(label), false, 'heading still visible: ' + label);
});
assert.match(checkHtml, /ts-course-sep/);
assert.match(checkHtml, /modifyWorkingRow/);
assert.match(checkHtml, /fireWorkingRow/);
const welcomeKey = w.diningLineKey(tasting.id, courses.findIndex((c) => w.isWelcomeTrioCourse(c)));
const porciniIdx = courses.findIndex((c) => /porcini/i.test([c.name, c.choice].join(' ')));
assert.match(checkHtml, new RegExp('modifyWorkingRow\\("' + welcomeKey.replace(/\|/g, '\\|') + '"\\)'));
assert.match(checkHtml, new RegExp('fireWorkingRow\\("' + w.diningLineKey(tasting.id, porciniIdx).replace(/\|/g, '\\|') + '"\\)'));
assert.equal(/FIRE Complimentary/.test(w.renderCourseFireRow()), false);
assert.equal(/FIRE Entremet/.test(w.renderCourseFireRow()), false);

// 5. complimentary Modify writes order-level positionSubs; seed dish unchanged
const seedName = (w.EPICUREAN_SCALINI.tasting.courses || []).find((c) => /smoked salmon/i.test(c.name || '')).name;
w.openPositionSubSheet('welcome');
const subInput = w.document.querySelector('.pos-sub-input');
assert.ok(subInput, 'position sub input missing');
subInput.value = 'Salad instead of Zucchini';
w.savePositionSubs('welcome');
assert.equal(tasting.positionSubs.welcome['1'], 'Salad instead of Zucchini');
assert.equal(seedName, 'Smoked Salmon');
assert.equal(welcomeSalmon.name, 'Smoked Salmon');

// 6. entremet hidden until dessert; then Modify|FIRE; sub is order-level
assert.equal(w.hideEntremetUntilDessert(sorbet, tasting), true);
assert.ok(!w.workingCheckHtml().includes('modifyWorkingRow') || !/entremet/i.test(JSON.stringify(w.collectWorkingCheckGroups().map((g) => g.kind))));
assert.ok(!w.collectDiningFireGroups().some((g) => g.key === 'entremet'));
tasting.dessertChosen = true;
const later = courses.find((c) => c.later || c.mode === 'later');
later.choice = 'Napoleon of chocolate';
later.name = 'Napoleon of chocolate';
later.pending = false;
w.openPositionSubSheet('entremet');
w.document.querySelector('.pos-sub-input').value = 'Mango Sorbet';
w.savePositionSubs('entremet');
assert.equal(tasting.positionSubs.entremet['1'], 'Mango Sorbet');
const afterDes = w.workingCheckHtml();
assert.match(afterDes, /Mango Sorbet/);
assert.equal(/PRE-DESSERT/.test(afterDes), false);
assert.match(afterDes, /Modify/);
assert.match(afterDes, /FIRE/);
assert.ok(w.collectDiningFireGroups().some((g) => g.key === 'entremet'));
const entremetIdx = courses.findIndex((c) => w.isEntremetCourse(c));
assert.match(afterDes, new RegExp('modifyWorkingRow\\("' + w.diningLineKey(tasting.id, entremetIdx).replace(/\|/g, '\\|') + '"\\)'));

// 7. à la carte selectable + Change/Replace
seedTable(w);
w.STATE.menuItems = (w.STATE.menuItems || []).concat([
  { id: 'i_arugula', name: 'Arugula', price: 14, category: 'soups-salads', modifiers: [{ group: 'Dressing', options: ['Lemon', 'Balsamic'] }], station: 'Cold/Garde Manger' },
  { id: 'i_agnolotti', name: 'Agnolotti', price: 22, category: 'entrees', modifiers: [], station: 'Sauté' }
]);
w.STATE._bevIndex = null;
const arugula = {
  lineId: 'alc-arugula',
  id: 'i_arugula',
  name: 'Arugula',
  price: 14,
  qty: 1,
  seat: 2,
  table: '4',
  category: 'soups-salads',
  course: 2,
  serviceCourse: 2,
  ticketPos: 12,
  mods: { Dressing: 'Lemon' },
  selectedMod: 'Dressing: Lemon',
  checkId: null
};
w.STATE.currentOrder = [arugula];
w.ensureOpenCheck('4');
arugula.checkId = w.activeCheckId();
const alcHtml = w.workingCheckHtml();
assert.match(alcHtml, /toggleLineSelect\("alc-arugula"\)/);
w.document.getElementById('app-content').innerHTML = alcHtml;
const nameEl = [...w.document.querySelectorAll('.ts-name')].find((el) => /Arugula/.test(el.textContent));
assert.ok(nameEl && nameEl.onclick, 'name is not selectable');
nameEl.click();
assert.equal(w.STATE.selectedLineIds['alc-arugula'], 1);
assert.match(w.lineEditBarHtml(), /Change\/Replace Item/);
w.replaceSelectedItem();
assert.equal(w.STATE._replaceLineId, 'alc-arugula');
assert.equal(w.STATE._replaceCtx.seat, 2);
assert.equal(w.STATE._replaceCtx.serviceCourse, 2);
w.beginAddItem('i_agnolotti');
const replaced = (w.STATE.currentOrder || []).find((i) => i.id === 'i_agnolotti');
assert.ok(replaced, 'replacement line missing');
assert.equal((w.STATE.currentOrder || []).some((i) => i.lineId === 'alc-arugula'), false);
assert.equal(replaced.seat, 2);
assert.equal(replaced.serviceCourse, 2);
assert.equal(JSON.stringify(replaced.mods || {}), '{}');
assert.notEqual(replaced.selectedMod, 'Dressing: Lemon');
assert.equal(w.selectedLineKeys().join(','), '');
w.STATE.selectedLineIds = { 'fired-line': 1 };
w.replaceSelectedItem();
assert.equal(w.STATE._replaceLineId == null, true);
assert.equal((w.STATE.currentOrder || []).some((i) => i.id === 'i_agnolotti'), true);

// 8. Add Items X
seedTable(w);
const orderSnap = JSON.stringify(w.STATE.currentOrder);
const header = w.addItemsHeaderHtml();
assert.match(header, /aria-label="Close"/);
assert.match(header, /closeAddItemsPane/);
assert.match(header, />X</);
w.STATE.menuOpen = true;
w.STATE.currentOrder = [{ lineId: 'keep', name: 'Tuna Tartare', table: '4', qty: 1, price: 16 }];
const keep = JSON.stringify(w.STATE.currentOrder);
w.closeAddItemsPane();
assert.equal(w.STATE.menuOpen, false);
assert.equal(JSON.stringify(w.STATE.currentOrder), keep);
assert.notEqual(JSON.stringify(w.STATE.currentOrder), 'mutated');
void orderSnap;

// 9. drinks hides food; food restores; selection does not rebuild pane
seedTable(w);
w.STATE.menuNav = { level: 'cats', family: 'food' };
w.STATE.menuFamily = 'food';
w.STATE.orderCat = null;
w.setMenuFamily('drinks');
const drinkGrid = w.renderMenuGrid();
assert.equal(/Small Plates/.test(drinkGrid), false);
assert.equal(/Soups/.test(drinkGrid), false);
assert.match(drinkGrid, /wine-window|wine-window-list/);
w.setMenuFamily('food');
const foodGrid = w.renderMenuGrid();
assert.equal(w.STATE.menuFamily, 'food');
assert.match(foodGrid, /ts-tile/);
w.STATE.menuNav = { level: 'cats', family: 'food' };
w.STATE.menuSearch = '';
w.STATE._posWineFind = '';
w.STATE.menuFamily = 'food';
w.STATE.orderCat = null;
w.STATE.tilePage = 0;
w.STATE._catalogFp = 'fp-sw';
const fp = w.menuNavFingerprint();
assert.equal(w.menuPaneShouldRebuild(fp, fp), false);
w.STATE.selectedLineIds = { alc1: 1 };
assert.equal(w.menuPaneShouldRebuild(fp, w.menuNavFingerprint()), false);

// 10. beverage index isolation
w.STATE.wines = (w.STATE.wines || []).concat([
  { id: 'w_chateau', vin: '1888', name: 'Château Lafite Rothschild', bottlePrice: 980, size: '750ml', active: true }
]);
w.STATE.bar = (w.STATE.bar || []).concat([
  { id: 'ck_negroni', kind: 'Cocktail', name: 'Negroni', price: 16, active: true },
  { id: 's_lin', kind: 'Spirit', name: 'Hibiki', lin: '2746', price: 24, active: true }
]);
w.STATE._bevIndex = null;
w.rebuildPosCatalog();
const cha = w.filterBeverageHits('cha');
assert.ok(cha.some((it) => /château|chateau|chardonnay/i.test(it.name)), 'cha missed château/chardonnay');
const negr = w.filterBeverageHits('negr');
assert.ok(negr.some((it) => /negroni/i.test(it.name)), 'negr missed Negroni');
const espr = w.filterBeverageHits('espr');
assert.ok(espr.some((it) => /espresso/i.test(it.name)), 'espr missed Espresso');
const vin = w.filterBeverageHits('VIN 1888');
assert.ok(vin.some((it) => it.vin === '1888' || /château|chateau/i.test(it.name)));
const lin = w.filterBeverageHits('LIN 2746');
assert.ok(lin.some((it) => /hibiki/i.test(it.name)));
let renderCalls = 0;
const origRender = w.renderOrder;
w.renderOrder = function () {
  renderCalls++;
  return origRender.apply(this, arguments);
};
w.document.getElementById('app-content').innerHTML = '<div id="add-items-pane"><div class="wine-window"><div class="wine-window-list" id="wine-window-list"></div></div></div>';
w.paintBeverageResults('cha');
assert.equal(renderCalls, 0, 'paintBeverageResults must not call renderOrder');
w.renderOrder = origRender;

// 11. keypad capture click reaches guestKey; floorViewLocked while sheet shown
seedTable(w);
w.STATE._guestBuf = '';
w.showGuestCountSheet('4');
assert.equal(w.floorViewLocked(), true);
const keyBtn = w.document.querySelector('.guest-keypad button');
assert.ok(keyBtn, 'keypad button missing');
const ev = new w.MouseEvent('click', { bubbles: true, cancelable: true });
keyBtn.dispatchEvent(ev);
assert.equal(w.STATE._guestBuf, '1');
w.closeSheet();
assert.equal(w.floorViewLocked(), false);

// 12. floor clone-drag decls unchanged vs origin/main
const mainSrc = execSync('git show origin/main:index.html', { cwd: root, encoding: 'utf8' });
[
  'var FLOOR_GESTURE =',
  'function ensureDragClone(',
  'function applyCloneDrag(',
  'function finishFloorTableDrag(',
  'function bindFloorDocGestures(',
  'function commitTableMove('
].forEach((needle) => {
  assert.equal(extractDecl(src, needle), extractDecl(mainSrc, needle), needle + ' changed vs origin/main');
});
assert.equal(w.FLOOR_HOLD_OCCUPIED_MS, 500);

if (w.STATE && w.STATE._seatTick) {
  w.clearInterval(w.STATE._seatTick);
  w.STATE._seatTick = null;
}

console.log('service-workflow tests passed');
