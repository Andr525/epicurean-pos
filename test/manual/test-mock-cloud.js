/* TEST BUILD ONLY — CLEARLY IDENTIFIED MOCK CLOUD for owner manual testing. Not Firebase, not Square.
   - Mock Firestore/Auth/Storage with the same surface the POS uses. Data lives in this browser's
     localStorage (key HLTEST_MOCK_CLOUD_V1). Every tab of the same address is another "device" on the
     same mock cloud; changes made in one tab are delivered to the others.
   - MOCK card SDK: tokenize() returns a fake token. No card data is collected or sent anywhere.
   - Test panel ("TEST" tab on the right edge): fictional logins, failure simulation, data reset.
   Nothing here talks to the network; the page also carries a connect-src 'none' policy. */
(function () {
  var KEY = 'HLTEST_MOCK_CLOUD_V1', FAULT_KEY = 'HLTEST_FAULT', TOKEN_KEY = 'HLTEST_TOKENS';
  // Imported original BOH floor plan (see test-boh-layout.js). Kept across "Reset all test data".
  var LAYOUT_KEY = 'HLTEST_BOH_LAYOUT_V1', POS_LAYOUT_CACHES = ['eh_pos_layout_v41', 'eh_pos_layout_live', 'eh_pos_table_combines'];
  var listeners = [], auto = 0;
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x, function (k, v) { return v && v._mockFV === 'serverTimestamp' ? new Date().toISOString() : v; })); }
  function layoutRecord() { try { var raw = localStorage.getItem(LAYOUT_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  // Floor plan + station waiters come from the imported layout; every other document stays fictional.
  function applyLayout(s, rec) {
    var seed = window.__POS_TEST_SEED__ || {}, sb = seed.boh_shared || {};
    s.boh_shared = s.boh_shared || {};
    s.boh_shared.tables = clone(rec ? rec.doc : sb.tables);
    var staff = clone((sb.staff_clock && sb.staff_clock.list) || []);
    if (rec && rec.extraStaff) staff = staff.concat(clone(rec.extraStaff));
    s.boh_shared.staff_clock = Object.assign({}, s.boh_shared.staff_clock || {}, {list: staff, updatedAt: Date.now()});
    return s;
  }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    var fresh = clone(window.__POS_TEST_SEED__ || {}) || {}, rec = layoutRecord();
    return rec ? applyLayout(fresh, rec) : fresh;
  }
  var store = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { console.error('MOCK cloud save failed', e); } }
  try { if (!localStorage.getItem(KEY)) save(); } catch (e) { console.error('MOCK cloud: browser storage unavailable', e); }
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
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  var pending = null; // {record, warnings} awaiting Apply, or {errors}
  var armed = '', note = ''; // two-tap confirmation inside the panel (some hosts block window.confirm)
  function fromMac() { var m = window.__BOH_LAYOUT_FROM_MAC__; return m && typeof m.text === 'string' ? m : null; }
  function layoutHtml() {
    var rec = layoutRecord(), mac = fromMac(), h = '<b>Floor plan</b><div style="margin:2px 0 6px">';
    if (rec) h += '<span style="color:#7fe08f">ORIGINAL BOH layout</span> · ' + esc(rec.fileName || 'imported file') + '<br>' + rec.summary.rooms + ' rooms · ' + rec.summary.tables + ' tables · ' + rec.summary.walls + ' walls · ' + rec.summary.stations + ' stations';
    else if (window.__POS_TEST_SEED__ && window.__POS_TEST_SEED__.__builtInLayout) { var bl = window.__POS_TEST_SEED__.__builtInLayout; h += '<span style="color:#7fe08f">ORIGINAL BOH layout (built in)</span> · ' + esc(bl.label) + '<br>' + bl.summary.rooms + ' rooms · ' + bl.summary.tables + ' tables · ' + bl.summary.walls + ' walls · ' + bl.summary.stations + ' stations' + (bl.mapping && bl.mapping.length ? '<br>' + bl.mapping.map(function (m) { return esc(m.station) + ' → ' + esc(m.waiter); }).join('<br>') : ''); }
    else h += '<span style="color:#ffcf70">Fictional sample floor plan</span> (import your BOH layout below)';
    h += '</div>';
    if (pending && pending.errors) {
      h += '<div style="border:1px solid #c66;border-radius:8px;padding:8px;margin:4px 0;background:#3a1717"><b>File rejected — nothing was changed</b><ul style="margin:4px 0;padding-left:18px">' +
        pending.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' + btn('OK', 'HLTEST.layoutCancel()') + '</div>';
    } else if (pending) {
      var r = pending.record, hid = Object.keys(r.hidden).map(function (k) { return r.hidden[k] + ' ' + k; }).join(', ');
      h += '<div id="hltest-layout-review" style="border:1px solid #d9a441;border-radius:8px;padding:8px;margin:4px 0;background:#262012"><b>Check before applying</b><br>' + esc(r.fileName) +
        '<div style="margin:4px 0;font-size:15px"><b>' + r.summary.rooms + '</b> rooms · <b>' + r.summary.tables + '</b> tables · <b>' + r.summary.stations + '</b> stations · ' + r.summary.walls + ' walls</div>' +
        (hid ? '<div style="opacity:.8">Not drawn in the POS: ' + esc(hid) + '</div>' : '') +
        (r.mapping.length ? '<div style="margin-top:4px">Stations → fictional waiters:<br>' + r.mapping.map(function (m) { return esc(m.station) + ' (' + m.tables + ' tables) → ' + esc(m.waiter); }).join('<br>') + '</div>' : '') +
        (pending.warnings.length ? '<div style="color:#ffcf70;margin-top:4px">' + pending.warnings.map(esc).join('<br>') + '</div>' : '') +
        btn('✅ Apply this floor plan', 'HLTEST.layoutApply()') + btn('Cancel', 'HLTEST.layoutCancel()') + '</div>';
    } else {
      if (mac) h += btn('📐 Use BOH layout from the Mac (' + esc(mac.name) + ')', 'HLTEST.layoutFromMac()');
      h += btn('📐 Import BOH Layout (choose file)', 'HLTEST.layoutPick()');
      if (rec) h += btn(armed === 'remove' ? '⚠ Tap again to remove the imported layout' : 'Remove imported layout (back to fictional)', 'HLTEST.layoutRemove()', armed === 'remove');
    }
    return h;
  }
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
      layoutHtml() +
      '<b>Test logins (PIN)</b><table style="width:100%;margin:4px 0 8px;border-collapse:collapse">' + staffRows() + '</table>' +
      '<b>This device</b><div style="margin:2px 0 6px">Simulated failure: <span style="color:#ffcf70">' + faultText() + '</span><br>Mock card authorizations on this device: ' + tokens() + '</div>' +
      btn('➕ Open another device (new tab)', 'HLTEST.newDevice()') + (note ? '<div style="color:#ffcf70;margin:2px 0 6px">' + esc(note) + '</div>' : '') +
      btn('💳 Next payment: check write fails', "HLTEST.fault('checks')") +
      btn('🎫 Next payment: ticket write fails', "HLTEST.fault('orders')") +
      btn('🍳 Kitchen SEND fails', "HLTEST.fault('send')") +
      btn('📴 Cloud offline', "HLTEST.fault('offline')") +
      btn('✅ Clear simulated failure', 'HLTEST.fault(null)') +
      btn('⬇ Download mock database (JSON)', 'HLTEST.download()') +
      btn(armed === 'reset' ? '⚠ Tap again to reset ALL test data' + (layoutRecord() ? ' (imported floor plan kept)' : '') : '↺ Reset all test data', 'HLTEST.reset()', true) + '</div>';
  }
  window.HLTEST = {
    toggle: function () { open = !open; paint(); },
    fault: function (k) { setFault(k === null ? null : k === 'offline' ? {mode: 'offline'} : k === 'send' ? {mode: 'send'} : {mode: 'after-payment', blocks: [k], armed: false}); },
    newDevice: function () { var w = null; try { w = window.open(location.href.split('#')[0], '_blank'); } catch (e) {} note = w ? '' : 'Open this same link in another browser tab: each tab is another POS device.'; paint(); },
    download: function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(store, null, 2)], {type: 'application/json'})); a.download = 'harbor-lane-mock-db-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500); },
    layoutPick: function () {
      var inp = document.getElementById('hltest-layout-file');
      if (!inp) {
        inp = document.createElement('input'); inp.type = 'file'; inp.id = 'hltest-layout-file'; inp.accept = '.json,application/json'; inp.style.cssText = 'position:fixed;left:-1000px;top:0;opacity:0'; // not display:none (iOS Safari)
        inp.addEventListener('change', function () {
          var f = inp.files && inp.files[0]; if (!f) return;
          var rd = new FileReader();
          rd.onload = function () { window.HLTEST.layoutCheck(String(rd.result || ''), f.name); inp.value = ''; };
          rd.onerror = function () { pending = {errors: ['The file could not be read.']}; paint(); inp.value = ''; };
          rd.readAsText(f);
        });
        document.body.appendChild(inp);
      }
      inp.click();
    },
    layoutFromMac: function () { var m = fromMac(); if (m) window.HLTEST.layoutCheck(m.text, m.name); },
    layoutCheck: function (text, name) {
      var staff = (window.__POS_TEST_SEED__ && window.__POS_TEST_SEED__.boh_shared && window.__POS_TEST_SEED__.boh_shared.staff_clock && window.__POS_TEST_SEED__.boh_shared.staff_clock.list) || [];
      var res = window.HLTEST_LAYOUT ? window.HLTEST_LAYOUT.prepare(text, name, staff) : {ok: false, errors: ['Layout import is not available in this build.']};
      pending = res.ok ? {record: res.record, warnings: res.warnings} : {errors: res.errors};
      open = true; paint();
    },
    layoutCancel: function () { pending = null; paint(); },
    layoutApply: function () {
      if (!pending || !pending.record) return;
      try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(pending.record)); } catch (e) { pending = {errors: ['This browser could not store the floor plan (storage full or blocked).']}; paint(); return; }
      applyLayout(store, pending.record); save(); notify(null);
      POS_LAYOUT_CACHES.forEach(function (k) { localStorage.removeItem(k); }); // this device's copy of the old floor plan
      location.reload();
    },
    layoutRemove: function () {
      if (armed !== 'remove') { armed = 'remove'; paint(); return; }
      armed = '';
      localStorage.removeItem(LAYOUT_KEY);
      applyLayout(store, null); save(); notify(null);
      POS_LAYOUT_CACHES.forEach(function (k) { localStorage.removeItem(k); });
      location.reload();
    },
    reset: function () {
      if (armed !== 'reset') { armed = 'reset'; paint(); return; }
      armed = '';
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
