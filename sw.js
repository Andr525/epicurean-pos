// Epicurean POS — Service Worker
// Network-first, cache-bypass fetch so handhelds do not keep an old shell.
var CACHE = 'epicurean-pos-v11';
var ASSETS = ['manifest.json','icon-192.png','icon-512.png'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function(list) {
      list.forEach(function(c) {
        try { c.navigate(c.url); } catch (err) {}
      });
    })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;
  if (url.indexOf('/sw.js') > -1) return;
  if (url.indexOf('firebase') > -1 || url.indexOf('googleapis') > -1) {
    e.respondWith(fetch(e.request).catch(function() { return caches.match(e.request); }));
    return;
  }
  e.respondWith(
    fetch(e.request, { cache: 'reload' }).then(function(res) {
      if (res && res.ok && e.request.url.indexOf('http') === 0) {
        var copy = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function() { return caches.match(e.request); })
  );
});
