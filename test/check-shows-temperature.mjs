// Payment screen and printed check show temperature modifiers and the 2A seat
// label. Offline only: Firebase is stubbed. No live Firestore.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { startFakeFirestore } from './fake-firestore.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROMIUM_PATH || '/usr/local/bin/google-chrome';
const playwrightModule = process.env.PLAYWRIGHT_MODULE || '/tmp/pw/node_modules/playwright-core/index.mjs';

function startStatic(dir) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const rel = decodeURIComponent(url.pathname);
    if (rel === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const file = path.normalize(path.join(dir, rel === '/' ? 'index.html' : rel));
    if (!file.startsWith(dir)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (error, buf) => {
      if (error) { res.writeHead(404); res.end('missing'); return; }
      const type = file.endsWith('.html') ? 'text/html; charset=utf-8'
        : file.endsWith('.js') ? 'text/javascript; charset=utf-8'
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

function rowOf(rows, name) {
  return rows.find((row) => row.name === name) || null;
}

async function main() {
  const fake = await startFakeFirestore();
  const pos = await startStatic(root);
  const { chromium } = await import(pathToFileURL(playwrightModule).href);
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const errors = [];
  try {
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
    }, fake.root);
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
      if (url.hostname === 'www.gstatic.com' && url.pathname.includes('/firebasejs/')) {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* local auth stub */' });
      }
      if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname.endsWith('squarecdn.com')) {
        return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      }
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(String(error && error.stack || error)));
    await page.goto(pos.origin + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof fbReady !== 'undefined' && fbReady === true && !!fbDb.collection);
    const shown = await page.evaluate(() => {
      STATE.currentServer = { name: 'Andre Mendoza', code: '3001', role: 'Food Master' };
      STATE.selectedTable = '1';
      const sess = sessionOf('1');
      sess.guestCount = 2;
      sess.seatedAt = Date.now();
      const check = ensureOpenCheck('1');
      STATE.viewCheckId = check.id;
      STATE.guestCount = 2;
      if (!sess.femalePositions['2']) toggleFemalePosition(2);
      STATE.currentOrder = [
        {
          lineId: 'line-ribeye', table: '1', seat: 1, checkId: check.id, qty: 1, held: false,
          name: 'Ribeye', price: 58, selectedMod: 'Temperature: Rare'
        },
        {
          lineId: 'line-salmon', table: '1', seat: 2, checkId: check.id, qty: 1, held: false,
          name: 'Salmon', price: 34, selectedMod: 'Temperature: Medium'
        },
        {
          lineId: 'line-bread', table: '1', seat: 1, checkId: check.id, qty: 1, held: false,
          name: 'Bread', price: 6, selectedMod: ''
        }
      ];
      showScreen('app-screen');
      openPayment(98);
      const payRows = [...document.querySelectorAll('#payment-card .pay-items > div')].filter((el) => !/Subtotal/.test(el.textContent || '')).map((el) => ({
        name: (el.querySelector('.pay-name') || el).childNodes[0] ? '' : '',
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        details: [...el.querySelectorAll('.pay-detail')].map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim()),
        price: (([...el.children].pop()) || {}).textContent || ''
      }));
      // Name is the first text node of .pay-main.
      payRows.forEach((row, index) => {
        const el = [...document.querySelectorAll('#payment-card .pay-items > div')].filter((node) => !/Subtotal/.test(node.textContent || ''))[index];
        const main = el.querySelector('.pay-main');
        row.name = main ? (main.childNodes[0] && main.childNodes[0].textContent || '').trim() : '';
      });
      window.__printCalls = 0;
      window.print = function() { window.__printCalls += 1; };
      printCheck();
      const printed = document.getElementById('print-root').innerHTML;
      const printRows = [...document.querySelectorAll('#print-root tr')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim());
      return {
        female: positionLabel(2),
        payRows,
        printCalls: window.__printCalls,
        printed,
        printRows,
        subtotal: (document.querySelector('#payment-card .pay-items') || {}).textContent || ''
      };
    });
    const ribeye = rowOf(shown.payRows, 'Ribeye');
    const salmon = rowOf(shown.payRows, 'Salmon');
    const bread = rowOf(shown.payRows, 'Bread');
    const printRibeye = shown.printRows.find((text) => text.includes('Ribeye')) || '';
    const printSalmon = shown.printRows.find((text) => text.includes('Salmon')) || '';
    const printBread = shown.printRows.find((text) => text.includes('Bread')) || '';
    const problems = [];
    if (shown.female !== '2A') problems.push('positionLabel(2)=' + shown.female);
    if (!ribeye || !ribeye.details.includes('Temperature: Rare') || !ribeye.details.includes('Seat 1')) problems.push('payment ribeye ' + JSON.stringify(ribeye));
    if (!salmon || !salmon.details.includes('Temperature: Medium') || !salmon.details.includes('Seat 2A')) problems.push('payment salmon ' + JSON.stringify(salmon));
    if (salmon && salmon.details.some((text) => text === 'Seat 2')) problems.push('payment still says Seat 2');
    if (!bread || bread.details.some((text) => text === '') || bread.details.length !== 1 || bread.details[0] !== 'Seat 1') problems.push('payment bread ' + JSON.stringify(bread));
    if (!ribeye || ribeye.price !== '$58.00' || !salmon || salmon.price !== '$34.00' || !bread || bread.price !== '$6.00') problems.push('prices changed ' + JSON.stringify(shown.payRows));
    if (!/Subtotal/.test(shown.subtotal) || !/\$98\.00/.test(shown.subtotal)) problems.push('subtotal changed');
    if (shown.printCalls !== 1) problems.push('print calls ' + shown.printCalls);
    if (!printRibeye.includes('Temperature: Rare') || !printRibeye.includes('Seat 1')) problems.push('print ribeye ' + printRibeye);
    if (!printSalmon.includes('Temperature: Medium') || !printSalmon.includes('Seat 2A')) problems.push('print salmon ' + printSalmon);
    if (/Seat 2(?!A)/.test(printSalmon)) problems.push('print still says Seat 2');
    if (!printBread.includes('Seat 1') || /Temperature/.test(printBread) || /·\s*·/.test(printBread)) problems.push('print bread ' + printBread);
    const pass = problems.length === 0 && errors.length === 0;
    console.log((pass ? 'PASS' : 'FAIL') + ' payment and printed check show temperature and Seat 2A :: ' + (problems.join(' | ') || 'ok'));
    if (errors.length) console.log(errors[0]);
    process.exitCode = pass ? 0 : 1;
    await context.close();
  } finally {
    await browser.close();
    await fake.close();
    await pos.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
