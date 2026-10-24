// Offline checks for firestore-adapter.js. The fake server listens on
// 127.0.0.1 only. Nothing in this file contacts live Firestore.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startFakeFirestore } from './fake-firestore.mjs';

const source = fs.readFileSync(new URL('../firestore-adapter.js', import.meta.url), 'utf8');
const results = [];

function record(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      results.push({ name, pass: true });
      console.log('PASS ' + name);
    })
    .catch((error) => {
      results.push({ name, pass: false, error });
      console.log('FAIL ' + name + ' :: ' + (error && error.stack || error));
    });
}

const realSetTimeout = global.setTimeout;
const realClearTimeout = global.clearTimeout;

function sleep(ms) {
  return new Promise((resolve) => realSetTimeout(resolve, ms));
}

function localDate(year, month, day, hour, minute) {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function businessDayStartMs(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5, 0, 0, 0);
  if (now.getTime() < start.getTime()) start.setDate(start.getDate() - 1);
  return start.getTime();
}

function installClock(fixed) {
  const RealDate = global.Date;
  function MockDate(...args) {
    if (args.length === 0) return new RealDate(fixed.getTime());
    return new RealDate(...args);
  }
  MockDate.now = () => fixed.getTime();
  MockDate.parse = RealDate.parse;
  MockDate.UTC = RealDate.UTC;
  MockDate.prototype = RealDate.prototype;
  global.Date = MockDate;
  return () => { global.Date = RealDate; };
}

function installTimerSpy() {
  const entries = [];
  const meta = new Map();
  global.setTimeout = (fn, ms, ...args) => {
    const info = { fn, ms, args, cleared: false, fired: false, realId: 0 };
    info.realId = realSetTimeout(() => {
      if (info.cleared || info.fired) return;
      info.fired = true;
      fn(...args);
    }, ms);
    meta.set(info.realId, info);
    entries.push(info);
    return info.realId;
  };
  global.clearTimeout = (id) => {
    const info = meta.get(id);
    if (info) info.cleared = true;
    realClearTimeout(id);
  };
  return {
    entries,
    restore() {
      global.setTimeout = realSetTimeout;
      global.clearTimeout = realClearTimeout;
    },
    firePending(ms) {
      const timer = entries.filter((entry) => !entry.cleared && !entry.fired && entry.ms === ms).pop();
      if (!timer) {
        const pending = entries.filter((entry) => !entry.cleared && !entry.fired).map((entry) => entry.ms);
        throw new Error('no pending timer ' + ms + ' (' + pending.join(', ') + ')');
      }
      timer.fired = true;
      realClearTimeout(timer.realId);
      timer.fn(...timer.args);
    }
  };
}

async function waitFor(fn, ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await fn()) return true;
    await sleep(20);
  }
  return false;
}

function loadAdapter(fake, auth) {
  const window = {};
  const runner = new Function('window', 'FIRESTORE_ROOT', 'firebaseConfig', 'fbAuth', source + '\nreturn window;');
  return runner(
    window,
    fake.root,
    { apiKey: 'test-key', projectId: 'epicurean-house-at-the-choc-st' },
    auth || { currentUser: { getIdToken() { return Promise.resolve('token'); } } }
  );
}

function assertSurface(api) {
  assert.equal(typeof api.createNamedFirestoreAdapter, 'function');
  assert.equal(api.ADAPTER_VERSION, 'phase1');
  assert.equal(api.EH_SYNC.adapterVersion, 'phase1');
  assert.deepEqual(Object.keys(api.EH_SYNC).sort(), ['adapterVersion', 'lastError', 'lastOk']);
  assert.equal(api.EH_SYNC.lastOk, null);
  assert.equal(api.EH_SYNC.lastError, null);
  const db = api.createNamedFirestoreAdapter();
  assert.equal(typeof db.collection, 'function');
  const col = db.collection('orders');
  const doc = col.doc('a');
  assert.equal(typeof doc.get, 'function');
  assert.equal(typeof doc.set, 'function');
  assert.equal(typeof doc.update, 'function');
  assert.equal(typeof doc.onSnapshot, 'function');
  assert.equal(typeof col.add, 'function');
  assert.equal(typeof col.onSnapshot, 'function');
  const query = col.where('table', '==', '1');
  assert.equal(typeof query.get, 'function');
  assert.equal(typeof query.onSnapshot, 'function');
  return db;
}

const fake = await startFakeFirestore();
try {
  await record('adapter file exports the full surface', async () => {
    assert.match(source, /REQUEST_TIMEOUT_MS\s*=\s*10000/);
    assert.match(source, /new AbortController\(/);
    assert.match(source, /POLL_FAST_MS\s*=\s*5000/);
    assert.match(source, /POLL_SLOW_MS\s*=\s*15000/);
    assert.match(source, /REQUEST_RETRY_LIMIT\s*=\s*3/);
    assert.match(source, /boh_shared/);
    assert.match(source, /active_orders/);
    fake.reset();
    const api = loadAdapter(fake);
    const db = assertSurface(api);
    fake.put('orders', 'a', { table: '1', name: 'Probe', n: 1 });
    const got = await db.collection('orders').doc('a').get();
    assert.equal(got.exists, true);
    assert.equal(got.id, 'a');
    assert.equal(got.data().name, 'Probe');
    assert.equal(typeof got.ref.update, 'function');
    assert.equal(typeof got.ref.set, 'function');
    await got.ref.update({ table: '2' });
    assert.equal(fake.get('orders', 'a').table, '2');
    await got.ref.set({ table: '3', name: 'Probe' });
    assert.equal(fake.get('orders', 'a').table, '3');
    const added = await db.collection('orders').add({ table: '4', status: 'new', sentAt: Date.now() });
    assert.equal(typeof added.id, 'string');
    assert.equal(fake.get('orders', added.id).table, '4');
    const snap = await db.collection('orders').where('table', '==', '4').get();
    assert.equal(snap.size, 1);
    assert.equal(snap.empty, false);
    assert.equal(typeof snap.forEach, 'function');
    const ids = [];
    snap.forEach((doc) => ids.push(doc.id));
    assert.deepEqual(ids, [added.id]);
    let seen = 0;
    const unsub = db.collection('orders').where('table', '==', '4').onSnapshot((shot) => {
      seen = shot.size;
    });
    assert.equal(typeof unsub, 'function');
    assert.equal(await waitFor(() => seen === 1, 2000), true);
    unsub();
    const missing = await db.collection('orders').doc('missing').get();
    assert.equal(missing.exists, false);
    assert.equal(api.EH_SYNC.lastError, null);
    assert.ok(api.EH_SYNC.lastOk);
  });

  await record('two listeners share one orders query', async () => {
    fake.reset();
    const api = loadAdapter(fake);
    const db = api.createNamedFirestoreAdapter();
    const now = Date.now();
    fake.put('orders', 'a', { table: '1', sentAt: now });
    fake.put('orders', 'b', { table: '2', sentAt: now });
    let full = 0;
    let filtered = 0;
    const unsubAll = db.collection('orders').onSnapshot(() => { full += 1; });
    const unsubFiltered = db.collection('orders').where('table', '==', '1').onSnapshot((snap) => {
      filtered = snap.size;
    });
    assert.equal(typeof unsubAll, 'function');
    assert.equal(typeof unsubFiltered, 'function');
    assert.equal(await waitFor(() => full >= 1 && filtered === 1, 2000), true);
    const queries = fake.requests.filter((req) => req.method === 'POST' && req.path.endsWith('/documents:runQuery'));
    const lists = fake.requests.filter((req) => req.method === 'GET' && req.path.endsWith('/orders'));
    assert.equal(queries.length, 1);
    assert.equal(lists.length, 0);
    unsubAll();
    unsubFiltered();
  });

  await record('listDocs follows nextPageToken', async () => {
    fake.reset();
    const api = loadAdapter(fake);
    const db = api.createNamedFirestoreAdapter();
    for (let i = 0; i < 1001; i++) {
      fake.put('orders', 'p' + String(i).padStart(4, '0'), { n: 1 });
    }
    const snap = await db.collection('orders').where('n', '==', 1).get();
    assert.equal(snap.size, 1001);
    const pages = fake.requests.filter((req) => req.method === 'GET' && req.path.endsWith('/orders'));
    assert.equal(pages.length, 2);
    assert.match(pages[1].query, /pageToken=/);
  });

  await record('dropped requests retry and then succeed', async () => {
    fake.reset();
    const api = loadAdapter(fake);
    const db = api.createNamedFirestoreAdapter();
    fake.put('orders', 'a', { n: 7 });
    fake.failNext(2, 'drop');
    const started = Date.now();
    const doc = await db.collection('orders').doc('a').get();
    assert.equal(doc.data().n, 7);
    const gets = fake.requests.filter((req) => req.method === 'GET' && req.path.endsWith('/a'));
    assert.equal(gets.length, 3);
    assert.ok(gets[1].at - gets[0].at >= 150);
    assert.ok(Date.now() - started < 5000);
    assert.equal(api.EH_SYNC.lastError, null);
  });

  await record('three retries are the limit', async () => {
    fake.reset();
    const api = loadAdapter(fake);
    const db = api.createNamedFirestoreAdapter();
    fake.put('orders', 'a', { n: 1 });
    fake.failNext(3, 'drop');
    const doc = await db.collection('orders').doc('a').get();
    assert.equal(doc.exists, true);
    assert.equal(fake.requests.filter((req) => req.path.endsWith('/a')).length, 4);
    fake.reset();
    fake.put('orders', 'a', { n: 1 });
    const again = loadAdapter(fake);
    again.createNamedFirestoreAdapter();
    fake.failNext(4, 'drop');
    await assert.rejects(() => again.createNamedFirestoreAdapter().collection('orders').doc('a').get());
    assert.ok(again.EH_SYNC.lastError);
    assert.equal(fake.requests.filter((req) => req.path.endsWith('/a')).length, 4);
  });

  await record('429 backs off before retrying', async () => {
    fake.reset();
    const api = loadAdapter(fake);
    const db = api.createNamedFirestoreAdapter();
    fake.put('orders', 'a', { n: 1 });
    fake.failNext(1, 429);
    const doc = await db.collection('orders').doc('a').get();
    assert.equal(doc.exists, true);
    const gets = fake.requests.filter((req) => req.path.endsWith('/a'));
    assert.equal(gets.length, 2);
    const gap = gets[1].at - gets[0].at;
    assert.ok(gap >= 250, 'gap ' + gap);
    assert.ok(gap < 1500, 'gap ' + gap);
  });

  await record('a hung request times out and then succeeds', async () => {
    fake.reset();
    const api = loadAdapter(fake);
    const db = api.createNamedFirestoreAdapter();
    fake.put('orders', 'a', { n: 9 });
    fake.failNext(1, 'hang');
    const started = Date.now();
    const doc = await Promise.race([
      db.collection('orders').doc('a').get(),
      sleep(20000).then(() => { throw new Error('hung past 20s'); })
    ]);
    const elapsed = Date.now() - started;
    assert.equal(doc.data().n, 9);
    assert.ok(elapsed >= 9000, 'elapsed ' + elapsed);
    assert.ok(elapsed < 16000, 'elapsed ' + elapsed);
    assert.equal(fake.requests.filter((req) => req.path.endsWith('/a')).length, 2);
  });

  await record('401 refreshes the ID token once', async () => {
    fake.reset();
    const forces = [];
    const api = loadAdapter(fake, {
      currentUser: {
        getIdToken(force) {
          forces.push(force === true);
          return Promise.resolve(force ? 'refreshed' : 'token');
        }
      }
    });
    const db = api.createNamedFirestoreAdapter();
    fake.put('orders', 'a', { n: 1 });
    fake.failNext(1, 401);
    const doc = await db.collection('orders').doc('a').get();
    assert.equal(doc.exists, true);
    assert.equal(forces.filter(Boolean).length, 1);
  });

  await record('onSnapshot reports a failure to its error callback', async () => {
    fake.reset();
    const api = loadAdapter(fake);
    const db = api.createNamedFirestoreAdapter();
    fake.put('notes', 'a', { n: 1 });
    fake.failNext(4, 'drop');
    let reported = null;
    const unsub = db.collection('notes').doc('a').onSnapshot(() => {}, (error) => {
      reported = error;
      unsub();
    });
    assert.equal(typeof unsub, 'function');
    assert.equal(await waitFor(() => reported != null, 4000), true);
    assert.ok(api.EH_SYNC.lastError);
  });

  await record('lost add response then 409 resolves as success', async () => {
    fake.reset();
    const api = loadAdapter(fake);
    const db = api.createNamedFirestoreAdapter();
    fake.failNext(1, 'lose');
    const doc = await db.collection('orders').add({ table: '1', status: 'new', sentAt: Date.now() });
    assert.equal(doc.exists, true);
    assert.equal(fake.get('orders', doc.id).table, '1');
    assert.equal(fake.count('orders'), 1);
    const posts = fake.requests.filter((req) => req.method === 'POST' && req.path.endsWith('/orders'));
    assert.equal(posts.length, 2);
    assert.equal(posts[0].fault, 'lose');
    assert.equal(api.EH_SYNC.lastError, null);
  });

  await record('poll interval doubles after repeated 429 and resets after success', async () => {
    fake.reset();
    const api = loadAdapter(fake);
    const db = api.createNamedFirestoreAdapter();
    const spy = installTimerSpy();
    const unsubs = [];
    try {
      fake.put('boh_shared', 'menu', { items: [] });
      fake.failNext(1, 429);
      let menuReads = 0;
      unsubs.push(db.collection('boh_shared').doc('menu').onSnapshot(() => { menuReads += 1; }));
      assert.equal(await waitFor(() => menuReads >= 1, 4000), true);
      assert.equal(await waitFor(() => spy.entries.some((entry) => !entry.cleared && !entry.fired && entry.ms === 5000), 2000), true);

      unsubs.splice(0).forEach((unsub) => unsub());
      fake.reset();
      const again = loadAdapter(fake);
      const retried = again.createNamedFirestoreAdapter();
      fake.put('boh_shared', 'menu', { items: [] });
      fake.failNext(4, 429);
      let menuErrors = 0;
      let menuOk = 0;
      unsubs.push(retried.collection('boh_shared').doc('menu').onSnapshot(() => { menuOk += 1; }, () => { menuErrors += 1; }));
      assert.equal(await waitFor(() => menuErrors >= 1, 8000), true);
      assert.equal(await waitFor(() => spy.entries.some((entry) => !entry.cleared && !entry.fired && entry.ms === 10000), 2000), true);
      spy.firePending(10000);
      assert.equal(await waitFor(() => menuOk >= 1, 4000), true);
      assert.equal(await waitFor(() => spy.entries.some((entry) => !entry.cleared && !entry.fired && entry.ms === 5000), 2000), true);

      unsubs.splice(0).forEach((unsub) => unsub());
      for (const name of ['checks', 'calls', 'messages']) {
        let seen = false;
        const unsub = retried.collection(name).onSnapshot(() => { seen = true; });
        unsubs.push(unsub);
        assert.equal(await waitFor(() => seen, 2000), true, name);
        assert.equal(await waitFor(() => spy.entries.some((entry) => !entry.cleared && !entry.fired && entry.ms === 60000), 2000), true, name);
        unsub();
      }

      let callErrors = 0;
      let callOk = 0;
      unsubs.push(retried.collection('calls').onSnapshot(() => { callOk += 1; }, () => { callErrors += 1; }));
      assert.equal(await waitFor(() => callOk >= 1, 2000), true);
      assert.equal(await waitFor(() => spy.entries.some((entry) => !entry.cleared && !entry.fired && entry.ms === 60000), 2000), true);
      fake.failNext(4, 429);
      spy.firePending(60000);
      assert.equal(await waitFor(() => callErrors >= 1, 8000), true);
      assert.equal(await waitFor(() => spy.entries.some((entry) => !entry.cleared && !entry.fired && entry.ms === 120000), 2000), true);
      fake.put('calls', 'late', { status: 'active' });
      spy.firePending(120000);
      assert.equal(await waitFor(() => callOk >= 2, 4000), true);
      assert.equal(await waitFor(() => spy.entries.some((entry) => !entry.cleared && !entry.fired && entry.ms === 60000), 2000), true);
    } finally {
      unsubs.forEach((unsub) => unsub());
      spy.restore();
    }
  });

  await record('orders poll is a filtered query and still returns 1200 from today', async () => {
    fake.reset();
    const api = loadAdapter(fake);
    const db = api.createNamedFirestoreAdapter();
    const today = businessDayStartMs();
    fake.put('orders', 'yesterday', { table: '9', sentAt: today - 1, status: 'new' });
    for (let i = 0; i < 1200; i++) {
      fake.put('orders', 'ord_' + String(i).padStart(4, '0'), { table: '9', sentAt: today, status: 'new' });
    }
    let size = -1;
    let sawYesterday = false;
    const unsub = db.collection('orders').onSnapshot((snap) => {
      size = snap.size;
      sawYesterday = false;
      snap.forEach((doc) => { if (doc.id === 'yesterday') sawYesterday = true; });
    });
    assert.equal(await waitFor(() => size === 1200, 4000), true);
    assert.equal(sawYesterday, false);
    const queries = fake.requests.filter((req) => req.method === 'POST' && req.path.endsWith('/documents:runQuery'));
    const lists = fake.requests.filter((req) => req.method === 'GET' && req.path.endsWith('/orders'));
    assert.equal(queries.length, 1);
    assert.equal(lists.length, 0);
    const filter = queries[0].body.structuredQuery.where.fieldFilter;
    assert.equal(queries[0].body.structuredQuery.from[0].collectionId, 'orders');
    assert.equal(filter.field.fieldPath, 'sentAt');
    assert.equal(filter.op, 'GREATER_THAN_OR_EQUAL');
    assert.equal(Number(filter.value.integerValue), today);
    const full = await db.collection('orders').where('table', '==', '9').get();
    assert.equal(full.size, 1201);
    unsub();
  });

  await record('business day cutoff is 05:00, and a 23:00 order remains at 00:30', async () => {
    assert.match(source, /BUSINESS_DAY_START_HOUR\s*=\s*5/);
    const early = localDate(2026, 10, 23, 4, 59).getTime();
    const boundary = localDate(2026, 10, 23, 5, 0).getTime();
    const late = localDate(2026, 10, 23, 23, 0).getTime();
    const beforeFive = localDate(2026, 10, 24, 4, 59).getTime();
    const open = localDate(2026, 10, 24, 5, 0).getTime();
    function seed() {
      fake.reset();
      fake.put('orders', 'early', { sentAt: early, table: '1' });
      fake.put('orders', 'boundary', { sentAt: boundary, table: '1' });
      fake.put('orders', 'late', { sentAt: late, table: '1' });
      fake.put('orders', 'beforeFive', { sentAt: beforeFive, table: '1' });
      fake.put('orders', 'open', { sentAt: open, table: '1' });
    }
    async function pollAt(when) {
      seed();
      const restore = installClock(when);
      try {
        const db = loadAdapter(fake).createNamedFirestoreAdapter();
        let ids = null;
        const unsub = db.collection('orders').onSnapshot((snap) => {
          ids = [];
          snap.forEach((doc) => ids.push(doc.id));
          ids.sort();
        });
        assert.equal(await waitFor(() => ids !== null, 3000), true);
        const query = fake.requests.filter((req) => req.method === 'POST' && req.path.endsWith('/documents:runQuery')).pop();
        const filter = query.body.structuredQuery.where.fieldFilter;
        assert.equal(filter.field.fieldPath, 'sentAt');
        assert.equal(filter.op, 'GREATER_THAN_OR_EQUAL');
        unsub();
        return { ids, cutoff: Number(filter.value.integerValue) };
      } finally {
        restore();
      }
    }
    const night = await pollAt(localDate(2026, 10, 24, 0, 30));
    assert.equal(night.cutoff, localDate(2026, 10, 23, 5, 0).getTime());
    assert.deepEqual(night.ids, ['beforeFive', 'boundary', 'late', 'open']);
    const noon = await pollAt(localDate(2026, 10, 24, 12, 0));
    assert.equal(noon.cutoff, localDate(2026, 10, 24, 5, 0).getTime());
    assert.deepEqual(noon.ids, ['open']);
  });
} finally {
  await fake.close();
}

const failed = results.filter((row) => !row.pass);
console.log('\n' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed');
process.exitCode = failed.length ? 1 : 0;
