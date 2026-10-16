// Offline acceptance helpers: real BOH page publishes into a CLEARLY IDENTIFIED in-memory
// mock Firestore; the real POS page then runs against those same documents.
// No network (all foreign requests aborted), no production Firebase, no payments.
import fs from 'node:fs';
import {resolve} from 'node:path';
import {transform, launch, openPage} from './serve.mjs';
export {launch};
const HERE = new URL('.', import.meta.url).pathname;
export const POS_ROOT = resolve(process.env.POS_ROOT || resolve(HERE, '../..'));
export const BOH_ROOT = resolve(process.env.BOH_ROOT || resolve(POS_ROOT, '../epicurean-boh'));
// CLEARLY IDENTIFIED MOCK card SDK: returns a fake token; no card data; nothing leaves the page.
export const MOCK_CARD_SDK = `<script>/* MOCK card SDK for offline tests: NOT Square, NOT a real authorization */window.Square={MOCK:true,payments:function(){return {card:function(){return Promise.resolve({attach:function(){return Promise.resolve();},tokenize:function(){window.__mockTokenized=(window.__mockTokenized||0)+1;return Promise.resolve({status:'OK',token:'MOCK-TOKEN-NOT-A-CARD'});},destroy:function(){return Promise.resolve();}});}};}};</script>`;
let port = 9700;

/** Boot the real BOH against an empty mock cloud, run BOH's own publish functions, return the docs. */
export async function exportBoh(browser, {ownerCode = 'EPICUREAN2024'} = {}) {
  const html = transform(fs.readFileSync(BOH_ROOT + '/index.html', 'utf8'));
  const o = await openPage(browser, {root: BOH_ROOT, html, origin: 'http://127.0.0.1:' + (port++)});
  const p = o.page;
  await p.waitForFunction(() => typeof STATE !== 'undefined' && typeof publishMenusToFrontOfHouse === 'function', null, {timeout: 30000});
  await p.waitForTimeout(1500);
  await p.locator('#mgr-code').fill(ownerCode); await p.locator('#mgr-go').click(); await p.waitForTimeout(600);
  const dump = await p.evaluate(async () => {
    await publishMenusToFrontOfHouse(); saveStaff(); saveGuests(); if (typeof saveBar === 'function') saveBar();
    await saveWines(); flushFloorCloud(); await _floorSaveChain; await new Promise(s => setTimeout(s, 400));
    return __MOCK_DB__.__dump();
  });
  await o.context.close();
  return dump;
}

export async function openPos(browser, {seed, extraHead = ''}) {
  const html = transform(fs.readFileSync(POS_ROOT + '/index.html', 'utf8'), {seed, extraHead});
  const o = await openPage(browser, {root: POS_ROOT, html, origin: 'http://127.0.0.1:' + (port++)});
  await o.page.waitForFunction(() => typeof STATE !== 'undefined', null, {timeout: 30000});
  await o.page.waitForTimeout(1000);
  return o;
}

export function ui(page) {
  const ev = (f, a) => page.evaluate(f, a);
  const api = {
    ev,
    async pin(code) { for (const k of code) await page.getByRole('button', {name: k, exact: true}).first().click(); await page.waitForTimeout(400); await api.toastGone(); },
    // A visible toast covers part of the screen (3 s); wait for it to clear like a person would.
    async toastGone() { await page.waitForFunction(() => { const t = document.getElementById('toast'); return !t || !t.classList.contains('show'); }, null, {timeout: 5000}).catch(() => {}); },
    async floor() {
      await api.closeOverlays();
      for (let i = 0; i < 4 && (await ev(() => STATE.activeTab)) !== 'tables'; i++) {
        const nav = page.locator('button[onclick="openTableService()"]:visible');
        if (await nav.count()) await nav.first().click(); else await page.locator('button[onclick="handheldBack()"]:visible').first().click();
        await page.waitForTimeout(400);
      }
    },
    async closeOverlays() { for (const re of [/^Back to order$/, /^← Order$/]) { const b = page.locator('button:visible').filter({hasText: re}); if (await b.count()) { await b.first().click(); await page.waitForTimeout(250); } } },
    async tapTable(n) { await page.locator('[class*="f-table"]').filter({hasText: new RegExp('^' + n + '$')}).first().click(); await page.waitForTimeout(500); },
    async seat(n, guests = 2) { await api.floor(); await api.tapTable(n); const g = page.locator(`button[onclick="chooseGuestCount(${guests})"]`); if (await g.count()) await g.click(); await page.waitForTimeout(400); },
    async openCategory(cat) { const plus = page.locator('button', {hasText: '+ Item'}); if (await plus.count()) await plus.first().click(); await page.waitForTimeout(150); await page.locator(`button[onclick*="filterCat('${cat}')"]`).first().click(); await page.waitForTimeout(300); },
    async tile(name) { await page.locator('[onclick*="beginAddItem"]:visible, [onclick*="86 — not available"]:visible').filter({hasText: name}).first().click(); await page.waitForTimeout(350); },
    async choose(label) { await page.getByRole('button', {name: label, exact: true}).first().click(); await page.waitForTimeout(200); },
    // Real tap; if another layer (e.g. the voice dock) covers the control, record it and dispatch the click.
    async tap(selector) { const l = page.locator(selector).first(); try { await l.click({timeout: 4000}); return 'tapped'; } catch (e) { const m = String(e.message).match(/<([^>]*)>[^\n]*intercepts pointer events/); await l.dispatchEvent('click'); await page.waitForTimeout(250); return 'covered by ' + (m ? m[0].slice(0, 70) : 'another element') + '; dispatched'; } },
    async chooseRe(re) { await page.getByRole('button', {name: re}).first().click(); await page.waitForTimeout(200); },
    async addToOrder() { const b = page.getByRole('button', {name: 'Add to order', exact: true}); if (!(await b.count())) throw Error('no "Add to order" button on the modifier sheet'); await b.first().click(); await page.waitForTimeout(300); },
    async sendAnyway() { const b = page.getByRole('button', {name: 'Send anyway'}); if (await b.count()) { await b.first().click(); await page.waitForTimeout(300); return true; } return false; },
    async send() { await page.locator('button[onclick="sendOrder({})"]:visible').first().click(); await page.waitForTimeout(600); },
    async selectLine(name) { await page.locator('.ts-line').filter({hasText: name}).first().locator('.pos-token').first().click(); await page.waitForTimeout(200); },
    async split() { await api.closeOverlays(); await page.locator('button[onclick="openSplitOverlay()"]:visible').first().click(); await page.waitForTimeout(350); },
    async closeSheets() { await ev(() => { try { closeSheet(); } catch (e) {} }); await page.waitForTimeout(150); },
    async pay({even = null, tip = null} = {}) {
      await api.closeOverlays(); await page.locator('button[onclick^="openPayment"]:visible').first().click(); await page.waitForTimeout(500);
      if (even) { await page.locator('#payment-card button', {hasText: '/' + even}).first().click(); await page.waitForTimeout(350); }
      if (tip) { await page.locator('.tip-btn', {hasText: tip}).first().click(); await page.waitForTimeout(150); }
      const screen = await ev(() => document.getElementById('payment-card').innerText.replace(/\s+/g, ' '));
      const label = await page.locator('#charge-btn').innerText();
      await page.locator('#charge-btn').click(); await page.waitForTimeout(1200);
      const after = await ev(() => document.getElementById('payment-card').innerText.replace(/\s+/g, ' '));
      const done = page.getByRole('button', {name: 'Done', exact: true}); if (await done.count()) { await done.first().click(); await page.waitForTimeout(400); }
      return {screen, label, after};
    },
    lines: () => ev(() => STATE.currentOrder.map(l => ({name: l.name, price: l.price, mods: l.selectedMod || '', seat: l.seat, owner: l.ownerCode || null, override: l.allergyOverride || null}))),
    checkItems: (cid) => ev(c => guestCheckItems(c).map(i => ({name: i.name, price: i.price, status: i.status, checkId: i.checkId})), cid),
    db: () => ev(() => __MOCK_DB__.__dump()),
    toast: () => ev(() => { const t = document.getElementById('toast'); return t ? t.innerText : ''; }),
    sheetText: () => ev(() => { const s = [...document.querySelectorAll('.sheet,.sheet-overlay,#sheet')].find(e => e.offsetParent && e.innerText.trim()); return s ? s.innerText.replace(/\s+/g, ' ').slice(0, 400) : ''; })
  };
  return api;
}
