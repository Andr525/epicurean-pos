// Local in-memory Firestore REST stand-in for offline pipeline tests.
// Listens on 127.0.0.1 only. It does not open a socket to Google.
import http from 'node:http';

const PROJECT = 'epicurean-house-at-the-choc-st';
const DATABASE = 'default';

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (!isFinite(value)) return { doubleValue: 0 };
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value) } };
  return { stringValue: String(value) };
}

function encodeFields(object) {
  const fields = {};
  Object.keys(object || {}).forEach((key) => {
    if (object[key] !== undefined) fields[key] = encodeValue(object[key]);
  });
  return fields;
}

function decodeValue(value) {
  if (!value) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;
  if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) return (value.arrayValue.values || []).map(decodeValue);
  if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) {
    const map = {};
    Object.keys(value.mapValue.fields || {}).forEach((key) => {
      map[key] = decodeValue(value.mapValue.fields[key]);
    });
    return map;
  }
  return null;
}

function decodeFields(fields) {
  const result = {};
  Object.keys(fields || {}).forEach((key) => { result[key] = decodeValue(fields[key]); });
  return result;
}

function docName(collection, id) {
  return `projects/${PROJECT}/databases/${DATABASE}/documents/${collection}/${id}`;
}

function compareId(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function startFakeFirestore() {
  const docs = new Map();
  const requests = [];
  const gates = [];
  const faults = [];
  let block = null;
  let server;

  function keyOf(collection, id) {
    return collection + '\n' + id;
  }

  function idsOf(collection) {
    const prefix = collection + '\n';
    const ids = [];
    for (const key of docs.keys()) {
      if (key.startsWith(prefix)) ids.push(key.slice(prefix.length));
    }
    ids.sort(compareId);
    return ids;
  }

  function put(collection, id, data) {
    docs.set(keyOf(collection, id), data == null ? {} : structuredClone(data));
  }

  function read(collection, id) {
    const value = docs.get(keyOf(collection, id));
    return value === undefined ? null : structuredClone(value);
  }

  function listAll(collection) {
    return idsOf(collection).map((id) => ({ id, data: read(collection, id) }));
  }

  function reset() {
    docs.clear();
    requests.length = 0;
    gates.length = 0;
    faults.length = 0;
    block = null;
  }

  function failNext(count, kind) {
    const n = Math.max(0, Number(count) || 0);
    for (let i = 0; i < n; i++) faults.push(kind);
  }

  function holdGets(match, until) {
    const gate = { match, until, waiters: [], done: false, arrived: 0 };
    gates.push(gate);
    return gate;
  }

  function releaseAll() {
    for (const gate of gates) {
      gate.done = true;
      const waiters = gate.waiters.splice(0);
      waiters.forEach((fn) => fn());
    }
  }

  function parseTarget(url) {
    const marker = '/documents/';
    const at = url.pathname.indexOf(marker);
    if (at < 0) return null;
    const rest = url.pathname.slice(at + marker.length).split('/').filter(Boolean).map(decodeURIComponent);
    if (!rest.length) return { kind: 'root' };
    if (rest.length === 1) return { kind: 'collection', collection: rest[0] };
    return { kind: 'document', collection: rest[0], id: rest.slice(1).join('/') };
  }

  function sendJson(res, status, body) {
    const raw = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(raw);
  }

  function errorBody(status, httpStatus) {
    return { error: { code: httpStatus, message: status, status } };
  }

  async function waitGate(req) {
    const gate = gates.find((item) => !item.done && item.match(req));
    if (!gate) return;
    gate.arrived += 1;
    if (gate.arrived >= gate.until) {
      gate.done = true;
      const waiters = gate.waiters.splice(0);
      setImmediate(() => waiters.forEach((fn) => fn()));
      return;
    }
    await new Promise((resolve) => gate.waiters.push(resolve));
  }

  function applyPatch(current, fields, mask) {
    const decoded = decodeFields(fields);
    if (!mask) return decoded;
    const next = current ? structuredClone(current) : {};
    mask.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(decoded, field)) next[field] = decoded[field];
      else delete next[field];
    });
    return next;
  }

  const listener = (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '600'
      });
      res.end();
      return;
    }
    const target = parseTarget(url);
    const entry = { method: req.method, path: url.pathname, query: url.search, at: Date.now() };
    requests.push(entry);
    req.on('error', () => {});
    if (!target || !url.pathname.includes('/v1/projects/')) {
      sendJson(res, 404, errorBody('NOT_FOUND', 404));
      return;
    }
    if (faults.length) {
      const fault = faults.shift();
      entry.fault = String(fault);
      if (fault === 'drop') {
        req.socket.on('error', () => {});
        req.socket.destroy();
        return;
      }
      if (fault === 'hang') return;
      if (fault === 429 || fault === '429') {
        sendJson(res, 429, { error: { code: 429, message: 'Quota exceeded.', status: 'RESOURCE_EXHAUSTED' } });
        return;
      }
      if (fault === 401 || fault === '401') {
        sendJson(res, 401, { error: { code: 401, message: 'Request had invalid authentication credentials.', status: 'UNAUTHENTICATED' } });
        return;
      }
      if (fault === 500 || fault === '500') {
        sendJson(res, 500, { error: { code: 500, message: 'Internal error', status: 'INTERNAL' } });
        return;
      }
    }

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      (async () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let body = {};
        if (raw) {
          try { body = JSON.parse(raw); } catch { body = {}; }
        }
        const described = {
          method: req.method,
          kind: target.kind,
          collection: target.collection || '',
          id: target.id || '',
          documentId: url.searchParams.get('documentId') || ''
        };
        if (block && block(described)) {
          entry.blocked = true;
          req.socket.destroy();
          return;
        }
        await waitGate(described);

        if (target.kind === 'collection' && req.method === 'GET') {
          const pageSize = Math.max(1, Number(url.searchParams.get('pageSize')) || 1000);
          const pageToken = url.searchParams.get('pageToken') || '';
          let ids = idsOf(target.collection);
          if (pageToken) ids = ids.filter((id) => compareId(id, pageToken) > 0);
          const page = ids.slice(0, pageSize);
          const documents = page.map((id) => ({
            name: docName(target.collection, id),
            fields: encodeFields(read(target.collection, id))
          }));
          const payload = { documents };
          if (ids.length > page.length) payload.nextPageToken = page[page.length - 1];
          sendJson(res, 200, payload);
          return;
        }

        if (target.kind === 'collection' && req.method === 'POST') {
          const id = url.searchParams.get('documentId');
          if (!id) {
            sendJson(res, 400, errorBody('INVALID_ARGUMENT', 400));
            return;
          }
          if (docs.has(keyOf(target.collection, id))) {
            sendJson(res, 409, errorBody('ALREADY_EXISTS', 409));
            return;
          }
          const data = decodeFields(body.fields || {});
          put(target.collection, id, data);
          sendJson(res, 200, { name: docName(target.collection, id), fields: encodeFields(data) });
          return;
        }

        if (target.kind === 'document' && req.method === 'GET') {
          const data = read(target.collection, target.id);
          if (!data) {
            sendJson(res, 404, errorBody('NOT_FOUND', 404));
            return;
          }
          sendJson(res, 200, { name: docName(target.collection, target.id), fields: encodeFields(data) });
          return;
        }

        if (target.kind === 'document' && req.method === 'PATCH') {
          const mask = url.searchParams.getAll('updateMask.fieldPaths');
          const existing = read(target.collection, target.id);
          // Masked PATCH is what both set({merge:true}) and update() send.
          // Merge-create matches set({merge:true}). update() in these apps
          // is only issued after a get that already found the document.
          const next = applyPatch(existing, body.fields || {}, mask.length ? mask : null);
          put(target.collection, target.id, next);
          sendJson(res, 200, { name: docName(target.collection, target.id), fields: encodeFields(next) });
          return;
        }

        sendJson(res, 405, errorBody('UNIMPLEMENTED', 405));
      })().catch((error) => {
        if (!res.headersSent) sendJson(res, 500, errorBody(String(error && error.message || error), 500));
      });
    });
  };

  server = http.createServer(listener);
  server.on('clientError', (_err, socket) => { if (socket && !socket.destroyed) socket.destroy(); });
  server.listen(0, '127.0.0.1');
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', () => {
      const address = server.address();
      const origin = `http://127.0.0.1:${address.port}`;
      const root = `${origin}/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;
      resolve({
        origin,
        root,
        port: address.port,
        requests,
        put,
        get: read,
        list: listAll,
        count(collection) { return idsOf(collection).length; },
        reset,
        block(predicate) { block = predicate; },
        unblock() { block = null; },
        failNext,
        holdGets,
        releaseAll,
        close() {
          releaseAll();
          if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
          return new Promise((done) => server.close(() => done()));
        }
      });
    });
  });
}

export function selfCheckFakeFirestore(fake) {
  fake.reset();
  fake.put('orders', 'b', { n: 2 });
  fake.put('orders', 'a', { n: 1 });
  fake.put('orders', 'c', { n: 3 });
  const ids = fake.list('orders').map((doc) => doc.id);
  if (ids.join(',') !== 'a,b,c') throw new Error('list order is not document id order: ' + ids.join(','));
  return fake;
}
