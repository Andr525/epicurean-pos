import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = fs.readFileSync(path.join(root, 'voice-turn.js'), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, window: {}, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const turn = sandbox.EPICUREAN_VOICE_TURN;

const krug = {
  id: 'w2148',
  name: 'Krug Grande Cuvée',
  producer: 'Krug',
  vintage: 'NV',
  size: '750ml',
  vin: '2148',
  source: 'wine',
  category: 'wine-bottle'
};
const half = {
  id: 'w400',
  name: 'Grande Cuvée',
  producer: 'Krug',
  vintage: 'NV',
  size: '375ml',
  vin: '400',
  source: 'wine',
  category: 'wine-bottle'
};
const salmon = {
  id: 'i5',
  name: 'Pan-Seared Salmon',
  source: 'menu',
  category: 'entrees',
  modifiers: [{ group: 'Temperature', options: ['R', 'MR', 'M'] }]
};
const shrimp = {
  id: 'i3',
  name: 'Shrimp Ceviche',
  source: 'menu',
  category: 'ceviche',
  modifiers: []
};
const catalog = [krug, half, salmon, shrimp, { id: 'i3b', name: 'Shrimp Cocktail', source: 'menu', category: 'entrees', modifiers: [] }];

function parsed(extra) {
  return Object.assign({
    text: '',
    seat: null,
    priority: false,
    positionTouched: false,
    confidence: 'NO_MATCH',
    kind: 'draft',
    itemId: ''
  }, extra);
}

let state = turn.createState();
let step = turn.decide(state, {
  text: '3A VIN 2148',
  parsed: parsed({ text: '3A VIN 2148', seat: 3, priority: true, positionTouched: true, confidence: 'HIGH', kind: 'item', itemId: krug.id }),
  item: krug,
  catalog: catalog,
  activeSeat: 1,
  lines: []
});
assert.equal(step.action, 'place');
assert.equal(step.seat, 3);
assert.equal(step.item.id, krug.id);
state = turn.remember(step.state, { item: krug, seat: 3, lineId: 'line-krug', notes: '' });
assert.equal(turn.confirmationSpeech('3A', krug), '3A. Krug Grande Cuvée, 750 milliliter, VIN 2148.');
const sizeless = Object.assign({}, krug, { size: '' });
const sizelessState = turn.remember(turn.createState(), { item: sizeless, seat: 3, lineId: 'line-krug', notes: '' });
assert.equal(turn.decide(sizelessState, {
  text: 'Krug Grande Cuvée, VIN 2148, 750',
  parsed: parsed({ text: 'Krug Grande Cuvée, VIN 2148, 750' }),
  item: null,
  catalog: catalog,
  activeSeat: 3,
  lines: [{ lineId: 'line-krug', id: krug.id, seat: 3 }]
}).action, 'confirm');
assert.equal(turn.confirmationSpeech('3A', Object.assign({}, krug, { vintage: '2018', name: 'Château X' })).includes('2018'), true);
assert.ok(turn.confirmationSpeech('3A', krug).length < 80);

step = turn.decide(state, {
  text: 'Krug Grande Cuvée, VIN 2148, 750',
  parsed: parsed({ text: 'Krug Grande Cuvée, VIN 2148, 750', confidence: 'NO_MATCH' }),
  item: null,
  catalog: catalog,
  activeSeat: 3,
  lines: [{ lineId: 'line-krug', id: krug.id, seat: 3 }]
});
assert.equal(step.action, 'confirm');
assert.equal(step.state.last.lineId, 'line-krug');

step = turn.decide(state, {
  text: '4 VIN 400',
  parsed: parsed({ text: '4 VIN 400', seat: 4, positionTouched: true, confidence: 'HIGH', kind: 'item', itemId: half.id }),
  item: half,
  catalog: catalog,
  activeSeat: 3,
  lines: [{ lineId: 'line-krug', id: krug.id, seat: 3 }]
});
assert.equal(step.action, 'place');
assert.equal(step.seat, 4);
assert.equal(step.item.id, half.id);

state = turn.remember(state, { item: half, seat: 4, lineId: 'line-half' });
step = turn.decide(state, {
  text: 'back to 3A',
  parsed: parsed({ text: 'back to 3A', seat: 3, priority: true, positionTouched: true, confidence: 'HIGH', kind: 'position' }),
  catalog: catalog,
  activeSeat: 4,
  lines: []
});
assert.equal(step.action, 'position');
assert.equal(step.state.activeSeat, 3);
assert.equal(step.state.last.itemId, half.id);

step = turn.decide(step.state, {
  text: 'medium rare',
  parsed: parsed({ text: 'medium rare', confidence: 'NO_MATCH' }),
  catalog: catalog,
  activeSeat: 3,
  lines: [{ lineId: 'food1', id: salmon.id, seat: 3, name: salmon.name }]
});
assert.equal(step.action, 'modifier');
assert.equal(step.lineId, 'food1');
assert.match(step.notes, /medium rare/i);

state = turn.createState();
step = turn.decide(state, {
  text: '4 salmon without beets',
  parsed: parsed({ text: '4 salmon without beets', seat: 4, positionTouched: true, confidence: 'NO_MATCH' }),
  catalog: catalog,
  activeSeat: 1,
  lines: []
});
assert.equal(step.action, 'hold');
assert.equal(step.state.pending.item.id, salmon.id);
assert.equal(step.state.pending.seat, 4);
assert.match(step.state.pending.notes, /without beets/i);
step = turn.decide(step.state, {
  text: 'medium rare',
  parsed: parsed({ text: 'medium rare', confidence: 'NO_MATCH' }),
  catalog: catalog,
  activeSeat: 4,
  lines: []
});
assert.equal(step.action, 'place');
assert.equal(step.item.id, salmon.id);
assert.equal(step.mods.Temperature, 'MR');
assert.match(step.notes, /without beets/i);

const shrimpOnly = [krug, shrimp];
step = turn.decide(turn.createState(), {
  text: '3A shrimp without saffron sauce',
  parsed: parsed({ text: '3A shrimp without saffron sauce', seat: 3, priority: true, positionTouched: true, confidence: 'NO_MATCH' }),
  catalog: shrimpOnly,
  activeSeat: 1,
  lines: []
});
assert.equal(step.action, 'place');
assert.equal(step.item.id, shrimp.id);
assert.match(step.notes, /without saffron sauce/i);

step = turn.decide(turn.createState(), {
  text: 'shrimp',
  parsed: parsed({ text: 'shrimp', confidence: 'NO_MATCH' }),
  catalog: catalog,
  activeSeat: 3,
  lines: []
});
assert.equal(step.action, 'draft');

step = turn.decide(state, {
  text: '7A no drink',
  parsed: parsed({ text: '7A no drink', seat: 7, positionTouched: true, confidence: 'HIGH', kind: 'noDrink' }),
  catalog: catalog,
  activeSeat: 3,
  lines: []
});
assert.equal(step.action, 'service');

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.equal(indexHtml.includes('VOICE_GUEST_RECORDING = false'), true);
assert.doesNotMatch(indexHtml, /indexedDB/);
assert.equal(fs.readFileSync(path.join(root, 'voice-engine.js'), 'utf8').includes('sendOrder'), false);

console.log('voice-turn tests passed');
