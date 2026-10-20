/* Cocktail identity for Epicurean Voice.
   These rows are original: a conventional name, aliases, a base spirit,
   and a family. They are not recipes. Ounce formulas, method prose, and
   third-party cocktail databases are not included.
   BOH still decides which drink can be sold, and at what price. */
(function (root) {
  var ROWS = [
    'martini|Martini|gin|martini|Vodka Martini=vodka;Gin Martini=gin;Dry Martini=dry',
    'dirty-martini|Dirty Martini|gin|martini|Filthy Martini=filthy',
    'gibson|Gibson|gin|martini',
    'vesper|Vesper|gin|martini',
    'espresso-martini|Espresso Martini|vodka|martini',
    'french-martini|French Martini|vodka|martini',
    'pornstar-martini|Pornstar Martini|vodka|martini|Porn Star Martini',
    'lychee-martini|Lychee Martini|vodka|martini',
    'lemon-drop|Lemon Drop|vodka|sour',
    'appletini|Appletini|vodka|martini|Apple Martini',
    'whiskey-sour|Whiskey Sour|whiskey|sour|Whisky Sour',
    'amaretto-sour|Amaretto Sour|amaretto|sour',
    'pisco-sour|Pisco Sour|pisco|sour',
    'new-york-sour|New York Sour|whiskey|sour',
    'daiquiri|Daiquiri|rum|sour',
    'hemingway-daiquiri|Hemingway Daiquiri|rum|sour',
    'clover-club|Clover Club|gin|sour',
    'gin-fizz|Gin Fizz|gin|fizz',
    'ramos-gin-fizz|Ramos Gin Fizz|gin|fizz|Ramos Fizz',
    'silver-fizz|Silver Fizz|gin|fizz',
    'tom-collins|Tom Collins|gin|collins',
    'john-collins|John Collins|whiskey|collins',
    'whiskey-collins|Whiskey Collins|whiskey|collins',
    'margarita|Margarita|tequila|sour',
    'tommys-margarita|Tommys Margarita|tequila|sour|Tommy Margarita',
    'cadillac-margarita|Cadillac Margarita|tequila|sour',
    'sidecar|Sidecar|cognac|sour',
    'cosmopolitan|Cosmopolitan|vodka|sour|Cosmo',
    'aviation|Aviation|gin|sour',
    'bees-knees|Bees Knees|gin|sour|Bee Knees',
    'last-word|Last Word|gin|sour',
    'paper-plane|Paper Plane|whiskey|sour',
    'gold-rush|Gold Rush|bourbon|sour',
    'penicillin|Penicillin|whiskey|sour',
    'corpse-reviver|Corpse Reviver|gin|sour|Corpse Reviver No 2',
    'white-lady|White Lady|gin|sour',
    'between-the-sheets|Between the Sheets|cognac|sour',
    'jack-rose|Jack Rose|brandy|sour',
    'gimlet|Gimlet|gin|sour|Vodka Gimlet=vodka',
    'caipirinha|Caipirinha|cachaca|sour',
    'caipiroska|Caipiroska|vodka|sour',
    'mojito|Mojito|rum|highball',
    'dark-and-stormy|Dark and Stormy|rum|highball|Dark n Stormy',
    'moscow-mule|Moscow Mule|vodka|highball',
    'mexican-mule|Mexican Mule|tequila|highball',
    'kentucky-mule|Kentucky Mule|bourbon|highball',
    'irish-mule|Irish Mule|whiskey|highball',
    'london-mule|London Mule|gin|highball',
    'french-mule|French Mule|cognac|highball',
    'french-75|French 75|gin|sparkling',
    'french-76|French 76|vodka|sparkling',
    'aperol-spritz|Aperol Spritz|aperol|spritz',
    'campari-spritz|Campari Spritz|campari|spritz',
    'hugo-spritz|Hugo Spritz|prosecco|spritz|Hugo',
    'limoncello-spritz|Limoncello Spritz|prosecco|spritz',
    'bellini|Bellini|prosecco|sparkling',
    'mimosa|Mimosa|champagne|sparkling|Bucks Fizz',
    'kir|Kir|wine|sparkling',
    'kir-royale|Kir Royale|champagne|sparkling',
    'sgroppino|Sgroppino|prosecco|sparkling',
    'rossini|Rossini|prosecco|sparkling',
    'southside|Southside|gin|sour',
    'bronx|Bronx|gin|martini',
    'old-fashioned|Old Fashioned|whiskey|old-fashioned|Old Fashioned Cocktail;Rum Old Fashioned=rum;Tequila Old Fashioned=tequila;Mezcal Old Fashioned=mezcal;Oaxaca Old Fashioned=mezcal;Oaxacan Old Fashioned=mezcal;Wisconsin Old Fashioned=brandy',
    'manhattan|Manhattan|whiskey|manhattan|Perfect Manhattan=perfect;Dry Manhattan=dry',
    'rob-roy|Rob Roy|scotch|manhattan|Perfect Rob Roy=perfect',
    'brooklyn|Brooklyn|rye|manhattan',
    'red-hook|Red Hook|rye|manhattan',
    'greenpoint|Greenpoint|rye|manhattan',
    'little-italy|Little Italy|rye|manhattan',
    'cobble-hill|Cobble Hill|rye|manhattan',
    'negroni|Negroni|gin|negroni',
    'white-negroni|White Negroni|gin|negroni',
    'mezcal-negroni|Mezcal Negroni|mezcal|negroni',
    'kingston-negroni|Kingston Negroni|rum|negroni',
    'sbagliato|Negroni Sbagliato|prosecco|negroni|Sbagliato',
    'boulevardier|Boulevardier|whiskey|negroni',
    'americano|Americano|campari|negroni',
    'old-pal|Old Pal|rye|negroni',
    'cardinale|Cardinale|gin|negroni',
    'enzoni|Enzoni|gin|negroni',
    'martinez|Martinez|gin|martini',
    'bijou|Bijou|gin|martini',
    'hanky-panky|Hanky Panky|gin|martini',
    'vieux-carre|Vieux Carre|rye|old-fashioned',
    'sazerac|Sazerac|rye|old-fashioned',
    'de-la-louisiane|De La Louisiane|rye|old-fashioned',
    'mint-julep|Mint Julep|bourbon|julep',
    'whiskey-smash|Whiskey Smash|whiskey|julep',
    'irish-coffee|Irish Coffee|whiskey|hot',
    'hot-toddy|Hot Toddy|whiskey|hot',
    'rusty-nail|Rusty Nail|scotch|duo',
    'godfather|Godfather|scotch|duo',
    'godmother|Godmother|vodka|duo',
    'black-russian|Black Russian|vodka|duo',
    'white-russian|White Russian|vodka|duo',
    'colorado-bulldog|Colorado Bulldog|vodka|duo',
    'brave-bull|Brave Bull|tequila|duo',
    'mudslide|Mudslide|vodka|duo',
    'revolver|Revolver|bourbon|manhattan',
    'toronto|Toronto|whiskey|manhattan',
    'black-manhattan|Black Manhattan|whiskey|manhattan',
    'remember-the-maine|Remember the Maine|rye|manhattan',
    'blood-and-sand|Blood and Sand|scotch|sour',
    'bobby-burns|Bobby Burns|scotch|manhattan',
    'bamboo|Bamboo|sherry|sherry',
    'adonis|Adonis|sherry|sherry',
    'affinity|Affinity|scotch|manhattan',
    'tipperary|Tipperary|whiskey|manhattan',
    'lucien-gaudin|Lucien Gaudin|gin|martini',
    'income-tax|Income Tax|gin|martini',
    'pink-gin|Pink Gin|gin|martini',
    'final-ward|Final Ward|rye|sour',
    'army-navy|Army and Navy|gin|sour|Army Navy',
    'trinidad-sour|Trinidad Sour|whiskey|sour',
    'gin-and-tonic|Gin and Tonic|gin|highball|G and T;Gin Tonic',
    'vodka-tonic|Vodka Tonic|vodka|highball|Vodka and Tonic',
    'vodka-soda|Vodka Soda|vodka|highball',
    'rum-and-coke|Rum and Coke|rum|highball|Cuba Libre',
    'paloma|Paloma|tequila|highball',
    'ranch-water|Ranch Water|tequila|highball',
    'batanga|Batanga|tequila|highball',
    'cantaro|Cantarito|tequila|highball',
    'whiskey-ginger|Whiskey Ginger|whiskey|highball|Whisky Ginger',
    'horses-neck|Horses Neck|bourbon|highball|Horse Neck',
    'presbyterian|Presbyterian|whiskey|highball',
    'seven-and-seven|Seven and Seven|whiskey|highball|7 and 7',
    'gin-rickey|Gin Rickey|gin|highball',
    'vodka-rickey|Vodka Rickey|vodka|highball',
    'bloody-mary|Bloody Mary|vodka|savory',
    'bloody-caesar|Bloody Caesar|vodka|savory',
    'bloody-maria|Bloody Maria|tequila|savory',
    'red-snapper|Red Snapper|gin|savory',
    'michelada|Michelada|beer|savory',
    'screwdriver|Screwdriver|vodka|highball',
    'greyhound|Greyhound|vodka|highball',
    'salty-dog|Salty Dog|vodka|highball',
    'sea-breeze|Sea Breeze|vodka|highball',
    'bay-breeze|Bay Breeze|vodka|highball',
    'cape-codder|Cape Codder|vodka|highball|Cape Cod',
    'madras|Madras|vodka|highball',
    'sex-on-the-beach|Sex on the Beach|vodka|highball',
    'woo-woo|Woo Woo|vodka|highball',
    'tequila-sunrise|Tequila Sunrise|tequila|highball',
    'tequila-sunset|Tequila Sunset|tequila|highball',
    'harvey-wallbanger|Harvey Wallbanger|vodka|highball',
    'long-island|Long Island Iced Tea|vodka|highball|Long Island',
    'long-beach|Long Beach Iced Tea|vodka|highball|Long Beach',
    'tokyo-tea|Tokyo Iced Tea|vodka|highball|Tokyo Tea',
    'mai-tai|Mai Tai|rum|tiki',
    'zombie|Zombie|rum|tiki',
    'hurricane|Hurricane|rum|tiki',
    'painkiller|Painkiller|rum|tiki',
    'pina-colada|Pina Colada|rum|tiki|Pina Colada',
    'blue-hawaiian|Blue Hawaiian|rum|tiki',
    'blue-lagoon|Blue Lagoon|vodka|highball',
    'planters-punch|Planters Punch|rum|tiki|Planter Punch',
    'singapore-sling|Singapore Sling|gin|tiki',
    'jungle-bird|Jungle Bird|rum|tiki',
    'bahama-mama|Bahama Mama|rum|tiki',
    'rum-runner|Rum Runner|rum|tiki',
    'yellow-bird|Yellow Bird|rum|tiki',
    'navy-grog|Navy Grog|rum|tiki',
    'three-dots|Three Dots and a Dash|rum|tiki',
    'saturn|Saturn|gin|tiki',
    'fog-cutter|Fog Cutter|rum|tiki',
    'scorpion|Scorpion|rum|tiki',
    'garibaldi|Garibaldi|campari|spritz',
    'bicicletta|Bicicletta|campari|spritz',
    'campari-soda|Campari Soda|campari|highball',
    'french-connection|French Connection|cognac|duo',
    'brandy-alexander|Brandy Alexander|brandy|duo',
    'stinger|Stinger|cognac|duo',
    'b-52|B 52|coffee|duo|B52',
    'kamikaze|Kamikaze|vodka|shot',
    'el-diablo|El Diablo|tequila|highball',
    'siesta|Siesta|tequila|sour',
    'naked-and-famous|Naked and Famous|mezcal|sour',
    'division-bell|Division Bell|mezcal|sour',
    'matador|Matador|tequila|sour',
    'rosita|Rosita|tequila|negroni',
    'el-presidente|El Presidente|rum|sour',
    'mary-pickford|Mary Pickford|rum|sour',
    'air-mail|Air Mail|rum|sparkling',
    'queens-park|Queens Park Swizzle|rum|tiki|Queen Park Swizzle',
    'ti-punch|Ti Punch|rum|tiki',
    'hotel-nacional|Hotel Nacional|rum|sour',
    'corn-and-oil|Corn and Oil|rum|tiki',
    'old-cuban|Old Cuban|rum|sparkling',
    'seelbach|Seelbach|bourbon|sparkling',
    'champagne-cocktail|Champagne Cocktail|champagne|sparkling',
    'death-in-the-afternoon|Death in the Afternoon|champagne|sparkling',
    'pisco-punch|Pisco Punch|pisco|sour',
    'chilcano|Chilcano|pisco|highball',
    'alabama-slammer|Alabama Slammer|whiskey|highball',
    'fuzzy-navel|Fuzzy Navel|schnapps|highball',
    'hairy-navel|Hairy Navel|vodka|highball',
    'midori-sour|Midori Sour|melon|sour',
    'amf|AMF|vodka|highball|Adios Motherfucker',
    'jagerbomb|Jagerbomb|whiskey|shot|Jager Bomb',
    'washington-apple|Washington Apple|whiskey|shot',
    'mind-eraser|Mind Eraser|vodka|shot',
    'buttery-nipple|Buttery Nipple|schnapps|shot',
    'mudslide-frozen|Frozen Mudslide|vodka|duo',
    'bushwacker|Bushwacker|rum|tiki',
    'miami-vice|Miami Vice|rum|tiki',
    'gin-sour|Gin Sour|gin|sour',
    'brandy-sour|Brandy Sour|brandy|sour',
    'brandy-crusta|Brandy Crusta|brandy|sour',
    'contessa|Contessa|gin|negroni',
    'cynar-spritz|Cynar Spritz|cynar|spritz',
    'select-spritz|Select Spritz|aperol|spritz',
    'highball|Highball|whiskey|highball',
    'gin-buck|Gin Buck|gin|highball',
  ];

  var SPIRIT_WORDS = {
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
    amaretto: ['AMARETTO'],
    coffee: ['COFFEE', 'KAHLUA'],
    champagne: ['CHAMPAGNE', 'PROSECCO', 'SPARKLING'],
    prosecco: ['PROSECCO', 'CHAMPAGNE', 'SPARKLING'],
    wine: ['WINE'],
    sherry: ['SHERRY'],
    cachaca: ['CACHACA'],
    absinthe: ['ABSINTHE'],
    beer: ['BEER', 'LAGER', 'ALE'],
    schnapps: ['SCHNAPPS'],
    melon: ['MIDORI', 'MELON'],
    cynar: ['CYNAR']
  };

  var MODS = [
    ['SHAKEN NOT STIRRED', 'shaken, not stirred'],
    ['STUFFED OLIVES', 'stuffed olives'],
    ['BLEU CHEESE OLIVES', 'bleu cheese olives'],
    ['BLUE CHEESE OLIVES', 'blue cheese olives'],
    ['EXTRA DIRTY', 'extra dirty'],
    ['EXTRA DRY', 'extra dry'],
    ['EXTRA OLIVES', 'extra olives'],
    ['EXTRA OLIVE', 'extra olive'],
    ['EXTRA GARNISH', 'extra garnish'],
    ['NO GARNISH', 'no garnish'],
    ['ON THE ROCKS', 'on the rocks'],
    ['LEMON TWIST', 'lemon twist'],
    ['ORANGE TWIST', 'orange twist'],
    ['SHAKEN', 'shaken'],
    ['STIRRED', 'stirred'],
    ['FILTHY', 'filthy'],
    ['DIRTY', 'dirty'],
    ['PERFECT', 'perfect'],
    ['NEAT', 'neat'],
    ['ROCKS', 'rocks'],
    ['DOUBLE', 'double'],
    ['BOURBON', 'bourbon'],
    ['TEQUILA', 'tequila'],
    ['MEZCAL', 'mezcal'],
    ['SCOTCH', 'scotch'],
    ['VODKA', 'vodka'],
    ['BRANDY', 'brandy'],
    ['OLIVES', 'olives'],
    ['OLIVE', 'olive'],
    ['TWIST', 'twist'],
    ['GIN', 'gin'],
    ['RYE', 'rye'],
    ['RUM', 'rum'],
    ['DRY', 'dry'],
    ['UP', 'up']
  ];

  var FILLER = {
    A: 1, AN: 1, THE: 1, PLEASE: 1, THANKS: 1, THANK: 1, YOU: 1,
    OF: 1, AND: 1, FOR: 1, TO: 1, WITH: 1, ME: 1, US: 1, SOME: 1,
    MAKE: 1, IT: 1, ILL: 1, HAVE: 1, LIKE: 1, WANT: 1, GET: 1, JUST: 1,
    ID: 1, CAN: 1, I: 1, WE: 1, ONE: 1, DRINK: 1
  };

  function norm(s) {
    return String(s == null ? '' : s)
      .toUpperCase()
      .replace(/&/g, ' AND ')
      .replace(/[^\w\s0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function content(s) {
    var n = norm(s);
    if (!n) return '';
    return n.split(' ').filter(function (word) { return word && !FILLER[word]; }).join(' ');
  }

  function parseRow(row) {
    var parts = String(row).split('|');
    var aliases = [];
    var aliasMods = {};
    String(parts[4] || '').split(';').forEach(function (bit) {
      if (!bit) return;
      var cut = bit.split('=');
      var name = norm(cut[0]);
      if (!name) return;
      aliases.push(name);
      if (cut[1]) aliasMods[name] = String(cut[1]).toLowerCase();
    });
    return {
      id: parts[0],
      name: parts[1],
      base: parts[2] || '',
      family: parts[3] || '',
      aliases: aliases,
      aliasMods: aliasMods
    };
  }

  var IDENTITIES = ROWS.map(parseRow);
  var PHRASES = [];
  IDENTITIES.forEach(function (row) {
    PHRASES.push({ key: norm(row.name), row: row, mod: '' });
    row.aliases.forEach(function (alias) {
      PHRASES.push({ key: alias, row: row, mod: row.aliasMods[alias] || '' });
    });
  });
  PHRASES.sort(function (a, b) { return b.key.length - a.key.length; });

  function findPhrase(phrase) {
    var hay = ' ' + norm(phrase) + ' ';
    var i;
    for (i = 0; i < PHRASES.length; i++) {
      var key = PHRASES[i].key;
      if (!key) continue;
      var at = hay.indexOf(' ' + key + ' ');
      if (at < 0) continue;
      var rest = (hay.slice(0, at) + ' ' + hay.slice(at + key.length + 2)).replace(/\s+/g, ' ').trim();
      return { row: PHRASES[i].row, key: key, mod: PHRASES[i].mod, rest: rest };
    }
    return null;
  }

  function takeMods(rest) {
    var hay = ' ' + String(rest || '') + ' ';
    var notes = [];
    var i;
    for (i = 0; i < MODS.length; i++) {
      var key = MODS[i][0];
      var at = hay.indexOf(' ' + key + ' ');
      if (at < 0) continue;
      notes.push(MODS[i][1]);
      hay = (hay.slice(0, at) + ' ' + hay.slice(at + key.length + 2)).replace(/\s+/g, ' ');
      hay = ' ' + hay.trim() + ' ';
      i = -1;
    }
    var unknown = hay.trim().split(' ').filter(function (word) { return word && !FILLER[word]; });
    return { notes: notes, unknown: unknown };
  }

  function isCocktailItem(it) {
    if (!it) return false;
    var blob = norm([it.kind, it.category, (it.catIds || []).join(' ')].join(' '));
    return /COCKTAIL/.test(blob);
  }

  function isSpiritItem(it) {
    if (!it || isCocktailItem(it)) return false;
    var blob = norm([it.kind, it.category, (it.catIds || []).join(' ')].join(' '));
    if (/BEER|WINE|MOCKTAIL|COFFEE|SOFT/.test(blob) && !/SPIRIT|AMARO|AFTER/.test(blob)) return false;
    return /SPIRIT|AMARO|AFTER|LIQUOR|DIGESTIF/.test(blob);
  }

  function inStock(it) {
    if (!it || it.active === false || it.eightySixed) return false;
    if (it.stock == null || it.stock === '') return true;
    return Number(it.stock) > 0;
  }

  function spiritFact(base, items) {
    var words = SPIRIT_WORDS[String(base || '').toLowerCase()] || [norm(base)];
    var hit = (items || []).some(function (it) {
      if (!isSpiritItem(it) || !inStock(it)) return false;
      var blob = norm([it.name, it.desc, it.description].join(' '));
      return words.some(function (word) { return blob.split(' ').indexOf(word) >= 0; });
    });
    var label = base ? (base.charAt(0).toUpperCase() + base.slice(1)) : 'The base spirit';
    return hit ? (label + ' is on the bar') : ('No ' + label.toLowerCase() + ' is listed on the bar');
  }

  function namedCocktails(items, name) {
    var want = norm(name);
    var hits = [];
    var seen = {};
    (items || []).forEach(function (it) {
      if (!isCocktailItem(it) || norm(it.name) !== want) return;
      var id = String(it.id || it.name);
      if (seen[id]) return;
      seen[id] = 1;
      hits.push(it);
    });
    return hits;
  }

  function chooseHouse(hits) {
    var sellable = hits.filter(inStock).filter(function (it) { return Number(it.price) > 0; });
    if (!sellable.length) return { action: 'unavailable', item: hits[0] || null };
    if (sellable.length === 1) return { action: 'place', item: sellable[0] };
    var price = Number(sellable[0].price);
    var same = sellable.every(function (it) { return Number(it.price) === price; });
    if (!same) return { action: 'ambiguous', items: sellable };
    var bar = sellable.filter(function (it) { return it.source === 'bar'; })[0];
    return { action: 'place', item: bar || sellable[0] };
  }

  function applyOption(item, notes) {
    var mods = {};
    var left = [];
    (notes || []).forEach(function (note) {
      var want = norm(note);
      var placed = false;
      ((item && item.modifiers) || []).forEach(function (group) {
        if (placed || !group) return;
        (group.options || []).forEach(function (opt) {
          if (placed) return;
          if (norm(opt && opt.name != null ? opt.name : opt) === want) {
            mods[group.group || group.name || 'Modifier'] = opt.name || opt;
            placed = true;
          }
        });
      });
      if (!placed) left.push(note);
    });
    return { mods: mods, notes: left.join(' · ') };
  }

  function draft(row, confidence, need, extra) {
    return {
      action: 'draft',
      confidence: confidence,
      name: row ? row.name : '',
      base: row ? row.base : '',
      family: row ? row.family : '',
      need: need || '',
      item: null,
      notes: (extra && extra.notes) || '',
      price: null
    };
  }

  function interpret(phrase, barItems) {
    var spoken = content(phrase);
    if (!spoken) return { action: 'none' };
    var exact = namedCocktails(barItems, spoken);
    if (exact.length) {
      var picked = chooseHouse(exact);
      if (picked.action === 'place') {
        return { action: 'place', item: picked.item, notes: '', mods: {}, name: picked.item.name, confidence: 'HIGH', price: Number(picked.item.price) };
      }
      if (picked.action === 'unavailable') return draft({ name: exact[0].name, base: '' }, 'MISSING', '86 — not available');
      return draft({ name: spoken, base: '' }, 'AMBIGUOUS', 'more than one house cocktail');
    }
    var found = findPhrase(phrase);
    if (!found) return { action: 'none' };
    var taken = takeMods(found.rest);
    if (found.mod) taken.notes.unshift(found.mod);
    if (taken.unknown.length) {
      return draft(found.row, 'MISSING', 'unparsed: ' + taken.unknown.join(' ').toLowerCase(), { notes: taken.notes.join(' · ') });
    }
    var house = namedCocktails(barItems, found.row.name);
    if (house.length) {
      var choice = chooseHouse(house);
      if (choice.action === 'place') {
        var applied = applyOption(choice.item, taken.notes);
        return {
          action: 'place',
          item: choice.item,
          notes: applied.notes,
          mods: applied.mods,
          name: choice.item.name,
          confidence: 'HIGH',
          price: Number(choice.item.price)
        };
      }
      if (choice.action === 'unavailable') return draft(found.row, 'MISSING', '86 — not available', { notes: taken.notes.join(' · ') });
      return draft(found.row, 'AMBIGUOUS', 'more than one house cocktail', { notes: taken.notes.join(' · ') });
    }
    return draft(found.row, 'UNPRICED', spiritFact(found.row.base, barItems), { notes: taken.notes.join(' · ') });
  }

  var api = {
    identities: IDENTITIES,
    norm: norm,
    interpret: interpret,
    spiritFact: spiritFact
  };
  root.EPICUREAN_VOICE_COCKTAILS = api;
  if (typeof globalThis !== 'undefined') globalThis.EPICUREAN_VOICE_COCKTAILS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
