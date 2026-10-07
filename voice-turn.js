/* Conversational state for restaurant Voice.
   The Build 58 parser still decides what a phrase is.
   This layer decides whether that phrase is a new order, a spoken
   confirmation, a modifier, or something we must not guess.
   It does not send, fire, or keep guest audio. */
(function (root) {
  var FILLER = {
    A: 1, AN: 1, THE: 1, PLEASE: 1, THANKS: 1, THANK: 1, YOU: 1, YES: 1,
    YEAH: 1, OK: 1, OKAY: 1, BOTTLE: 1, OF: 1, AND: 1, ML: 1, MILLILITER: 1,
    MILLILITERS: 1, LITER: 1, LITERS: 1, GLASS: 1, VIN: 1, LIN: 1, WINE: 1,
    ITS: 1, IT: 1, FOR: 1, TO: 1, ON: 1, AT: 1
  };
  var TEMPS = [
    ['MEDIUM RARE', ['MR', 'MEDIUM RARE', 'MED RARE', 'MEDIUM-RARE']],
    ['MEDIUM WELL', ['MW', 'MEDIUM WELL', 'MED WELL', 'MEDIUM-WELL']],
    ['WELL DONE', ['WD', 'WELL DONE', 'WELL']],
    ['MEDIUM', ['M', 'MEDIUM']],
    ['RARE', ['R', 'RARE']]
  ];

  function norm(s) {
    return String(s == null ? '' : s)
      .toUpperCase()
      .replace(/[^\w\s0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(s) {
    var n = norm(s);
    return n ? n.split(' ') : [];
  }

  function createState() {
    return { activeSeat: null, last: null, pending: null };
  }

  function isDrink(item) {
    if (!item) return false;
    if (item.byTheGlass || item.scaliniOnly || item.source === 'wine' || item.source === 'bar') return true;
    var blob = [item.category, item.kind, (item.catIds || []).join(' ')].join(' ').toLowerCase();
    return /cocktail|mocktail|beer|wine|spirit|coffee|soft|after/.test(blob);
  }

  function wordsOf(item) {
    var bag = [];
    function add(value) {
      tokens(value).forEach(function (word) {
        if (word && bag.indexOf(word) < 0) bag.push(word);
      });
    }
    if (!item) return bag;
    add(item.name);
    add(item.producer);
    add(item.voiceKeyword);
    (item.voiceAliases || []).forEach(add);
    if (item.vintage && String(item.vintage) !== 'NV') add(item.vintage);
    if (item.vin) add(item.vin);
    if (item.lin) add(item.lin);
    var size = String(item.size || '');
    var digits = size.replace(/[^\d]/g, '');
    if (digits) add(digits);
    return bag;
  }

  function remember(state, placed) {
    state = state || createState();
    var item = placed.item || {};
    var next = {
      activeSeat: placed.seat != null ? placed.seat : state.activeSeat,
      pending: null,
      last: {
        lineId: placed.lineId || '',
        itemId: String(item.id || ''),
        seat: placed.seat != null ? placed.seat : state.activeSeat,
        name: item.name || '',
        producer: item.producer || '',
        vintage: item.vintage || '',
        size: item.size || '',
        vin: String(item.vin || ''),
        lin: String(item.lin || ''),
        words: wordsOf(item),
        notes: placed.notes || ''
      }
    };
    return next;
  }

  function spokenSize(size) {
    var raw = String(size || '').trim();
    if (!raw) return '';
    var ml = raw.match(/^(\d+(?:\.\d+)?)\s*ml$/i);
    if (ml) return ml[1] + ' milliliter';
    var liter = raw.match(/^(\d+(?:\.\d+)?)\s*l$/i);
    if (liter) return liter[1] + ' liter';
    return raw;
  }

  function confirmationSpeech(seatLabel, item, notes) {
    item = item || {};
    var seat = seatLabel || 'Seat';
    if (isDrink(item) && (item.vin || item.lin || item.source === 'wine')) {
      var name = String(item.name || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      var producer = String(item.producer || '').trim();
      if (producer && name.toUpperCase().indexOf(producer.toUpperCase()) !== 0) name = producer + ' ' + name;
      var vintage = String(item.vintage || '');
      if (vintage && vintage !== 'NV') name = name.replace(new RegExp('\\b' + vintage + '\\b'), ' ').replace(/\s+/g, ' ').trim();
      var tail = [name];
      if (vintage && vintage !== 'NV') tail.push(vintage);
      var size = spokenSize(item.size);
      if (size) tail.push(size);
      if (item.vin) tail.push('VIN ' + item.vin);
      else if (item.lin) tail.push('LIN ' + item.lin);
      return seat + '. ' + tail.filter(Boolean).join(', ') + '.';
    }
    var line = seat + '. ' + String(item.name || 'Item') + '.';
    var extra = String(notes || '').trim();
    if (extra && extra.length <= 42) line = line.replace(/\.$/, '') + ', ' + extra + '.';
    return line;
  }

  function remainder(text, parsed) {
    var s = String(text || '');
    if (parsed && parsed.positionTouched && parsed.seat != null) {
      s = s.replace(new RegExp('\\b' + parsed.seat + '\\s*a\\b', 'ig'), ' ');
      s = s.replace(new RegExp('^\\s*' + parsed.seat + '\\b'), ' ');
      s = s.replace(new RegExp('\\b' + parsed.seat + '\\s*$'), ' ');
    }
    return s.replace(/\s+/g, ' ').trim();
  }

  function contentTokens(text) {
    return tokens(text).filter(function (word) { return !FILLER[word]; });
  }

  function correctionCue(text) {
    return /\b(instead|change that|make it|rather|switch)\b/i.test(String(text || ''));
  }

  function modifierCue(text) {
    var n = norm(text);
    if (!n) return false;
    if (/^(MEDIUM RARE|MEDIUM WELL|MEDIUM|RARE|WELL DONE)$/.test(n)) return true;
    return /^(WITHOUT|NO|HOLD|ALLERGY|ALLERGIC)\b/.test(n);
  }

  var BOTTLE_SIZE = { '187': 1, '375': 1, '500': 1, '750': 1, '1500': 1, '3000': 1 };

  function bottleSizeWord(word) {
    if (BOTTLE_SIZE[word]) return true;
    return /^(187|375|500|750|1500|3000)ML$/.test(word);
  }

  function uncovered(text, words, last) {
    var known = {};
    (words || []).forEach(function (word) { known[word] = 1; });
    var coded = !!(last && (last.vin || last.lin || last.size));
    return contentTokens(text).filter(function (word) {
      if (known[word]) return false;
      if (word.length < 3) return false;
      if (coded && bottleSizeWord(word)) return false;
      return true;
    });
  }

  function isConfirmation(state, text, parsed, item) {
    var last = state && state.last;
    if (!last) return false;
    if (parsed && parsed.positionTouched) return false;
    if (correctionCue(text)) return false;
    var body = remainder(text, parsed);
    if (modifierCue(body) && !last.words.some(function (word) { return contentTokens(body).indexOf(word) >= 0 && word.length >= 4; })) {
      return false;
    }
    var sameItem = item && last.itemId && String(item.id) === String(last.itemId);
    var overlap = contentTokens(body).some(function (word) {
      if (last.vin && word === last.vin) return true;
      if (last.lin && word === last.lin) return true;
      return word.length >= 4 && last.words.indexOf(word) >= 0;
    });
    if (!sameItem && !overlap) return false;
    if (uncovered(body, last.words, last).length) return false;
    return true;
  }

  function splitRequest(body) {
    var text = String(body || '').trim();
    var match = text.match(/^(.*?)(?:\s+)(without\b.*|no\b.*|hold the\b.*|hold\b.*|allergy\b.*|allergic\b.*)$/i);
    if (!match) return { dish: text, note: '' };
    return { dish: String(match[1] || '').trim(), note: String(match[2] || '').trim() };
  }

  function uniqueFood(phrase, catalog) {
    var q = norm(phrase);
    if (!q || q.length < 3 || modifierCue(q)) return [];
    var hits = [];
    var seen = {};
    (catalog || []).forEach(function (item) {
      if (!item || item.active === false || item.eightySixed || isDrink(item)) return;
      var id = String(item.id || '');
      if (!id || seen[id]) return;
      var names = [item.name, item.voiceKeyword].concat(item.voiceAliases || []);
      var matched = names.some(function (name) {
        var key = norm(name);
        if (!key) return false;
        if (key === q) return true;
        return key.split(' ').indexOf(q) >= 0;
      });
      if (!matched) return;
      seen[id] = 1;
      hits.push(item);
    });
    return hits;
  }

  function tempChoice(phrase, item) {
    var n = norm(phrase);
    var group = ((item && item.modifiers) || []).filter(function (mod) {
      return mod && /temp/i.test(String(mod.group || ''));
    })[0];
    if (!group) return null;
    var options = group.options || [];
    var i;
    for (i = 0; i < TEMPS.length; i++) {
      if (n !== TEMPS[i][0]) continue;
      var aliases = TEMPS[i][1];
      var j;
      for (j = 0; j < aliases.length; j++) {
        var want = norm(aliases[j]);
        var hit = options.filter(function (opt) { return norm(opt) === want; })[0];
        if (hit) return { group: group.group, option: hit };
      }
      return null;
    }
    return null;
  }

  function needsTemp(item) {
    return ((item && item.modifiers) || []).some(function (mod) {
      return mod && /temp/i.test(String(mod.group || '')) && (mod.options || []).length;
    });
  }

  function lineForSeat(lines, seat) {
    var found = null;
    (lines || []).forEach(function (line) {
      if (!line) return;
      if (seat != null && String(line.seat) !== String(seat)) return;
      found = line;
    });
    return found;
  }

  function withSeat(state, seat) {
    var next = {
      activeSeat: seat != null ? seat : state.activeSeat,
      last: state.last,
      pending: state.pending
    };
    return next;
  }

  function decide(state, input) {
    state = state || createState();
    input = input || {};
    var parsed = input.parsed || {};
    var text = String(input.text || '');
    var item = input.item || null;
    var seat = parsed.positionTouched ? parsed.seat : (state.pending && state.pending.seat != null ? state.pending.seat : (state.activeSeat != null ? state.activeSeat : input.activeSeat));
    if (parsed.kind === 'position') {
      return {
        action: 'position',
        state: withSeat(state, parsed.seat),
        seat: parsed.seat,
        status: ''
      };
    }
    if (parsed.kind === 'pass' || parsed.kind === 'noDrink') {
      return {
        action: 'service',
        state: withSeat(state, parsed.positionTouched ? parsed.seat : state.activeSeat),
        seat: parsed.positionTouched ? parsed.seat : seat,
        status: ''
      };
    }
    if (isConfirmation(state, text, parsed, item)) {
      return {
        action: 'confirm',
        state: state,
        seat: state.last.seat,
        status: 'Confirmed ' + (state.last.name || '')
      };
    }
    var body = remainder(text, parsed);
    var parts = splitRequest(body);
    var temp = tempChoice(parts.dish || body, (state.pending && state.pending.item) || item);
    if (!temp && state.pending && state.pending.item) temp = tempChoice(body, state.pending.item);
    if (temp && state.pending && String(state.pending.seat) === String(seat)) {
      var mods = {};
      mods[temp.group] = temp.option;
      return {
        action: 'place',
        food: true,
        state: { activeSeat: seat, last: state.last, pending: null },
        item: state.pending.item,
        seat: state.pending.seat,
        mods: mods,
        notes: state.pending.notes || '',
        status: ''
      };
    }
    if (modifierCue(body) && !uniqueFood(parts.dish, input.catalog).length) {
      var target = lineForSeat(input.lines, seat);
      if (state.pending && String(state.pending.seat) === String(seat)) {
        var pending = {
          item: state.pending.item,
          seat: state.pending.seat,
          notes: [state.pending.notes, body].filter(Boolean).join(' · '),
          mods: state.pending.mods || {}
        };
        return {
          action: 'hold',
          state: { activeSeat: seat, last: state.last, pending: pending },
          seat: seat,
          status: (seat != null ? String(seat) : 'Seat') + '. ' + (pending.item.name || 'Item')
        };
      }
      if (target) {
        return {
          action: 'modifier',
          state: withSeat(state, seat),
          lineId: target.lineId,
          notes: body,
          seat: seat,
          status: (seat != null ? String(seat) : 'Seat') + '. ' + body
        };
      }
      return { action: 'draft', state: withSeat(state, seat), status: '' };
    }
    if (parsed.confidence === 'HIGH' && item) {
      if (correctionCue(text) && state.last && String(item.id) !== String(state.last.itemId)) {
        return {
          action: 'place',
          state: withSeat(state, parsed.positionTouched ? parsed.seat : state.activeSeat),
          item: item,
          seat: parsed.positionTouched ? parsed.seat : seat,
          replaceLineId: state.last.lineId,
          notes: parts.note || '',
          status: ''
        };
      }
      return {
        action: 'place',
        state: withSeat(state, parsed.positionTouched ? parsed.seat : state.activeSeat),
        item: item,
        seat: parsed.positionTouched ? parsed.seat : seat,
        notes: parts.note || '',
        status: ''
      };
    }
    var foods = uniqueFood(parts.dish, input.catalog);
    if (foods.length === 1) {
      var food = foods[0];
      var foodSeat = parsed.positionTouched ? parsed.seat : seat;
      var foodTemp = tempChoice(body, food);
      var foodMods = {};
      if (foodTemp) foodMods[foodTemp.group] = foodTemp.option;
      if (needsTemp(food) && !foodTemp) {
        return {
          action: 'hold',
          state: {
            activeSeat: foodSeat,
            last: state.last,
            pending: { item: food, seat: foodSeat, notes: parts.note || '', mods: {} }
          },
          seat: foodSeat,
          item: food,
          status: String(foodSeat) + '. ' + food.name
        };
      }
      return {
        action: 'place',
        food: true,
        state: { activeSeat: foodSeat, last: state.last, pending: null },
        item: food,
        seat: foodSeat,
        mods: foodMods,
        notes: parts.note || '',
        status: ''
      };
    }
    if (foods.length > 1) return { action: 'draft', state: withSeat(state, seat), status: '' };
    return { action: 'draft', state: withSeat(state, seat), status: '' };
  }

  var api = {
    createState: createState,
    decide: decide,
    remember: remember,
    confirmationSpeech: confirmationSpeech,
    norm: norm
  };
  root.EPICUREAN_VOICE_TURN = api;
  if (typeof globalThis !== 'undefined') globalThis.EPICUREAN_VOICE_TURN = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
