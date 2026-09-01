// Epicurean POS — kill stale workers, then get out of the way.
// Old handhelds cached a cache-first shell (station tabs). This file
// unregisters itself, wipes Cache Storage, and reloads with ?b=12.
self.addEventListener('install', function(e) { self.skipWaiting(); });
self.addEventListener('activate', function(e) {
  e.waitUntil(
    self.registration.unregister()
      .then(function(){ return caches.keys(); })
      .then(function(keys){ return Promise.all(keys.map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.clients.claim(); })
      .then(function(){ return self.clients.matchAll({ type:'window', includeUncontrolled:true }); })
      .then(function(list){
        list.forEach(function(c){
          try {
            var u=new URL(c.url);
            u.searchParams.set('b','12');
            c.navigate(u.toString());
          } catch (err) {}
        });
      })
  );
});
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request, { cache:'reload' }));
});
