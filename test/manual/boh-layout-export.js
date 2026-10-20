/* BOH layout export: READ-ONLY bookmark button (test kit tool; nothing in BOH is changed).
   Run it on the open Epicurean BOH page. It reads the floor plan BOH is showing (window.STATE) and the
   copy BOH keeps in this browser, and downloads them as one JSON file. It never writes to BOH, the
   browser's storage or Firebase, and makes no network request.
   "published" is built with BOH's own read-only helpers exactly as BOH builds boh_shared/tables when
   it saves the floor: rooms + physicalRoomObjs(STATE.roomObjs) + mergeStationSync(computeStations(), STATE.stations).
   Employee PINs/credentials and guest details (names, VIP flags, notes, reservations) are left out. */
(function () {
  var W = window, S = W.STATE;
  if (!S || typeof S !== 'object' || !S.roomObjs || !Array.isArray(S.rooms)) {
    W.alert('Export BOH layout\n\nOpen your Epicurean BOH page first (the one that shows Floor & Tables), then click this button again.\n\nNothing was changed.');
    return;
  }
  var DROP = {serverCode: 'credential', code: 'credential', pin: 'credential', passcode: 'credential', password: 'credential', pass: 'credential', token: 'credential', secret: 'credential', apiKey: 'credential',
    guestName: 'guest', guestId: 'guest', guestPhone: 'guest', phone: 'guest', email: 'guest', vip: 'guest', notes: 'guest', note: 'guest', guestNote: 'guest', turns: 'guest', _demoTurns: 'guest'};
  var removed = {};
  function clone(v) { return v === undefined ? null : JSON.parse(JSON.stringify(v)); }
  function scrub(v) {
    if (Array.isArray(v)) return v.map(scrub);
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).forEach(function (k) { if (DROP[k]) { removed[k] = (removed[k] || 0) + 1; return; } o[k] = scrub(v[k]); });
      return o;
    }
    return v;
  }
  function byRoom(raw) {
    if (Array.isArray(raw)) return {main: raw.slice()};
    var out = {};
    Object.keys(raw || {}).forEach(function (r) { var a = raw[r]; out[r] = Array.isArray(a) ? a.slice() : Object.keys(a || {}).map(function (k) { return a[k]; }); });
    return out;
  }
  function attempt(f, fallback) { try { return f(); } catch (e) { return fallback(); } }
  var editor = attempt(function () { return typeof W.stripDemoTurnsFromRooms === 'function' ? W.stripDemoTurnsFromRooms(S.roomObjs) : clone(byRoom(S.roomObjs)); }, function () { return clone(byRoom(S.roomObjs)); });
  var physical = attempt(function () { if (typeof W.physicalRoomObjs !== 'function') throw 0; return W.physicalRoomObjs(S.roomObjs); }, function () {
    var src = clone(byRoom(S.roomObjs)), out = {};
    Object.keys(src).forEach(function (r) { out[r] = src[r].filter(function (o) { return o && o.type !== 'waiterstation'; }); });
    return out;
  });
  var stations = attempt(function () { if (typeof W.computeStations !== 'function' || typeof W.mergeStationSync !== 'function') throw 0; return clone(W.mergeStationSync(W.computeStations(), S.stations)); }, function () { return clone(S.stations || []); });
  function saved(k) { try { var raw = W.localStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  var published = scrub({rooms: clone(S.rooms), roomObjs: clone(physical), stations: stations});
  var editorObjs = scrub(clone(editor));
  var savedCopy = scrub({eh_rooms: saved('eh_rooms'), eh_rooms_objs: saved('eh_rooms_objs'), eh_stations: saved('eh_stations')});
  var SEAT = {table: 1, stool: 1, outdoor: 1, couch: 1}, WALL = {wall: 1, lshape: 1, curve: 1};
  var types = {}, tables = 0, booths = 0, walls = 0, objects = 0;
  Object.keys(editorObjs).forEach(function (r) {
    (editorObjs[r] || []).forEach(function (o) {
      if (!o) return;
      objects++; types[o.type] = (types[o.type] || 0) + 1;
      if (o.type === 'couch') booths++; else if (SEAT[o.type]) tables++;
      if (WALL[o.type]) walls++;
    });
  });
  var now = new Date();
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes());
  var file = {
    format: 'epicurean-boh-layout-export', version: 1, exportedAt: now.toISOString(),
    source: {page: W.location.origin + W.location.pathname, title: W.document.title, method: 'Read-only bookmark button. Nothing in BOH, this browser or Firebase was changed.'},
    summary: {rooms: published.rooms.length, objects: objects, tables: tables, booths: booths, walls: walls, stations: (published.stations || []).length, objectTypes: types},
    removed: {fields: removed, note: 'Left out on purpose: employee PINs/credentials and guest details. Layout, geometry, numbers, seats, rooms and station assignments are complete.'},
    published: published,
    editorRoomObjs: editorObjs,
    savedCopy: savedCopy
  };
  var name = 'boh-layout-' + stamp + '.json';
  var url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], {type: 'application/json'}));
  var a = W.document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none';
  W.document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  W.alert('BOH layout exported (read-only)\n\nFile: ' + name + ' (in your Downloads folder)\n\n' +
    published.rooms.length + ' rooms · ' + tables + ' tables · ' + booths + ' booths · ' + walls + ' walls · ' + (published.stations || []).length + ' waiter stations\n\n' +
    'Employee PINs and guest details were left out. Nothing in BOH was changed.');
})();
