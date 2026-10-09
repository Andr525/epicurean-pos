import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadPos() {
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const inline = (file) => () => '<script>' + fs.readFileSync(path.join(root, file), 'utf8') + '</script>';
  html = html.replace(/<script src="https:[^"]+"><\/script>/g, '');
  html = html.replace(/<script src="scalini-dining\.js[^"]*"><\/script>/, inline('scalini-dining.js'));
  html = html.replace(/<script src="voice-vocab\.js[^"]*"><\/script>/, inline('voice-vocab.js'));
  html = html.replace(/<script src="voice-engine\.js[^"]*"><\/script>/, inline('voice-engine.js'));
  html = html.replace(/<script src="voice-turn\.js[^"]*"><\/script>/, inline('voice-turn.js'));
  html = html.replace(/<script src="voice-catalog\.js[^"]*"><\/script>/, inline('voice-catalog.js'));
  html = html.replace(/<script src="voice-price\.js[^"]*"><\/script>/, inline('voice-price.js'));
  html = html.replace(/<script src="voice-service\.js[^"]*"><\/script>/, inline('voice-service.js'));
  html = html.replace(/<script src="voice-cocktails\.js[^"]*"><\/script>/, inline('voice-cocktails.js'));
  html = html.replace(/<script src="cellar\.js[^"]*"><\/script>/, '');
  const vc = new VirtualConsole();
  vc.on('jsdomError', () => {});
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1/epicurean-pos/',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    virtualConsole: vc
  });
  return dom.window;
}

const cellarSandbox = { window: {}, console };
cellarSandbox.globalThis = cellarSandbox;
vm.createContext(cellarSandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'cellar.js'), 'utf8'), cellarSandbox);
const spirits = (cellarSandbox.window.BINWISE_CELLAR && cellarSandbox.window.BINWISE_CELLAR.spirits) || [];
assert.ok(spirits.length > 20, 'cellar spirits');

const w = loadPos();
w.STATE.currentServer = { name: 'Andre', role: 'manager', code: '5000' };
w.STATE.selectedTable = '12';
w.STATE.guestCount = 4;
w.STATE.currentOrder = [];
w.STATE.orders = [];
w.STATE.checks = {};
w.STATE.tableSessions = {};
w.STATE.voiceDrafts = [];
w.STATE.voiceTurn = null;
w.STATE.voiceBatch = null;
w.ensureOpenCheck('12');
w.sessionOf('12').guestCount = 4;
spirits.forEach((spirit) => {
  w.STATE.menuItems.push({
    id: spirit.id,
    name: spirit.name,
    price: spirit.price,
    kind: spirit.kind,
    category: 'spirits',
    catIds: ['spirits'],
    unit: spirit.unit,
    desc: spirit.desc,
    description: spirit.desc,
    stock: spirit.stock,
    active: spirit.active !== false,
    source: 'bar',
    modifiers: [],
    station: 'Bar'
  });
});

const hibiki = spirits.find((spirit) => spirit.id === 'sphibikiHarmony');
const yamazaki = spirits.find((spirit) => /Yamazaki 18/.test(spirit.name));
assert.equal(hibiki.price, 24);
assert.equal(yamazaki.price, 175);
const hibikiQuote = w.EPICUREAN_PRICE.normalizeSpirit(hibiki);
assert.equal(hibikiQuote.premium, false);
assert.equal(hibikiQuote.price2, 24);
assert.equal(hibikiQuote.price1, 12);
const yamazakiQuote = w.EPICUREAN_PRICE.normalizeSpirit(yamazaki);
assert.equal(yamazakiQuote.premium, true);

w.applyVoiceCommand("I'll have the pork chop");
assert.equal(w.STATE.currentOrder.length, 0);
assert.equal((w.STATE.voiceDrafts || []).length, 0);
w.applyVoiceCommand('What do you recommend with the salmon?');
assert.equal(w.STATE.currentOrder.length, 0);

w.applyVoiceCommand('4 hibiki');
assert.equal(w.STATE.currentOrder.length, 1);
assert.equal(w.STATE.currentOrder[0].price, 24);
assert.equal(w.STATE.currentOrder[0].seat, 4);
assert.equal(w.STATE.currentOrder[0].seatPriority, false);
assert.match(w.STATE.currentOrder[0].notes, /2 oz/);
assert.equal(w.STATE.orders.length, 0);

w.STATE.currentOrder = [];
w.applyVoiceCommand('4A 1 oz hibiki');
assert.equal(w.STATE.currentOrder.length, 1);
assert.equal(w.STATE.currentOrder[0].price, 12);
assert.equal(w.STATE.currentOrder[0].seatPriority, true);
const echo = w.STATE.voiceEcho;
const before = w.STATE.currentOrder.length;
w.applyVoiceCommand(echo);
assert.equal(w.STATE.currentOrder.length, before);

w.applyVoiceCommand('No, not 4A. Position 4. Change it.');
assert.equal(w.STATE.currentOrder.length, 1);
assert.equal(w.STATE.currentOrder[0].seat, 4);
assert.equal(w.STATE.currentOrder[0].seatPriority, false);

w.STATE.currentOrder = [];
w.STATE.voiceDrafts = [];
w.applyVoiceCommand('2 or 2A');
assert.equal(w.STATE.currentOrder.length, 0);
assert.match((w.STATE.voiceDrafts[0] || {}).need || '', /position/);

w.STATE.voiceDrafts = [];
w.applyVoiceCommand('4 old fashioned');
const fashioned = w.STATE.currentOrder.filter((line) => line.name === 'Old Fashioned');
assert.equal(fashioned.length, 1);
assert.equal(fashioned[0].price, 25);
assert.equal(fashioned[0].name, 'Old Fashioned');
assert.equal(w.STATE.orders.length, 0);

w.STATE.currentOrder = [];
w.STATE.voiceDrafts = [];
w.applyVoiceCommand('4 martini');
assert.equal(w.STATE.currentOrder.length, 0);
assert.equal((w.STATE.voiceDrafts[0] || {}).price == null, true);

w.STATE.voiceDrafts = [];
w.applyVoiceCommand('4 old fashioned with yamazaki 18');
assert.equal(w.STATE.currentOrder.length, 0);
assert.match((w.STATE.voiceDrafts[0] || {}).need || '', /premium spirit/);
assert.equal((w.STATE.voiceDrafts[0] || {}).price == null, true);

w.STATE.currentOrder = [];
w.STATE.voiceDrafts = [];
w.applyVoiceCommand('3 bottle of Clos Rougeard 2016');
assert.equal(w.STATE.currentOrder.length, 0);
assert.equal((w.STATE.voiceDrafts[0] || {}).confidence, 'SOMMELIER');
assert.equal((w.STATE.voiceDrafts[0] || {}).price == null, true);

w.STATE.currentOrder = [];
w.STATE.voiceDrafts = [];
w.STATE.orders = [];
w.applyVoiceCommand('Position 4, hibiki, position 5, old fashioned');
assert.equal(w.STATE.currentOrder.length, 0);
assert.equal((w.STATE.voiceBatch || []).length, 2);
w.applyVoiceCommand('Confirm');
assert.equal(w.STATE.currentOrder.length, 2);
w.STATE.currentOrder = [];
w.applyVoiceCommand('Position 4, hibiki, position 5, old fashioned. Confirm.');
const names = w.STATE.currentOrder.map((line) => line.name).sort();
assert.deepEqual(names, ['Hibiki Japanese Harmony', 'Old Fashioned']);
assert.equal(w.STATE.orders.length, 0);
assert.match(w.STATE.voiceEcho || '', /Confirmed/);

assert.equal(w.VOICE_GUEST_RECORDING, false);
assert.equal(w.VOICE_IDLE_MS, 300000);
const waits = [];
const original = w.setTimeout;
w.setTimeout = function (fn, ms) { waits.push(ms); return 1; };
w.STATE.voiceSession = { on: true, lastUseful: 0, idle: null };
w.armVoiceIdle();
assert.equal(waits[0], 300000);
w.setTimeout = original;

w.stopVoiceSession();
w.close();
console.log('voice-service tests passed');
