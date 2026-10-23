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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const added = await db.collection('orders').add({ table: '4', status: 'new' });
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

  await record('two listeners share one list request', async () => {
    fake.reset();
    const api = loadAdapter(fake);
    const db = api.createNamedFirestoreAdapter();
    fake.put('orders', 'a', { table: '1' });
    fake.put('orders', 'b', { table: '2' });
    let full = 0;
    let filtered = 0;
    const unsubAll = db.collection('orders').onSnapshot(() => { full += 1; });
    const unsubFiltered = db.collection('orders').where('table', '==', '1').onSnapshot((snap) => {
      filtered = snap.size;
    });
    assert.equal(typeof unsubAll, 'function');
    assert.equal(typeof unsubFiltered, 'function');
    assert.equal(await waitFor(() => full >= 1 && filtered === 1, 2000), true);
    const lists = fake.requests.filter((req) => req.method === 'GET' && req.path.endsWith('/orders'));
    assert.equal(lists.length, 1);
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
} finally {
  await fake.close();
}

const failed = results.filter((row) => !row.pass);
console.log('\n' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed');
process.exitCode = failed.length ? 1 : 0;
