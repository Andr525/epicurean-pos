import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = fs.readFileSync(path.join(root, 'voice-catalog.js'), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, window: {}, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const catalog = sandbox.EPICUREAN_VOICE_CATALOG;

const entries = [
  { sourceId: 'sf_w_salmon', voiceKeyword: 'SMOKED', voiceAliases: [], active: true, name: 'Smoked Salmon' },
  { sourceId: 'sf_m_forestiere', voiceKeyword: 'SALMON', voiceAliases: [], active: true, name: 'Filet of Faroe Island salmon Forrestiere' },
  { sourceId: 'sf_m_zafferano', voiceKeyword: 'SHRIMP', voiceAliases: [], active: true, name: 'Shrimp Zafferano' },
  { sourceId: 'sf_w_shrimp', voiceKeyword: 'SHERRY', voiceAliases: [], active: true, name: 'Shrimp in sherry-mustard sauce' },
  { sourceId: 'btg_white_walch', voiceKeyword: 'PINOT BIANCO', voiceAliases: [], active: true, name: 'Pinot Bianco' },
  { sourceId: 'btg_lib_sudtirol', voiceKeyword: 'PINOT NOIR', voiceAliases: [], active: true, name: 'Pinot Noir' },
  { sourceId: 'sf_d_formaggio', voiceKeyword: 'FORMAGGIO', voiceAliases: ['GORGONZOLA', 'PARMIGIANO', 'MOZZARELLA'], active: true, name: 'Formaggio' },
  { sourceId: 'sf_m_forestiere', voiceKeyword: 'SALMON', voiceAliases: [], scope: 'tasting', active: true, name: 'Filet of Faroe Island salmon Forrestiere' }
];

const names = Object.fromEntries(entries.map((entry) => [entry.sourceId, entry.name]));
function narrow(phrase) {
  return catalog.narrowByName(catalog.resolvePhrase(phrase, entries), catalog.tokens(phrase), (id) => names[id] || '');
}

assert.equal(narrow('salmon').sourceId, 'sf_m_forestiere');
assert.equal(narrow('smoked').sourceId, 'sf_w_salmon');
assert.equal(narrow('smoked salmon').sourceId, 'sf_w_salmon');
assert.equal(narrow('shrimp').sourceId, 'sf_m_zafferano');
assert.equal(narrow('bianco pinot').sourceId, 'btg_white_walch');
assert.equal(narrow('gorgonzola').sourceId, 'sf_d_formaggio');
assert.equal(narrow('pinot').action, 'draft');
assert.equal(narrow('pinot').reason, 'ambiguous');
assert.equal((narrow('salmon').leftover || []).length, 0);

const temps = ['Rare', 'Medium Rare', 'Medium', 'Well Done'];
assert.equal(catalog.tempChoice('medium rare', temps), 'Medium Rare');
assert.equal(catalog.tempChoice('mr', temps), 'Medium Rare');
assert.equal(catalog.tempChoice('rare', ['Medium', 'Well Done']), '');
const pour = catalog.classifyLeftover(['GLASS'], { temps: temps });
assert.equal(pour.pour, 'GLASS');
assert.equal(pour.unknown.length, 0);
const noted = catalog.classifyLeftover(['MEDIUM', 'RARE', 'NO', 'BEETS'], { temps: temps });
assert.equal(noted.temp, 'Medium Rare');
assert.match(noted.notes, /no beets/);

const groups = [
  { name: 'Meat Temperature', options: [{ name: 'Rare' }] },
  { name: 'Fish Temperature', options: [{ name: 'Rare' }] }
];
assert.equal(catalog.matchGroupOption('rare', groups).ambiguous, true);
assert.equal(catalog.matchGroupOption('rare', [groups[1]]).option, 'Rare');

console.log('voice-catalog tests passed');
