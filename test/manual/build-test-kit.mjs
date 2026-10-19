// Builds the owner manual-testing kit for the POS from the APPROVED commit only.
// Output: a self-contained folder + zip that runs on the owner's computer with no network access:
//   - the approved POS files, byte-for-byte from git (index.html is only wrapped: see TEST_CHANGES below)
//   - fictional "Harbor Lane Bistro" data, a clearly identified mock cloud and mock card SDK
//   - sample guest checks created by driving the real POS screens once, headless, during the build
// Usage (in this repo): PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... node test/manual/build-test-kit.mjs <outDir> [commit]
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {fictionalCloud, STAFF, RESTAURANT} from './fictional-data.mjs';
import {ui} from '../acceptance/lib.mjs';

const HERE = new URL('.', import.meta.url).pathname;
const REPO = path.resolve(HERE, '../..');
const OUT = path.resolve(process.argv[2] || 'pos-test-kit');
const COMMIT = process.argv[3] || 'd2ff60f';
const KIT = path.join(OUT, 'harbor-lane-test-pos');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], {maxBuffer: 64 * 1024 * 1024});
const full = git('rev-parse', COMMIT).toString().trim();
const APP_FILES = ['index.html', 'cellar.js', 'scalini-dining.js', 'voice-vocab.js', 'voice-engine.js', 'voice-turn.js', 'voice-catalog.js', 'voice-cocktails.js', 'voice-price.js', 'voice-service.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];
const sha = b => createHash('sha256').update(b).digest('hex');

// ---- 1. app files from the approved commit (never from the working tree) ----
fs.rmSync(OUT, {recursive: true, force: true}); fs.mkdirSync(KIT, {recursive: true});
const manifest = {builtAt: new Date().toISOString(), restaurant: RESTAURANT, approvedCommit: full, files: {}, testChanges: []};
const DATA_FILES = ['cellar.js', 'scalini-dining.js']; // restaurant data modules: replaced by fictional versions below
for (const f of APP_FILES) { const b = git('show', `${full}:${f}`); manifest.files[f] = sha(b); if (f !== 'index.html' && !DATA_FILES.includes(f)) fs.writeFileSync(path.join(KIT, f), b); }

// ---- 1b. fictional data modules (no real restaurant data is shipped in the kit) ----
// cellar.js is pure data. scalini-dining.js is data plus helper functions (collectById … mergeList);
// those helpers are copied VERBATIM from the approved file, and the data is the approved data passed
// through the same scrub the runtime overlay applies.
{
  const cellarSrc = git('show', `${full}:cellar.js`).toString('utf8'), scaliniSrc = git('show', `${full}:scalini-dining.js`).toString('utf8');
  const sandbox = {}; sandbox.window = sandbox; sandbox.globalThis = sandbox; vm.createContext(sandbox);
  vm.runInContext(cellarSrc, sandbox); vm.runInContext(scaliniSrc, sandbox); vm.runInContext(fs.readFileSync(path.join(HERE, 'test-data-overlay.js'), 'utf8'), sandbox);
  if (!sandbox.__FICTIONAL_OVERLAY__) throw Error('overlay did not run');
  fs.writeFileSync(path.join(KIT, 'cellar.js'), '/* TEST BUILD — FICTIONAL cellar (replaces the bundled cellar data). */\nwindow.BINWISE_CELLAR=' + JSON.stringify(sandbox.BINWISE_CELLAR) + ';\n');
  const start = scaliniSrc.indexOf('  function collectById(menu) {'), endMarker = '  var VOICE_SEED = {', end = scaliniSrc.indexOf(endMarker);
  const version = (scaliniSrc.match(/var VERSION = (\d+);/) || [])[1];
  if (start < 0 || end < start || !version) throw Error('scalini-dining.js layout changed: helper block not found');
  const helpers = scaliniSrc.slice(start, end);
  const data = JSON.parse(JSON.stringify(sandbox.EPICUREAN_SCALINI)); // functions dropped; re-attached below
  fs.writeFileSync(path.join(KIT, 'scalini-dining.js'), '/* TEST BUILD — FICTIONAL set-menu data (Harbor Lane). Helper functions below are copied verbatim from the approved scalini-dining.js. */\n(function (root) {\n  var VERSION = ' + version + ';\n' + helpers +
    '  var S = ' + JSON.stringify(data) + ';\n  S.mergeMenu = mergeMenu;\n  S.mergeList = mergeList;\n  root.EPICUREAN_SCALINI = S;\n  if (typeof globalThis !== \'undefined\') globalThis.EPICUREAN_SCALINI = root.EPICUREAN_SCALINI;\n})(typeof window !== \'undefined\' ? window : (typeof globalThis !== \'undefined\' ? globalThis : this));\n');
  manifest.fictionalDataFiles = {'cellar.js': 'generated fictional data', 'scalini-dining.js': 'fictional data + approved helper functions (verbatim), sha256 of helper block ' + sha(Buffer.from(helpers))};
}

// ---- 2. index.html: wrapped for the test build; application script untouched apart from the cloud adapter line ----
let html = git('show', `${full}:index.html`).toString('utf8');
const TEST_CHANGES = [];
const edit = (label, re, to, expect) => { const n = (html.match(re) || []).length; if (n !== expect) throw Error(`test-build edit "${label}": expected ${expect} match(es), found ${n}`); html = html.replace(re, to); TEST_CHANGES.push(`${label} (${n})`); };
edit('remove Firebase SDK scripts (production cloud)', /<script[^>]*src="https:\/\/www\.gstatic\.com\/firebasejs[^"]*"><\/script>\s*/g, '', 3);
edit('remove Square SDK script (real payment provider)', /<script[^>]*src="https:\/\/[^"]*squarecdn[^"]*"><\/script>\s*/g, '', 1);
edit('remove Google Fonts links (external)', /<link[^>]*href="https:\/\/fonts\.(googleapis|gstatic)\.com[^"]*"[^>]*>\s*/g, '', 2);
edit('use the mock cloud instead of the Firestore REST adapter', /fbDb = createNamedFirestoreAdapter\(\);/g, "fbDb = window.__MOCK_DB__; /* TEST BUILD: mock cloud */", 1);
edit('load the fictional data overlay after the bundled data files', /(<script src="scalini-dining\.js[^"]*"><\/script>)/g, '$1\n<script src="test-data-overlay.js"></script>', 1);
edit('add no-network policy, test seed, BOH layout import and mock cloud', /<head>/g, `<head>\n<meta http-equiv="Content-Security-Policy" content="connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'">\n<script src="seed.js"></script>\n<script src="boh-layout.js"></script>\n<script src="test-boh-layout.js"></script>\n<script src="test-mock-cloud.js"></script>`, 1);
manifest.testChanges = TEST_CHANGES;
fs.writeFileSync(path.join(KIT, 'index.html'), html);
for (const f of ['test-data-overlay.js', 'test-mock-cloud.js', 'test-boh-layout.js']) fs.copyFileSync(path.join(HERE, f), path.join(KIT, f));
// Placeholder: the iPhone launcher's server replaces this with the boh-layout*.json found in the kit folder.
fs.writeFileSync(path.join(KIT, 'boh-layout.js'), '/* TEST BUILD: no BOH layout file offered (see "READ ME FIRST.md"). */\nwindow.__BOH_LAYOUT_FROM_MAC__ = null;\n');
const writeSeed = s => fs.writeFileSync(path.join(KIT, 'seed.js'), '/* FICTIONAL test data — Harbor Lane Bistro (not a real business). Restored by "Reset all test data". */\nwindow.__POS_TEST_SEED__=' + JSON.stringify(s).replace(/</g, '\\u003c') + ';\n');
writeSeed(fictionalCloud());

// ---- 3. drive the real POS once (headless) to create realistic open guest checks ----
const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox']});
let port = 9930;
async function openKit() {
  const origin = 'http://127.0.0.1:' + (port++); const context = await browser.newContext({viewport: {width: 1366, height: 1024}});
  const page = await context.newPage(); const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await context.route('**/*', route => { const u = new URL(route.request().url()); if (u.origin !== origin) { external.push(u.host); return route.abort(); }
    const p = path.join(KIT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname)); if (!p.startsWith(KIT)) return route.abort();
    try { return route.fulfill({body: fs.readFileSync(p), contentType: p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.png') ? 'image/png' : p.endsWith('.json') ? 'application/json' : 'text/javascript; charset=utf-8'}); } catch { return route.fulfill({status: 404, body: ''}); } });
  await page.goto(origin + '/index.html'); await page.waitForFunction(() => typeof STATE !== 'undefined' && window.__MOCK_DB__); await page.waitForTimeout(1200);
  return {context, page, errors, external, u: ui(page)};
}
const s1 = await openKit(); const {u, page} = s1;
await u.pin('3101');                                       // Jordan Reyes
await u.seat('3', 2);
await u.openCategory('c_small'); await u.tile('Tuna Crudo'); await u.addToOrder().catch(() => {});
await u.openCategory('c_ent'); await u.tile('Harbor Burger'); await u.choose('Medium'); await u.choose('Fries'); await u.chooseRe(/^Aged Cheddar/);
await page.locator('#mod-notes').fill('No onions, pickles on the side'); await page.locator('#mod-notes').dispatchEvent('input'); await u.addToOrder();
await u.send();
await u.seat('5', 4);
await u.ev(() => { toggleAllergy('2', 'Shellfish', 1); });
await u.ev(() => { STATE.activeSeat = 2; }); await u.openCategory('c_small'); await u.tile('Crispy Calamari'); await u.addToOrder().catch(() => {}); await u.sendAnyway();
await u.ev(() => { STATE.activeSeat = 1; }); await u.openCategory('c_ent'); await u.tile('Pan-Seared Salmon'); await u.choose('Medium Rare'); await u.addToOrder().catch(() => {});
await u.ev(() => { STATE.activeSeat = 3; }); await u.openCategory('c_ent'); await u.tile('Wild Mushroom Risotto'); await u.addToOrder().catch(() => {});
await u.send(); await u.tapTable('5');
await u.ev(() => { STATE.activeSeat = 4; }); await u.openCategory('c_des'); await u.tile('Dark Chocolate Tart'); // left UNSENT (a draft owned by Jordan)
await u.ev(() => logout()); await page.waitForTimeout(400);
await u.pin('3102');                                       // Sam Patel
await u.seat('8', 2);
await u.openCategory('c_ent'); await u.tile('Grilled Ribeye 14 oz'); await u.choose('Medium Rare'); await u.addToOrder().catch(() => {});
await u.openCategory('c_side'); await u.tile('Truffle Fries');
await u.send();
await u.ev(() => logout()); await page.waitForTimeout(600);
const seeded = await page.evaluate(() => __MOCK_DB__.__dump());
if (s1.errors.length) throw Error('sample service page errors: ' + s1.errors.join('; '));
await s1.context.close();
writeSeed(seeded);

// ---- 4. verify the finished kit: loads clean, no network, sample checks present, money + recovery flows work ----
const v = await openKit(); const vu = v.u, vp = v.page;
const report = {};
report.loginRoster = await vp.evaluate(() => allStaffForLogin().map(s => s.code + ' ' + s.name).sort());
const fictional = STAFF.map(s => s.code + ' ' + s.name).sort();
if (JSON.stringify(report.loginRoster) !== JSON.stringify(fictional)) throw Error('login roster is not exactly the fictional staff: ' + JSON.stringify(report.loginRoster));
await vu.pin('3101');
report.openChecks = await vp.evaluate(() => Object.values(__MOCK_DB__.__dump().checks || {}).filter(c => c.status === 'open').map(c => c.table).sort());
report.tickets = await vp.evaluate(() => Object.values(__MOCK_DB__.__dump().orders || {}).map(o => o.table + ':' + o.items.map(i => i.name).join('+')));
await vu.seat('1', 2); await vu.openCategory('c_des'); await vu.tile('Lemon Olive Oil Cake'); await vu.send(); await vu.tapTable('1');
const pay = await vu.pay(); report.normalPayment = {label: pay.label, success: /Payment Successful/.test(pay.after)};
await vu.seat('2', 2); await vu.openCategory('c_soup'); await vu.tile('Roasted Tomato Soup'); await vu.send(); await vu.tapTable('2');
await vp.evaluate(() => HLTEST.fault('checks')); const pay2 = await vu.pay(); report.faultedPayment = /settlement pending/i.test(pay2.after);
const dev2 = await v.context.newPage(); dev2.on('pageerror', e => v.errors.push(e.message)); dev2.on('dialog', d => d.accept());
await dev2.goto(vp.url()); await dev2.waitForFunction(() => typeof STATE !== 'undefined'); await dev2.waitForTimeout(1200);
await ui(dev2).pin('3101'); const fin = dev2.locator('#settlement-banner button', {hasText: /Finish settlement/i}); report.recoveryDiscoverable = (await fin.count()) > 0;
if (report.recoveryDiscoverable) { await fin.first().click(); await dev2.waitForFunction(() => !STATE._settling); await dev2.waitForTimeout(400); }
report.recovered = await dev2.evaluate(() => Object.values(__MOCK_DB__.__dump().payments || {}).every(p => p.settlement === 'complete'));
report.tokenizationsOnSecondDevice = await dev2.evaluate(() => window.__mockTokenized || 0);
report.pageErrors = v.errors; report.externalRequests = [...new Set(v.external)];
await v.context.close();
// file:// (double-click) smoke check
const fctx = await browser.newContext(); const fpage = await fctx.newPage(); const ferr = [], fext = [];
fpage.on('pageerror', e => ferr.push(e.message)); fpage.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) fext.push(new URL(r.url()).host); });
await fpage.goto(pathToFileURL(path.join(KIT, 'index.html')).href); await fpage.waitForFunction(() => typeof STATE !== 'undefined'); await fpage.waitForTimeout(1200);
await ui(fpage).pin('3102'); report.fileUrl = {loggedIn: await fpage.evaluate(() => STATE.currentServer && STATE.currentServer.name), pageErrors: ferr, networkAttempts: [...new Set(fext)]};
await fctx.close(); await browser.close();
manifest.verification = report;
fs.writeFileSync(path.join(KIT, 'BUILD-MANIFEST.json'), JSON.stringify(manifest, null, 2));

// ---- 5. launchers + instructions + zip ----
fs.writeFileSync(path.join(KIT, 'Start Test POS (Mac).command'), '#!/bin/bash\ncd "$(dirname "$0")"\necho "Harbor Lane TEST POS — http://127.0.0.1:8765  (close this window to stop)"\n(sleep 1; open "http://127.0.0.1:8765/index.html") &\npython3 -m http.server 8765 --bind 127.0.0.1\n');
fs.chmodSync(path.join(KIT, 'Start Test POS (Mac).command'), 0o755);
fs.writeFileSync(path.join(KIT, 'Start Test POS for iPhone (Mac).command'), "#!/bin/bash\n# Harbor Lane TEST POS \u2014 serve the test kit to devices on YOUR home Wi-Fi only (e.g. your iPhone).\n# Same files, same fictional data, mock cloud and mock card, same no-network policy inside the page.\n# The server listens only on this Mac's Wi-Fi address; nothing is published on the internet.\ncd \"$(dirname \"$0\")\"\nPORT=8765\nIP=\"\"\nfor IF in en0 en1 en2 en3; do IP=$(ipconfig getifaddr \"$IF\" 2>/dev/null); [ -n \"$IP\" ] && break; done\nif [ -z \"$IP\" ]; then\n  echo \"Could not find this Mac's Wi-Fi address. Turn Wi-Fi on, join your home network, and try again.\"\n  read -n 1 -s -r -p \"Press any key to close.\"; exit 1\nfi\nURL=\"http://$IP:$PORT/index.html\"\necho \"\"\necho \"  Harbor Lane TEST POS (fictional data, mock payments)\"\necho \"\"\necho \"  On your iPhone (same Wi-Fi), open Safari and go to:\"\necho \"\"\necho \"      $URL\"\necho \"\"\necho \"  On this Mac you can use the same address.\"\necho \"  Only devices on your home network can reach it. Close this window to stop the server.\"\necho \"\"\n(sleep 1; open \"$URL\") &\npython3 -m http.server \"$PORT\" --bind \"$IP\"\n");
fs.chmodSync(path.join(KIT, 'Start Test POS for iPhone (Mac).command'), 0o755);
for (const f of ['iphone-test-server.py', 'iphone-qr.html', 'qrcode-generator.js']) fs.copyFileSync(path.join(HERE, f), path.join(KIT, f));
fs.copyFileSync(path.join(HERE, 'start-iphone-pos-test.command'), path.join(KIT, 'Start iPhone POS Test.command'));
// Read-only BOH layout export: the bookmark button's code (boh-layout-export.js) on a helper page.
{
  const src = fs.readFileSync(path.join(HERE, 'boh-layout-export.js'), 'utf8').replace(/^\/\*[\s\S]*?\*\/\s*/, '');
  const page = fs.readFileSync(path.join(HERE, 'boh-layout-export-page.html'), 'utf8');
  if (page.split('__BOOKMARKLET__').length !== 2) throw Error('export page placeholder missing');
  fs.writeFileSync(path.join(KIT, 'BOH Layout Export.html'), page.replace('__BOOKMARKLET__', 'javascript:' + encodeURIComponent(src)));
}
fs.chmodSync(path.join(KIT, 'Start iPhone POS Test.command'), 0o755);
fs.writeFileSync(path.join(KIT, 'Start Test POS (Windows).bat'), '@echo off\r\ncd /d "%~dp0"\r\necho Harbor Lane TEST POS - http://127.0.0.1:8765  (close this window to stop)\r\nstart "" "http://127.0.0.1:8765/index.html"\r\npy -m http.server 8765 --bind 127.0.0.1 || python -m http.server 8765 --bind 127.0.0.1\r\n');
fs.copyFileSync(path.join(HERE, 'OWNER-TESTING.md'), path.join(KIT, 'READ ME FIRST.md'));
fs.writeFileSync(path.join(KIT, 'test-logins.txt'), 'Harbor Lane Bistro (TEST) — fictional employees\n\n' + STAFF.map(s => `${s.code}  ${s.name}  (${s.jobs[0].code})`).join('\n') + '\n');
execFileSync('zip', ['-qr', 'harbor-lane-test-pos.zip', 'harbor-lane-test-pos'], {cwd: OUT});
console.log(JSON.stringify({kit: KIT, zip: path.join(OUT, 'harbor-lane-test-pos.zip'), approvedCommit: full, testChanges: TEST_CHANGES, verification: report}, null, 1));
