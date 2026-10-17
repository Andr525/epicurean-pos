/* TEST BUILD ONLY — CLEARLY IDENTIFIED MOCK CLOUD for owner manual testing. Not Firebase, not Square.
   - Mock Firestore/Auth/Storage with the same surface the POS uses. Data lives in this browser's
     localStorage (key HLTEST_MOCK_CLOUD_V1). Every tab of the same address is another "device" on the
     same mock cloud; changes made in one tab are delivered to the others.
   - MOCK card SDK: tokenize() returns a fake token. No card data is collected or sent anywhere.
   - Test panel ("TEST" tab on the right edge): fictional logins, failure simulation, data reset.
   Nothing here talks to the network; the page also carries a connect-src 'none' policy. */
(function () {
  var KEY = 'HLTEST_MOCK_CLOUD_V1', FAULT_KEY = 'HLTEST_FAULT', TOKEN_KEY = 'HLTEST_TOKENS';
  var listeners = [], auto = 0;
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x, function (k, v) { return v && v._mockFV === 'serverTimestamp' ? new Date().toISOString() : v; })); }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    return clone(window.__POS_TEST_SEED__ || {}) || {};
  }
  var store = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { console.error('MOCK cloud save failed', e); } }
  if (!localStorage.getItem(KEY)) save();
  function col(c) { return store[c] || (store[c] = {}); }
  function docSnap(c, id) { var d = col(c)[id]; return {id: id, exists: d !== undefined, data: function () { return clone(d); }}; }
  function match(d, w) { if (!w) return true; var v = d[w.f]; return w.op === '==' ? v === w.v : true; }
  function qSnap(c, w) { var docs = Object.keys(col(c)).filter(function (id) { return match(col(c)[id], w); }).map(function (id) { return docSnap(c, id); }); return {docs: docs, size: docs.length, empty: !docs.length, forEach: function (f) { docs.forEach(f); }}; }
  function notify(c) { setTimeout(function () { listeners.forEach(function (l) { if (c && l.c !== c) return; try { l.id ? l.cb(docSnap(l.c, l.id)) : l.cb(qSnap(l.c, l.w)); } catch (e) { console.error(e); } }); }, 0); }
  // Another tab (device) changed the mock cloud: reload it and deliver the change to this device.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { if (e.newValue === null) { location.reload(); return; } try { store = JSON.parse(e.newValue); } catch (x) {} notify(null); }
  });
  // ---- failure simulation (this device only) ----
  function fault() { try { return JSON.parse(sessionStorage.getItem(FAULT_KEY) || 'null'); } catch (e) { return null; } }
  function setFault(f) { if (f) sessionStorage.setItem(FAULT_KEY, JSON.stringify(f)); else sessionStorage.removeItem(FAULT_KEY); paint(); }
  function refused(kind) { return Promise.reject(Object.assign(Error('MOCK: ' + kind + ' refused (simulated test failure)'), {code: 'unavailable'})); }
  function writeBlocked(c) { var f = fault(); if (!f) return false; if (f.mode === 'offline') return true; if (f.armed && f.blocks && f.blocks.indexOf(c) > -1) return true; if (f.mode === 'send' && c === 'orders') return true; return false; }
  function readBlocked() { var f = fault(); return !!(f && f.mode === 'offline'); }
  function afterWrite(c) { var f = fault(); if (f && f.mode === 'after-payment' && c === 'payments' && !f.armed) { f.armed = true; setFault(f); } }
  function ref(c, id) {
    return {id: id,
      set: function (data, opts) { if (writeBlocked(c)) return refused('write'); var prev = col(c)[id], merge = opts && opts.merge; col(c)[id] = merge && prev ? Object.assign(clone(prev), clone(data)) : clone(data); save(); notify(c); afterWrite(c); return Promise.resolve(); },
      update: function (data) { if (writeBlocked(c)) return refused('write'); col(c)[id] = Object.assign(col(c)[id] || {}, clone(data)); save(); notify(c); return Promise.resolve(); }, // same semantics as the mock the approved tests used
      get: function () { if (readBlocked()) return refused('read'); return Promise.resolve(docSnap(c, id)); },
      onSnapshot: function (cb) { var l = {c: c, id: id, cb: cb}; listeners.push(l); setTimeout(function () { cb(docSnap(c, id)); }, 0); return function () { var i = listeners.indexOf(l); if (i > -1) listeners.splice(i, 1); }; }};
  }
  function whereQ(c, w) { return {onSnapshot: function (cb) { var l = {c: c, w: w, cb: cb}; listeners.push(l); setTimeout(function () { cb(qSnap(c, w)); }, 0); return function () { var i = listeners.indexOf(l); if (i > -1) listeners.splice(i, 1); }; }}; }
  var db = {collection: function (c) {
    return {
      doc: function (id) { return ref(c, id || ('mock' + Date.now().toString(36) + (++auto))); },
      add: function (data) { var id = 'mock_' + Date.now().toString(36) + (++auto); return ref(c, id).set(data).then(function () { return docSnap(c, id); }); },
      get: function () { if (readBlocked()) return refused('read'); return Promise.resolve(qSnap(c)); },
      where: function (f, op, v) { return whereQ(c, {f: f, op: op, v: v}); },
      onSnapshot: function (cb) { var l = {c: c, cb: cb}; listeners.push(l); setTimeout(function () { cb(qSnap(c)); }, 0); return function () { var i = listeners.indexOf(l); if (i > -1) listeners.splice(i, 1); }; }
    };
  }, __dump: function () { return clone(store); }, MOCK: true};
  window.__MOCK_DB__ = db;
  var FieldValue = {serverTimestamp: function () { return {_mockFV: 'serverTimestamp'}; }, delete: function () { return undefined; }, arrayUnion: function () { return [].slice.call(arguments); }, increment: function (n) { return n; }};
  var user = {uid: 'MOCK-TEST-DEVICE', isAnonymous: true, getIdToken: function () { return Promise.resolve('MOCK-TOKEN'); }};
  var auth = {currentUser: user, signInAnonymously: function () { return Promise.resolve({user: user}); }, onAuthStateChanged: function (cb) { setTimeout(function () { cb(user); }, 0); return function () {}; }, signOut: function () { return Promise.resolve(); }};
  var fs = function () { return db; }; fs.FieldValue = FieldValue;
  window.firebase = {MOCK: true, initializeApp: function () { return {name: 'MOCK-TEST'}; }, firestore: fs, auth: function () { return auth; },
    storage: function () { return {ref: function () { return {put: function () { return Promise.reject(Error('MOCK storage: uploads disabled in the test build')); }, child: function () { return this; }, getDownloadURL: function () { return Promise.reject(Error('MOCK storage')); }}; }}; }};
  // ---- MOCK card SDK (stands in for Square's script, which is removed from the test build) ----
  function tokens() { return Number(sessionStorage.getItem(TOKEN_KEY) || 0); }
  window.Square = {MOCK: true, payments: function () { return {card: function () { return Promise.resolve({
    attach: function (sel) { var el = document.querySelector(sel); if (el) el.innerHTML = '<div style="padding:10px;border:1px dashed #d9a441;border-radius:8px;color:#d9a441;font-size:13px">TEST CARD — no card needed. The mock card is approved; nothing is charged.</div>'; return Promise.resolve(); },
    tokenize: function () { sessionStorage.setItem(TOKEN_KEY, String(tokens() + 1)); window.__mockTokenized = tokens(); paint(); return Promise.resolve({status: 'OK', token: 'MOCK-TOKEN-NOT-A-CARD'}); },
    destroy: function () { return Promise.resolve(); }}); }}; }};

  // ---- Test panel ----
  var panel, open = false, TOP_KEY = 'HLTEST_TAB_TOP';
  function tabTop() { var t = Number(localStorage.getItem(TOP_KEY)); return isFinite(t) && t > 40 ? Math.min(t, window.innerHeight - 120) : Math.round(window.innerHeight * 0.42); }
  // The TEST tab sits on the right edge and can be dragged up/down so it never covers a POS control.
  function dragTab(ev) {
    var startY = ev.clientY, startTop = tabTop(), moved = false;
    function mv(e) { var y = startTop + (e.clientY - startY); if (Math.abs(e.clientY - startY) > 6) moved = true; if (moved) { panel.style.top = Math.max(50, Math.min(window.innerHeight - 120, y)) + 'px'; } }
    function up() { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); if (moved) { localStorage.setItem(TOP_KEY, parseInt(panel.style.top, 10)); } else window.HLTEST.toggle(); }
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); ev.preventDefault();
  }
  function staffRows() { var s = (store.boh_shared && store.boh_shared.staff_clock && store.boh_shared.staff_clock.list) || []; return s.map(function (p) { return '<tr><td>' + p.name + '</td><td style="font-weight:700">' + p.code + '</td><td>' + ((p.jobs && p.jobs[0] && p.jobs[0].code) || '') + '</td></tr>'; }).join(''); }
  function faultText() { var f = fault(); if (!f) return 'none'; if (f.mode === 'offline') return 'CLOUD OFFLINE (reads and writes fail)'; if (f.mode === 'send') return 'Kitchen SEND fails (ticket writes refused)'; if (f.mode === 'after-payment') return (f.armed ? 'ACTIVE: ' : 'Armed for next payment: ') + (f.blocks.indexOf('checks') > -1 ? 'check write fails' : 'ticket write fails'); return 'none'; }
  function btn(label, js, danger) { return '<button type="button" onclick="' + js + '" style="display:block;width:100%;margin:4px 0;padding:8px;border-radius:8px;border:1px solid ' + (danger ? '#c66' : '#555') + ';background:' + (danger ? '#4a1d1d' : '#2a2a2a') + ';color:#fff;font-size:13px;text-align:left">' + label + '</button>'; }
  function paint() {
    if (!document.body) return;
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'hltest-panel';
      panel.style.cssText = 'position:fixed;right:0;z-index:10050;font:13px -apple-system,system-ui,sans-serif;color:#fff;';
      document.body.appendChild(panel);
    }
    panel.style.top = (open ? 60 : tabTop()) + 'px';
    if (!open) { panel.innerHTML = '<button type="button" id="hltest-tab" title="Test panel (drag up/down to move)" style="writing-mode:vertical-rl;background:#d9a441;color:#111;border:0;border-radius:8px 0 0 8px;padding:10px 3px;font-weight:800;letter-spacing:1px;opacity:.9;touch-action:none">TEST</button>'; panel.querySelector('#hltest-tab').addEventListener('pointerdown', dragTab); return; }
    panel.innerHTML = '<div style="width:300px;max-height:80vh;overflow:auto;background:#161616;border:1px solid #d9a441;border-right:0;border-radius:12px 0 0 12px;padding:12px;box-shadow:0 8px 24px rgba(0,0,0,.6)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><b style="color:#d9a441">TEST MODE</b><button type="button" onclick="HLTEST.toggle()" style="background:none;border:0;color:#fff;font-size:18px">✕</button></div>' +
      '<div style="opacity:.8;margin:4px 0 8px">Harbor Lane Bistro — fictional data · mock cloud in this browser · mock card (nothing is charged)</div>' +
      '<b>Test logins (PIN)</b><table style="width:100%;margin:4px 0 8px;border-collapse:collapse">' + staffRows() + '</table>' +
      '<b>This device</b><div style="margin:2px 0 6px">Simulated failure: <span style="color:#ffcf70">' + faultText() + '</span><br>Mock card authorizations on this device: ' + tokens() + '</div>' +
      btn('➕ Open another device (new tab)', 'HLTEST.newDevice()') +
      btn('💳 Next payment: check write fails', "HLTEST.fault('checks')") +
      btn('🎫 Next payment: ticket write fails', "HLTEST.fault('orders')") +
      btn('🍳 Kitchen SEND fails', "HLTEST.fault('send')") +
      btn('📴 Cloud offline', "HLTEST.fault('offline')") +
      btn('✅ Clear simulated failure', 'HLTEST.fault(null)') +
      btn('⬇ Download mock database (JSON)', 'HLTEST.download()') +
      btn('↺ Reset all test data', 'HLTEST.reset()', true) + '</div>';
  }
  window.HLTEST = {
    toggle: function () { open = !open; paint(); },
    fault: function (k) { setFault(k === null ? null : k === 'offline' ? {mode: 'offline'} : k === 'send' ? {mode: 'send'} : {mode: 'after-payment', blocks: [k], armed: false}); },
    newDevice: function () { window.open(location.href.split('#')[0], '_blank'); },
    download: function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(store, null, 2)], {type: 'application/json'})); a.download = 'harbor-lane-mock-db-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500); },
    reset: function () {
      if (!window.confirm('Reset ALL test data? Every test check, ticket and payment in this browser goes back to the starting sample data.')) return;
      try { Object.keys(localStorage).forEach(function (k) { if (k === KEY || /^eh_/.test(k)) localStorage.removeItem(k); }); sessionStorage.clear(); } catch (e) {}
      location.reload();
    }
  };
  // The approved POS always adds its built-in staff list (SEED_STAFF) to the login roster. In the test
  // build that data list holds the fictional employees instead (same login logic, fictional people).
  function fictionalSeedStaff() {
    if (!Array.isArray(window.SEED_STAFF)) return;
    var list = ((store.boh_shared && store.boh_shared.staff_clock && store.boh_shared.staff_clock.list) || []).map(function (p) { return {code: String(p.code), name: p.name, role: (p.jobs && p.jobs[0] && p.jobs[0].code) || ''}; });
    window.SEED_STAFF.splice.apply(window.SEED_STAFF, [0, window.SEED_STAFF.length].concat(list));
  }
  document.addEventListener('DOMContentLoaded', function () { fictionalSeedStaff(); document.title = 'TEST · ' + document.title; paint(); });
})();
