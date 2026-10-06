import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'cellar.js'), 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const data = sandbox.window.BINWISE_CELLAR;
const wines = data.wines.filter((w) => String(w.id).length < 80);
const monster = data.wines.find((w) => String(w.id).length > 80);

assert.equal(data.v, 'binwise-375-park-v3');
assert.equal(data.wines.length, 3612);
assert.equal(wines.length, 3611);

const byId = Object.fromEntries(wines.map((w) => [w.id, w]));
const bottle = byId.w2148NV750ml;
const half = byId.w2148NV375ml;
assert.equal(bottle.vin, '2148');
assert.equal(bottle.name, 'Krug Grande Cuvée');
assert.equal(bottle.size, '750ml');
assert.equal(bottle.bottlePrice, 275);
assert.equal(bottle.stock, 12);
assert.equal(half.vin, '400');
assert.equal(half.name, 'Grande Cuvée (375ml)');
assert.equal(half.size, '375ml');
assert.equal(half.bottlePrice, 275);
assert.equal(half.stock, 12);
assert.equal(half.ozOnHand, 150);

const counts = {};
wines.forEach((w) => {
  if (!/^\d+$/.test(String(w.vin))) return;
  counts[w.vin] = (counts[w.vin] || 0) + 1;
});
const shared = Object.keys(counts).filter((vin) => counts[vin] > 1).sort();
assert.deepEqual(shared, ['9416']);
Object.keys(counts).forEach((vin) => {
  const n = Number(vin);
  assert.ok(n < 20000 || n > 20257, 'temporary VIN remains ' + vin);
});
assert.equal(byId.w15542021750ml.vin, '100');
assert.equal(byId.w179182024750ml.vin, '101');
assert.equal(byId.w161362022750ml.vin, '200');
assert.equal(byId.w162702022750ml.vin, '201');
assert.equal(byId.w92822018375ml.vin, '500');
assert.equal(byId.w15541999750ml.vin, '1554');
assert.equal(byId.w161362021750ml.vin, '16136');
assert.equal(byId.w162702018750ml.vin, '16270');
assert.equal(byId.w179182018750ml.vin, '17918');
assert.equal(byId.wx6e6df6d12021750ml.vin, 'x6e6df6d1');
assert.equal(byId.wxe9bc315bNV750ml.vin, 'xe9bc315b');
assert.ok(monster);
assert.match(monster.name, /Hibiki Japanese Harmony/);
assert.equal(data.spirits.find((b) => b.id === 'sphibikiHarmony').stock, 4);
assert.equal(data.spirits.find((b) => b.id === 'sphibikiHarmony').lin, undefined);

const previousSrc = execFileSync('git', ['show', 'origin/main:cellar.js'], { cwd: root, encoding: 'utf8', maxBuffer: 8e6 });
const previous = { window: {}, console };
vm.createContext(previous);
vm.runInContext(previousSrc, previous);
const before = previous.window.BINWISE_CELLAR;
assert.equal(before.wines.length, data.wines.length);
const beforeById = Object.fromEntries(before.wines.map((w) => [w.id, w]));
let vinChanges = 0;
data.wines.forEach((w) => {
  const old = beforeById[w.id];
  assert.ok(old, w.id);
  Object.keys(w).forEach((key) => {
    if (key === 'vin') return;
    assert.deepEqual(w[key], old[key], w.id + ' ' + key);
  });
  if (w.vin !== old.vin) vinChanges += 1;
});
assert.equal(vinChanges, 0);
assert.equal(beforeById.w2148NV375ml.vin, '400');
assert.equal(beforeById.w2148NV750ml.vin, '2148');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /cellar\.js\?v=binwise-375-park-v3/);
assert.match(html, /pos-build: scalini-print-v61/);
assert.match(html, /voice-engine\.js\?v=58/);
assert.doesNotMatch(fs.readFileSync(path.join(root, 'voice-engine.js'), 'utf8'), /20007/);

console.log('vin-sku-migration.mjs ok');
