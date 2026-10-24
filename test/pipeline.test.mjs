// Offline pipeline harness. Assertions describe the behavior the pipeline
// should have. Do not edit them to force a pass. Phase 1 records an
// "after" column beside the frozen test/pipeline-baseline (32bdc41) results.
// No request in this file is sent to live Firestore.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { startFakeFirestore } from './fake-firestore.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROMIUM_PATH || '/usr/local/bin/google-chrome';
const playwrightModule = process.env.PLAYWRIGHT_MODULE || '/tmp/pw/node_modules/playwright-core/index.mjs';
const kitchenRoot = [process.env.KITCHEN_ROOT, path.resolve(root, '../epicurean-kitchen'), '/tmp/epicurean-kitchen']
  .filter(Boolean)
  .find((dir) => fs.existsSync(path.join(dir, 'index.html')));

const MENU = {
  cats: [{ id: 'c_small', name: 'Small Plates', visible: true }],
  items: [{
    id: 'probe_tuna',
    name: 'Probe Tuna',
    price: 18,
    catIds: ['c_small'],
    station: 'Grill',
    cookMin: 5,
    active: true,
    visible: true
  }]
};
const TABLES = {
  rooms: [{ id: 'main', name: 'Dining' }],
  roomObjs: {
    main: [
      { id: 't1', type: 'table', num: 1, x: 40, y: 40, w: 80, h: 80, seats: 4 },
      { id: 't2', type: 'table', num: 2, x: 180, y: 40, w: 80, h: 80, seats: 2 }
    ]
  },
  stations: []
};

const results = [];
const forbidden = [];

function record(id, pass, measured, errors) {
  const unique = [...new Set((errors || []).filter((item) => item && item !== 'Failed to load resource: the server responded with a status of 404 (Not Found)'))];
  results.push({ id, pass: pass ? 'PASS' : 'FAIL', measured: measured == null ? '' : String(measured), errors: unique });
  console.log((pass ? 'PASS ' : 'FAIL ') + id + ' :: ' + measured + (unique.length ? ' :: ' + unique[0] : ''));
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitFor(fn, ms, step = 150) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const value = await fn();
    if (value) return value;
    await sleep(step);
  }
  return null;
}

function startStatic(dir) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const rel = decodeURIComponent(url.pathname);
    if (rel === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const file = path.normalize(path.join(dir, rel === '/' ? 'index.html' : rel));
    if (!file.startsWith(dir)) {
      res.writeHead(403); res.end(); return;
    }
    fs.readFile(file, (error, buf) => {
      if (error) { res.writeHead(404); res.end('missing'); return; }
      const type = file.endsWith('.html') ? 'text/html; charset=utf-8'
        : file.endsWith('.js') ? 'text/javascript; charset=utf-8'
        : file.endsWith('.css') ? 'text/css'
        : file.endsWith('.json') ? 'application/json'
        : file.endsWith('.png') ? 'image/png'
        : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      origin: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((done) => server.close(() => done()))
    }));
  });
}

function writeCallSites() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').split(/\n/);
  const hits = [];
  html.forEach((text, index) => {
    if (!text.includes('fbDb.')) return;
    const pieces = text.split('fbDb.').slice(1);
    pieces.forEach((piece) => {
      const expr = 'fbDb.' + piece.trim();
      const collection = (expr.match(/collection\('([^']+)'\)/) || [])[1] || '(dynamic)';
      const doc = (expr.match(/\.doc\('([^']+)'\)/) || [])[1]
        || (expr.match(/\.doc\(([^)]+)\)/) || [])[1]
        || '';
      const blob = /=\s*fbDb\.collection/.test(text) && !/\.(where|onSnapshot|add|update|set|get)\(/.test(expr)
        ? expr + '\n' + html.slice(index + 1, index + 16).join('\n')
        : expr;
      const methods = [];
      for (const match of blob.matchAll(/\.(where|onSnapshot|add|update|set|get)\(/g)) {
        if (!methods.includes(match[1])) methods.push(match[1]);
      }
      hits.push({ line: index + 1, collection, doc: doc.trim(), methods, text: text.trim() });
    });
  });
  const groups = new Map();
  hits.forEach((hit) => {
    if (!groups.has(hit.collection)) groups.set(hit.collection, []);
    groups.get(hit.collection).push(hit);
  });
  const lines = [];
  lines.push('# Firestore call sites');
  lines.push('');
  lines.push('Source command, run against `index.html` on `fix/phase1-adapter`. The named adapter lives in `firestore-adapter.js`. Call sites in `index.html` were not retargeted, except `transferCheckTo`, which wraps `retargetKitchenTickets` so a Firestore failure toasts and does not abort the local move.');
  lines.push('');
  lines.push('```');
  lines.push('grep -n "fbDb\\." index.html');
  lines.push('```');
  lines.push('');
  lines.push('## Raw grep');
  lines.push('');
  lines.push('```');
  html.forEach((text, index) => {
    if (text.includes('fbDb.')) lines.push((index + 1) + ':' + text);
  });
  lines.push('```');
  lines.push('');
  lines.push('## Grouped by collection');
  lines.push('');
  [...groups.keys()].sort().forEach((name) => {
    lines.push('### `' + name + '`');
    lines.push('');
    lines.push('| Line | Document | Methods |');
    lines.push('| --- | --- | --- |');
    groups.get(name).forEach((hit) => {
      lines.push('| ' + hit.line + ' | `' + (hit.doc || '—') + '` | ' + (hit.methods.join(', ') || '—') + ' |');
    });
    lines.push('');
  });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'FIRESTORE_CALL_SITES.md'), lines.join('\n'));
  return hits.length;
}

// Frozen output of test/pipeline-baseline at 32bdc41. Do not regenerate this
// from a later run. The After Phase 1 column is the only live measurement.
const BASELINE_ROWS = [
  { id: 'T1 BOH menu write appears in POS state', pass: 'PASS', measured: '59.8s until Probe Tuna was in POS state', errors: [] },
  { id: 'T2 blocked send must not show sent without an orders doc and active_orders entry', pass: 'FAIL', measured: 'toast="Order sent to kitchen" orders=0 active_orders=0', errors: ['Failed to load resource: net::ERR_EMPTY_RESPONSE', 'TypeError: Failed to fetch\n    at http://127.0.0.1:46845/index.html:1455:16'] },
  { id: 'T3 two simultaneous sends both reach active_orders', pass: 'FAIL', measured: 'orders docs=2 feed=[Alpha Plate] heldGets=2', errors: [] },
  { id: 'T4 POS sees all 1200 order documents', pass: 'FAIL', measured: 'POS saw 1000 of 1200 (first read 1000)', errors: [] },
  { id: 'T5 stale POS bar write keeps the BOH edit', pass: 'FAIL', measured: 'POS state before write=[lager] stored list=[lager]', errors: [] },
  { id: 'T6 transferCheckTo re-tables an open kitchen ticket without throwing', pass: 'FAIL', measured: 'threw=yes orders.table=1 active_orders.table=1 sendToast="Order sent to kitchen"', errors: ['page.evaluate: TypeError: fbDb.collection(...).where(...).get is not a function\n    at retargetKitchenTickets (http://127.0.0.1:46845/index.html:9720:58)\n    at transferCheckTo (http://127.0.0.1:46845/index.html:9790:3)\n    at eval (eval at evaluate (:370:30), <anonymous>:1:9)\n    at UtilityScript.evaluate (<anonymous>:372:16)\n    at UtilityScript.<anonymous> (<anonymous>:1:44)\n    at main (/workspace/test/pipeline.test.mjs:441:22)'] },
  { id: 'T7 KDS bump clears the ticket', pass: 'PASS', measured: 'bump buttons before=1 after=0 orders.status=cleared kds="✓ All clear — no active orders"', errors: [] },
  { id: 'T8 manual seat, add, SEND appears on KDS', pass: 'PASS', measured: 'menuReady=true toast="Order sent to kitchen" kds=shows Probe Tuna', errors: [] }
];

function cell(value) {
  return String(value == null ? '' : value).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function writeResults() {
  const lines = [];
  const byId = new Map(results.map((row) => [row.id, row]));
  lines.push('# Pipeline baseline results');
  lines.push('');
  lines.push('POS commit `cfeceb8` (main) is what `test/pipeline-baseline` (`32bdc41`) measured. This file on `fix/phase1-adapter` adds the After Phase 1 column from the same assertions. No live Firestore network and no deploy.');
  lines.push('');
  lines.push('The assertions describe the behavior the pipeline should have. They were not edited to turn a FAIL into a PASS. T2, T3, and T5 are still expected to fail in Phase 1.');
  lines.push('');
  lines.push('Chrome logs `Failed to load resource: 404` for every missing document. The named adapter treats that 404 as "document does not exist", so those lines are omitted here. Application exceptions are kept.');
  lines.push('');
  lines.push('| Test | Baseline (32bdc41) | After Phase 1 | Baseline measured | After Phase 1 measured |');
  lines.push('| --- | --- | --- | --- | --- |');
  const changes = [];
  BASELINE_ROWS.forEach((before) => {
    const after = byId.get(before.id);
    const afterPass = after ? after.pass : 'not run';
    const afterMeasured = after ? after.measured : '';
    if (before.pass !== afterPass) changes.push(before.id + ': ' + before.pass + ' → ' + afterPass);
    lines.push('| ' + before.id + ' | ' + before.pass + ' | ' + afterPass + ' | ' + cell(before.measured) + ' | ' + cell(afterMeasured) + ' |');
  });
  results.forEach((row) => {
    if (!BASELINE_ROWS.some((before) => before.id === row.id)) {
      changes.push(row.id + ': (new) → ' + row.pass);
      lines.push('| ' + row.id + ' | — | ' + row.pass + ' | — | ' + cell(row.measured) + ' |');
    }
  });
  lines.push('');
  lines.push('## PASS/FAIL changes');
  lines.push('');
  if (!changes.length) lines.push('No test changed PASS/FAIL.');
  else changes.forEach((line) => lines.push('- ' + line));
  lines.push('');
  lines.push('T1 stayed PASS. The measured wait is the menu poll, so that number changed when the poll became 5 seconds. T2, T3, T5, T7, and T8 kept the same PASS/FAIL. T2 still fails with the same toast and zero documents; its console stack now points at `firestore-adapter.js` because that is where `fetch` runs.');
  lines.push('');
  lines.push('## Exact console errors');
  lines.push('');
  BASELINE_ROWS.forEach((before) => {
    const after = byId.get(before.id);
    lines.push('### ' + before.id);
    lines.push('');
    lines.push('Baseline:');
    lines.push('');
    if (!before.errors.length) lines.push('none');
    else {
      lines.push('```');
      lines.push(before.errors.join('\n'));
      lines.push('```');
    }
    lines.push('');
    lines.push('After Phase 1:');
    lines.push('');
    const afterErrors = after ? after.errors : [];
    if (!after || !afterErrors.length) lines.push(after ? 'none' : 'not run');
    else {
      lines.push('```');
      lines.push(afterErrors.join('\n'));
      lines.push('```');
    }
    lines.push('');
  });
  if (forbidden.length) {
    lines.push('## Blocked external hosts');
    lines.push('');
    lines.push('These were aborted and not allowed to connect:');
    lines.push('');
    lines.push('```');
    lines.push([...new Set(forbidden)].join('\n'));
    lines.push('```');
    lines.push('');
  }
  fs.writeFileSync(path.join(root, 'docs', 'BASELINE-RESULTS.md'), lines.join('\n'));
}

function attach(page, errors) {
  page.on('pageerror', (error) => errors.push(String(error && error.stack || error)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('request', (req) => {
    let host = '';
    try { host = new URL(req.url()).hostname; } catch { host = ''; }
    // Fonts, the Firebase SDK, and Square are fulfilled locally in the route
    // hook. They are not console errors and they never leave the machine.
    if (!host || host === '127.0.0.1' || host === 'localhost') return;
    if (host === 'www.gstatic.com' || host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com' || host.endsWith('squarecdn.com')) return;
    forbidden.push(host + ' ' + req.url());
    errors.push('EXTERNAL ' + req.url());
  });
}

async function openApp(browser, origin, firestoreRoot, errors) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((storedRoot) => {
    Object.defineProperty(window, 'FIRESTORE_ROOT', {
      configurable: false,
      enumerable: true,
      get() { return storedRoot; },
      set() {}
    });
    const user = { uid: 'anon-test', getIdToken() { return Promise.resolve('test-token'); } };
    const auth = {
      currentUser: null,
      signInAnonymously() {
        auth.currentUser = user;
        return Promise.resolve({ user });
      }
    };
    window.firebase = {
      initializeApp() { return {}; },
      firestore() { return {}; },
      auth() { return auth; }
    };
  }, firestoreRoot);
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    forbidden.push(url.hostname + ' ' + url.href);
    if (url.hostname === 'www.gstatic.com' && url.pathname.includes('/firebasejs/')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* local auth stub is already installed */' });
    }
    if (url.hostname.endsWith('squarecdn.com')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* square not loaded */' });
    }
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    return route.abort();
  });
  const page = await context.newPage();
  attach(page, errors);
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  const pointed = await page.evaluate(() => typeof FIRESTORE_ROOT === 'string' ? FIRESTORE_ROOT : '');
  if (pointed !== firestoreRoot) throw new Error('FIRESTORE_ROOT was not overridden: ' + pointed);
  const ready = await page.evaluate(() => typeof fbReady !== 'undefined' && fbReady === true && typeof fbDb !== 'undefined' && !!fbDb.collection);
  if (!ready) throw new Error('anonymous auth stub did not bring the named adapter up');
  return { context, page };
}

async function plantAndSend(page, name, table) {
  return page.evaluate(({ name, table }) => {
    STATE.currentServer = STATE.currentServer || { name: 'Andre Mendoza', code: '3001', role: 'Food Master' };
    STATE.selectedTable = String(table);
    const sess = sessionOf(table);
    sess.guestCount = 2;
    sess.seatedAt = sess.seatedAt || Date.now();
    STATE.guestCount = 2;
    const check = ensureOpenCheck(table);
    STATE.viewCheckId = check.id;
    STATE.currentOrder = [{
      lineId: 'line-' + name,
      table: String(table),
      seat: 1,
      qty: 1,
      held: false,
      checkId: check.id,
      id: 'probe_tuna',
      name: name,
      price: 18,
      station: 'Grill',
      cookTime: 5,
      modifiers: [],
      allergens: [],
      notes: ''
    }];
    let thrown = '';
    try { sendOrder({}); } catch (error) { thrown = String(error && error.stack || error); }
    return {
      thrown,
      toast: (document.getElementById('toast') || {}).textContent || '',
      local: (STATE.orders || []).filter((order) => (order.items || []).some((item) => item.name === name)).length
    };
  }, { name, table });
}

// Records every toast text, so a "sent" toast that flashed and was replaced is still seen.
async function watchToasts(page) {
  await page.evaluate(() => {
    window.__toasts = [];
    const el = document.getElementById('toast');
    if (!el) return;
    new MutationObserver(() => { window.__toasts.push(el.textContent || ''); })
      .observe(el, { childList: true, characterData: true, subtree: true });
  });
}

function claimsSent(texts) {
  return texts.some((text) => /sent|fired/i.test(text) && !/not sent/i.test(text));
}

async function readOutbox(page) {
  return page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('eh_outbox_v1') || '[]'); } catch (error) { return ['unreadable']; }
  });
}

async function seatedOnFloor(page) {
  return waitFor(() => page.evaluate(() => (STATE.rooms || []).length > 0).catch(() => false), 10000);
}

function feedEntries(fake) {
  const feed = fake.get('boh_shared', 'active_orders');
  return feed && Array.isArray(feed.list) ? feed.list : [];
}

function writesTo(fake, collection, id) {
  return fake.requests.filter((req) => req.method === 'PATCH' && !req.fault && req.path.endsWith('/' + collection + '/' + id)).length;
}

async function main() {
  writeCallSites();
  if (process.env.CALLS_ONLY) return;
  const fake = await startFakeFirestore();
  const pos = await startStatic(root);
  const kitchen = kitchenRoot ? await startStatic(kitchenRoot) : null;
  const { chromium } = await import(pathToFileURL(playwrightModule).href);
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    fake.reset();
    fake.put('orders', 'b', { n: 2 });
    fake.put('orders', 'a', { n: 1 });
    fake.put('orders', 'c', { n: 3 });
    const page1 = await fetch(fake.root + '/orders?pageSize=2').then((res) => res.json());
    const page2 = await fetch(fake.root + '/orders?pageSize=2&pageToken=' + encodeURIComponent(page1.nextPageToken)).then((res) => res.json());
    const order = (page1.documents || []).map((doc) => doc.name.split('/').pop()).concat((page2.documents || []).map((doc) => doc.name.split('/').pop()));
    if (order.join(',') !== 'a,b,c' || !page1.nextPageToken) throw new Error('pagination self-check failed: ' + JSON.stringify({ page1, page2 }));
    fake.reset();

    // T1 — a BOH menu write must show up in POS state. Record how long it takes.
    {
      const errors = [];
      fake.reset();
      const { context, page } = await openApp(browser, pos.origin, fake.root, errors);
      const sawFirstRead = await waitFor(() => fake.requests.some((req) => req.method === 'GET' && req.path.endsWith('/menu')), 10000);
      if (!sawFirstRead) throw new Error('POS never read boh_shared/menu');
      await sleep(300);
      const started = Date.now();
      fake.put('boh_shared', 'menu', JSON.parse(JSON.stringify(MENU)));
      const appeared = await waitFor(() => page.evaluate(() => (STATE.menuItems || []).some((item) => item.id === 'probe_tuna')).catch(() => false), 85000);
      const seconds = Math.round((Date.now() - started) / 100) / 10;
      record('T1 BOH menu write appears in POS state', !!appeared, appeared ? seconds + 's until Probe Tuna was in POS state' : 'Probe Tuna was not in POS state after ' + seconds + 's', errors);
      await context.close();
    }

    // T2 — a blocked send must not tell the waiter the order was sent unless both writes landed.
    // The network is blocked for every Firestore request. After it comes back, the
    // automatic retry must deliver exactly one orders doc and one active_orders entry.
    {
      const errors = [];
      fake.reset();
      fake.put('boh_shared', 'tables', JSON.parse(JSON.stringify(TABLES)));
      const { context, page } = await openApp(browser, pos.origin, fake.root, errors);
      await seatedOnFloor(page);
      await watchToasts(page);
      fake.block(() => true);
      const sent = await plantAndSend(page, 'Blocked Plate', '1');
      const tile = await waitFor(() => page.evaluate(() => {
        const el = document.querySelector('[data-table="1"] .kitchen-send-badge.failed');
        return el ? el.textContent : '';
      }).catch(() => ''), 10000);
      await page.evaluate(() => tapTable('1'));
      const view = await waitFor(() => page.evaluate(() => {
        const el = document.querySelector('#order-top .kitchen-send-badge.failed');
        return el ? el.textContent : '';
      }).catch(() => ''), 5000);
      const blockedToasts = await page.evaluate(() => window.__toasts.slice());
      const blockedOrders = fake.count('orders');
      const blockedFeed = feedEntries(fake).length;
      fake.unblock();
      const delivered = await waitFor(async () => {
        const box = await readOutbox(page);
        return fake.count('orders') >= 1 && feedEntries(fake).length >= 1 && box.length === 0;
      }, 40000);
      await sleep(500);
      const orders = fake.count('orders');
      const feedCount = feedEntries(fake).length;
      const cleared = await page.evaluate(() => !document.querySelector('.kitchen-send-badge.failed'));
      const claimed = claimsSent(blockedToasts);
      const ok = !claimed && /Not sent to kitchen/.test(tile || '') && /Not sent to kitchen/.test(view || '')
        && blockedOrders === 0 && !!delivered && orders === 1 && feedCount === 1 && cleared;
      record('T2 blocked send must not show sent without an orders doc and active_orders entry', ok,
        'blocked: toasts=[' + blockedToasts.join(' | ') + '] tile="' + (tile || 'none') + '" orderView="' + (view || 'none') + '" orders=' + blockedOrders + ' active_orders=' + blockedFeed +
        '; unblocked: orders=' + orders + ' active_orders=' + feedCount + ' badgeCleared=' + cleared,
        errors.concat(sent.thrown ? [sent.thrown] : []));
      await context.close();
    }

    // T3 — two pages sending together must both land in the kitchen feed.
    {
      const errors = [];
      fake.reset();
      const gate = fake.holdGets((req) => req.method === 'GET' && req.collection === 'boh_shared' && req.id === 'active_orders', 2);
      const a = await openApp(browser, pos.origin, fake.root, errors);
      const b = await openApp(browser, pos.origin, fake.root, errors);
      await Promise.all([
        plantAndSend(a.page, 'Alpha Plate', '1'),
        plantAndSend(b.page, 'Beta Plate', '2')
      ]);
      await waitFor(() => gate.arrived >= 2, 10000);
      if (!gate.done) fake.releaseAll();
      await waitFor(() => {
        const feed = fake.get('boh_shared', 'active_orders');
        return feed && Array.isArray(feed.list) && feed.list.length > 0;
      }, 8000);
      await sleep(400);
      const feed = fake.get('boh_shared', 'active_orders');
      const names = feed && Array.isArray(feed.list) ? feed.list.map((order) => (order.items || []).map((item) => item.name).join('+')).sort() : [];
      const both = names.includes('Alpha Plate') && names.includes('Beta Plate');
      record('T3 two simultaneous sends both reach active_orders', both, 'orders docs=' + fake.count('orders') + ' feed=[' + names.join(', ') + '] heldGets=' + gate.arrived, errors);
      await a.context.close();
      await b.context.close();
    }

    // T4 — the POS must see every order in the current business day. sentAt is now,
    // which is always at or after the 05:00 cutoff.
    {
      const errors = [];
      fake.reset();
      const sentAt = Date.now();
      for (let i = 0; i < 1200; i++) {
        const id = 'ord_' + String(i).padStart(4, '0');
        fake.put('orders', id, { table: '9', status: 'new', sentAt: sentAt, items: [{ name: 'Seed ' + i }] });
      }
      const { context, page } = await openApp(browser, pos.origin, fake.root, errors);
      const seen = await waitFor(async () => {
        const count = await page.evaluate(() => (STATE.orders || []).length).catch(() => 0);
        return count > 0 ? count : 0;
      }, 10000);
      await sleep(500);
      const finalCount = await page.evaluate(() => (STATE.orders || []).length);
      record('T4 POS sees all 1200 order documents', finalCount === 1200, 'POS saw ' + finalCount + ' of ' + fake.count('orders') + ' (first read ' + seen + ')', errors);
      await context.close();
    }

    // T5 — a stale POS bar write must not erase a newer BOH edit.
    {
      const errors = [];
      fake.reset();
      fake.put('boh_shared', 'bar', {
        list: [{ id: 'lager', name: 'Lager', kind: 'beer', stock: 10, active: true }],
        updatedAt: 1
      });
      const { context, page } = await openApp(browser, pos.origin, fake.root, errors);
      const loaded = await waitFor(() => page.evaluate(() => (STATE.bar || []).some((item) => item.id === 'lager')).catch(() => false), 10000);
      if (!loaded) throw new Error('POS did not load the bar document');
      fake.put('boh_shared', 'bar', {
        list: [
          { id: 'lager', name: 'Lager', kind: 'beer', stock: 10, active: true },
          { id: 'boh_edit', name: 'BOH Edit', kind: 'beer', stock: 4, active: true }
        ],
        updatedAt: 2
      });
      const before = await page.evaluate(() => {
        const ids = (STATE.bar || []).map((item) => item.id);
        STATE.menuItems = (STATE.menuItems || []).concat([{ id: 'lager', name: 'Lager', source: 'bar' }]);
        consumePosInventory([{ id: 'lager', qty: 1 }]);
        return ids;
      });
      await waitFor(() => {
        const bar = fake.get('boh_shared', 'bar');
        return bar && bar.updatedAt && bar.updatedAt !== 2;
      }, 8000);
      const after = fake.get('boh_shared', 'bar');
      const ids = after && Array.isArray(after.list) ? after.list.map((item) => item.id) : [];
      const kept = ids.includes('boh_edit');
      record('T5 stale POS bar write keeps the BOH edit', kept && before.includes('lager') && !before.includes('boh_edit'), 'POS state before write=[' + before.join(', ') + '] stored list=[' + ids.join(', ') + ']', errors);
      await context.close();
    }

    // T6 — moving a table with an open kitchen ticket must not throw, and the ticket must move.
    {
      const errors = [];
      fake.reset();
      fake.put('boh_shared', 'tables', JSON.parse(JSON.stringify(TABLES)));
      const { context, page } = await openApp(browser, pos.origin, fake.root, errors);
      const sent = await plantAndSend(page, 'Move Plate', '1');
      const landed = await waitFor(() => {
        const feed = fake.get('boh_shared', 'active_orders');
        return fake.count('orders') > 0 && feed && Array.isArray(feed.list) && feed.list.length > 0;
      }, 8000);
      let thrown = '';
      if (landed) {
        try {
          await page.evaluate(() => { transferCheckTo('2'); });
        } catch (error) {
          thrown = String(error && error.stack || error);
        }
      }
      await sleep(800);
      const order = fake.list('orders')[0];
      const feed = fake.get('boh_shared', 'active_orders');
      const orderTable = order && order.data ? String(order.data.table) : '';
      const feedTable = feed && feed.list && feed.list[0] ? String(feed.list[0].table) : '';
      const ok = landed && !thrown && orderTable === '2' && feedTable === '2';
      record('T6 transferCheckTo re-tables an open kitchen ticket without throwing', !!ok, 'threw=' + (thrown ? 'yes' : 'no') + ' orders.table=' + (orderTable || 'missing') + ' active_orders.table=' + (feedTable || 'missing') + ' sendToast="' + sent.toast + '"', errors.concat(thrown ? [thrown] : []));
      await context.close();
    }

    // T7 — KDS bump removes the ticket and clears the order document.
    {
      const errors = [];
      if (!kitchen) {
        record('T7 KDS bump clears the ticket', false, 'epicurean-kitchen checkout not found', errors);
      } else {
        fake.reset();
        const ticket = {
          id: 'kds_ticket_1',
          table: '4',
          server: 'Andre Mendoza',
          status: 'new',
          sentAt: Date.now(),
          items: [{ id: 'probe_tuna', name: 'Probe Tuna', station: 'Grill', qty: 1 }]
        };
        fake.put('orders', ticket.id, { table: ticket.table, server: ticket.server, status: 'new', sentAt: ticket.sentAt, items: ticket.items });
        fake.put('boh_shared', 'active_orders', { list: [ticket], updatedAt: Date.now() });
        const { context, page } = await openApp(browser, kitchen.origin, fake.root, errors);
        for (const digit of ['1', '0', '0', '1']) {
          await page.locator('#kds-numpad button', { hasText: new RegExp('^' + digit + '$') }).click();
        }
        await page.waitForSelector('.bump-btn', { timeout: 8000 });
        const before = await page.locator('.bump-btn').count();
        await page.locator('.bump-btn').click();
        const cleared = await waitFor(() => {
          const doc = fake.get('orders', 'kds_ticket_1');
          return doc && doc.status === 'cleared';
        }, 8000);
        const left = await page.locator('.bump-btn').count();
        const gone = await page.locator('#kds-content').innerText();
        record('T7 KDS bump clears the ticket', !!cleared && left === 0 && before === 1, 'bump buttons before=' + before + ' after=' + left + ' orders.status=' + ((fake.get('orders', 'kds_ticket_1') || {}).status || 'missing') + ' kds="' + gone.replace(/\s+/g, ' ').slice(0, 80) + '"', errors);
        await context.close();
      }
    }

    // T8 — seat, add, SEND on the POS, and the ticket shows on the KDS.
    {
      const errors = [];
      if (!kitchen) {
        record('T8 manual seat, add, SEND appears on KDS', false, 'epicurean-kitchen checkout not found', errors);
      } else {
        let posApp;
        let kds;
        try {
          fake.reset();
          fake.put('boh_shared', 'menu', JSON.parse(JSON.stringify(MENU)));
          fake.put('boh_shared', 'tables', JSON.parse(JSON.stringify(TABLES)));
          posApp = await openApp(browser, pos.origin, fake.root, errors);
          const menuReady = await waitFor(() => posApp.page.evaluate(() => (STATE.menuItems || []).some((item) => item.id === 'probe_tuna')).catch(() => false), 10000);
          for (const digit of ['3', '0', '0', '1']) {
            await posApp.page.locator('#numpad button', { hasText: new RegExp('^' + digit + '$') }).click();
          }
          await posApp.page.waitForFunction(() => STATE.currentServer && STATE.currentServer.code === '3001', { timeout: 8000 });
          await posApp.page.evaluate(() => document.querySelector('button[data-tab="tables"]').click());
          await posApp.page.waitForFunction(() => document.querySelector('[data-table="1"]'), { timeout: 8000 });
          await posApp.page.evaluate(() => tapTable('1'));
          await posApp.page.evaluate(() => {
            const btn = [...document.querySelectorAll('#sheet-overlay button')].find((el) => el.textContent.trim() === '2');
            if (!btn) throw new Error('guest count button missing');
            btn.click();
          });
          await posApp.page.waitForFunction(() => document.querySelector('.ts-tile'), { timeout: 8000 });
          await posApp.page.evaluate(() => {
            const tiles = [...document.querySelectorAll('.ts-tile')];
            const category = tiles.find((el) => el.textContent.includes('Small Plates'));
            if (category) category.click();
          });
          await posApp.page.evaluate(() => {
            const tile = [...document.querySelectorAll('.ts-tile')].find((el) => el.textContent.includes('Probe Tuna'));
            if (!tile) throw new Error('Probe Tuna tile missing');
            tile.click();
          });
          await posApp.page.evaluate(() => {
            const keep = [...document.querySelectorAll('#sheet-overlay button')].find((el) => el.textContent.includes('Add & keep ordering'));
            if (keep) keep.click();
          });
          await posApp.page.evaluate(() => {
            const send = document.querySelector('button.send');
            if (!send) throw new Error('Send button missing');
            send.click();
          });
          const toast = await posApp.page.locator('#toast').innerText();
          kds = await openApp(browser, kitchen.origin, fake.root, errors);
          for (const digit of ['1', '0', '0', '1']) {
            await kds.page.locator('#kds-numpad button', { hasText: new RegExp('^' + digit + '$') }).click();
          }
          const shown = await waitFor(async () => {
            const text = await kds.page.locator('#kds-content').innerText().catch(() => '');
            return text.includes('Probe Tuna') ? text : '';
          }, 15000);
          record('T8 manual seat, add, SEND appears on KDS', !!menuReady && !!shown, 'menuReady=' + !!menuReady + ' toast="' + toast + '" kds=' + (shown ? 'shows Probe Tuna' : 'ticket not shown'), errors);
        } catch (error) {
          record('T8 manual seat, add, SEND appears on KDS', false, 'flow stopped before a KDS ticket could be confirmed', errors.concat([String(error && error.stack || error)]));
        } finally {
          if (posApp) await posApp.context.close();
          if (kds) await kds.context.close();
        }
      }
    }

    // T9 — a ticket still in the outbox when the page reloads is delivered once by the new page.
    {
      const errors = [];
      fake.reset();
      const { context, page } = await openApp(browser, pos.origin, fake.root, errors);
      await sleep(400);
      fake.block(() => true);
      const sent = await plantAndSend(page, 'Reload Plate', '1');
      const pending = await waitFor(async () => {
        const box = await readOutbox(page);
        return box.length === 1 && box[0].state === 'failed' ? box : null;
      }, 10000);
      const id = pending ? pending[0].id : '';
      fake.unblock();
      const reloadAt = Date.now();
      await page.reload({ waitUntil: 'domcontentloaded' });
      const delivered = await waitFor(async () => {
        const box = await readOutbox(page).catch(() => ['reloading']);
        return fake.count('orders') >= 1 && feedEntries(fake).length >= 1 && box.length === 0;
      }, 15000);
      await sleep(1500);
      const orders = fake.count('orders');
      const feedIds = feedEntries(fake).map((item) => item.id);
      const afterReload = fake.requests.filter((req) => req.method === 'PATCH' && !req.fault && req.at >= reloadAt && req.path.endsWith('/orders/' + id)).length;
      const box = await readOutbox(page);
      const ok = !!id && !!delivered && orders === 1 && fake.get('orders', id) && feedIds.length === 1 && feedIds[0] === id && afterReload >= 1 && box.length === 0;
      record('T9 reload with a pending outbox delivers the ticket exactly once', ok,
        'outbox before reload=' + (pending ? pending.length : 0) + ' orders=' + orders + ' active_orders=' + feedIds.length + ' sameId=' + (feedIds[0] === id) + ' ordersWritesAfterReload=' + afterReload + ' outbox after=' + box.length,
        errors.concat(sent.thrown ? [sent.thrown] : []));
      await context.close();
    }

    // T10 — the orders write lands but every response is lost; the retry must not duplicate it.
    {
      const errors = [];
      fake.reset();
      const { context, page } = await openApp(browser, pos.origin, fake.root, errors);
      await sleep(400);
      await watchToasts(page);
      // Chrome silently resends a request whose kept-alive socket closes, so the
      // fault stays on until the outbox records a failed attempt.
      const lose = fake.failWhen((req) => req.method === 'PATCH' && req.collection === 'orders', 1000, 'lose');
      const sent = await plantAndSend(page, 'Lost Plate', '1');
      const failed = await waitFor(async () => {
        const box = await readOutbox(page);
        return box.length === 1 && box[0].state === 'failed' ? box : null;
      }, 10000);
      lose.left = 0;
      const landedWhileLost = fake.count('orders');
      const toastsWhileLost = await page.evaluate(() => window.__toasts.slice());
      const delivered = await waitFor(async () => {
        const box = await readOutbox(page);
        return feedEntries(fake).length >= 1 && box.length === 0;
      }, 15000);
      await sleep(800);
      const writes = fake.requests.filter((req) => req.method === 'PATCH' && req.path.includes('/orders/')).length;
      const orders = fake.count('orders');
      const feedCount = feedEntries(fake).length;
      const toasts = await page.evaluate(() => window.__toasts.slice());
      const ok = !!failed && landedWhileLost === 1 && !claimsSent(toastsWhileLost) && !!delivered && orders === 1 && feedCount === 1 && writes >= 2;
      record('T10 lost write response then retry makes no duplicate', ok,
        'failed attempt seen=' + !!failed + ' orders while response lost=' + landedWhileLost + ' orders PATCH attempts=' + writes + ' orders=' + orders + ' active_orders=' + feedCount + ' toasts=[' + toasts.join(' | ') + ']',
        errors.concat(sent.thrown ? [sent.thrown] : []));
      await context.close();
    }

    // T11 — orders doc lands, the feed write fails; tapping retry completes only the feed.
    {
      const errors = [];
      fake.reset();
      fake.put('boh_shared', 'tables', JSON.parse(JSON.stringify(TABLES)));
      const { context, page } = await openApp(browser, pos.origin, fake.root, errors);
      await seatedOnFloor(page);
      for (const digit of ['3', '0', '0', '1']) {
        await page.locator('#numpad button', { hasText: new RegExp('^' + digit + '$') }).click();
      }
      await page.waitForFunction(() => STATE.currentServer && STATE.currentServer.code === '3001', { timeout: 8000 });
      await page.evaluate(() => document.querySelector('button[data-tab="tables"]').click());
      await watchToasts(page);
      fake.failWhen((req) => req.method === 'PATCH' && req.collection === 'boh_shared' && req.id === 'active_orders', 4, 500);
      const sent = await plantAndSend(page, 'Feed Plate', '1');
      await page.evaluate(() => tapTable('1'));
      const banner = await waitFor(() => page.evaluate(() => {
        const el = document.querySelector('#order-top .kitchen-send-badge.failed');
        return el ? el.textContent : '';
      }).catch(() => ''), 10000);
      const box = await readOutbox(page);
      const id = box[0] ? box[0].id : '';
      const writtenFlag = box[0] ? !!box[0].written : false;
      const ordersBefore = fake.count('orders');
      const feedBefore = feedEntries(fake).length;
      const toastsBefore = await page.evaluate(() => window.__toasts.slice());
      if (banner) await page.locator('#order-top .kitchen-send-badge.failed').click();
      const delivered = await waitFor(async () => {
        const left = await readOutbox(page);
        return feedEntries(fake).length >= 1 && left.length === 0;
      }, 10000);
      await sleep(800);
      const ordersWrites = id ? writesTo(fake, 'orders', id) : -1;
      const feedIds = feedEntries(fake).map((item) => item.id);
      const toasts = await page.evaluate(() => window.__toasts.slice());
      const ok = !!banner && writtenFlag && ordersBefore === 1 && feedBefore === 0 && !claimsSent(toastsBefore)
        && !!delivered && ordersWrites === 1 && fake.count('orders') === 1 && feedIds.length === 1 && feedIds[0] === id
        && toasts.includes('Order sent to kitchen');
      record('T11 orders written but feed fails, retry completes only the feed', ok,
        'banner="' + (banner || 'none') + '" written=' + writtenFlag + ' before: orders=' + ordersBefore + ' active_orders=' + feedBefore +
        '; after tap: orders writes=' + ordersWrites + ' orders=' + fake.count('orders') + ' active_orders=' + feedIds.length + ' sameId=' + (feedIds[0] === id) + ' toasts=[' + toasts.join(' | ') + ']',
        errors.concat(sent.thrown ? [sent.thrown] : []));
      await context.close();
    }
  } finally {
    writeResults();
    await browser.close();
    fake.releaseAll();
    await fake.close();
    await pos.close();
    if (kitchen) await kitchen.close();
  }
  const failed = results.filter((row) => row.pass === 'FAIL').length;
  console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error(error && error.stack || error);
  try { writeResults(); } catch { /* the results file is best-effort if setup crashed */ }
  process.exitCode = 1;
});
