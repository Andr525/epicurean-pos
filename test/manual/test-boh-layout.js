/* TEST BUILD ONLY — "Import BOH Layout" for the owner test kit.
   Turns a BOH layout export (boh-layout-*.json from the read-only export button) — or a plain
   boh_shared/tables document — into the kit's mock boh_shared/tables document:
   - rooms: unchanged
   - roomObjs: the original numbered tables (table, stool, outdoor) and walls (wall, lshape, curve),
     every field and every coordinate unchanged. Booths, sideboards, bar counters, doors, plants,
     labels, zones and station boxes are left out of the POS view (the backup file keeps them).
   - stations: unchanged (ids, numbers, rooms, boxes, polygons, tableIds) except the assigned waiter,
     which is mapped to a fictional test employee (one fictional waiter per original waiter).
   Guest details and any PIN/credential fields are never copied in. No application code is changed. */
(function () {
  var SHOW_TABLE = {table: 1, stool: 1, outdoor: 1}, SHOW_WALL = {wall: 1, lshape: 1, curve: 1};
  var STRIP = ['serverCode', 'code', 'pin', 'passcode', 'password', 'pass', 'token', 'secret', 'apiKey',
    'guestName', 'guestId', 'guestPhone', 'phone', 'email', 'vip', 'notes', 'note', 'guestNote', 'turns', '_demoTurns'];
  var MAX_BYTES = 10 * 1024 * 1024;
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function strip(o) { STRIP.forEach(function (k) { delete o[k]; }); return o; }
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function byRoom(raw) {
    if (Array.isArray(raw)) return {main: raw};
    var out = {};
    Object.keys(raw).forEach(function (r) { var a = raw[r]; out[r] = Array.isArray(a) ? a : (a && typeof a === 'object' ? Object.keys(a).map(function (k) { return a[k]; }) : null); });
    return out;
  }
  function source(json) {
    if (json && json.format === 'epicurean-boh-layout-export') {
      if (json.version !== 1) return {error: 'This export file is from a newer version (' + json.version + ') of the export button.'};
      return {doc: json.published, meta: {exportedAt: json.exportedAt || '', page: (json.source && json.source.page) || ''}};
    }
    if (json && json.boh_shared && json.boh_shared.tables) return {doc: json.boh_shared.tables, meta: {}};
    if (json && json.rooms && json.roomObjs) return {doc: json, meta: {}};
    return {error: 'This is not a BOH layout file. Use the file downloaded with the "Export BOH layout" button (boh-layout-….json).'};
  }

  // fictional waiters: the kit's fictional servers first, then extra fictional waiters only if needed
  function waiterPool(staff) {
    return (staff || []).filter(function (p) { var j = (p.jobs && p.jobs[0] && p.jobs[0].code) || ''; return j === 'Food Master' || j === 'Server'; });
  }
  function extraWaiter(n, template, used) {
    var code = 3100 + n; while (used[String(code)]) code++;
    used[String(code)] = 1;
    var p = clone(template);
    p.id = 'hsx' + n; p.name = 'Test Waiter ' + n + ' (fictional)'; p.code = String(code);
    if (Array.isArray(p.rates)) p.rates.forEach(function (r) { r.id = 'r_' + p.id; });
    return p;
  }

  function prepare(text, fileName, staff) {
    var errors = [], warnings = [];
    if (typeof text !== 'string' || !text.length) return {ok: false, errors: ['The file is empty.']};
    if (text.length > MAX_BYTES) return {ok: false, errors: ['The file is too large to be a BOH layout (over 10 MB).']};
    var json;
    try { json = JSON.parse(text); } catch (e) { return {ok: false, errors: ['The file is not valid JSON (it may be damaged or incomplete).']}; }
    var src = source(json);
    if (src.error) return {ok: false, errors: [src.error]};
    var d = src.doc;
    if (!d || typeof d !== 'object') return {ok: false, errors: ['The file has no floor plan in it.']};
    // rooms
    var rooms = Array.isArray(d.rooms) ? d.rooms : null;
    if (!rooms || !rooms.length) errors.push('No rooms found.');
    var roomIds = {};
    (rooms || []).forEach(function (r, i) {
      if (!r || r.id === undefined || r.id === null || r.id === '') { errors.push('Room ' + (i + 1) + ' has no id.'); return; }
      if (roomIds[String(r.id)]) errors.push('Room id "' + r.id + '" appears twice.');
      roomIds[String(r.id)] = 1;
    });
    // objects
    if (!d.roomObjs || typeof d.roomObjs !== 'object') { errors.push('No room objects (tables and walls) found.'); return {ok: false, errors: errors}; }
    var objs = byRoom(d.roomObjs), bad = [], tables = 0, walls = 0, hidden = {}, seen = {}, dups = {};
    Object.keys(objs).forEach(function (r) {
      if (!Array.isArray(objs[r])) { bad.push('room "' + r + '" is not a list of objects'); return; }
      if (rooms && !roomIds[r] && objs[r].length) warnings.push('Objects for a room that is not in the room list ("' + r + '") are kept as they are.');
      objs[r].forEach(function (o, i) {
        var where = 'room "' + r + '", object ' + (i + 1);
        if (!o || typeof o !== 'object' || typeof o.type !== 'string') { bad.push(where + ' has no type'); return; }
        if (SHOW_TABLE[o.type] || SHOW_WALL[o.type]) {
          if (!num(o.x) || !num(o.y) || !num(o.w) || !num(o.h) || o.w <= 0 || o.h <= 0) { bad.push(where + ' (' + o.type + (o.num !== undefined ? ' ' + o.num : '') + ') is missing its position or size'); return; }
        }
        if (SHOW_TABLE[o.type]) {
          if (o.num === undefined || o.num === null || String(o.num).trim() === '') { bad.push(where + ' (' + o.type + ') has no table number'); return; }
          tables++;
          var k = String(o.num);
          if (seen[k]) dups[k] = 1;
          seen[k] = 1;
        } else if (SHOW_WALL[o.type]) walls++;
        else hidden[o.type] = (hidden[o.type] || 0) + 1;
      });
    });
    if (bad.length) errors.push('Incomplete objects: ' + bad.slice(0, 6).join('; ') + (bad.length > 6 ? ' … and ' + (bad.length - 6) + ' more' : '') + '.');
    if (!bad.length && !tables) errors.push('No numbered tables found.');
    if (Object.keys(dups).length) warnings.push('Table numbers used more than once: ' + Object.keys(dups).join(', ') + ' (the POS identifies tables by number).');
    // stations
    var stations = d.stations === undefined ? [] : d.stations;
    if (!Array.isArray(stations)) errors.push('Waiter stations are not a list.');
    else stations.forEach(function (s, i) {
      if (!s || s.id === undefined || s.id === null || s.id === '') errors.push('Waiter station ' + (i + 1) + ' has no id.');
      else if (s.tableIds !== undefined && !Array.isArray(s.tableIds)) errors.push('Waiter station ' + (s.number || s.id) + ' has an invalid table list.');
    });
    if (errors.length) return {ok: false, errors: errors};
    if (!stations.length) warnings.push('No waiter stations in this file: "My station" will have nothing to show.');

    // ---- build the mock boh_shared/tables document ----
    var outObjs = {};
    Object.keys(objs).forEach(function (r) {
      outObjs[r] = objs[r].filter(function (o) { return SHOW_TABLE[o.type] || SHOW_WALL[o.type]; }).map(function (o) { return strip(clone(o)); });
    });
    var sorted = stations.slice().sort(function (a, b) {
      var na = parseFloat(a.number), nb = parseFloat(b.number);
      if (isFinite(na) && isFinite(nb) && na !== nb) return na - nb;
      return String(a.id).localeCompare(String(b.id));
    });
    var pool = waiterPool(staff), used = {}, extra = [], assigned = {}, mapping = [];
    (staff || []).forEach(function (p) { used[String(p.code)] = 1; });
    function fictionalFor(key) {
      if (assigned[key]) return assigned[key];
      var i = Object.keys(assigned).length, p = pool[i];
      if (!p) { p = extraWaiter(i + 1, pool[0] || (staff || [])[0] || {jobs: [{code: 'Food Master', access: 'POS', rate: 18}]}, used); extra.push(p); }
      assigned[key] = p;
      return p;
    }
    var aliases = {}; // one original waiter = one key, whether a record names them by staff id or by name
    sorted.forEach(function (s) { if (s.serverId && s.server) aliases[String(s.server)] = String(s.serverId); });
    var outStations = sorted.map(function (s) {
      var c = strip(clone(s)), key = String(s.serverId || aliases[String(s.server || '')] || s.server || '');
      var label = 'Station ' + (s.number !== undefined && s.number !== null && s.number !== '' ? s.number : s.id);
      if (!key) { c.server = ''; c.serverId = ''; mapping.push({station: label, tables: (s.tableIds || []).length, waiter: '(no waiter assigned in BOH)'}); return c; }
      var p = fictionalFor(key);
      if (s.server) aliases[String(s.server)] = key;
      if (s.serverId) aliases[String(s.serverId)] = key;
      c.server = p.name; c.serverId = p.id; c.serverCode = String(p.code);
      mapping.push({station: label, tables: (s.tableIds || []).length, waiter: p.name + ' · PIN ' + p.code});
      return c;
    });
    var tableAssignments = 0;
    Object.keys(outObjs).forEach(function (r) {
      outObjs[r].forEach(function (o) {
        if (!SHOW_TABLE[o.type] || !o.server) return;
        var key = aliases[String(o.server)] || String(o.server);
        o.server = fictionalFor(key).name; tableAssignments++;
      });
    });
    var doc = {rooms: clone(rooms), roomObjs: outObjs, stations: outStations, updatedAt: Date.now()};
    return {ok: true, warnings: warnings, record: {
      importedAt: new Date().toISOString(), fileName: String(fileName || ''), exportedAt: src.meta.exportedAt || '', sourcePage: src.meta.page || '',
      summary: {rooms: rooms.length, tables: tables, walls: walls, stations: stations.length, tableAssignments: tableAssignments},
      hidden: hidden, mapping: mapping, warnings: warnings, doc: doc, extraStaff: extra
    }};
  }
  window.HLTEST_LAYOUT = {prepare: prepare, SHOW_TABLE: SHOW_TABLE, SHOW_WALL: SHOW_WALL};
})();
