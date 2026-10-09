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
  html = html.replace(/<script src="https:[^"]+"><\/script>/g, '');
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
  const sess = w.sessionOf('4');
  sess.guestCount = opts.guests || 2;
  sess.femalePositions = {};
  sess.checkId = null;
  w.fbReady = false;
}

function laterDessert() {
  return {
    course: 'Dolce',
    name: '',
    choice: '',
    later: true,
    mode: 'later',
    pending: true,
    serviceCourse: 4,
    fired: false
  };
}

function entremetCourse() {
  return {
    course: 'Entremet',
    name: 'Coconut–lime sorbet with rum glazed pineapple',
    choice: 'Coconut–lime sorbet with rum glazed pineapple',
    mode: 'entremets',
    entremets: true,
    pending: true,
    fired: false,
    serviceCourse: 4
  };
}

function diningOrder(w, id, seat, extras) {
  extras = extras || {};
  return {
    id: id,
    table: '4',
    status: 'active',
    type: 'prix-fixe',
    prixFixeName: 'Scalini Prix Fixe',
    prixFixeId: 'pf_scalini_89',
    totalPrice: 89,
    seat: seat,
    dessertChosen: false,
    selections: extras.selections || [
      { course: 'Primi Piccolo', choice: 'Smoked Salmon', name: 'Smoked Salmon', auto: true, fireEach: true, fired: false },
      { course: 'Primi Piccolo', choice: 'Breaded zucchini Milanese', name: 'Breaded zucchini Milanese', auto: true, fireEach: true, fired: false },
      { course: 'Primi Piccolo', choice: 'Shrimp', name: 'Shrimp', auto: true, fireEach: true, fired: false },
      { course: 'Primi', choice: extras.app || 'Linguini in spicy pescatore sauce', name: extras.app || 'Linguini in spicy pescatore sauce', serviceCourse: 2, fired: false },
      { course: 'Principale', choice: extras.main || 'Split 10 oz. filet mignon', name: extras.main || 'Split 10 oz. filet mignon', selectedTemp: extras.temp || '', serviceCourse: 3, fired: false, category: extras.mainCategory || 'mains' },
      entremetCourse(),
      extras.dessert === false ? laterDessert() : (extras.dessert || laterDessert())
    ]
  };
}

function chooseDessert(to) {
  to.dessertChosen = true;
  (to.selections || []).forEach(function (c) {
    if (!(c.later || c.mode === 'later')) return;
    c.choice = 'Napoleon of chocolate';
    c.name = 'Napoleon of chocolate';
    c.pending = false;
  });
}

const w = loadPos();

// 1. setSelectedServiceCourse clears selection; Close X; Up/Down keeps selection
seedTable(w, { guests: 2 });
const line = {
  lineId: 'alc1',
  name: 'Split 10 oz. filet mignon',
  price: 52,
  qty: 1,
  seat: 1,
  table: '4',
  category: 'mains',
  course: 3,
  serviceCourse: 3,
  checkId: null
};
w.STATE.currentOrder = [line];
w.ensureOpenCheck('4');
line.checkId = w.activeCheckId();
w.STATE.selectedLineIds = { alc1: 1 };
w.setSelectedServiceCourse(2);
assert.equal(w.selectedLineKeys().join(','), '');
assert.equal(line.serviceCourse, 2);
w.STATE.selectedLineIds = { alc1: 1 };
assert.match(w.lineEditBarHtml(), /clearLineSelection/);
assert.match(w.lineEditBarHtml(), />X</);
w.clearLineSelection();
assert.equal(w.selectedLineKeys().join(','), '');
const line2 = {
  lineId: 'alc2',
  name: 'Tuna Tartare',
  price: 16,
  qty: 1,
  seat: 1,
  table: '4',
  category: 'small-plates',
  course: 2,
  serviceCourse: 2,
  ticketPos: 10,
  checkId: line.checkId
};
line.ticketPos = 20;
w.STATE.currentOrder = [line, line2];
w.STATE.selectedLineIds = { alc1: 1 };
w.moveSelectedLine(-1);
assert.equal(w.selectedLineKeys().join(','), 'alc1');

// 2. occupied hold 500ms, empty 1000ms
seedTable(w, { guests: 2 });
assert.equal(w.FLOOR_HOLD_MS, 1000);
assert.equal(w.FLOOR_HOLD_OCCUPIED_MS, 500);
assert.equal(w.FLOOR_HOLD_JITTER, 14);
assert.equal(w.FLOOR_DRAG_PX, 20);
w.STATE.tableSessions['4'] = w.sessionOf('4');
w.STATE.tableSessions['4'].seatedAt = Date.now();
assert.equal(w.tableInService('4'), true);
assert.equal(w.floorHoldMs('4'), 500);
assert.equal(w.tableInService('99'), false);
assert.equal(w.floorHoldMs('99'), 1000);
const delays = [];
const realTimeout = w.setTimeout;
w.setTimeout = function (fn, ms) {
  delays.push(ms);
  return realTimeout.call(w, function () {}, 0);
};
w.armFloorHold('4');
assert.equal(delays[delays.length - 1], 500);
w.armFloorHold('99');
assert.equal(delays[delays.length - 1], 1000);
w.setTimeout = realTimeout;
w.clearFloorHold();

// 3. welcome compact + position sub storage
seedTable(w, { guests: 2 });
const welcomeTo = diningOrder(w, 'to1', 1, { dessert: false });
w.STATE.activeTastingOrders = [welcomeTo, diningOrder(w, 'to2', 2, { dessert: false })];
const rest = w.workingCheckHtml();
assert.equal(/COMPLIMENTARY/.test(rest), false);
assert.equal(/WELCOME/.test(rest), false);
assert.match(rest, /Modify/);
assert.match(rest, /FIRE/);
assert.match(rest, /Salmon/);
assert.equal(/Zucchini Milanese/i.test(rest), false);
assert.equal(/Smoked Salmon/i.test(rest), false);
assert.equal(/Coconut-Lime Sorbet/i.test(rest), false);
assert.ok(w.collectDiningFireGroups().some((g) => g.key === 'welcome'));
w.STATE.selectedLineIds = {};
w.STATE.selectedLineIds[w.diningLineKey('to1', 0)] = 1;
w.savePositionSubs = w.savePositionSubs;
welcomeTo.positionSubs = { welcome: { '1': 'Salad instead of Zucchini' } };
welcomeTo.selections[0].positionSubs = { '1': 'Salad instead of Zucchini' };
welcomeTo.selections[0].modNote = '1 — Salad instead of Zucchini';
welcomeTo.selections[1].positionSubs = { '1': 'Salad instead of Zucchini' };
const restSub = w.workingCheckHtml();
assert.match(restSub, /Salad instead of Zucchini/);
assert.equal(/Zucchini Milanese/i.test(restSub), false);
const fireNote = w.diningPositionSubNote(welcomeTo, welcomeTo.selections[1]);
assert.equal(fireNote, '1 — Salad instead of Zucchini');
assert.equal(welcomeTo.selections[1].name, 'Breaded zucchini Milanese');

// 4. entremet hidden until dessert; then compact PRE-DESSERT + order-level sub
assert.equal(w.hideEntremetUntilDessert(welcomeTo.selections[5], welcomeTo), true);
assert.ok(!w.collectDiningFireGroups().some((g) => g.key === 'entremet'));
chooseDessert(welcomeTo);
chooseDessert(w.STATE.activeTastingOrders[1]);
w.toggleFemalePosition(2);
w.STATE.activeTastingOrders[1].positionSubs = { entremet: { '2': 'Mango Sorbet' } };
w.STATE.activeTastingOrders[1].selections[5].positionSubs = { '2': 'Mango Sorbet' };
const after = w.workingCheckHtml();
assert.equal(/PRE-DESSERT/.test(after), false);
assert.match(after, /Modify/);
assert.match(after, /FIRE/);
assert.equal(/rum glazed pineapple/i.test(after), false);
assert.match(after, /Coconut-Lime Sorbet|Mango Sorbet/);
assert.match(after, /Mango Sorbet/);
assert.ok(w.collectDiningFireGroups().some((g) => g.key === 'entremet'));
assert.equal(w.diningPositionSubNote(w.STATE.activeTastingOrders[1], w.STATE.activeTastingOrders[1].selections[5]), '2A — Mango Sorbet');

// 5. wine list uncapped + VIN lookup without rendering 3600 tiles
assert.equal(src.includes('slice(0,80)'), false);
assert.equal(typeof w.renderWineWindow, 'function');
assert.equal(typeof w.filterCatalogItems, 'function');
w.STATE.wines = [
  { id: 'w2148', vin: '2148', name: 'Krug Grande Cuvée', bottlePrice: 275, size: '750ml', active: true },
  { id: 'w2148m', vin: '2148', name: 'Krug Grande Cuvée', bottlePrice: 550, size: '1.5L', active: true },
  { id: 'w999', vin: '9999', name: 'House White', bottlePrice: 40, size: '750ml', active: true }
];
w.STATE.bar = [{ id: 's1', kind: 'Spirit', name: 'Hibiki', lin: '2746', price: 24, active: true }];
w.rebuildPosCatalog();
const vinHits = w.filterCatalogItems(w.STATE.menuItems, 'VIN 2148');
assert.ok(vinHits.length > 1, 'ambiguous VIN 2148 should return >1');
assert.ok(vinHits.every((it) => /Krug/.test(it.name)));
const bare = w.filterCatalogItems(w.STATE.menuItems, '2148');
assert.ok(bare.length > 1);
const linHits = w.filterCatalogItems(w.STATE.menuItems, 'LIN 2746');
assert.equal(linHits.length, 1);
assert.equal(linHits[0].name, 'Hibiki');
const wineHtml = w.renderWineWindow(w.STATE.menuItems.filter((i) => i.vin), '');
assert.equal((wineHtml.match(/wine-row/g) || []).length <= 60, true);
assert.equal(wineHtml.includes('ticker-dots'), false);

// 6. menu pane rebuild skip when only selection/totals change
w.STATE.menuNav = { level: 'cats', family: 'food' };
w.STATE.menuSearch = '';
w.STATE._posWineFind = '';
w.STATE.menuFamily = 'food';
w.STATE.orderCat = null;
w.STATE.tilePage = 0;
w.STATE._catalogFp = 'fp1';
const fp = w.menuNavFingerprint();
assert.equal(w.menuPaneShouldRebuild(fp, fp), false);
w.STATE.selectedLineIds = { alc1: 1 };
assert.equal(w.menuPaneShouldRebuild(fp, w.menuNavFingerprint()), false);
w.STATE.menuSearch = 'krug';
assert.equal(w.menuPaneShouldRebuild(fp, w.menuNavFingerprint()), true);

// 7. floor clone-drag identity vs origin/main except hold-ms / armFloorHold
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
assert.equal(extractDecl(src, 'function armFloorHold('), extractDecl(mainSrc, 'function armFloorHold('));
assert.equal(src.includes('var FLOOR_HOLD_OCCUPIED_MS = 500'), true);
assert.equal(src.includes('<!-- pos-build: scalini-print-v66 -->'), true);

if (w.STATE && w.STATE._seatTick) {
  w.clearInterval(w.STATE._seatTick);
  w.STATE._seatTick = null;
}

console.log('handheld-refine tests passed');
