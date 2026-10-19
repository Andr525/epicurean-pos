// Verifies the iPhone QR launcher of the test kit (no Mac needed): address detection and errors via
// stub macOS tools, then the real server + QR window in Chromium, decoding the QR with an independent
// reader (jsQR, test-only, not shipped). Usage:
//   PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... JSQR=/path/to/jsQR.js node verify-iphone-launcher.mjs <kitDir> <bindableIp>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn, spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const KIT = path.resolve(process.argv[2]), BIND = process.argv[3];
const results = [];
const check = (name, ok, detail) => { results.push({name, ok: !!ok, detail}); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- stub macOS tools ----
function stubs({routeIf = 'en0', addrs = {}}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'macstub-')), log = path.join(dir, 'calls.log');
  const w = (n, body) => { fs.writeFileSync(path.join(dir, n), '#!/bin/bash\n' + body + '\n'); fs.chmodSync(path.join(dir, n), 0o755); };
  w('route', routeIf ? `echo "   route to: default"; echo "interface: ${routeIf}"` : 'exit 1');
  w('ipconfig', 'case "$2" in ' + Object.entries(addrs).map(([k, v]) => `${k}) echo "${v}";;`).join(' ') + ' *) exit 1;; esac');
  w('osascript', `echo "osascript $*" >> "${log}"`);
  w('open', `echo "open $*" >> "${log}"`);
  return {dir, log, calls: () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : ''};
}
// The launcher, with only its final exec line swapped for an echo (to observe address detection).
function detect(st) {
  const copy = path.join(st.dir, 'launcher-detect.command');
  fs.writeFileSync(copy, fs.readFileSync(path.join(KIT, 'Start iPhone POS Test.command'), 'utf8').replace(/^exec .*$/m, 'echo "DETECTED $IP"; exit 0').replace('cd "$(dirname "$0")" || exit 1', `cd "${KIT}" || exit 1`));
  const r = spawnSync('bash', [copy], {env: {...process.env, PATH: st.dir + ':' + process.env.PATH}, encoding: 'utf8'});
  return {code: r.status, out: r.stdout + r.stderr};
}
{
  const st = stubs({routeIf: 'en0', addrs: {en0: '192.168.1.23'}}); const r = detect(st);
  check('detects the active Wi-Fi address (default-route interface)', r.code === 0 && /DETECTED 192\.168\.1\.23/.test(r.out), r.out.trim());
}
{
  const st = stubs({routeIf: 'utun3', addrs: {en1: '10.0.0.5'}}); const r = detect(st);
  check('falls back to the Wi-Fi port when the default route is a VPN tunnel', r.code === 0 && /DETECTED 10\.0\.0\.5/.test(r.out), r.out.trim());
}
{
  const st = stubs({routeIf: null, addrs: {}}); const r = spawnSync('bash', [path.join(KIT, 'Start iPhone POS Test.command')], {env: {...process.env, PATH: st.dir + ':' + process.env.PATH}, encoding: 'utf8'});
  check('missing Wi-Fi: clear error dialog, exit 2, no server', r.status === 2 && /No home Wi-Fi connection found/.test(st.calls()) && !/open /.test(st.calls()), (r.stdout || '').trim().split('\n').join(' ').slice(0, 160));
}
{
  const st = stubs({routeIf: 'en0', addrs: {en0: '8.8.8.8'}}); const r = spawnSync('bash', [path.join(KIT, 'Start iPhone POS Test.command')], {env: {...process.env, PATH: st.dir + ':' + process.env.PATH}, encoding: 'utf8'});
  check('never serves on a public address (treated as no home Wi-Fi)', r.status === 2 && /No home Wi-Fi connection found/.test(st.calls()), 'exit ' + r.status);
}
{
  // Address not available on this machine: the server reports it cannot start (same path as a blocked port).
  const st = stubs({routeIf: 'en0', addrs: {en0: '192.168.250.250'}}); const r = spawnSync('bash', [path.join(KIT, 'Start iPhone POS Test.command')], {env: {...process.env, PATH: st.dir + ':' + process.env.PATH}, encoding: 'utf8', timeout: 20000});
  check('launcher → server: unusable address/port gives a clear error dialog, exit 3', r.status === 3 && /Could not start the test server/.test(st.calls()), 'exit ' + r.status);
}

// ---- real server on a bindable address ----
function startServer(st, port = 8765) {
  const p = spawn('python3', [path.join(KIT, 'iphone-test-server.py'), BIND, String(port)], {env: {...process.env, PATH: st.dir + ':' + process.env.PATH}, stdio: ['ignore', 'pipe', 'pipe']});
  let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  const exited = new Promise(r => p.on('exit', code => r(code)));
  return {p, out: () => out, exited};
}
async function waitUrl(u, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { try { const r = await fetch(u, {cache: 'no-store'}); if (r.ok) return r; } catch {} await sleep(200); } throw Error('not reachable: ' + u); }
const occupy = ports => Promise.all(ports.map(port => new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(port, BIND, () => res(s)); })));

const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox']});
const jsqr = fs.readFileSync(process.env.JSQR, 'utf8');
async function decodeQr(page) {
  await page.addScriptTag({content: jsqr});
  return page.evaluate(async () => {
    const svg = document.querySelector('#qr svg'); const img = new Image(); // data: URL (the page's policy allows data: images, not blob:)
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.outerHTML); await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = 600; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 600); g.drawImage(img, 0, 0, 600, 600);
    const d = g.getImageData(0, 0, 600, 600); const r = window.jsQR(d.data, 600, 600); return r ? r.data : null;
  });
}
{
  // Normal start: QR window opens, QR decodes to the exact POS URL, POS loads, Stop Testing stops the server.
  const st = stubs({}); const s = startServer(st);
  const expected = `http://${BIND}:8765/index.html`;
  await waitUrl(`http://${BIND}:8765/__alive`);
  check('server prints the exact iPhone URL', s.out().includes('iPhone URL:  ' + expected), s.out().split('\n').find(l => /iPhone URL/.test(l)));
  await sleep(300);
  check('QR window is opened automatically on the Mac', st.calls().includes(`open http://${BIND}:8765/iphone-qr.html`), st.calls().trim());
  const ctx = await browser.newContext({viewport: {width: 1280, height: 900}}); const page = await ctx.newPage(); const errs = [], ext = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('request', r => { const u = new URL(r.url()); if (u.host !== `${BIND}:8765` && !/^(data|blob):/.test(r.url())) ext.push(u.host); });
  await page.goto(`http://${BIND}:8765/iphone-qr.html`); await page.waitForSelector('#qr svg');
  const shown = await page.locator('#url').innerText(); const decoded = await decodeQr(page);
  check('QR code decodes to exactly the POS URL', decoded === expected, 'decoded=' + decoded);
  check('URL is shown under the QR code', shown.trim() === expected, shown.trim());
  const box = await page.locator('#qr').boundingBox(); check('QR code is large (≥ 480 px on a 1280×900 window)', box && box.width >= 480, box && Math.round(box.width) + ' px');
  await page.screenshot({path: path.join(os.tmpdir(), 'iphone-qr-window.png')});
  const pos = await (await fetch(expected)).text();
  check('the QR URL serves the isolated test POS (mock cloud + no-network policy present)', /connect-src 'none'/.test(pos) && /test-mock-cloud\.js/.test(pos) && /window\.__MOCK_DB__/.test(pos), pos.length + ' bytes');
  const phone = await browser.newContext({viewport: {width: 390, height: 844}, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', isMobile: true, hasTouch: true});
  const pp = await phone.newPage(); const perr = [], pext = []; pp.on('pageerror', e => perr.push(e.message)); pp.on('request', r => { const u = new URL(r.url()); if (u.host !== `${BIND}:8765` && !/^(data|blob):/.test(r.url())) pext.push(u.host); });
  await pp.goto(decoded); await pp.waitForFunction(() => typeof STATE !== 'undefined' && window.__MOCK_DB__ && window.__MOCK_DB__.MOCK); await pp.waitForTimeout(1200);
  for (const d of '3101') await pp.getByRole('button', {name: d, exact: true}).first().click();
  await pp.waitForTimeout(600); const who = await pp.evaluate(() => STATE.currentServer && STATE.currentServer.name);
  await pp.screenshot({path: path.join(os.tmpdir(), 'iphone-pos.png')});
  check('opening the scanned URL on an iPhone-sized Safari view: POS loads, fictional login works, no outside requests', who === 'Jordan Reyes' && !perr.length && !pext.length, `signed in as ${who}; pageErrors=${perr.length}; outside requests=${JSON.stringify([...new Set(pext)])}`);
  await phone.close();
  check('QR window makes no outside requests and has no errors', !errs.length && !ext.length, JSON.stringify({errs, ext}));
  await page.getByRole('button', {name: 'Stop Testing'}).click();
  const code = await Promise.race([s.exited, sleep(8000).then(() => 'still running')]);
  const after = await page.locator('#status').innerText();
  check('Stop Testing stops the server and says so', code === 0 && /stopped/i.test(after), `exit=${code}; status="${after}"`);
  await ctx.close();
}
{
  // Closing the QR window stops the server after a short grace period.
  const st = stubs({}); const s = startServer(st); await waitUrl(`http://${BIND}:8765/__alive`);
  const ctx = await browser.newContext(); const page = await ctx.newPage(); await page.goto(`http://${BIND}:8765/iphone-qr.html`); await page.waitForSelector('#qr svg');
  await page.close(); const code = await Promise.race([s.exited, sleep(20000).then(() => 'still running')]);
  check('closing the QR window stops the server', code === 0, 'exit=' + code); await ctx.close();
}
{
  // Port 8765 busy: next free port is used, and the QR follows it.
  const held = await occupy([8765]); const st = stubs({}); const s = startServer(st); await waitUrl(`http://${BIND}:8766/__alive`);
  const info = await (await fetch(`http://${BIND}:8766/__info`)).json();
  check('busy port 8765: uses 8766 and the QR URL follows', info.url === `http://${BIND}:8766/index.html`, info.url);
  await fetch(`http://${BIND}:8766/__stop`, {method: 'POST'}); await s.exited; held.forEach(x => x.close());
}
{
  // All five ports blocked: clear error dialog, exit 3, no QR window.
  const held = await occupy([8765, 8766, 8767, 8768, 8769]); const st = stubs({}); const s = startServer(st); const code = await s.exited;
  check('all ports blocked: clear error dialog, exit 3, no QR window', code === 3 && /Could not start the test server: ports 8765–8769/.test(st.calls()) && !/open /.test(st.calls()), st.calls().split('\n')[0].slice(0, 140));
  held.forEach(x => x.close());
}
await browser.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
