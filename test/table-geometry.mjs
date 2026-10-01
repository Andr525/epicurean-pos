import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'index.html');

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
  const w = dom.window;
  w.Element.prototype.getBoundingClientRect = function () {
    const left = parseFloat(this.style.left) || 0;
    const top = parseFloat(this.style.top) || 0;
    const width = parseFloat(this.style.width) || this.offsetWidth || 70;
    const height = parseFloat(this.style.height) || this.offsetHeight || 70;
    return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height };
  };
  w.document.elementFromPoint = function (x, y) {
    const nodes = Array.from(w.document.querySelectorAll('[data-table]'));
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return n;
    }
    return w.document.getElementById('floor-stage') || w.document.body;
  };
  return w;
}

function seedFloor(w) {
  w.localStorage.clear();
  w.STATE.currentServer = { name: 'Test', role: 'manager', code: '5000' };
  w.STATE.rooms = [{ id: 'dining', name: 'Dining' }];
  w.STATE.roomObjs = {
    dining: [
      { type: 'table', num: 4, shape: 'square', x: 100, y: 80, w: 70, h: 70, seats: 2, _bohGeom: { x: 100, y: 80, w: 70, h: 70, seats: 2 } },
      { type: 'table', num: 5, shape: 'square', x: 250, y: 80, w: 70, h: 70, seats: 2, _bohGeom: { x: 250, y: 80, w: 70, h: 70, seats: 2 } },
      { type: 'table', num: 7, shape: 'square', x: 400, y: 80, w: 70, h: 70, seats: 2, _bohGeom: { x: 400, y: 80, w: 70, h: 70, seats: 2 } }
    ]
  };
  w.STATE.tableCombines = [];
  w.STATE.floorFilter = 'room:dining';
  w.STATE.floorUserPicked = true;
  w.STATE.activeTab = 'tables';
  w.STATE.floorZoom = 1;
  w.STATE.floorPanX = 0;
  w.STATE.floorPanY = 0;
  w.STATE.floorFitDone = true;
  w.floorAbortDrag();
  w.FLOOR_GESTURE.source = '';
  w.FLOOR_GESTURE.pointers = {};
  w.renderTables();
}

function fireTouch(w, type, target, x, y, extra) {
  const t = { identifier: 1, clientX: x, clientY: y, target };
  const ev = new w.Event(type, { bubbles: true, cancelable: true });
  ev.touches = extra && extra.touches ? extra.touches : (type === 'touchend' || type === 'touchcancel' ? [] : [t]);
  ev.changedTouches = [t];
  target.dispatchEvent(ev);
  return ev;
}

function sameGeom(a, b) {
  assert.equal(a && a.x, b.x);
  assert.equal(a && a.y, b.y);
  assert.equal(a && a.w, b.w);
  assert.equal(a && a.h, b.h);
  assert.equal(a && a.seats, b.seats);
}

const w = loadPos();
assert.equal(w.JOIN_EDGE_IGNORE, 0.10);

// Cache must not mint BOH geometry from live/drag coordinates.
const poisoned = w.sanitizeLoadedRoomObj({ type: 'table', num: 4, x: 999, y: 888, w: 70, h: 70, seats: 2 });
assert.equal(poisoned._bohGeom, undefined);
assert.equal(poisoned.x, 999);

const fromBoh = w.sanitizeLoadedRoomObj({
  type: 'table', num: 4, x: 999, y: 888, w: 12, h: 12, seats: 9,
  bohGeom: { x: 40, y: 50, w: 70, h: 70, seats: 2 }
});
sameGeom(fromBoh._bohGeom, { x: 40, y: 50, w: 70, h: 70, seats: 2 });
assert.equal(fromBoh.x, 40);
assert.equal(fromBoh.y, 50);

const persistObj = {
  type: 'table', num: 4, x: 999, y: 888, w: 400, h: 400, seats: 8,
  hidden: true, combinedInto: '4',
  _bohGeom: { x: 40, y: 50, w: 70, h: 70, seats: 2 }
};
const stored = w.stripPosOverlayForPersist(persistObj);
assert.equal(stored.x, 40);
assert.equal(stored.y, 50);
assert.equal(stored.w, 70);
assert.equal(stored.h, 70);
assert.equal(stored.seats, 2);
sameGeom(stored.bohGeom, { x: 40, y: 50, w: 70, h: 70, seats: 2 });
assert.equal(stored.hidden, undefined);
assert.equal(stored.combinedInto, undefined);

seedFloor(w);
const keep = w.liveFloorTable('4');
const drop = w.liveFloorTable('5');
w.applyCombineToObject(keep, drop);
sameGeom(keep._bohGeom, { x: 100, y: 80, w: 70, h: 70, seats: 2 });
sameGeom(drop._bohGeom, { x: 250, y: 80, w: 70, h: 70, seats: 2 });
assert.equal(keep.x, 100);
assert.equal(keep.y, 80);
assert.ok(keep.w > 70 || keep.h > 70);
assert.equal(drop.hidden, true);

w.STATE.tableCombines = [{ keep: '4', drop: '5', at: 1 }, { keep: '4', drop: '7', at: 2 }];
w.reapplyCombines();
const keep2 = w.liveFloorTable('4');
sameGeom(keep2._bohGeom, { x: 100, y: 80, w: 70, h: 70, seats: 2 });
assert.equal(keep2.x, 100);
assert.equal(w.liveFloorTable('7').hidden, true);
w.STATE.tableCombines = [];
w.reapplyCombines();
assert.equal(w.liveFloorTable('4').w, 70);
assert.equal(w.liveFloorTable('5').hidden, false);
assert.equal(w.liveFloorTable('5').x, 250);

function tablePoint(el, dx, dy) {
  const r = el.getBoundingClientRect();
  return { x: r.left + (dx == null ? r.width / 2 : dx), y: r.top + (dy == null ? r.height / 2 : dy) };
}

seedFloor(w);
const stage = w.document.getElementById('floor-stage');
assert.ok(stage);
const rest = w.document.querySelector('[data-table="4"]');
assert.ok(rest);
const restLeft = rest.style.left;
const restTop = rest.style.top;
const liveBefore = { x: w.liveFloorTable('4').x, y: w.liveFloorTable('4').y };
const p0 = tablePoint(rest);
fireTouch(w, 'touchstart', stage, p0.x, p0.y);
fireTouch(w, 'touchmove', stage, p0.x + 80, p0.y);
assert.equal(rest.style.left, restLeft, 'resting table must not move during drag');
assert.equal(rest.style.top, restTop);
assert.ok(w.FLOOR_GESTURE.cloneEl, 'clone overlay should follow the finger');
assert.notEqual(w.FLOOR_GESTURE.cloneEl.style.left, restLeft);
assert.equal(w.liveFloorTable('4').x, liveBefore.x);
assert.equal(w.liveFloorTable('4')._bohGeom.x, 100);

// Lost touchend: no touchend dispatched.
assert.equal(rest.style.left, restLeft, 'lost touchend must leave resting node at BOH');
assert.equal(w.liveFloorTable('4').x, 100);
w.persistPosLayout();
const cached = JSON.parse(w.localStorage.getItem(w.POS_LAYOUT_KEY));
const cached4 = cached.roomObjs.dining.find((o) => String(o.num) === '4');
assert.equal(cached4.x, 100);
assert.equal(cached4.y, 80);
assert.equal(cached4.bohGeom.x, 100);

w.floorAbortDrag();
assert.equal(w.document.querySelector('.floor-drag-clone'), null);
assert.equal(rest.style.left, restLeft);

// Successful combine uses clone hit, not a moved resting node.
seedFloor(w);
const stage2 = w.document.getElementById('floor-stage');
const rest4 = w.document.querySelector('[data-table="4"]');
const rest5 = w.document.querySelector('[data-table="5"]');
const left4 = rest4.style.left;
const start4 = tablePoint(rest4);
const hit5 = tablePoint(rest5);
fireTouch(w, 'touchstart', stage2, start4.x, start4.y);
fireTouch(w, 'touchmove', stage2, hit5.x, hit5.y);
assert.equal(rest4.style.left, left4);
w.finishFloorTableDrag(hit5.x, hit5.y);
assert.equal(w.liveFloorTable('4')._bohGeom.x, 100);
assert.equal(w.liveFloorTable('5')._bohGeom.x, 250);
assert.equal(String(w.lowerTableNumber('4', '5')), '4');
assert.equal(w.liveFloorTable('5').hidden, true);

// Pointer-type touch is not ignored.
seedFloor(w);
const stage3 = w.document.getElementById('floor-stage');
const rest3 = w.document.querySelector('[data-table="4"]');
const left3 = rest3.style.left;
const src = fs.readFileSync(htmlPath, 'utf8');
assert.equal(src.includes("if (e.pointerType==='touch') return;"), false);
const start3 = tablePoint(rest3);
const evDown = new w.Event('pointerdown', { bubbles: true, cancelable: true });
evDown.pointerId = 9;
evDown.pointerType = 'touch';
evDown.clientX = start3.x;
evDown.clientY = start3.y;
stage3.dispatchEvent(evDown);
assert.equal(w.FLOOR_GESTURE.source, 'pointer');
assert.equal(w.FLOOR_GESTURE.startTable, '4');
const evMove = new w.Event('pointermove', { bubbles: true, cancelable: true });
evMove.pointerId = 9;
evMove.pointerType = 'touch';
evMove.clientX = start3.x + 90;
evMove.clientY = start3.y;
stage3.dispatchEvent(evMove);
assert.equal(rest3.style.left, left3);
assert.ok(w.FLOOR_GESTURE.cloneEl);
assert.equal(rest3.getAttribute('data-table'), '4');

console.log('table-geometry tests passed');
