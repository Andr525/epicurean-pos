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
  const voice = fs.readFileSync(path.join(root, 'voice-vocab.js'), 'utf8');
  html = html.replace(/<script src="https:[^"]+"><\/script>/g, '');
  html = html.replace(/<script src="scalini-dining\.js[^"]*"><\/script>/, '<script>' + scalini + '</script>');
  html = html.replace(/<script src="voice-vocab\.js[^"]*"><\/script>/, '<script>' + voice + '</script>');
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
  w.STATE.rapidVoice = { on: false, listening: false, drafts: [], activeSeat: null, lastUndo: null };
  const sess = w.sessionOf('4');
  sess.guestCount = opts.guests || 2;
  sess.femalePositions = {};
  sess.positionStates = {};
  sess.checkId = null;
  w.fbReady = false;
}

const w = loadPos();

// 1. A labels; storage key still femalePositions
seedTable(w, { guests: 3 });
w.toggleFemalePosition(3);
assert.equal(w.positionLabel(3), '3A');
assert.notEqual(w.positionLabel(3), '3F');
assert.equal(w.isPriorityPosition(3), true);
const check = w.ensureOpenCheck('4');
w.persistCheck(check);
assert.equal(check.femalePositions['3'], true);
assert.equal(Object.prototype.hasOwnProperty.call(check, 'priorityPositions'), false);

// 2. keywords from scalini / voice-vocab, not a POS-only map
assert.equal(w.EPICUREAN_VOICE.APPROVED_KEYWORDS.sf_m_giambotta, 'FILET');
assert.equal(src.includes('APPROVED_KEYWORDS'), false);
const filet = w.posVoiceCatalog().find((it) => it.id === 'sf_m_giambotta');
assert.ok(filet, 'FILET missing from voice catalog');
assert.equal(filet.voiceKeyword, 'FILET');

// 3. inactive daily special omitted; historical line remains
seedTable(w);
w.STATE.dailySpecials = [
  { id: 'ds_dead', name: 'Venison special', price: 42, active: false, voiceKeyword: 'VENISON' }
];
w.rebuildPosCatalog();
assert.equal((w.STATE.menuItems || []).some((it) => it.id === 'ds_dead'), false);
assert.equal(w.posVoiceCatalog().some((it) => it.id === 'ds_dead'), false);
w.STATE.currentOrder = [{ lineId: 'hist1', name: 'Venison special', price: 42, qty: 1, seat: 1, table: '4' }];
assert.match(w.workingCheckHtml(), /Venison special/);

// 4. MIC does not send/fire; REVIEW/SEND is the send entry
seedTable(w);
let sent = 0;
let fired = 0;
const so = w.sendOrder;
const fc = w.fireDiningCourse;
const fg = w.fireDiningGroup;
w.sendOrder = function () { sent += 1; };
w.fireDiningCourse = function () { fired += 1; };
w.fireDiningGroup = function () { fired += 1; };
w.startRapidVoiceListen();
assert.equal(w.STATE.rapidVoice.listening, true);
assert.equal(sent, 0);
assert.equal(fired, 0);
w.reviewSendRapidVoice();
assert.equal(sent, 1);
assert.equal(fired, 0);
w.sendOrder = so;
w.fireDiningCourse = fc;
w.fireDiningGroup = fg;

// 5. gelato: one item; two flavors incomplete
const two = w.makeRapidVoiceGelatoDraft(['APPLE', 'VANILLA'], 1);
assert.equal(two.itemId, 'sf_d_gelato');
assert.equal(two.flavors.length, 2);
assert.match(two.need, /2 OF 3/);
assert.equal(two.confidence, 'need');
const three = w.makeRapidVoiceGelatoDraft(['APPLE', 'VANILLA', 'CARAMEL'], 1);
assert.equal(three.itemId, 'sf_d_gelato');
assert.equal(three.need, '');
assert.equal(three.confidence, 'high');
w.STATE.rapidVoice.drafts = [two];
assert.equal(w.STATE.rapidVoice.drafts.length, 1);

// 6. spoken VIN + existing posOpsLookup
const spoken = w.EPICUREAN_VOICE.normalizeSpokenVin('VIN eight two five one');
assert.ok(spoken);
assert.equal(spoken.kind, 'vin');
assert.equal(spoken.code, '8251');
const lookup = w.posOpsLookup('vin 8251');
assert.ok(lookup);
assert.equal(lookup.kind, 'vin');
assert.equal(String(lookup.code), '8251');

// 7. tasting temps / entremet / headings
seedTable(w);
w.STATE.tastingMenus = w.mergeScaliniList([], w.SEED_TASTING_MENUS, ['tm_chef7', 'tm_choc5', 'tm1', 'tm2']);
w.ensureOpenCheck('4');
w.addTastingMenu('tm_scalini_128');
const tasting = (w.STATE.activeTastingOrders || [])[0];
assert.ok(tasting);
const courses = w.diningCourses(tasting);
const forestiere = courses.find((c) => /forestiere|forrestiere|sf_m_forestiere/i.test([c.name, c.choice, c.dishId].join(' ')));
const giambotta = courses.find((c) => /giambotta|sf_m_giambotta/i.test([c.name, c.choice, c.dishId].join(' ')));
const sorbet = courses.find((c) => /sorbet|entremet/i.test([c.name, c.choice, c.mode].join(' ')));
assert.equal(forestiere.askTemp, 'salmon');
assert.equal(giambotta.askTemp, 'steak');
courses.forEach((c) => {
  if (c === forestiere || c === giambotta) return;
  if (c && c.headingOnly) return;
  assert.ok(!c.askTemp, 'unexpected temp on ' + (c.name || c.course));
});
assert.equal(w.hideEntremetUntilDessert(sorbet, tasting), true);
const checkHtml = w.workingCheckHtml();
['WELCOME', 'APPETIZER', 'MAIN', 'DESSERT', 'PRE-DESSERT'].forEach((label) => {
  assert.equal(checkHtml.includes(label), false, 'heading still visible: ' + label);
});

// 8. floor clone-drag decls unchanged vs origin/main
const main = execSync('git show origin/main:index.html', { cwd: root, encoding: 'utf8' });
[
  'function FLOOR_GESTURE',
  'function ensureDragClone',
  'function applyCloneDrag',
  'function finishFloorTableDrag',
  'function bindFloorDocGestures',
  'function commitTableMove'
].forEach((fn) => {
  assert.equal(extractDecl(src, fn), extractDecl(main, fn), fn + ' changed');
});
assert.equal(w.FLOOR_HOLD_OCCUPIED_MS, 500);

// 9. selection-only change does not rebuild menu pane
seedTable(w);
w.STATE.menuNav = { level: 'cats', family: 'food' };
const prev = w.menuNavFingerprint();
w.STATE.selectedLineIds = { alc1: 1 };
assert.equal(w.menuPaneShouldRebuild(prev, w.menuNavFingerprint()), false);

console.log('rapid-voice-phase1.mjs ok');
