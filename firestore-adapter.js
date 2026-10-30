/* Named Firestore adapter for the existing database ID: default.
   Loaded before the POS inline script. FIRESTORE_ROOT, firebaseConfig, and
   fbAuth are read when a call runs, so the offline harness can point
   FIRESTORE_ROOT at localhost first. */
var ADAPTER_VERSION = 'phase1';
var POLL_FAST_MS = 5000;
var POLL_SLOW_MS = 15000;
var POLL_FULL_COLLECTION_MS = 60000;
var POLL_MAX_MS = 600000;
var BUSINESS_DAY_START_HOUR = 5;
var REQUEST_TIMEOUT_MS = 10000;
var REQUEST_RETRY_LIMIT = 3;
var RETRY_BASE_MS = 200;
var RATE_LIMIT_BASE_MS = 300;

var EH_SYNC = { lastOk: null, lastError: null, adapterVersion: ADAPTER_VERSION };
window.EH_SYNC = EH_SYNC;
window.ADAPTER_VERSION = ADAPTER_VERSION;

function createNamedFirestoreAdapter() {
  var collectionPolls = {};

  function pollDelay(collection, id) {
    if (collection === 'orders') return POLL_FAST_MS;
    if (collection === 'boh_shared' && (id === 'menu' || id === 'active_orders')) return POLL_FAST_MS;
    if (!id && (collection === 'checks' || collection === 'calls' || collection === 'messages')) return POLL_FULL_COLLECTION_MS;
    return POLL_SLOW_MS;
  }

  function nextInterval(current, base, error) {
    var interval = current || base;
    if (!error) return base;
    if (isRateLimited(error)) return Math.min(interval * 2, POLL_MAX_MS);
    return interval;
  }

  function delay(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  function ensureAuth() {
    if (typeof fbAuth === 'undefined' || !fbAuth) return Promise.resolve(null);
    if (fbAuth.currentUser) return Promise.resolve(fbAuth.currentUser);
    return fbAuth.signInAnonymously().then(function(result) { return result.user; });
  }

  function statusOf(error) {
    if (!error) return 0;
    if (error.status) return Number(error.status) || 0;
    var code = String(error.code || '');
    var match = /^http-(\d+)$/.exec(code);
    return match ? Number(match[1]) : 0;
  }

  function isNotFound(error) {
    return statusOf(error) === 404 || String(error && error.code || '') === 'NOT_FOUND';
  }

  function isUnauthorized(error) {
    var code = String(error && error.code || '');
    return statusOf(error) === 401 || code === 'UNAUTHENTICATED' || code === 'http-401';
  }

  function isRateLimited(error) {
    var code = String(error && error.code || '');
    return statusOf(error) === 429 || code === 'RESOURCE_EXHAUSTED' || code === 'http-429';
  }

  function isAlreadyExists(error) {
    return String(error && error.code || '') === 'ALREADY_EXISTS';
  }

  function isServerError(error) {
    var status = statusOf(error);
    return status >= 500 && status <= 599;
  }

  function isNetworkError(error) {
    if (!error) return true;
    if (error.name === 'AbortError') return true;
    if (statusOf(error)) return false;
    var code = String(error.code || '');
    if (code === 'NOT_FOUND' || code === 'UNAUTHENTICATED' || code === 'RESOURCE_EXHAUSTED') return false;
    if (/^http-4/.test(code)) return false;
    return true;
  }

  function recordFailure(error) {
    if (isNotFound(error)) return;
    EH_SYNC.lastError = {
      message: String(error && error.message || error),
      code: String(error && (error.code || error.name) || ''),
      status: statusOf(error),
      at: Date.now()
    };
  }

  function backoffFor(error, attempt) {
    var base = isRateLimited(error) ? RATE_LIMIT_BASE_MS : RETRY_BASE_MS;
    return base * Math.pow(2, attempt);
  }

  function request(method, url, body, options) {
    var tokenRefreshed = false;
    function attempt(n) {
      return ensureAuth().then(function(user) {
        var headers = { 'Content-Type': 'application/json' };
        var tokenPromise = user && user.getIdToken
          ? user.getIdToken().then(function(token) { headers.Authorization = 'Bearer ' + token; })
          : Promise.resolve();
        return tokenPromise.then(function() {
          var key = (typeof firebaseConfig !== 'undefined' && firebaseConfig && firebaseConfig.apiKey) ? firebaseConfig.apiKey : '';
          var fullUrl = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'key=' + encodeURIComponent(key);
          var controller = new AbortController();
          var timer = setTimeout(function() { controller.abort(); }, REQUEST_TIMEOUT_MS);
          return fetch(fullUrl, {
            method: method,
            headers: headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal
          }).then(function(response) {
            clearTimeout(timer);
            return response.text().then(function(text) {
              var json = {};
              if (text) {
                try { json = JSON.parse(text); } catch (parseError) { json = {}; }
              }
              if (!response.ok) {
                var error = new Error((json.error && json.error.message) || ('Firestore request failed (' + response.status + ')'));
                error.code = (json.error && json.error.status) || ('http-' + response.status);
                error.status = response.status;
                throw error;
              }
              EH_SYNC.lastOk = Date.now();
              return json;
            });
          }, function(networkError) {
            clearTimeout(timer);
            throw networkError;
          });
        });
      }).then(function(json) {
        return json;
      }, function(error) {
        if (isUnauthorized(error) && !tokenRefreshed) {
          tokenRefreshed = true;
          var current = (typeof fbAuth !== 'undefined' && fbAuth && fbAuth.currentUser) ? fbAuth.currentUser : null;
          if (current && typeof current.getIdToken === 'function') {
            return current.getIdToken(true).then(function() {
              return attempt(n);
            }, function(refreshError) {
              recordFailure(refreshError);
              throw refreshError;
            });
          }
        }
        if (options && options.idempotentDocument && n > 0 && isAlreadyExists(error)) {
          EH_SYNC.lastOk = Date.now();
          return options.idempotentDocument;
        }
        var retryable = isNetworkError(error) || isServerError(error) || isRateLimited(error);
        if (retryable && n < REQUEST_RETRY_LIMIT) {
          return delay(backoffFor(error, n)).then(function() { return attempt(n + 1); });
        }
        recordFailure(error);
        throw error;
      });
    }
    return attempt(0);
  }

  function encodeValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    if (value && typeof value === 'object' && (value._methodName === 'FieldValue.serverTimestamp' || value._methodName === 'serverTimestamp')) {
      return { timestampValue: new Date().toISOString() };
    }
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
    var fields = {};
    Object.keys(object || {}).forEach(function(key) {
      if (object[key] !== undefined) fields[key] = encodeValue(object[key]);
    });
    return fields;
  }

  function fieldMaskQuery(data) {
    return Object.keys(data || {}).filter(function(key) { return data[key] !== undefined; }).map(function(key) {
      return 'updateMask.fieldPaths=' + encodeURIComponent(key);
    }).join('&');
  }

  function decodeValue(value) {
    if (!value) return null;
    if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
    if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
    if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return value.booleanValue;
    if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
    if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
    if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;
    if (Object.prototype.hasOwnProperty.call(value, 'bytesValue')) return value.bytesValue;
    if (Object.prototype.hasOwnProperty.call(value, 'referenceValue')) return value.referenceValue;
    if (Object.prototype.hasOwnProperty.call(value, 'geoPointValue')) return value.geoPointValue;
    if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) return (value.arrayValue.values || []).map(decodeValue);
    if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) {
      var map = {};
      Object.keys(value.mapValue.fields || {}).forEach(function(key) { map[key] = decodeValue(value.mapValue.fields[key]); });
      return map;
    }
    return null;
  }

  function decodeFields(fields) {
    var result = {};
    Object.keys(fields || {}).forEach(function(key) { result[key] = decodeValue(fields[key]); });
    return result;
  }

  function root() {
    return FIRESTORE_ROOT;
  }

  function docUrl(collection, id) {
    return root() + '/' + encodeURIComponent(collection) + '/' + encodeURIComponent(id);
  }

  function docRef(collection, id) {
    return {
      id: id,
      update: function(data) { return updateDoc(collection, id, data); },
      set: function(data, options) { return setDoc(collection, id, data, options); }
    };
  }

  function docFrom(json, fallbackId, collection) {
    var id = fallbackId || '';
    var exists = false;
    if (json && json.name) {
      var parts = json.name.split('/');
      id = parts[parts.length - 1] || id;
      exists = true;
    }
    return {
      exists: exists,
      id: id,
      ref: docRef(collection, id),
      data: function() { return exists ? decodeFields(json.fields || {}) : undefined; }
    };
  }

  function getDoc(collection, id) {
    return request('GET', docUrl(collection, id)).then(function(json) {
      return docFrom(json, id, collection);
    }).catch(function(error) {
      if (isNotFound(error)) return docFrom(null, id, collection);
      throw error;
    });
  }

  function setDoc(collection, id, data, options) {
    var url = docUrl(collection, id);
    if (options && options.merge) {
      var mask = fieldMaskQuery(data);
      if (mask) url += '?' + mask;
    }
    return request('PATCH', url, { fields: encodeFields(data) }).then(function(json) {
      return docFrom(json, id, collection);
    });
  }

  function updateDoc(collection, id, data) {
    var mask = fieldMaskQuery(data);
    var url = docUrl(collection, id) + (mask ? '?' + mask : '');
    return request('PATCH', url, { fields: encodeFields(data) }).then(function(json) {
      return docFrom(json, id, collection);
    });
  }

  function addDoc(collection, data) {
    var id = 'web_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    var fields = encodeFields(data);
    var payload = { fields: fields };
    var created = { name: root() + '/' + collection + '/' + id, fields: fields };
    return request('POST', root() + '/' + encodeURIComponent(collection) + '?documentId=' + encodeURIComponent(id), payload, { idempotentDocument: created }).then(function(json) {
      return docFrom(json, id, collection);
    });
  }

  function listDocs(collection) {
    var all = [];
    function page(token) {
      var url = root() + '/' + encodeURIComponent(collection) + '?pageSize=1000';
      if (token) url += '&pageToken=' + encodeURIComponent(token);
      return request('GET', url).then(function(json) {
        (json.documents || []).forEach(function(doc) { all.push(docFrom(doc, '', collection)); });
        if (json.nextPageToken) {
          if (json.nextPageToken === token) throw new Error('Firestore page token did not advance');
          return page(json.nextPageToken);
        }
        return all;
      });
    }
    return page('');
  }

  function businessDayStartMs() {
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), BUSINESS_DAY_START_HOUR, 0, 0, 0);
    if (now.getTime() < start.getTime()) start.setDate(start.getDate() - 1);
    return start.getTime();
  }

  function queryOrdersToday() {
    var body = {
      structuredQuery: {
        from: [{ collectionId: 'orders' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'sentAt' },
            op: 'GREATER_THAN_OR_EQUAL',
            value: { integerValue: String(businessDayStartMs()) }
          }
        }
      }
    };
    return request('POST', root() + ':runQuery', body).then(function(rows) {
      var docs = [];
      var list = Array.isArray(rows) ? rows : [];
      list.forEach(function(row) {
        if (row && row.document) docs.push(docFrom(row.document, '', 'orders'));
      });
      return docs;
    });
  }

  function fetchPolledCollection(collection) {
    if (collection === 'orders') return queryOrdersToday();
    return listDocs(collection);
  }

  function snapshot(docs) {
    return {
      docs: docs,
      size: docs.length,
      empty: docs.length === 0,
      forEach: function(callback, context) {
        docs.forEach(function(doc) { callback.call(context, doc); });
      }
    };
  }

  function applyFilter(docs, filter) {
    if (!filter) return docs;
    return docs.filter(function(doc) {
      var data = doc.data() || {};
      return filter.op === '==' ? data[filter.field] === filter.value : true;
    });
  }

  function reportError(onError, error) {
    if (typeof onError === 'function') {
      try { onError(error); }
      catch (callbackError) { console.error(callbackError); }
    } else {
      console.error(error);
    }
  }

  function deliver(sub, docs) {
    try {
      var filtered = applyFilter(docs, sub.filter);
      var signature = JSON.stringify(filtered.map(function(doc) {
        return { id: doc.id, data: doc.data() };
      }));
      if (signature === sub.last) return;
      sub.last = signature;
      sub.callback(snapshot(filtered));
    } catch (error) {
      reportError(sub.onError, error);
    }
  }

  function schedule(collection) {
    var bucket = collectionPolls[collection];
    if (!bucket) return;
    bucket.subs = bucket.subs.filter(function(sub) { return sub.active; });
    if (!bucket.subs.length) {
      if (bucket.timer) clearTimeout(bucket.timer);
      delete collectionPolls[collection];
      return;
    }
    if (bucket.timer) clearTimeout(bucket.timer);
    bucket.timer = setTimeout(function() {
      bucket.timer = null;
      runCollection(collection);
    }, bucket.interval || pollDelay(collection));
  }

  function runCollection(collection) {
    var bucket = collectionPolls[collection];
    if (!bucket) return;
    if (bucket.timer) { clearTimeout(bucket.timer); bucket.timer = null; }
    var token = {};
    bucket.token = token;
    var pending = fetchPolledCollection(collection);
    bucket.inFlight = pending;
    var base = pollDelay(collection);
    pending.then(function(docs) {
      if (collectionPolls[collection] !== bucket || bucket.token !== token) return;
      bucket.inFlight = null;
      bucket.interval = nextInterval(bucket.interval, base, null);
      bucket.lastDocs = docs;
      bucket.subs.slice().forEach(function(sub) {
        if (sub.active) deliver(sub, docs);
      });
      schedule(collection);
    }, function(error) {
      if (collectionPolls[collection] !== bucket || bucket.token !== token) return;
      bucket.inFlight = null;
      bucket.interval = nextInterval(bucket.interval, base, error);
      bucket.subs.slice().forEach(function(sub) {
        if (sub.active) reportError(sub.onError, error);
      });
      schedule(collection);
    });
  }

  function subscribeCollection(collection, filter, callback, onError) {
    var bucket = collectionPolls[collection];
    if (!bucket) {
      bucket = { subs: [], timer: null, inFlight: null, lastDocs: null, token: null };
      collectionPolls[collection] = bucket;
    }
    var sub = { filter: filter, callback: callback, onError: onError, active: true, last: '' };
    bucket.subs.push(sub);
    if (!bucket.inFlight) {
      if (bucket.lastDocs) {
        deliver(sub, bucket.lastDocs);
        if (!bucket.timer) schedule(collection);
      } else {
        runCollection(collection);
      }
    }
    return function unsubscribe() {
      sub.active = false;
      var current = collectionPolls[collection];
      if (!current) return;
      current.subs = current.subs.filter(function(item) { return item !== sub && item.active; });
      if (!current.subs.length) {
        if (current.timer) clearTimeout(current.timer);
        current.token = null;
        delete collectionPolls[collection];
      }
    };
  }

  function watchDoc(collection, id, callback, onError) {
    var active = true;
    var timer = null;
    var base = pollDelay(collection, id);
    var interval = base;
    var delivered = false;
    var lastSignature = '';
    function arm() {
      if (!active) return;
      timer = setTimeout(run, interval);
    }
    // The real Firebase onSnapshot fires only when a document changes. Polling must
    // do the same, or every poll rebuilds the screen (flicker, scroll jumps, lost taps).
    function signatureOf(doc) {
      if (!doc || !doc.exists) return 'missing';
      try { return 'doc:' + JSON.stringify(doc.data()); }
      catch (e) { return 'doc:unserializable:' + Date.now(); }
    }
    function run() {
      if (!active) return;
      getDoc(collection, id).then(function(doc) {
        if (!active) return;
        interval = nextInterval(interval, base, null);
        var signature = signatureOf(doc);
        if (!delivered || signature !== lastSignature) {
          delivered = true;
          lastSignature = signature;
          try { callback(doc); }
          catch (error) { reportError(onError, error); }
        }
        arm();
      }, function(error) {
        if (!active) return;
        interval = nextInterval(interval, base, error);
        reportError(onError, error);
        arm();
      });
    }
    run();
    return function unsubscribe() {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }

  function collection(name) {
    return {
      doc: function(id) {
        return {
          get: function() { return getDoc(name, id); },
          set: function(data, options) { return setDoc(name, id, data, options); },
          update: function(data) { return updateDoc(name, id, data); },
          onSnapshot: function(callback, onError) { return watchDoc(name, id, callback, onError); }
        };
      },
      add: function(data) { return addDoc(name, data); },
      onSnapshot: function(callback, onError) { return subscribeCollection(name, null, callback, onError); },
      where: function(field, op, value) {
        var filter = { field: field, op: op, value: value };
        return {
          get: function() {
            return listDocs(name).then(function(docs) { return snapshot(applyFilter(docs, filter)); });
          },
          onSnapshot: function(callback, onError) {
            return subscribeCollection(name, filter, callback, onError);
          }
        };
      }
    };
  }

  return { collection: collection };
}

window.createNamedFirestoreAdapter = createNamedFirestoreAdapter;
