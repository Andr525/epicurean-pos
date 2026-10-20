/* BOH selling prices, normalized to the house pour.
   A spirit record's price is whatever BOH stored for its unit.
   Inventory counted in bottles is not a second price.
   This file does not name products and does not invent a missing price. */
(function (root) {
  var STANDARD_POUR_OZ = 2;
  var SHORT_POUR_OZ = 1;
  var PREMIUM_PER_OZ = 30;
  var CLASSIC_PRICE = 25;
  var PREMIUM_ADD = 5;

  var FAMILY = {
    gin: ['GIN'],
    vodka: ['VODKA'],
    whiskey: ['WHISKEY', 'WHISKY', 'BOURBON', 'RYE', 'SCOTCH'],
    bourbon: ['BOURBON', 'WHISKEY', 'WHISKY'],
    rye: ['RYE', 'WHISKEY', 'WHISKY'],
    scotch: ['SCOTCH', 'WHISKY', 'WHISKEY'],
    rum: ['RUM'],
    tequila: ['TEQUILA'],
    mezcal: ['MEZCAL'],
    brandy: ['BRANDY', 'COGNAC'],
    cognac: ['COGNAC', 'BRANDY'],
    pisco: ['PISCO'],
    campari: ['CAMPARI'],
    aperol: ['APEROL'],
    champagne: ['CHAMPAGNE', 'PROSECCO', 'SPARKLING'],
    prosecco: ['PROSECCO', 'CHAMPAGNE', 'SPARKLING']
  };

  function norm(s) {
    return String(s == null ? '' : s)
      .toUpperCase()
      .replace(/&/g, ' AND ')
      .replace(/[^\w\s]/g, ' ')
      .replace(/(\d+)\s*YR\b/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function money(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function statedOunces(item) {
    var unit = String((item && (item.unit || item.pourUnit)) || '');
    var fromUnit = unit.match(/(\d+(?:\.\d+)?)\s*oz\b/i);
    if (fromUnit) return Number(fromUnit[1]);
    var desc = String((item && (item.desc || item.description)) || '');
    var fromDesc = desc.match(/(\d+(?:\.\d+)?)\s*oz\b/i);
    if (fromDesc) return Number(fromDesc[1]);
    if (item && Number(item.pourOz) > 0) return Number(item.pourOz);
    return 0;
  }

  function isSpirit(item) {
    if (!item) return false;
    var blob = norm([item.kind, item.category, (item.catIds || []).join(' ')].join(' '));
    if (/COCKTAIL|MOCKTAIL|BEER|WINE|COFFEE|SOFT/.test(blob) && !/SPIRIT/.test(blob)) return false;
    return /SPIRIT|AMARO|LIQUOR|DIGESTIF|AFTER/.test(blob);
  }

  function inStock(item) {
    if (!item || item.active === false || item.eightySixed) return false;
    if (item.stock == null || item.stock === '') return true;
    return Number(item.stock) > 0;
  }

  function normalizeSpirit(item) {
    if (!isSpirit(item)) return { ok: false, reason: 'not a spirit' };
    var price = Number(item.price);
    if (!(price > 0)) return { ok: false, reason: 'no selling price' };
    var stated = statedOunces(item);
    var ounces = stated > 0 ? stated : STANDARD_POUR_OZ;
    var perOz = price / ounces;
    return {
      ok: true,
      perOz: money(perOz),
      storedOz: ounces,
      stated: stated > 0,
      price2: money(perOz * STANDARD_POUR_OZ),
      price1: money(perOz * SHORT_POUR_OZ),
      premium: perOz >= PREMIUM_PER_OZ,
      basis: stated > 0 ? ('BOH price is for ' + ounces + ' oz') : 'BOH selling price is the standard 2 oz pour'
    };
  }

  function spokenOunces(text) {
    var n = norm(text);
    if (/\b(1|ONE)\s*(OZ|OUNCE|OUNCES)\b/.test(n) || /\b(OZ|OUNCE|OUNCES)\s*(1|ONE)\b/.test(n)) return 1;
    if (/\b(2|TWO)\s*(OZ|OUNCE|OUNCES)\b/.test(n) || /\b(OZ|OUNCE|OUNCES)\s*(2|TWO)\b/.test(n)) return 2;
    if (/\b(\d+|THREE|FOUR|FIVE|SIX)\s*(OZ|OUNCE|OUNCES)\b/.test(n)) return 0;
    return null;
  }

  function nameTokens(item) {
    return norm(item && item.name).split(' ').filter(function (word) { return word && word.length >= 2; });
  }

  function matchSpirit(phrase, items) {
    var skip = { OZ: 1, OUNCE: 1, OUNCES: 1, POUR: 1, OF: 1, THE: 1, A: 1, AN: 1, AND: 1, WITH: 1, ONE: 1, TWO: 1, '1': 1, '2': 1 };
    var want = norm(phrase).split(' ').filter(function (word) { return word && !skip[word] && word.length >= 2; });
    if (!want.length) return { action: 'none' };
    var hits = [];
    var seen = {};
    (items || []).forEach(function (item) {
      if (!isSpirit(item) || !inStock(item)) return;
      var id = String(item.id || item.name);
      if (seen[id]) return;
      seen[id] = 1;
      var have = {};
      nameTokens(item).forEach(function (word) { have[word] = 1; });
      var covered = want.every(function (word) { return have[word]; });
      if (covered) hits.push(item);
    });
    if (!hits.length) return { action: 'none' };
    hits.sort(function (a, b) { return nameTokens(a).length - nameTokens(b).length; });
    var tight = hits.filter(function (item) { return nameTokens(item).length === nameTokens(hits[0]).length; });
    var signature = norm(tight[0].name) + '|' + Number(tight[0].price);
    var sameProduct = tight.every(function (item) { return norm(item.name) + '|' + Number(item.price) === signature; });
    if (sameProduct) return { action: 'one', item: tight[0] };
    return { action: 'ambiguous', items: tight };
  }

  function familyHits(base, items) {
    var words = FAMILY[String(base || '').toLowerCase()] || [norm(base)];
    return (items || []).filter(function (item) {
      if (!isSpirit(item) || !inStock(item)) return false;
      var tokens = norm([item.name, item.desc, item.description].join(' ')).split(' ');
      return words.some(function (word) { return word && tokens.indexOf(word) >= 0; });
    });
  }

  function classicItem(row, price, note) {
    return {
      action: 'place',
      item: {
        id: 'classic:' + (row.id || norm(row.name).toLowerCase().replace(/\s+/g, '-')),
        name: row.name,
        price: price,
        category: 'cocktails',
        catIds: ['cocktails'],
        station: 'Bar',
        modifiers: [],
        source: 'classic',
        active: true,
        description: 'Standard classic'
      },
      preset: { mods: {}, notes: note || '', price: price }
    };
  }

  function quoteClassic(row, items, spoken) {
    if (!row || !row.name) return null;
    var extra = '';
    var need = String((spoken && spoken.need) || '');
    if (/^unparsed:/i.test(need)) extra = need.replace(/^unparsed:\s*/i, '');
    if (extra) {
      var named = matchSpirit(extra, items);
      if (named.action === 'ambiguous') {
        return { action: 'draft', need: 'which ' + (row.base || 'spirit') + ' bottle', name: row.name };
      }
      if (named.action === 'one') {
        var quote = normalizeSpirit(named.item);
        if (!quote.ok) return { action: 'draft', need: 'no selling price for ' + named.item.name, name: row.name };
        if (quote.premium) {
          var oz = spokenOunces((spoken && spoken.text) || extra);
          if (oz !== 1 && oz !== 2) {
            return {
              action: 'draft',
              need: 'premium spirit — the cocktail recipe does not say how many ounces of ' + named.item.name + ' to price',
              name: row.name
            };
          }
          var spiritPrice = oz === 1 ? quote.price1 : quote.price2;
          return classicItem(row, money(spiritPrice + PREMIUM_ADD), named.item.name + ' · ' + oz + ' oz');
        }
        return classicItem(row, CLASSIC_PRICE, named.item.name);
      }
      return null;
    }
    var stocked = familyHits(row.base, items);
    if (!stocked.length) return null;
    var quotes = stocked.map(normalizeSpirit).filter(function (quote) { return quote.ok; });
    if (!quotes.length) return { action: 'draft', need: 'spirit price is missing', name: row.name };
    if (!quotes.some(function (quote) { return !quote.premium; })) {
      return { action: 'draft', need: 'only premium ' + (row.base || 'spirit') + ' is on the bar — say which bottle', name: row.name };
    }
    return classicItem(row, CLASSIC_PRICE, '');
  }

  function quoteSpirit(phrase, items) {
    var ounces = spokenOunces(phrase);
    if (ounces === 0) return { action: 'draft', need: 'pour must be 1 oz or 2 oz', name: '' };
    var named = matchSpirit(phrase, items);
    if (named.action === 'none') return null;
    if (named.action === 'ambiguous') {
      return { action: 'draft', need: 'which bottle', name: named.items.map(function (item) { return item.name; }).slice(0, 4).join(' / ') };
    }
    var quote = normalizeSpirit(named.item);
    if (!quote.ok) return { action: 'draft', need: quote.reason, name: named.item.name };
    var oz = ounces == null ? STANDARD_POUR_OZ : ounces;
    var price = oz === 1 ? quote.price1 : quote.price2;
    return {
      action: 'place',
      item: named.item,
      preset: { mods: {}, notes: oz + ' oz', price: price },
      quote: quote
    };
  }

  var api = {
    STANDARD_POUR_OZ: STANDARD_POUR_OZ,
    SHORT_POUR_OZ: SHORT_POUR_OZ,
    PREMIUM_PER_OZ: PREMIUM_PER_OZ,
    CLASSIC_PRICE: CLASSIC_PRICE,
    PREMIUM_ADD: PREMIUM_ADD,
    norm: norm,
    normalizeSpirit: normalizeSpirit,
    matchSpirit: matchSpirit,
    quoteClassic: quoteClassic,
    quoteSpirit: quoteSpirit,
    isSpirit: isSpirit
  };
  root.EPICUREAN_PRICE = api;
  if (typeof globalThis !== 'undefined') globalThis.EPICUREAN_PRICE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
