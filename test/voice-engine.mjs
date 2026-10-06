import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'index.html');
const src = fs.readFileSync(htmlPath, 'utf8');

function loadEngine() {
  const code = fs.readFileSync(path.join(root, 'voice-engine.js'), 'utf8');
  const sandbox = { module: { exports: {} }, exports: {}, window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.EPICUREAN_VOICE_ENGINE;
}

function loadPos() {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const scalini = fs.readFileSync(path.join(root, 'scalini-dining.js'), 'utf8');
  const voice = fs.readFileSync(path.join(root, 'voice-vocab.js'), 'utf8');
  const engine = fs.readFileSync(path.join(root, 'voice-engine.js'), 'utf8');
  html = html.replace(/<script src="https:[^"]+"><\/script>/g, '');
  html = html.replace(/<script src="scalini-dining\.js[^"]*"><\/script>/, '<script>' + scalini + '</script>');
  html = html.replace(/<script src="voice-vocab\.js[^"]*"><\/script>/, '<script>' + voice + '</script>');
  html = html.replace(/<script src="voice-engine\.js[^"]*"><\/script>/, '<script>' + engine + '</script>');
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

function seedTable(w, guests) {
  if (w.posSheetOpen()) w.closeSheet();
  w.STATE.currentServer = { name: 'Test', role: 'manager', code: '5000' };
  w.STATE.selectedTable = '4';
  w.STATE.activeSeat = 1;
  w.STATE.guestCount = guests || 2;
  w.STATE.currentOrder = [];
  w.STATE.orders = [];
  w.STATE.checks = {};
  w.STATE.selectedLineIds = {};
  w.STATE.activeTastingOrders = [];
  w.STATE.tableSessions = {};
  w.STATE.viewCheckId = null;
  w.STATE.menuOpen = true;
  w.STATE.voiceDrafts = [];
  w.STATE._voiceCommit = false;
  w.STATE.rapidVoice = { on: false, listening: false, drafts: [], activeSeat: null, lastUndo: null };
  const sess = w.sessionOf('4');
  sess.guestCount = guests || 2;
  sess.femalePositions = {};
  sess.positionStates = {};
  sess.checkId = null;
  w.ensureOpenCheck('4');
  w.fbReady = false;
}

function installVocab(w, entries, opts) {
  opts = opts || {};
  const eng = w.EPICUREAN_VOICE_ENGINE;
  const revision = opts.revision || 'rTEST';
  w.STATE.voiceVocab = {
    revision: revision,
    stale: !!opts.stale,
    index: opts.stale ? null : eng.buildIndex(entries, opts.modifiers || [], revision),
    reason: opts.stale ? 'test' : ''
  };
}

function draft(w) {
  return (w.STATE.voiceDrafts || [])[0] || null;
}

const eng = loadEngine();
const cellar = fs.readFileSync(path.join(root, 'cellar.js'), 'utf8');
assert.match(cellar, /"vin":"2148"/);

const bev = { scope: 'beverage', sourceType: 'btg', active: true };
const index = eng.buildIndex([
  Object.assign({ sourceId: 'btg_spark_beck', family: 'btg-sparkling', voiceKeyword: 'CHAMPAGNE', voiceAliases: ['BUBBLES'] }, bev),
  Object.assign({ sourceId: 'btg_spark_zardetto', family: 'btg-sparkling', voiceKeyword: 'PROSECCO' }, bev),
  Object.assign({ sourceId: 'btg_spark_concerto', family: 'btg-sparkling', voiceKeyword: 'LAMBRUSCO' }, bev),
  { scope: 'beverage', sourceType: 'bar', sourceId: 'br1', family: 'beer', voiceKeyword: 'HITACHINO', voiceAliases: ['NEST'], active: true },
  { scope: 'beverage', sourceType: 'bar', sourceId: 'gone', family: 'beer', voiceKeyword: 'RETIRED', active: false },
  { scope: 'food', sourceType: 'food', sourceId: 'sf_m_forestiere', family: 'food', voiceKeyword: 'SALMON', active: true },
  { scope: 'beverage', sourceType: 'bar', sourceId: 'a', family: 'cocktail', voiceKeyword: 'HOUSE', active: true },
  { scope: 'beverage', sourceType: 'bar', sourceId: 'b', family: 'cocktail', voiceKeyword: 'HOUSE', active: true }
], [{ id: 'garnish', voiceRole: 'garnish', options: [{ name: 'Twist', voiceAliases: ['TWIST'] }] }], 'rLIVE');
assert.equal(index.entryCount, 6);
assert.equal(index.modifiers[0].voiceRole, 'garnish');
assert.equal(index.byKeyword.SALMON, undefined);

const catalog = [
  { id: 'btg_spark_beck', name: 'Graham Beck Brut', price: 25, source: 'wine', byTheGlass: true, category: 'wine-glass', modifiers: [{ group: 'Pour', options: ['Glass 6 oz 25', 'Taste 2 oz 8'] }], active: true },
  { id: 'btg_spark_zardetto', name: 'Zardetto Prosecco Brut', price: 17, source: 'wine', byTheGlass: true, category: 'wine-glass', modifiers: [{ group: 'Pour', options: ['Glass', 'Taste'] }], active: true },
  { id: 'btg_spark_concerto', name: 'Lambrusco Concerto', price: 27, source: 'wine', byTheGlass: true, category: 'wine-glass', modifiers: [{ group: 'Pour', options: ['Glass', 'Taste'] }], active: true },
  { id: 'br1', name: 'Hitachino Nest White Ale', price: 16, source: 'bar', category: 'beer', modifiers: [], active: true, eightySixed: false },
  { id: 'w2148NV750ml', name: 'Krug Grande Cuvée', price: 275, source: 'wine', vin: '2148', category: 'wine-bottle', modifiers: [], active: true, byTheGlass: false },
  { id: 'sp1', name: 'Hibiki Japanese Harmony', price: 24, source: 'bar', lin: '2746', category: 'spirits', modifiers: [], active: true },
  { id: 'cf_esp', name: 'Espresso', price: 5, source: 'bar', category: 'coffees', modifiers: [], active: true },
  { id: 'port10', name: 'Fonseca Tawny 10 Years', price: 20, source: 'wine', category: 'wine-bottle', modifiers: [], active: true, byTheGlass: false },
  { id: 'i1', name: 'Tuna Tartare', price: 16, source: 'menu', category: 'small-plates', modifiers: [], active: true }
];
const opts = { index: index, stale: false, catalog: catalog };

let parsed = eng.parse('CHAMPAGNE', opts);
assert.equal(parsed.confidence, 'MISSING');
assert.equal(parsed.itemId, 'btg_spark_beck');
assert.equal(parsed.need, 'Pour');
parsed = eng.parse('PROSECCO', opts);
assert.equal(parsed.itemId, 'btg_spark_zardetto');
assert.equal(parsed.confidence, 'MISSING');
parsed = eng.parse('LAMBRUSCO', opts);
assert.equal(parsed.itemId, 'btg_spark_concerto');
parsed = eng.parse('3A CHAMPAGNE', opts);
assert.equal(parsed.seat, 3);
assert.equal(parsed.priority, true);
assert.equal(parsed.confidence, 'MISSING');
assert.equal(parsed.itemId, 'btg_spark_beck');
parsed = eng.parse('CHAMPAGNE 3A', opts);
assert.equal(parsed.seat, 3);
assert.equal(parsed.priority, true);
assert.equal(parsed.confidence, 'MISSING');
assert.equal(parsed.itemId, 'btg_spark_beck');
parsed = eng.parse('3A PROSECCO', opts);
assert.equal(parsed.seat, 3);
assert.equal(parsed.priority, true);
assert.equal(parsed.itemId, 'btg_spark_zardetto');
parsed = eng.parse('PROSECCO 3A', opts);
assert.equal(parsed.seat, 3);
assert.equal(parsed.priority, true);
assert.equal(parsed.itemId, 'btg_spark_zardetto');
assert.equal(parsed.confidence, 'MISSING');
parsed = eng.parse('3 PROSECCO', opts);
assert.equal(parsed.seat, 3);
assert.equal(parsed.priority, false);
assert.equal(parsed.itemId, 'btg_spark_zardetto');
parsed = eng.parse('PROSECCO 3', opts);
assert.equal(parsed.seat, 3);
assert.equal(parsed.priority, false);
assert.equal(parsed.itemId, 'btg_spark_zardetto');
parsed = eng.parse('7A CHAMPAGNE', opts);
assert.equal(parsed.seat, 7);
assert.equal(parsed.priority, true);
assert.equal(parsed.itemId, 'btg_spark_beck');
parsed = eng.parse('CHAMPAGNE 7A', opts);
assert.equal(parsed.seat, 7);
assert.equal(parsed.priority, true);
assert.equal(parsed.itemId, 'btg_spark_beck');
parsed = eng.parse('BUBBLES', opts);
assert.equal(parsed.itemId, 'btg_spark_beck');
assert.notEqual(parsed.confidence, 'HIGH');
parsed = eng.parse('HITACHINO', opts);
assert.equal(parsed.confidence, 'HIGH');
assert.equal(parsed.itemId, 'br1');
assert.equal(parsed.price, 16);
parsed = eng.parse('VIN 2148', opts);
assert.equal(parsed.confidence, 'HIGH');
assert.equal(parsed.itemId, 'w2148NV750ml');
assert.equal(parsed.code.code, '2148');
assert.equal(parsed.positionTouched, false);
assert.equal(parsed.seat, null);
parsed = eng.parse('3A VIN 2148', opts);
assert.equal(parsed.seat, 3);
assert.equal(parsed.priority, true);
assert.equal(parsed.confidence, 'HIGH');
assert.equal(parsed.itemId, 'w2148NV750ml');
assert.equal(parsed.code.code, '2148');
parsed = eng.parse('VIN 2148 3A', opts);
assert.equal(parsed.seat, 3);
assert.equal(parsed.priority, true);
assert.equal(parsed.confidence, 'HIGH');
assert.equal(parsed.itemId, 'w2148NV750ml');
assert.equal(parsed.code.code, '2148');
parsed = eng.parse('VIN 2', opts);
assert.equal(parsed.positionTouched, false);
assert.equal(parsed.code.code, '2');
assert.equal(parsed.confidence, 'INVALID_CODE');
parsed = eng.parse('VIN eight two five one', opts);
assert.equal(parsed.code.kind, 'vin');
assert.equal(parsed.code.code, '8251');
assert.equal(parsed.confidence, 'INVALID_CODE');
assert.equal(parsed.suggestion, '');
parsed = eng.parse('LIN 2746', opts);
assert.equal(parsed.confidence, 'HIGH');
assert.equal(parsed.itemId, 'sp1');
parsed = eng.parse('LIN two seven four six', opts);
assert.equal(parsed.confidence, 'HIGH');
assert.equal(parsed.itemId, 'sp1');
parsed = eng.parse('7A PASS', opts);
assert.equal(parsed.kind, 'pass');
assert.equal(parsed.seat, 7);
assert.equal(parsed.priority, true);
assert.equal(parsed.confidence, 'HIGH');
parsed = eng.parse('7A NO DRINK', opts);
assert.equal(parsed.kind, 'noDrink');
assert.equal(parsed.confidence, 'HIGH');
parsed = eng.parse('PASS 7A', opts);
assert.equal(parsed.kind, 'pass');
assert.equal(parsed.seat, 7);
assert.equal(parsed.priority, true);
parsed = eng.parse('NO DRINK 7A', opts);
assert.equal(parsed.kind, 'noDrink');
assert.equal(parsed.seat, 7);
assert.equal(parsed.priority, true);
parsed = eng.parse('Fonseca Tawny 10 Years', opts);
assert.equal(parsed.positionTouched, false);
assert.equal(parsed.confidence, 'HIGH');
assert.equal(parsed.itemId, 'port10');
parsed = eng.parse('3A Fonseca Tawny 10 Years', opts);
assert.equal(parsed.seat, 3);
assert.equal(parsed.priority, true);
assert.equal(parsed.itemId, 'port10');
parsed = eng.parse('3A PROSECCO 7A', opts);
assert.equal(parsed.positionTouched, false);
assert.equal(parsed.confidence, 'NO_MATCH');
parsed = eng.parse('back to 3A', opts);
assert.equal(parsed.kind, 'position');
assert.equal(parsed.seat, 3);
assert.equal(parsed.priority, true);
parsed = eng.parse('1', opts);
assert.equal(parsed.kind, 'position');
assert.equal(parsed.seat, 1);
assert.equal(parsed.priority, false);
parsed = eng.parse('ZYZZY', opts);
assert.equal(parsed.confidence, 'NO_MATCH');
assert.equal(parsed.itemId, '');
parsed = eng.parse('CHAMPAGN', opts);
assert.equal(parsed.confidence, 'NO_MATCH');
assert.match(parsed.suggestion, /CHAMPAGNE/);
assert.equal(parsed.itemId, '');
parsed = eng.parse('HOUSE', opts);
assert.equal(parsed.confidence, 'AMBIGUOUS');
assert.equal(parsed.itemId, '');
parsed = eng.parse('RETIRED', opts);
assert.equal(parsed.confidence, 'MISSING');
assert.equal(parsed.need, 'inactive');
parsed = eng.parse('SALMON', opts);
assert.equal(parsed.confidence, 'NO_MATCH');
parsed = eng.parse('Espresso', opts);
assert.equal(parsed.confidence, 'HIGH');
assert.equal(parsed.itemId, 'cf_esp');
parsed = eng.parse('Tuna Tartare', opts);
assert.equal(parsed.confidence, 'NO_MATCH');
const eighty = catalog.map((it) => it.id === 'br1' ? Object.assign({}, it, { eightySixed: true }) : it);
parsed = eng.parse('HITACHINO', { index: index, stale: false, catalog: eighty });
assert.equal(parsed.confidence, 'MISSING');
assert.match(parsed.need, /86/);
parsed = eng.parse('CHAMPAGNE', { index: index, stale: true, catalog: catalog });
assert.equal(parsed.confidence, 'STALE');
parsed = eng.parse('7A PASS', { index: null, stale: true, catalog: catalog });
assert.equal(parsed.kind, 'pass');
parsed = eng.parse('VIN 2148', { index: null, stale: true, catalog: catalog });
assert.equal(parsed.confidence, 'HIGH');
assert.equal(parsed.itemId, 'w2148NV750ml');

const bad = eng.assemble(
  { activeRevision: 'rNEW', chunkCount: 1, chunkIds: ['voice_vocab_rNEW_0'] },
  [{ revision: 'rOLD', chunkIndex: 0, chunkCount: 1, entries: [], modifiers: [] }]
);
assert.equal(bad.stale, true);
assert.equal(bad.index, null);
const good = eng.assemble(
  { activeRevision: 'rLIVE', chunkCount: 1 },
  [{ revision: 'rLIVE', chunkIndex: 0, chunkCount: 1, entries: [
    { scope: 'beverage', sourceType: 'bar', sourceId: 'br1', family: 'beer', voiceKeyword: 'HITACHINO', voiceAliases: [] }
  ], modifiers: [{ id: 'g', voiceRole: 'service' }] }]
);
assert.equal(good.stale, false);
assert.equal(good.index.revision, 'rLIVE');
assert.equal(good.index.modifiers[0].voiceRole, 'service');

const w = loadPos();
const krugRows = [
  { id: 'w2148NV750ml', vin: '2148', name: 'Krug Grande Cuvée', size: '750ml', bottlePrice: 275, stock: 9, ozOnHand: 100 },
  { id: 'w2148NV375ml', vin: '2148', name: 'Grande Cuvée (375ml)', size: '375ml', bottlePrice: 275, stock: 8, ozOnHand: 50 }
];
assert.equal(w.applyBundledSkuVins(krugRows, [
  { id: 'w2148NV750ml', vin: '2148' },
  { id: 'w2148NV375ml', vin: '20007' }
]), true);
assert.equal(krugRows[0].vin, '2148');
assert.equal(krugRows[1].vin, '20007');
assert.equal(krugRows[1].stock, 8);
assert.equal(krugRows[1].ozOnHand, 50);
assert.equal(w.filterByOpsLookup(krugRows, w.posOpsLookup('vin 2148')).map((it) => it.id).join(','), 'w2148NV750ml');
assert.equal(w.filterByOpsLookup(krugRows, w.posOpsLookup('vin 20007')).map((it) => it.id).join(','), 'w2148NV375ml');
assert.equal(w.applyBundledSkuVins(krugRows, [
  { id: 'w2148NV750ml', vin: '2148' },
  { id: 'w2148NV375ml', vin: '20007' }
]), false);
const publishedHalf = [{ id: 'w2148NV375ml', vin: '20007', stock: 8 }];
assert.equal(w.applyBundledSkuVins(publishedHalf, [{ id: 'w2148NV375ml', vin: '400' }]), true);
assert.equal(publishedHalf[0].vin, '400');
assert.equal(publishedHalf[0].stock, 8);
const managerVin = [{ id: 'w2148NV375ml', vin: '8801' }];
assert.equal(w.applyBundledSkuVins(managerVin, [{ id: 'w2148NV375ml', vin: '400' }]), false);
assert.equal(managerVin[0].vin, '8801');
const heldRows = [
  { id: 'w15542021750ml', vin: '1554', name: 'Clau de Nell' },
  { id: 'w15541999750ml', vin: '1554', name: 'Brunate- Le Coste' }
];
assert.equal(w.applyBundledSkuVins(heldRows, heldRows.map((row) => ({ id: row.id, vin: row.vin }))), false);
assert.equal(heldRows[0].vin, '1554');
assert.equal(heldRows[1].vin, '1554');
const half = w.mapWineToPos({ id: 'w2148NV375ml', vin: '20007', name: 'Grande Cuvée (375ml)', size: '375ml', vintage: 'NV', bottlePrice: 275, stock: 12 });
assert.equal(half.name, 'Grande Cuvée (375ml)');
assert.equal(half.vin, '20007');
assert.equal(half.price, 275);
const spaced = w.mapWineToPos({ id: 'x', vin: '1', name: 'House (375 ml)', size: '375ml', vintage: 'NV', bottlePrice: 10 });
assert.equal(spaced.name, 'House (375 ml)');
const magnum = w.mapWineToPos({ id: 'm', vin: '2', name: 'Único (Magnum)', size: '1.5L', vintage: '1986', bottlePrice: 3200 });
assert.equal(magnum.name, 'Único (Magnum) 1986 (1.5L)');
seedTable(w);
w.STATE.foodItems = w.SEED_ITEMS.slice();
w.STATE.bar = [
  { id: 'br1', name: 'Hitachino Nest White Ale', kind: 'Beer', price: 16, stock: 12, active: true, visible: true },
  { id: 'sp1', name: 'Hibiki Japanese Harmony', kind: 'Spirit', price: 24, lin: '2746', stock: 4, active: true, visible: true }
];
w.STATE.wines = [
  { id: 'w2148NV750ml', vin: '2148', name: 'Krug Grande Cuvée', vintage: 'NV', bottlePrice: 275, glassPrice: 0, stock: 12, active: true, visible: true }
];
w.rebuildPosCatalog();
const beck = w.STATE.menuItems.find((it) => it.id === 'btg_spark_beck');
const krug = w.STATE.menuItems.find((it) => it.vin === '2148');
const hibiki = w.STATE.menuItems.find((it) => it.id === 'sp1');
assert.ok(beck, 'BTG champagne missing from the existing catalog');
assert.ok(krug, 'VIN 2148 missing from the existing catalog');
assert.equal(String(hibiki.lin), '2746');
assert.equal(w.filterByOpsLookup(w.STATE.menuItems, w.posOpsLookup('vin 2148'))[0].id, krug.id);
assert.equal(w.filterByOpsLookup(w.STATE.menuItems, w.posOpsLookup('lin 2746'))[0].id, 'sp1');

installVocab(w, [
  { scope: 'beverage', sourceType: 'btg', sourceId: 'btg_spark_beck', family: 'btg-sparkling', voiceKeyword: 'CHAMPAGNE', voiceAliases: ['BUBBLES'], active: true },
  { scope: 'beverage', sourceType: 'btg', sourceId: 'btg_spark_zardetto', family: 'btg-sparkling', voiceKeyword: 'PROSECCO', active: true },
  { scope: 'beverage', sourceType: 'btg', sourceId: 'btg_spark_concerto', family: 'btg-sparkling', voiceKeyword: 'LAMBRUSCO', active: true },
  { scope: 'beverage', sourceType: 'bar', sourceId: 'br1', family: 'beer', voiceKeyword: 'HITACHINO', active: true },
  { scope: 'beverage', sourceType: 'bar', sourceId: 'gone', family: 'beer', voiceKeyword: 'RETIRED', active: false },
  { scope: 'beverage', sourceType: 'bar', sourceId: 'a', family: 'cocktail', voiceKeyword: 'HOUSE', active: true },
  { scope: 'beverage', sourceType: 'bar', sourceId: 'b', family: 'cocktail', voiceKeyword: 'HOUSE', active: true }
]);

let reads = 0;
const origGet = w.fbGetDoc;
w.fbGetDoc = function () { reads += 1; return Promise.resolve(null); };
let sent = 0;
let fired = 0;
const origSend = w.sendOrder;
const origFire = w.fireDiningCourse;
const origGroup = w.fireDiningGroup;
w.sendOrder = function () { sent += 1; };
w.fireDiningCourse = function () { fired += 1; };
w.fireDiningGroup = function () { fired += 1; };

w.applyVoiceCommand('CHAMPAGNE');
assert.equal(w.STATE.currentOrder.length, 0);
assert.equal(draft(w).confidence, 'MISSING');
assert.match(draft(w).need, /Pour/);
assert.equal(sent, 0);

w.applyVoiceCommand('3A CHAMPAGNE');
assert.equal(w.STATE.activeSeat, 3);
assert.equal(w.positionLabel(3), '3A');
assert.equal(w.femalePositionsOf()['3'], true);
assert.equal(w.STATE.currentOrder.length, 0);
assert.equal(sent, 0);
w.applyVoiceCommand('PROSECCO 3A');
assert.equal(w.STATE.activeSeat, 3);
assert.equal(w.positionLabel(3), '3A');
assert.equal(w.femalePositionsOf()['3'], true);
assert.equal(w.STATE.currentOrder.length, 0);
assert.equal(w.STATE.orders.length, 0);
assert.equal(draft(w).itemId, 'btg_spark_zardetto');
assert.equal(draft(w).confidence, 'MISSING');
assert.equal(sent, 0);

w.STATE.voiceDrafts = [];
w.applyVoiceCommand('PROSECCO');
w.applyVoiceCommand('LAMBRUSCO');
assert.equal(w.STATE.currentOrder.length, 0);
assert.equal(w.STATE.voiceDrafts.filter((d) => d.itemId === 'btg_spark_zardetto').length, 1);
assert.equal(w.STATE.voiceDrafts.filter((d) => d.itemId === 'btg_spark_concerto').length, 1);

w.STATE.voiceDrafts = [];
w.applyVoiceCommand('HITACHINO');
assert.equal(sent, 0);
assert.equal(fired, 0);
assert.equal(w.STATE.orders.length, 0);
assert.equal(w.STATE.currentOrder.length, 1);
assert.equal(w.STATE.currentOrder[0].id, 'br1');
assert.equal(w.STATE.currentOrder[0].price, 16);
assert.equal(w.STATE.currentOrder[0].voiceOrigin, true);
assert.equal(w.STATE.currentOrder[0].seat, 3);
assert.equal(w.STATE.menuOpen, true);

seedTable(w);
installVocab(w, [
  { scope: 'beverage', sourceType: 'bar', sourceId: 'br1', family: 'beer', voiceKeyword: 'HITACHINO', active: true }
]);
w.applyVoiceCommand('3A HITACHINO');
assert.equal(w.STATE.currentOrder[0].seat, 3);
assert.equal(w.positionLabel(3), '3A');
assert.equal(w.STATE.orders.length, 0);

seedTable(w);
installVocab(w, [
  { scope: 'beverage', sourceType: 'btg', sourceId: 'btg_spark_beck', family: 'btg-sparkling', voiceKeyword: 'CHAMPAGNE', active: true }
]);
let codeReads = 0;
const origFilter = w.filterByOpsLookup;
w.filterByOpsLookup = function () { codeReads += 1; return origFilter.apply(this, arguments); };
w.applyVoiceCommand('VIN 2148');
assert.ok(codeReads >= 1);
assert.equal(w.STATE.activeSeat, 1);
assert.equal(w.STATE.currentOrder.length, 1);
assert.equal(w.STATE.currentOrder[0].id, krug.id);
assert.equal(w.STATE.currentOrder[0].price, 275);
assert.equal(w.STATE.currentOrder[0].voiceOrigin, true);
assert.equal(w.STATE.orders.length, 0);
assert.equal(sent, 0);
w.filterByOpsLookup = origFilter;
seedTable(w);
installVocab(w, [
  { scope: 'beverage', sourceType: 'btg', sourceId: 'btg_spark_zardetto', family: 'btg-sparkling', voiceKeyword: 'PROSECCO', active: true }
]);
w.applyVoiceCommand('VIN 2148 3A');
assert.equal(w.STATE.activeSeat, 3);
assert.equal(w.positionLabel(3), '3A');
assert.equal(w.STATE.currentOrder.length, 1);
assert.equal(w.STATE.currentOrder[0].id, krug.id);
assert.equal(w.STATE.currentOrder[0].seat, 3);
assert.equal(w.STATE.currentOrder[0].price, 275);
assert.equal(w.STATE.orders.length, 0);

seedTable(w);
w.STATE.voiceVocab = w.STATE.voiceVocab;
w.applyVoiceCommand('VIN eight two five one');
assert.equal(w.STATE.currentOrder.length, 0);
assert.equal(draft(w).confidence, 'INVALID_CODE');
assert.equal(draft(w).suggestion || '', '');

seedTable(w);
w.applyVoiceCommand('LIN two seven four six');
assert.equal(w.STATE.currentOrder.length, 1);
assert.equal(w.STATE.currentOrder[0].id, 'sp1');
assert.equal(w.STATE.currentOrder[0].price, 24);
assert.equal(w.STATE.orders.length, 0);

seedTable(w);
w.applyVoiceCommand('7A PASS');
assert.equal(w.positionState(7).pass, true);
assert.equal(w.positionState(7).noDrink, false);
assert.equal(w.positionLabel(7), '7A');
assert.equal(w.STATE.currentOrder.length, 0);
assert.equal(w.STATE.orders.length, 0);
assert.equal((w.STATE.voiceDrafts || []).length, 0);
w.STATE._menuPaneFp = null;
w.renderOrder();
assert.match(w.document.getElementById('app-content').textContent, /7A PASS/);

seedTable(w);
w.applyVoiceCommand('7A NO DRINK');
assert.equal(w.positionState(7).noDrink, true);
assert.equal(w.positionState(7).pass, false);
assert.equal(w.STATE.currentOrder.length, 0);

seedTable(w);
w.applyVoiceCommand('back to 3A');
assert.equal(w.STATE.activeSeat, 3);
assert.equal(w.positionLabel(3), '3A');
assert.equal(w.STATE.currentOrder.length, 0);
w.applyVoiceCommand('3');
assert.equal(w.STATE.activeSeat, 3);
assert.equal(w.femalePositionsOf()['3'], true);

seedTable(w);
installVocab(w, [
  { scope: 'beverage', sourceType: 'bar', sourceId: 'br1', family: 'beer', voiceKeyword: 'HITACHINO', active: true },
  { scope: 'beverage', sourceType: 'bar', sourceId: 'gone', family: 'beer', voiceKeyword: 'RETIRED', active: false },
  { scope: 'beverage', sourceType: 'bar', sourceId: 'a', family: 'cocktail', voiceKeyword: 'HOUSE', active: true },
  { scope: 'beverage', sourceType: 'bar', sourceId: 'b', family: 'cocktail', voiceKeyword: 'HOUSE', active: true }
]);
w.applyVoiceCommand('ZYZZYVA');
assert.equal(draft(w).confidence, 'NO_MATCH');
assert.equal(w.STATE.currentOrder.length, 0);
w.applyVoiceCommand('HOUSE');
assert.equal(draft(w).confidence, 'AMBIGUOUS');
assert.equal(w.STATE.currentOrder.length, 0);
w.applyVoiceCommand('RETIRED');
assert.equal(draft(w).confidence, 'MISSING');
assert.equal(draft(w).need, 'inactive');
assert.equal(w.STATE.currentOrder.length, 0);

seedTable(w);
const lager = w.findPosMenuItem('br1');
lager.eightySixed = true;
w.applyVoiceCommand('HITACHINO');
assert.equal(w.STATE.currentOrder.length, 0);
assert.match(draft(w).need, /86/);
lager.eightySixed = false;

seedTable(w);
w.STATE.voiceVocab = { revision: 'rOLD', stale: true, index: null, reason: 'test' };
w.applyVoiceCommand('CHAMPAGNE');
assert.equal(draft(w).confidence, 'STALE');
assert.equal(w.STATE.currentOrder.length, 0);
w.applyVoiceCommand('7A PASS');
assert.equal(w.positionState(7).pass, true);
assert.equal(w.STATE.currentOrder.length, 0);

seedTable(w);
installVocab(w, [
  { scope: 'beverage', sourceType: 'bar', sourceId: 'br1', family: 'beer', voiceKeyword: 'HITACHINO', active: true }
]);
w.applyVoiceCommand('CHAMPAGNE');
assert.equal(draft(w).confidence, 'NO_MATCH');
assert.equal(w.STATE.currentOrder.length, 0, 'static approved keyword must not order');

seedTable(w);
w.seatAllergies(1).push('Egg');
w.applyVoiceCommand('HITACHINO');
assert.equal(w.STATE.currentOrder.length, 1);
w.STATE.currentOrder = [];
const pisco = w.findPosMenuItem('i8');
assert.ok(pisco);
w.STATE.voiceVocab = {
  revision: 'rEGG',
  stale: false,
  index: w.EPICUREAN_VOICE_ENGINE.buildIndex([
    { scope: 'beverage', sourceType: 'bar', sourceId: 'i8', family: 'cocktail', voiceKeyword: 'PISCO', active: true }
  ], [], 'rEGG')
};
w.applyVoiceCommand('PISCO');
assert.equal(w.STATE.currentOrder.length, 0);
assert.equal(draft(w).need, 'allergy');

assert.equal(reads, 0);
w.fbGetDoc = origGet;
w.sendOrder = origSend;
w.fireDiningCourse = origFire;
w.fireDiningGroup = origGroup;

seedTable(w);
installVocab(w, [
  { scope: 'beverage', sourceType: 'bar', sourceId: 'br1', family: 'beer', voiceKeyword: 'HITACHINO', active: true }
]);
w.applyVoiceCommand('HITACHINO');
assert.equal(w.STATE.orders.length, 0);
w.sendOrder({});
assert.equal(w.STATE.orders.length, 1);
assert.equal(w.STATE.currentOrder.length, 0);

seedTable(w);
installVocab(w, [
  { scope: 'beverage', sourceType: 'bar', sourceId: 'br1', family: 'beer', voiceKeyword: 'HITACHINO', active: true }
]);
w.applyVoiceCommand('HITACHINO');
assert.equal(w.STATE.orders.length, 0);
w.sendOrder({ fireCourse: 1, stay: true });
assert.equal(w.STATE.orders.length, 1);
assert.equal(w.STATE.currentOrder.length, 0);

seedTable(w);
w.applyVoiceCommand('CHAMPAGNE');
const before = w.STATE.orders.length;
w.sendOrder({});
assert.equal(w.STATE.orders.length, before);
assert.equal(w.STATE.currentOrder.length, 0);
assert.ok((w.STATE.voiceDrafts || []).length);

seedTable(w);
const beforeManual = w.STATE.orders.length;
w.beginAddItem('i8');
assert.equal(w.STATE.currentOrder.length, 1);
assert.equal(w.STATE.currentOrder[0].id, 'i8');
assert.equal(w.STATE.currentOrder[0].price, 14);
assert.equal(w.STATE.currentOrder[0].voiceOrigin, undefined);
assert.equal(w.STATE.orders.length, beforeManual);
w.closeSheet();
w.STATE.currentOrder = [];
w.beginAddItem('btg_spark_beck');
assert.ok(w.STATE.pendingItem);
assert.equal(w.STATE.pendingItem.id, 'btg_spark_beck');
assert.equal(w.STATE.currentOrder.length, 0);
w.closeSheet();
w.beginAddItem(krug.id);
assert.equal(w.STATE.currentOrder.length, 0);
assert.equal(w.STATE.pendingItem.id, krug.id);
w.closeSheet();
w.beginAddItem('sp1');
assert.equal(w.STATE.currentOrder[0].id, 'sp1');
assert.equal(w.STATE.orders.length, 0);
w.STATE.currentOrder = [];
w.beginAddItem('i10');
assert.equal(w.STATE.currentOrder[0].category, 'beer');
w.STATE.currentOrder = [];
const espresso = w.findPosMenuItem('cf_esp');
assert.ok(espresso, 'coffee item missing');
w.beginAddItem('cf_esp');
assert.equal(w.STATE.currentOrder[0].id, 'cf_esp');
assert.equal(w.STATE.orders.length, 0);

const found = w.filterCatalogItems(w.STATE.menuItems, 'prosecco');
assert.ok(found.some((it) => it.id === 'btg_spark_zardetto'));
const byVin = w.filterCatalogItems(w.STATE.menuItems, 'VIN 2148');
assert.ok(byVin.some((it) => it.vin === '2148'));

w.STATE.menuFamily = 'drinks';
w.STATE.menuNav = { level: 'cats', family: 'drinks' };
w.STATE.menuOpen = true;
w.STATE.menuSearch = '';
w.STATE._menuPaneFp = null;
w.renderOrder();
const app = w.document.getElementById('app-content');
assert.ok(app.querySelector('[data-voice-test="1"]'));
assert.match(app.textContent, /VOICE TEST/);
assert.match(app.querySelector('.add-items-label').textContent, /Add items/i);
const tabs = [...app.querySelectorAll('.period-tab')].map((el) => el.textContent.trim());
['Food', 'Drinks', 'Prix Fixe', 'Tasting'].forEach((label) => {
  assert.ok(tabs.includes(label), label);
});
['Pisco Sour', 'Graham Beck', 'Malbec Reserva', 'Local Lager', 'Hibiki', 'Espresso'].forEach((name) => {
  assert.match(app.textContent, new RegExp(name));
});
const catNames = (w.STATE.menuCategories || []).map((c) => c.name);
['Wines by the Glass', 'Wines by the Bottle', 'Cocktails', 'Beer', 'Spirits', 'Coffees', 'Mocktails', 'After Dinner', 'Soft Drinks'].forEach((name) => {
  assert.ok(catNames.includes(name), name);
});
assert.equal(app.querySelector('.rv-footer'), null);
assert.equal(w.RAPID_VOICE_OPERATOR_ENABLED, false);
assert.equal(app.querySelector('#add-items-pane').getAttribute('data-open'), 'true');
assert.ok(app.querySelector('#pos-item-find'));

const main = execSync('git show origin/main:index.html', { cwd: root, encoding: 'utf8' });
[
  'function beginAddItem',
  'function sendOrder',
  'function fireDiningCourse',
  'function fireWorkingRow',
  'function mapBarToPos',
  'function rebuildPosCatalog',
  'function posOpsLookup',
  'function filterByOpsLookup',
  'function toggleRapidVoice',
  'function reviewSendRapidVoice'
].forEach((fn) => {
  assert.equal(extractDecl(src, fn), extractDecl(main, fn), fn);
});
execSync('git diff --exit-code origin/main -- scalini-dining.js voice-vocab.js', { cwd: root, stdio: 'pipe' });
assert.match(src, /pos-build: scalini-print-v60/);
assert.doesNotMatch(fs.readFileSync(path.join(root, 'voice-engine.js'), 'utf8'), /sendOrder|fireDining|reviewSendRapidVoice/);
const prevTab = w.STATE.activeTab;
w.STATE.activeTab = 'tables';
w.fbReady = true;
let chunkGets = 0;
w.fbDb = {
  collection: function (name) {
    assert.equal(name, 'boh_shared');
    return {
      doc: function (id) {
        return {
          get: function () {
            chunkGets += 1;
            assert.equal(id, 'voice_vocab_rLIVE_0');
            return Promise.resolve({
              exists: true,
              data: function () {
                return {
                  revision: 'rLIVE',
                  chunkIndex: 0,
                  chunkCount: 1,
                  entries: [{ scope: 'beverage', sourceType: 'bar', sourceId: 'br1', family: 'beer', voiceKeyword: 'HITACHINO', voiceAliases: [] }],
                  modifiers: [{ id: 'g', voiceRole: 'garnish' }]
                };
              }
            });
          }
        };
      }
    };
  }
};
await w.loadVoiceRevision({ activeRevision: 'rLIVE', chunkCount: 1, chunkIds: ['voice_vocab_rLIVE_0'] });
assert.equal(chunkGets, 1);
assert.equal(w.STATE.voiceVocab.stale, false);
assert.equal(w.STATE.voiceVocab.index.byKeyword.HITACHINO.length, 1);
assert.equal(w.STATE.voiceVocab.index.modifiers[0].voiceRole, 'garnish');
w.fbReady = false;
seedTable(w);
w.applyVoiceCommand('HITACHINO');
assert.equal(chunkGets, 1);
assert.equal(w.STATE.currentOrder.length, 1);
assert.equal(w.STATE.orders.length, 0);
w.fbReady = false;
w.STATE.activeTab = prevTab;
assert.equal(src.includes('fbGetDoc'), false);

if (w.STATE._seatTick) w.clearInterval(w.STATE._seatTick);
w.close();

console.log('voice-engine tests passed');
