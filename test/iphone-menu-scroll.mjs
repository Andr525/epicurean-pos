// iPhone order-screen menu scroll. Offline only: Firebase is stubbed and every
// request stays on 127.0.0.1. No live Firestore.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { startFakeFirestore } from './fake-firestore.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROMIUM_PATH || '/usr/local/bin/google-chrome';
const playwrightModule = process.env.PLAYWRIGHT_MODULE || '/tmp/pw/node_modules/playwright-core/index.mjs';

const VIEWPORTS = [
  { width: 390, height: 844, label: 'iPhone 14 390x844' },
  { width: 375, height: 667, label: '375x667' }
];

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

async function openOrder(browser, origin, firestoreRoot, iphone, viewport) {
  const context = await browser.newContext({
    ...iphone,
    viewport,
    isMobile: true,
    hasTouch: true
  });
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
    if (url.hostname === 'www.gstatic.com' && url.pathname.includes('/firebasejs/')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* local auth stub */' });
    }
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname.endsWith('squarecdn.com')) {
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    return route.abort();
  });
  const page = await context.newPage();
  const forbidden = [];
  page.on('request', (req) => {
    try {
      const host = new URL(req.url()).hostname;
      // Fonts, the Firebase SDK, and Square are fulfilled locally in the route
      // hook. They never leave the machine.
      if (!host || host === '127.0.0.1' || host === 'localhost') return;
      if (host === 'www.gstatic.com' || host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com' || host.endsWith('squarecdn.com')) return;
      forbidden.push(host);
    } catch { /* ignore malformed urls */ }
  });
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof fbReady !== 'undefined' && fbReady === true && !!fbDb.collection);
  await page.evaluate(() => {
    STATE.currentServer = { name: 'Andre Mendoza', code: '3001', role: 'Food Master' };
    STATE.menuLive = true;
    STATE.menuCategories = Array.from({ length: 18 }, (_, i) => ({
      id: 'cat_' + i,
      name: 'Category ' + String(i + 1).padStart(2, '0')
    }));
    STATE.menuItems = [{
      id: 'probe', name: 'Probe Dish', price: 10, category: 'cat_0', catIds: ['cat_0'],
      station: 'Grill', active: true, visible: true
    }];
    STATE.prixFixeMenus = [];
    STATE.tastingMenus = [];
    STATE.selectedTable = '1';
    const sess = sessionOf('1');
    sess.guestCount = 4;
    sess.seatedAt = Date.now();
    ensureOpenCheck('1');
    showScreen('app-screen');
    switchTab('order');
    setMenuFamily('food');
  });
  await page.waitForSelector('#menu-items-list .ts-tile');
  return { context, page, forbidden };
}

// Scroll the order screen's menu container (the one that actually overflows)
// and report the last category tile against any fixed bottom bar.
async function scrollMenu(page) {
  return page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#menu-items-list .ts-tile:not(.back)')];
    const last = tiles[tiles.length - 1];
    if (!last) return { error: 'no category tile' };
    let scroller = last.parentElement;
    while (scroller && scroller !== document.body) {
      const style = getComputedStyle(scroller);
      const scrolls = /(auto|scroll)/.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight + 1;
      if (scrolls) break;
      scroller = scroller.parentElement;
    }
    if (!scroller || scroller === document.body) scroller = document.getElementById('app-content');
    scroller.scrollTop = scroller.scrollHeight;
    const rect = last.getBoundingClientRect();
    const port = scroller.getBoundingClientRect();
    const bars = [...document.body.querySelectorAll('*')].filter((el) => {
      const style = getComputedStyle(el);
      if (style.position !== 'fixed' && style.position !== 'sticky') return false;
      const box = el.getBoundingClientRect();
      return box.height > 20 && box.width > 20 && box.bottom >= window.innerHeight - 2 && box.top > window.innerHeight * 0.4;
    }).map((el) => {
      const box = el.getBoundingClientRect();
      return { name: String(el.className || el.id || el.tagName).slice(0, 40), top: box.top, bottom: box.bottom };
    });
    const visibleBottom = Math.min(window.innerHeight, port.bottom, ...bars.map((bar) => bar.top));
    const visibleTop = Math.max(0, port.top);
    const hit = document.elementFromPoint(rect.left + rect.width / 2, Math.min(rect.bottom - 2, visibleBottom - 1));
    const covered = !hit || (hit !== last && !last.contains(hit));
    const fully = rect.height > 2 && rect.top >= visibleTop - 1 && rect.bottom <= visibleBottom + 1 && !covered;
    return {
      scroller: scroller.id || String(scroller.className).slice(0, 40),
      last: (last.textContent || '').trim().slice(0, 40),
      tiles: tiles.length,
      scrollTop: scroller.scrollTop,
      clientHeight: scroller.clientHeight,
      scrollHeight: scroller.scrollHeight,
      reached: scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1,
      fully,
      covered,
      rect: { top: Math.round(rect.top), bottom: Math.round(rect.bottom) },
      visibleTop: Math.round(visibleTop),
      visibleBottom: Math.round(visibleBottom),
      bars
    };
  });
}

async function main() {
  const css = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const screenRule = css.match(/\.screen\s*\{[^}]*\}/);
  if (!screenRule || !/height:\s*100vh/.test(screenRule[0]) || !/height:\s*100dvh/.test(screenRule[0])) {
    throw new Error('.screen is missing height:100vh followed by height:100dvh');
  }
  const fake = await startFakeFirestore();
  const pos = await startStatic(root);
  const { chromium, devices } = await import(pathToFileURL(playwrightModule).href);
  const iphone = devices['iPhone 14'];
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const results = [];
  try {
    for (const viewport of VIEWPORTS) {
      const { context, page, forbidden } = await openOrder(browser, pos.origin, fake.root, iphone, viewport);
      const measured = await scrollMenu(page);
      const pass = !measured.error && measured.reached && measured.fully && measured.tiles >= 8 && forbidden.length === 0;
      results.push({ viewport: viewport.label, pass, measured, forbidden: [...new Set(forbidden)] });
      console.log((pass ? 'PASS ' : 'FAIL ') + viewport.label + ' :: ' + JSON.stringify(measured) + (forbidden.length ? ' :: external ' + forbidden.join(',') : ''));
      await context.close();
    }
  } finally {
    await browser.close();
    await fake.close();
    await pos.close();
  }
  const failed = results.filter((row) => !row.pass);
  console.log('\n' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed');
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
