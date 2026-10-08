import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = fs.readFileSync(path.join(root, 'voice-cocktails.js'), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, window: {}, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const drinks = sandbox.EPICUREAN_VOICE_COCKTAILS;

assert.ok(drinks.identities.length >= 150, 'cocktail identity library');
const names = new Set(drinks.identities.map((row) => row.name));
['Martini', 'Dirty Martini', 'Negroni', 'Sex on the Beach', 'Black Russian', 'White Russian', 'Old Fashioned', 'Manhattan', 'Pisco Sour'].forEach((name) => {
  assert.ok(names.has(name), name);
});

const bar = [
  { id: 'i8', name: 'Pisco Sour', price: 14, category: 'cocktails', active: true, source: 'menu' },
  { id: 'i9', name: 'Chocolate Old Fashioned', price: 16, category: 'cocktails', active: true },
  { id: 'house-martini', name: 'Martini', price: 18, category: 'cocktails', active: true, modifiers: [] },
  { id: 'gin', name: 'Plymouth Gin', price: 16, kind: 'Spirit', category: 'spirits', active: true, stock: 2 }
];

function say(phrase, items) {
  return drinks.interpret(phrase, items || bar);
}

let heard = say('pisco sour');
assert.equal(heard.action, 'place');
assert.equal(heard.item.id, 'i8');
assert.equal(heard.price, 14);

heard = say('a pisco sour please');
assert.equal(heard.action, 'place');
assert.equal(heard.price, 14);

heard = say('vodka martini');
assert.equal(heard.action, 'place');
assert.equal(heard.item.id, 'house-martini');
assert.equal(heard.price, 18);
assert.match(heard.notes, /vodka/);

heard = say('shaken martini with an olive');
assert.equal(heard.action, 'place');
assert.equal(heard.price, 18);
assert.match(heard.notes, /shaken/);
assert.match(heard.notes, /olive/);

heard = say('dirty martini', [{ id: 'house-martini', name: 'Martini', price: 18, category: 'cocktails', active: true }]);
assert.equal(heard.action, 'draft');
assert.equal(heard.name, 'Dirty Martini');
assert.equal(heard.price, null);
assert.equal(heard.confidence, 'UNPRICED');

heard = say('old fashioned');
assert.equal(heard.action, 'draft');
assert.equal(heard.name, 'Old Fashioned');
assert.equal(heard.price, null);

heard = say('chocolate old fashioned');
assert.equal(heard.action, 'place');
assert.equal(heard.item.id, 'i9');
assert.equal(heard.price, 16);

heard = say('sex on the beach');
assert.equal(heard.action, 'draft');
assert.equal(heard.name, 'Sex on the Beach');
assert.equal(heard.price, null);

const black = say('black russian');
const white = say('white russian');
assert.equal(black.name, 'Black Russian');
assert.equal(white.name, 'White Russian');
assert.notEqual(black.name, white.name);
assert.equal(black.price, null);
assert.equal(white.price, null);

heard = say('negroni');
assert.equal(heard.action, 'draft');
assert.match(heard.need, /gin/i);
assert.equal(heard.price, null);

heard = say('martini', bar.filter((item) => item.id !== 'gin'));
assert.equal(heard.action, 'place');
heard = say('negroni', bar);
assert.match(heard.need, /Gin is on the bar/);

heard = say('martini with banana foam', bar);
assert.equal(heard.action, 'draft');
assert.match(heard.need, /unparsed: banana foam/);
assert.equal(heard.price, null);

const eighty = [{ id: 'i8', name: 'Pisco Sour', price: 14, category: 'cocktails', active: true, stock: 0 }];
heard = say('pisco sour', eighty);
assert.equal(heard.action, 'draft');
assert.match(heard.need, /86/);
assert.equal(heard.price, null);

const priced = [
  { id: 'a', name: 'Martini', price: 18, category: 'cocktails', active: true },
  { id: 'b', name: 'Martini', price: 22, category: 'cocktails', active: true }
];
heard = say('martini', priced);
assert.equal(heard.action, 'draft');
assert.equal(heard.confidence, 'AMBIGUOUS');

heard = say('3A VIN 2148');
assert.equal(heard.action, 'none');

console.log('voice-cocktails tests passed');
