// Epicurean POS — uninstall leftover workers. Do not take over the page
// or reload clients; a reload loop blocked the login keypad.
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(
    self.registration.unregister().then(function(){
      return caches.keys();
    }).then(function(keys){
      return Promise.all(keys.map(function(k){ return caches.delete(k); }));
    })
  );
});
