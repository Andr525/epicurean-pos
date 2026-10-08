import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures/voice-vocab-active.json'), 'utf8'));
const lins = JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures/bar-lins.json'), 'utf8'));

function loadEngine() {
  const code = fs.readFileSync(path.join(root, 'voice-engine.js'), 'utf8');
  const sandbox = { module: { exports: {} }, exports: {}, window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.EPICUREAN_VOICE_ENGINE;
}

function loadPos() {
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const inline = (file) => () => '<script>' + fs.readFileSync(path.join(root, file), 'utf8') + '</script>';
  html = html.replace(/<script src="https:[^"]+"><\/script>/g, '');
  html = html.replace(/<script src="scalini-dining\.js[^"]*"><\/script>/, inline('scalini-dining.js'));
  html = html.replace(/<script src="voice-vocab\.js[^"]*"><\/script>/, inline('voice-vocab.js'));
  html = html.replace(/<script src="voice-engine\.js[^"]*"><\/script>/, inline('voice-engine.js'));
  html = html.replace(/<script src="voice-turn\.js[^"]*"><\/script>/, inline('voice-turn.js'));
  html = html.replace(/<script src="voice-catalog\.js[^"]*"><\/script>/, inline('voice-catalog.js'));
  html = html.replace(/<script src="voice-cocktails\.js[^"]*"><\/script>/, inline('voice-cocktails.js'));
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

const eng = loadEngine();
const failures = [];
function check(ok, detail) {
  if (!ok) failures.push(detail);
}

const cellarSandbox = { window: {}, console };
cellarSandbox.globalThis = cellarSandbox;
vm.createContext(cellarSandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'cellar.js'), 'utf8'), cellarSandbox);
const wines = (cellarSandbox.window.BINWISE_CELLAR && cellarSandbox.window.BINWISE_CELLAR.wines) || [];
const activeWines = wines.filter((wine) => wine && wine.active !== false && /^\d+$/.test(String(wine.vin || '').trim()));
const nonNumericVins = wines.filter((wine) => wine && wine.active !== false && String(wine.vin || '').trim() && !/^\d+$/.test(String(wine.vin || '').trim())).length;
const byVin = new Map();
activeWines.forEach((wine) => {
  const vin = String(wine.vin).trim();
  if (!byVin.has(vin)) byVin.set(vin, []);
  byVin.get(vin).push(wine);
});
const wineCatalog = activeWines.map((wine) => ({
  id: String(wine.id),
  vin: String(wine.vin).trim(),
  name: wine.name || '',
  price: Number(wine.bottlePrice) || 0,
  source: 'wine',
  category: 'wine-bottle',
  active: true,
  modifiers: [],
  size: wine.size || ''
}));
const emptyIndex = eng.buildIndex([], [], 'rCOV');
let vinResolved = 0;
let vinAmbiguous = 0;
let vinWrong = 0;
byVin.forEach((rows, vin) => {
  const parsed = eng.parse('VIN ' + vin, { index: emptyIndex, stale: false, catalog: wineCatalog });
  if (rows.length === 1) {
    const ok = parsed.confidence === 'HIGH' && parsed.itemId === String(rows[0].id) && Number(parsed.price) === (Number(rows[0].bottlePrice) || 0);
    if (ok) vinResolved += 1;
    else {
      vinWrong += 1;
      if (vinWrong <= 8) failures.push(('VIN ' + vin + ' -> ' + parsed.confidence + ' ' + parsed.itemId).slice(0, 180));
    }
  } else {
    vinAmbiguous += 1;
    if (parsed.confidence !== 'AMBIGUOUS') {
      vinWrong += 1;
      failures.push('shared VIN ' + vin + ' was ' + parsed.confidence);
    }
  }
});
const vin9416 = byVin.get('9416') || [];
check(vin9416.length > 1, 'VIN 9416 should stay the shared cellar code');

const linCatalog = lins.map((item) => ({
  id: item.id,
  lin: String(item.lin),
  name: item.name,
  price: Number(item.price) || 0,
  source: 'bar',
  category: 'spirits',
  kind: 'Spirit',
  active: item.active !== false,
  modifiers: []
}));
const byLin = new Map();
linCatalog.forEach((item) => {
  if (!byLin.has(item.lin)) byLin.set(item.lin, []);
  byLin.get(item.lin).push(item);
});
let linResolved = 0;
let linWrong = 0;
byLin.forEach((rows, lin) => {
  const parsed = eng.parse('LIN ' + lin, { index: emptyIndex, stale: false, catalog: linCatalog });
  const ok = rows.length === 1
    ? parsed.confidence === 'HIGH' && parsed.itemId === rows[0].id && Number(parsed.price) === rows[0].price
    : parsed.confidence === 'AMBIGUOUS';
  if (ok) linResolved += 1;
  else {
    linWrong += 1;
    if (linWrong <= 8) failures.push('LIN ' + lin + ' -> ' + parsed.confidence + ' ' + parsed.itemId);
  }
});

const w = loadPos();
w.STATE.currentServer = { name: 'Test', role: 'manager', code: '5000' };
w.STATE.selectedTable = '4';
w.STATE.activeSeat = 1;
w.STATE.guestCount = 4;
w.STATE.currentOrder = [];
w.STATE.orders = [];
w.STATE.checks = {};
w.STATE.tableSessions = {};
w.STATE.voiceDrafts = [];
w.STATE.foodItems = w.SEED_ITEMS.slice();
w.STATE.bar = lins.slice(0, 3).map((item) => Object.assign({ visible: true }, item));
w.STATE.wines = [
  { id: 'w2148NV750ml', vin: '2148', name: 'Krug Grande Cuvée', vintage: 'NV', size: '750ml', bottlePrice: 275, glassPrice: 0, stock: 12, active: true, visible: true }
];
w.rebuildPosCatalog();
w.sessionOf('4').guestCount = 4;
w.ensureOpenCheck('4');
w.STATE.voiceVocab = {
  revision: fixture.revision,
  stale: false,
  index: w.EPICUREAN_VOICE_ENGINE.buildIndex(fixture.entries, fixture.modifiers || [], fixture.revision),
  entries: fixture.entries,
  modifierGroups: fixture.modifiers || [],
  reason: ''
};

function interpret(phrase) {
  const parsed = w.EPICUREAN_VOICE_ENGINE.parse(phrase, {
    index: w.STATE.voiceVocab.index,
    stale: false,
    catalog: w.STATE.menuItems
  });
  return w.voiceInterpret(phrase, parsed);
}
function identityOf(heard) {
  if (heard && heard.item && heard.item.id) return String(heard.item.id);
  if (heard && heard.draft && heard.draft.itemId) return String(heard.draft.itemId);
  return '';
}

const keywordIds = new Map();
fixture.entries.forEach((entry) => {
  if (!entry || entry.active === false || !entry.voiceKeyword || !entry.sourceId) return;
  const words = [entry.voiceKeyword].concat(entry.voiceAliases || []);
  words.forEach((word) => {
    const key = String(word).toUpperCase();
    if (!keywordIds.has(key)) keywordIds.set(key, new Set());
    keywordIds.get(key).add(String(entry.sourceId));
  });
});
let keywordChecked = 0;
let keywordResolved = 0;
let keywordAmbiguous = 0;
let variationChecked = 0;
let variationResolved = 0;
keywordIds.forEach((ids, word) => {
  keywordChecked += 1;
  const heard = interpret(word);
  if (ids.size > 1) {
    keywordAmbiguous += 1;
    check(heard.action === 'draft', word + ' should draft when two items share it');
    return;
  }
  const want = [...ids][0];
  const got = identityOf(heard);
  if (got === want) keywordResolved += 1;
  else failures.push(word + ' -> ' + (got || heard.action) + ' expected ' + want);
  const parts = word.split(' ').filter(Boolean);
  const frames = [];
  if (parts.length > 1) frames.push(parts.slice().reverse().join(' '));
  frames.push('3A ' + word, word + ' 4', 'back to 7A ' + word);
  frames.forEach((phrase) => {
    variationChecked += 1;
    const again = identityOf(interpret(phrase));
    if (again === want) variationResolved += 1;
    else failures.push(phrase + ' -> ' + (again || 'none') + ' expected ' + want);
  });
});

const pinot = interpret('pinot');
check(pinot.action === 'draft', 'pinot alone must stay ambiguous');
const salmon = interpret('salmon');
check(identityOf(salmon) === 'sf_m_forestiere', 'salmon keyword');
const smoked = interpret('smoked salmon');
check(identityOf(smoked) === 'sf_w_salmon', 'smoked salmon name');
const shrimp = interpret('shrimp');
check(identityOf(shrimp) === 'sf_m_zafferano', 'shrimp keyword');

function lines() { return w.STATE.currentOrder.length; }
w.applyVoiceCommand('salmon');
check(lines() === 0, 'unpriced salmon must not become a line');
check((w.STATE.voiceDrafts[0] || {}).itemId === 'sf_m_forestiere', 'salmon draft keeps the vocab dish');
check(!w.STATE.currentOrder.some((line) => /pan-seared/i.test(line.name || '')), 'salmon must not become the seeded salmon');

w.STATE.voiceDrafts = [];
w.applyVoiceCommand('CHAMPAGNE');
check(lines() === 0, 'champagne without a pour must not order');
check(/Pour/i.test((w.STATE.voiceDrafts[0] || {}).need || ''), 'champagne asks for a pour');

w.STATE.voiceDrafts = [];
w.applyVoiceCommand('3A VIN 2148');
check(lines() === 1 && w.STATE.currentOrder[0].price === 275, 'Krug 2148');
check(w.STATE.orders.length === 0, 'voice must not send');
const before = lines();
w.applyVoiceCommand('Krug Grande Cuvée, VIN 2148, 750');
check(lines() === before, 'spoken confirmation must not duplicate the bottle');

w.STATE.currentOrder = [];
w.STATE.voiceDrafts = [];
w.applyVoiceCommand('pisco sour');
check(lines() === 1 && w.STATE.currentOrder[0].price === 14 && w.STATE.currentOrder[0].name === 'Pisco Sour', 'house pisco sour');
check(w.STATE.orders.length === 0, 'cocktail voice must not send');

w.STATE.currentOrder = [];
w.applyVoiceCommand('martini');
w.applyVoiceCommand('dirty martini');
w.applyVoiceCommand('sex on the beach');
w.applyVoiceCommand('negroni');
w.applyVoiceCommand('black russian');
w.applyVoiceCommand('white russian');
w.applyVoiceCommand('old fashioned');
check(lines() === 0, 'unpriced classics must not be added');
check(!w.STATE.voiceDrafts.some((draft) => draft.price != null), 'drafts must not invent a price');
check(!w.STATE.currentOrder.some((line) => /chocolate old fashioned/i.test(line.name || '')), 'old fashioned is not the chocolate one');

w.STATE.menuItems.push({ id: 'house-martini', name: 'Martini', price: 18, category: 'cocktails', catIds: ['cocktails'], station: 'Bar', modifiers: [], active: true, source: 'bar' });
w.STATE.currentOrder = [];
w.applyVoiceCommand('vodka martini');
check(lines() === 1 && w.STATE.currentOrder[0].id === 'house-martini' && w.STATE.currentOrder[0].price === 18, 'vodka martini keeps the house price');
check(/vodka/i.test(w.STATE.currentOrder[0].notes || ''), 'vodka is recorded on the house martini');
w.STATE.menuItems = w.STATE.menuItems.filter((item) => item.id !== 'house-martini');

const pisco = w.findPosMenuItem('i8');
pisco.stock = 0;
pisco.eightySixed = true;
w.STATE.currentOrder = [];
w.STATE.voiceDrafts = [];
w.applyVoiceCommand('pisco sour');
check(lines() === 0, '86 cocktail must not be added');
pisco.eightySixed = false;
pisco.stock = null;

w.STATE.currentOrder = [];
w.STATE.voiceDrafts = [];
w.applyVoiceCommand('gelato');
check(lines() === 0, 'gelato without three scoops must draft');
check(/flavor/i.test((w.STATE.voiceDrafts[0] || {}).need || ''), 'gelato draft asks for flavors');

w.STATE.activeTastingOrders = [{ table: '4', status: 'active', id: 'dining' }];
w.STATE.currentOrder = [];
w.STATE.voiceDrafts = [];
w.STATE.voiceTurn = null;
w.applyVoiceCommand('2A salmon medium rare');
check(lines() === 1, 'priced dining salmon should order');
if (lines() === 1) {
  check(w.STATE.currentOrder[0].id === 'sf_m_forestiere', 'dining salmon id');
  check(w.STATE.currentOrder[0].mods.Temperature === 'Medium Rare', 'dining salmon temperature');
  check(Number(w.STATE.currentOrder[0].price) > 0, 'dining salmon uses the extra-plate price');
  check(w.STATE.orders.length === 0, 'dining voice must not send');
}
w.STATE.activeTastingOrders = [];

const vocabPct = keywordChecked ? Math.round((keywordResolved / keywordChecked) * 1000) / 10 : 0;
const variationPct = variationChecked ? Math.round((variationResolved / variationChecked) * 1000) / 10 : 0;
const vinDenom = byVin.size - vinAmbiguous;
const vinPct = vinDenom ? Math.round((vinResolved / vinDenom) * 1000) / 10 : 0;
const linPct = byLin.size ? Math.round((linResolved / byLin.size) * 1000) / 10 : 0;
const report = {
  vocabularyRevision: fixture.revision,
  vocabularyEntries: fixture.entries.length,
  keywordPhrases: keywordChecked,
  keywordResolved,
  keywordAmbiguous,
  keywordWrong: keywordChecked - keywordResolved - keywordAmbiguous,
  keywordIdentityPct: vocabPct,
  naturalVariations: variationChecked,
  naturalVariationsResolved: variationResolved,
  naturalVariationPct: variationPct,
  activeVins: byVin.size,
  uniqueVinsResolved: vinResolved,
  sharedVinsLeftAmbiguous: vinAmbiguous,
  vinWrong,
  uniqueVinPct: vinPct,
  vin9416Records: vin9416.length,
  nonNumericVinRecords: nonNumericVins,
  nonNumericVinNote: 'Voice VIN codes are numeric. Non-numeric cellar values are excluded from the percentage and still need a data repair in the cellar.',
  linsInLiveBarSnapshot: byLin.size,
  linsResolved: linResolved,
  linWrong,
  linPct,
  linNote: 'Bundled cellar spirits often have no LIN. This percentage is the live bar snapshot, not a second cellar.',
  cocktailIdentities: w.EPICUREAN_VOICE_COCKTAILS.identities.length,
  orderingNote: 'Keyword identity is not the same as adding a line. Prix-fixe dishes draft until a dining check exists, so the system does not invent an à la carte price. By-the-glass wines still require a spoken pour. Classics with no house SKU draft with no price.',
  speechRecognitionPct: null,
  speechRecognitionNote: 'Not measured. This audit is catalog and parser coverage, not dining-room transcription accuracy.',
  guestRecording: false,
  failures
};
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
fs.writeFileSync('/opt/cursor/artifacts/voice-coverage.json', JSON.stringify(report, null, 2));
if (w.stopVoiceSession) w.stopVoiceSession();
if (w.STATE._seatTick) w.clearInterval(w.STATE._seatTick);
w.close();

if (failures.length) {
  console.error(failures.slice(0, 30).join('\n'));
  throw new Error(failures.length + ' coverage failures');
}
console.log('voice-coverage', JSON.stringify({
  keywordIdentityPct: vocabPct,
  naturalVariationPct: variationPct,
  uniqueVinPct: vinPct,
  linPct,
  cocktailIdentities: report.cocktailIdentities,
  sharedVins: vinAmbiguous
}));
