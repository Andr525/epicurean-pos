/* TEST BUILD ONLY — fictional data overlay for owner manual testing ("Harbor Lane Bistro", not a real business).
   Loaded right after cellar.js and scalini-dining.js, before the POS application script.
   It replaces bundled restaurant data (wine cellar, wines by the glass, set-menu names, prices, pairings,
   stories, links, photos and translations) with fictional values.
   Kept on purpose: dish names, course labels, ids and structure of the bundled set menus, because the
   POS code itself recognizes them (e.g. salmon/filet temperatures, welcome course, gelato scoops).
   No application code is changed. */
(function () {
  var W = window;
  // ---- Wine cellar: fictional bottles only (beers/spirits come from the fictional BOH bar list) ----
  if (W.BINWISE_CELLAR) {
    W.BINWISE_CELLAR.v = 'fictional-test-v1';
    W.BINWISE_CELLAR.wines = [
      {id: 'hw1', vin: '9101', name: 'Seaglass Brut (fictional)', vintage: 'NV', region: 'Coastal Valley', bottlePrice: 64, glassPrice: 14, stock: 12, bottleOz: 25, ozOnHand: 300, openOz: 0, size: '750ml', active: true},
      {id: 'hw2', vin: '9102', name: 'Driftwood Sauvignon Blanc (fictional)', vintage: '2023', region: 'North Ridge', bottlePrice: 52, glassPrice: 13, stock: 12, bottleOz: 25, ozOnHand: 300, openOz: 0, size: '750ml', active: true},
      {id: 'hw3', vin: '9103', name: 'Tidewater Chardonnay (fictional)', vintage: '2022', region: 'Harbor Hills', bottlePrice: 68, glassPrice: 15, stock: 12, bottleOz: 25, ozOnHand: 300, openOz: 0, size: '750ml', active: true},
      {id: 'hw4', vin: '9104', name: 'Lantern Pinot Noir (fictional)', vintage: '2021', region: 'Fog Valley', bottlePrice: 78, glassPrice: 17, stock: 12, bottleOz: 25, ozOnHand: 300, openOz: 0, size: '750ml', active: true},
      {id: 'hw5', vin: '9105', name: 'Breakwater Cabernet (fictional)', vintage: '2019', region: 'Stone Bench', bottlePrice: 120, glassPrice: 0, stock: 6, bottleOz: 25, ozOnHand: 150, openOz: 0, size: '750ml', active: true},
      {id: 'hw6', vin: '9106', name: 'Moonrise Late Harvest (fictional)', vintage: '2020', region: 'Coastal Valley', bottlePrice: 58, glassPrice: 12, stock: 6, bottleOz: 25, ozOnHand: 150, openOz: 0, size: '750ml', active: true}
    ];
    W.BINWISE_CELLAR.beers = [];
    W.BINWISE_CELLAR.spirits = [];
    W.BINWISE_CELLAR.flights = [];
  }
  var S = W.EPICUREAN_SCALINI;
  if (!S) return;
  var PAIRS = ['House Sparkling (fictional) · $14', 'Driftwood Sauvignon Blanc (fictional) · $13', 'Lantern Pinot Noir (fictional) · $17', 'Moonrise Late Harvest (fictional) · $12'];
  var pi = 0;
  function scrubString(s) {
    return String(s).replace(/https?:\/\/\S+/g, '').replace(/Scalini Fedeli/gi, 'Harbor Lane').replace(/Scalini/gi, 'Harbor Lane');
  }
  function scrub(o) {
    if (Array.isArray(o)) { o.forEach(scrub); return; }
    if (!o || typeof o !== 'object') return;
    Object.keys(o).forEach(function (k) {
      var v = o[k];
      if (k === 'i18n') { o[k] = {}; return; }                                   // real-menu translations
      if (/^(story|photo)$/.test(k) || /Url$/.test(k)) { o[k] = ''; return; }   // links, stories, photos
      if (/^(pairing|pairWhite|pairRed|pairDessert)$/.test(k)) { o[k] = v ? PAIRS[(pi++) % PAIRS.length] : ''; return; }
      if (k === 'desc' && typeof v === 'string' && v) { o[k] = 'Test description for ' + String(o.name || 'this course').toLowerCase() + '.'; return; }
      if (typeof v === 'string') { o[k] = scrubString(v); return; }
      scrub(v);
    });
  }
  // ---- Set menus: fictional names, prices and copy; structure, ids, dish names and course labels kept ----
  scrub(S.prixFixe); scrub(S.tasting);
  S.prixFixe.name = 'Harbor Lane Prix Fixe (TEST)';
  S.prixFixe.subtitle = 'Fictional prix fixe dinner $85. First courses are served automatically, one at a time; dessert after the main.';
  S.prixFixe.desc = 'Fictional test menu. Choose a primo and a main; dessert is chosen after the main.';
  S.prixFixe.price = 85;
  S.tasting.name = 'Harbor Lane Tasting (TEST)';
  S.tasting.subtitle = 'Fictional tasting menu. Choose temperature for salmon and filet, then dessert.';
  S.tasting.price = 120;
  // ---- Wines by the glass: fictional names, same ids/groups/shape ----
  (S.winesByGlass || []).forEach(function (w, i) {
    var n = i + 1;
    w.name = 'Fictional ' + (w.group || 'Wine') + ' ' + n;
    w.producer = 'Fictional Estate'; w.region = 'Test Region'; w.country = 'Testland';
    w.varietal = w.grape = 'House blend (fictional)'; w.vintage = 'NV';
    w.glassPrice = w.price = 12 + (i % 5); w.bottlePrice = 0;
    scrub(w);
    w.desc = 'Fictional Estate · Test Region · House blend (fictional)';
  });
  // Explanations and ingredient notes are restaurant-written copy: fictional placeholders, same keys.
  ['explainMore', 'ingredientNotes'].forEach(function (key) {
    Object.keys(S[key] || {}).forEach(function (k) { S[key][k] = 'Fictional test explanation for ' + k + '.'; });
  });
  Object.keys(S.wineNotes || {}).forEach(function (k) { S.wineNotes[k] = 'Fictional test wine — placeholder tasting note.'; });
  scrub(S.ui);
  W.__FICTIONAL_OVERLAY__ = true;
})();
