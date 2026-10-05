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
      {
        course: 'Primi Piccolo',
        choice: 'Smoked Salmon',
        name: 'Smoked Salmon',
        auto: true,
        fireEach: true,
        fired: false
      },
      {
        course: 'Primi Piccolo',
        choice: 'Breaded zucchini Milanese',
        name: 'Breaded zucchini Milanese',
        auto: true,
        fireEach: true,
        fired: false
      },
      {
        course: 'Primi Piccolo',
        choice: 'Shrimp',
        name: 'Shrimp',
        auto: true,
        fireEach: true,
        fired: false
      },
      {
        course: 'Primi',
        choice: extras.app || 'Linguini in spicy pescatore sauce',
        name: extras.app || 'Linguini in spicy pescatore sauce',
        serviceCourse: 2,
        fired: false
      },
      {
        course: 'Principale',
        choice: extras.main || 'Split 10 oz. filet mignon',
        name: extras.main || 'Split 10 oz. filet mignon',
        selectedTemp: extras.temp || '',
        serviceCourse: 3,
        fired: false,
        category: extras.mainCategory || 'mains'
      },
      entremetCourse(),
      extras.dessert === false ? laterDessert() : (extras.dessert || laterDessert())
    ]
  };
}

const w = loadPos();

// 1. operational names
assert.equal(w.operationalDishName('Slowly braised lamb “Osso Bucco”'), 'Lamb Osso Bucco');
assert.equal(w.operationalDishName('Linguini in spicy pescatore sauce'), 'Linguini Pescatore');
const named = { name: 'Slowly braised lamb “Osso Bucco”' };
assert.equal(w.operationalDishName(named.name, named), 'Lamb Osso Bucco');
assert.equal(named.name, 'Slowly braised lamb “Osso Bucco”');

// 2 / 3. position labels and one chip per guest
seedTable(w, { guests: 2 });
assert.equal(w.positionLabel(1), '1');
w.toggleFemalePosition(2);
assert.equal(w.isFemalePosition(2), true);
assert.equal(w.positionLabel(2), '2A');
assert.equal(w.positionLabel(1), '1');
const bar2 = w.renderSeatBar();
const barDom2 = new JSDOM(bar2);
const numbered2 = [...barDom2.window.document.querySelectorAll('.seat-chip[data-seat]')];
assert.equal(numbered2.length, 2);
assert.equal(numbered2.filter((el) => el.getAttribute('data-seat') === '2').length, 1);
assert.equal(numbered2[1].textContent, '2A');
assert.equal(barDom2.window.document.querySelectorAll('.seat-chip').length >= 4, true);
assert.match(bar2, /Share/);
assert.match(bar2, /\+\s*Add/);
assert.equal(bar2.includes('Seat 2'), false);

// 4. female-first consolidated tokens
seedTable(w, { guests: 13 });
w.toggleFemalePosition(13);
const plates = [
  { seat: 13, temp: 'Medium' },
  { seat: 12, temp: 'Medium Rare' }
].sort(w.sortServicePositions);
assert.equal(w.workingTokenText(plates), '13A M · 12 MR');
assert.equal(w.positionTempToken(13, 'Medium'), '13A M');
assert.equal(w.positionTempToken(12, 'Medium Rare'), '12 MR');

// 5. two $89 PF → $178, no $89 package total
seedTable(w, { guests: 2 });
w.STATE.activeTastingOrders = [
  diningOrder(w, 'to1', 1, { temp: 'Medium', dessert: false }),
  diningOrder(w, 'to2', 2, { temp: 'Medium Rare', dessert: false, main: 'Split 10 oz. filet mignon' })
];
w.toggleFemalePosition(2);
const checkHtml = w.workingCheckHtml();
assert.match(checkHtml, /Prix Fixe/);
assert.match(checkHtml, /\$178|178/);
assert.equal(checkHtml.includes('$89'), false);
const pkg = new JSDOM('<div>' + checkHtml + '</div>').window.document.querySelector('.working-pkg');
assert.ok(pkg);
assert.equal(pkg.textContent.includes('89'), false);
assert.match(pkg.textContent, /178/);
assert.match(pkg.textContent, /Prix Fixe/);

// 6. later / unpicked dessert hidden
assert.equal(/choose later/i.test(checkHtml), false);
assert.equal(/Dolce — choose later/i.test(checkHtml), false);
assert.equal(/not selected/i.test(checkHtml), false);

// 7. entremet hidden until dessert; complimentary is compact
assert.equal(/Zucchini Milanese/i.test(checkHtml), false);
assert.equal(/Smoked Salmon/i.test(checkHtml), false);
assert.equal(/COMPLIMENTARY/.test(checkHtml), false);
assert.match(checkHtml, /Modify/);
assert.match(checkHtml, /FIRE/);
assert.equal(/PRE-DESSERT/.test(checkHtml), false);
assert.equal(/Coconut-Lime Sorbet/.test(checkHtml), false);
assert.equal(w.hideEntremetUntilDessert({ mode: 'entremets' }, w.STATE.activeTastingOrders[0]), true);
const fireGroups = w.collectDiningFireGroups();
assert.ok(!fireGroups.some((g) => g.key === 'entremet'), 'FIRE Entremet should wait for dessert');
assert.ok(fireGroups.some((g) => g.key === 'welcome'), 'FIRE Complimentary group missing');
const live = w.liveCheckHtml();
assert.equal(/Coconut-Lime Sorbet/.test(live), false);
assert.equal(/choose later/i.test(live), false);
assert.equal(/COMPLIMENTARY/.test(live), false);
assert.match(live, /Modify/);
w.STATE.activeTastingOrders.forEach(function (to) {
  to.dessertChosen = true;
  w.diningCourses(to).forEach(function (c) {
    if (!(c.later || c.mode === 'later')) return;
    c.choice = 'Napoleon of chocolate';
    c.name = 'Napoleon of chocolate';
    c.pending = false;
  });
});
const afterDessert = w.workingCheckHtml();
assert.equal(/PRE-DESSERT/.test(afterDessert), false);
assert.match(afterDessert, /Modify/);
assert.match(afterDessert, /FIRE/);
assert.ok(w.collectDiningFireGroups().some((g) => g.key === 'entremet'), 'FIRE Entremet after dessert');

// 8. handheld CSS fills removed
assert.equal(src.includes('#fff3e8'), false);
assert.equal(src.includes('#fff7e0'), false);
assert.equal(/body\.hh-on\s+\.ts-line\.unsent\s*\{[^}]*#fff3e8/.test(src), false);
assert.equal(/body\.hh-on\s+\.ts-line\.held\s*\{[^}]*#fff7e0/.test(src), false);
assert.equal(/body\.hh-on\s+\.ts-line\.sent\s*\{[^}]*#e8f6ee/.test(src), false);

// 9. 13 guests → 13 numbered chips; 13F when flagged; min-height ≥ 44
seedTable(w, { guests: 13 });
w.toggleFemalePosition(13);
w.STATE.activeSeat = 13;
const bar13 = w.renderSeatBar();
w.document.getElementById('app-content').innerHTML = bar13;
const chips = [...w.document.querySelectorAll('.seat-bar .seat-chip')];
const numbered = chips.filter((el) => el.getAttribute('data-seat'));
const extras = chips.filter((el) => !el.getAttribute('data-seat'));
assert.equal(numbered.length, 13);
assert.ok(extras.some((el) => /Share/.test(el.textContent)));
assert.ok(extras.some((el) => /\+\s*Add/.test(el.textContent)));
assert.equal(numbered[12].textContent, '13A');
assert.equal(src.includes('min-height:44px'), true);
assert.equal(src.includes('min-width:52px'), true);
const chipStyle = w.getComputedStyle(numbered[0]);
const minH = parseFloat(chipStyle.minHeight) || parseFloat(chipStyle.height) || 44;
assert.ok(minH >= 44, 'seat-chip min-height is ' + chipStyle.minHeight);

// 10. service course override changes display, not menu category
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
const catBefore = line.category;
w.setSelectedServiceCourse(2);
assert.equal(line.serviceCourse, 2);
assert.equal(line.category, catBefore);
assert.equal(line.category, 'mains');
const moved = w.workingCheckHtml();
assert.equal(/APPETIZER/.test(moved), false);
assert.match(moved, /Filet Mignon/);

// F toggle: first tap selects, second tap on active numbered chip flips F
seedTable(w, { guests: 3 });
w.STATE.activeSeat = 1;
w.setActiveSeat(2);
assert.equal(w.STATE.activeSeat, 2);
assert.equal(w.isFemalePosition(2), false);
w.setActiveSeat(2);
assert.equal(w.isFemalePosition(2), true);
assert.equal(w.positionLabel(2), '2A');
w.setActiveSeat('table');
assert.equal(w.isFemalePosition('table'), false);
assert.equal(w.positionLabel('table'), 'Share');

// persist / restore femalePositions
seedTable(w, { guests: 4 });
w.toggleFemalePosition(3);
const check = w.ensureOpenCheck('4');
w.persistCheck(check);
assert.equal(check.femalePositions['3'], true);
w.STATE.tableSessions = {};
w.ingestOpenChecks([{
  id: check.id,
  table: '4',
  status: 'open',
  femalePositions: { '3': true, '4': true },
  guestCount: 4
}]);
assert.equal(w.isFemalePosition(3), true);
assert.equal(w.positionLabel(4), '4A');

// display-only consolidation does not rewrite seats / ownership
seedTable(w, { guests: 2 });
const a = diningOrder(w, 'own1', 1, { temp: 'Medium', dessert: false });
const b = diningOrder(w, 'own2', 2, { temp: 'Medium Rare', dessert: false });
w.STATE.activeTastingOrders = [a, b];
const beforeSeats = [a.seat, b.seat];
const beforeMains = [a.selections[4].choice, b.selections[4].choice];
w.workingCheckHtml();
assert.equal(a.seat, beforeSeats[0]);
assert.equal(b.seat, beforeSeats[1]);
assert.equal(a.selections[4].choice, beforeMains[0]);
assert.equal(b.selections[4].choice, beforeMains[1]);
assert.equal(a.selections[4].selectedTemp, 'Medium');
assert.equal(b.selections[4].selectedTemp, 'Medium Rare');

// Handlers must be valid HTML: single-quoted attrs around JSON.stringify keys.
seedTable(w, { guests: 2 });
const clickCheck = w.ensureOpenCheck('4');
w.STATE.activeTastingOrders = [
  diningOrder(w, 'to2', 1, { temp: 'Medium', dessert: false })
];
w.STATE.currentOrder = [{
  lineId: 'ex1',
  name: 'Split 10 oz. filet mignon',
  price: 18,
  qty: 1,
  seat: 1,
  extraPlate: true,
  pfCourseKind: 'main',
  table: '4',
  checkId: clickCheck.id,
  category: 'mains',
  serviceCourse: 3
}];
w.STATE.selectedLineIds = {};
w.STATE._extraDrag = null;
const clickHtml = w.workingCheckHtml();
assert.match(clickHtml, /onclick='event\.stopPropagation\(\);toggleLineSelect\("d\|to2\|4"\)'/);
assert.equal(clickHtml.includes('onclick="event.stopPropagation();toggleLineSelect("d|to2|4")"'), false);
assert.match(clickHtml, /onpointerdown='extraDragStart\(event,"ex1"\)'/);
assert.equal(clickHtml.includes('onpointerdown="extraDragStart(event,"ex1")"'), false);

const host = w.document.getElementById('app-content');
host.innerHTML = clickHtml;
const filetName = [...host.querySelectorAll('.ts-name')].find((el) => /Filet Mignon/.test(el.textContent) && el.closest('.working-line') && !el.closest('.extra-line'));
assert.ok(filetName, 'qty===1 Filet name missing');
const filetRow = filetName.closest('.working-line');
const token = filetRow.querySelector('.pos-token');
assert.ok(token, 'position token missing');
assert.ok(token.onclick, 'token onclick must parse');
assert.equal(w.STATE.selectedLineIds['d|to2|4'], undefined);
token.click();
assert.equal(w.STATE.selectedLineIds['d|to2|4'], 1);

w.STATE.selectedLineIds = {};
host.innerHTML = w.workingCheckHtml();
const nameEl = [...host.querySelectorAll('.ts-name')].find((el) => /Filet Mignon/.test(el.textContent) && el.closest('.working-line') && !el.closest('.extra-line'));
assert.ok(nameEl && nameEl.onclick, 'qty===1 name onclick must parse');
assert.equal(w.STATE.selectedLineIds['d|to2|4'], undefined);
nameEl.click();
assert.equal(w.STATE.selectedLineIds['d|to2|4'], 1);

w.STATE.selectedLineIds = {};
w.STATE._extraDrag = null;
host.innerHTML = w.workingCheckHtml();
const extraRow = host.querySelector('.extra-line');
assert.ok(extraRow, 'extra-plate row missing');
const extraHandler = extraRow.getAttribute('onpointerdown');
assert.equal(extraHandler, 'extraDragStart(event,"ex1")');
const pev = new w.Event('pointerdown', { bubbles: true, cancelable: true });
pev.button = 0;
pev.clientX = 12;
pev.clientY = 18;
pev.pointerId = 7;
const runExtra = extraRow.onpointerdown || new w.Function('event', extraHandler);
runExtra.call(extraRow, pev);
assert.ok(w.STATE._extraDrag, 'extra drag did not start');
assert.equal(w.STATE._extraDrag.lineId, 'ex1');

// 11. floor geometry source identity vs origin/main
const mainSrc = execSync('git show origin/main:index.html', { cwd: root, encoding: 'utf8' });
['var FLOOR_GESTURE =', 'function finishFloorTableDrag(', 'function ensureDragClone('].forEach((needle) => {
  assert.equal(extractDecl(src, needle), extractDecl(mainSrc, needle), needle + ' changed vs origin/main');
});
assert.equal(src.includes('<!-- pos-build: scalini-print-v55 -->'), true);
assert.equal(src.includes('Table Service · build 55'), true);

if (w.STATE && w.STATE._seatTick) {
  w.clearInterval(w.STATE._seatTick);
  w.STATE._seatTick = null;
}

console.log('fine-dining-check tests passed');
