/* Stage B beverage Voice engine.
   The published BOH revision is the only vocabulary authority.
   This file does not send, fire, or write a check. */
(function (root) {
  var DIGITS = {
    zero: '0', oh: '0', o: '0', one: '1', two: '2', three: '3', four: '4',
    five: '5', six: '6', seven: '7', eight: '8', nine: '9'
  };
  var CONFIDENCE = ['HIGH', 'AMBIGUOUS', 'MISSING', 'INVALID_CODE', 'NO_MATCH', 'STALE'];

  function normKeyword(s) {
    return String(s == null ? '' : s)
      .toUpperCase()
      .replace(/[^\w\s0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function asList(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(function (x) { return x != null && String(x).trim() !== ''; });
    return String(v).split(/[,;]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function isBeverage(it) {
    if (!it) return false;
    if (it.byTheGlass || it.scaliniOnly || it.source === 'wine' || it.source === 'bar') return true;
    var id = String(it.id || '');
    if (id.indexOf('btg_') === 0) return true;
    var blob = [it.category, it.kind, (it.catIds || []).join(' ')].join(' ').toLowerCase();
    return /cocktail|mocktail|beer|wine|spirit|coffee|soft|after/.test(blob);
  }

  function isBtg(it) {
    if (!it) return false;
    if (it.byTheGlass || it.scaliniOnly) return true;
    return String(it.id || '').indexOf('btg_') === 0;
  }

  function modifierGroups(item) {
    var mods = (item && item.modifiers) || [];
    var blob = String((item && item.category) || '') + ' ' + ((item && item.catIds) || []).join(' ');
    var wine = !!(item && (item.source === 'wine' || isBtg(item) || /wine/.test(blob)));
    if (wine && !isBtg(item)) {
      mods = mods.filter(function (m) { return !m || String(m.group || '') !== 'Pour'; });
    }
    var names = [];
    mods.forEach(function (m) {
      if (!m || !(m.options || []).length) return;
      names.push(String(m.group || 'modifier'));
    });
    return names;
  }

  function pushMap(map, key, entry) {
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(entry);
  }

  function buildIndex(entries, modifiers, revision) {
    var byKeyword = {};
    var byAlias = {};
    var bySource = {};
    var inactiveKeyword = {};
    var active = [];
    (entries || []).forEach(function (entry) {
      if (!entry || String(entry.scope || '') !== 'beverage') return;
      var copy = {
        key: entry.key || ((entry.sourceType || '') + ':' + (entry.sourceId || '')),
        sourceType: entry.sourceType || '',
        sourceId: String(entry.sourceId || ''),
        family: entry.family || '',
        scope: 'beverage',
        voiceKeyword: normKeyword(entry.voiceKeyword),
        voiceAliases: asList(entry.voiceAliases).map(normKeyword).filter(Boolean),
        active: entry.active !== false
      };
      if (!copy.voiceKeyword || !copy.sourceId) return;
      if (!copy.active) {
        pushMap(inactiveKeyword, copy.voiceKeyword, copy);
        return;
      }
      active.push(copy);
      pushMap(byKeyword, copy.voiceKeyword, copy);
      copy.voiceAliases.forEach(function (alias) { pushMap(byAlias, alias, copy); });
      bySource[copy.sourceType + ':' + copy.sourceId] = copy;
    });
    return {
      revision: revision || '',
      byKeyword: byKeyword,
      byAlias: byAlias,
      bySource: bySource,
      inactiveKeyword: inactiveKeyword,
      modifiers: Array.isArray(modifiers) ? modifiers : [],
      entryCount: active.length
    };
  }

  function assemble(control, chunkDocs) {
    control = control || {};
    var rev = String(control.activeRevision || '');
    var n = Number(control.chunkCount) || 0;
    function stale(reason) {
      return { revision: rev, stale: true, index: null, reason: reason };
    }
    if (!rev || !n) return stale('control');
    var docs = (chunkDocs || []).filter(function (d) { return !!d; });
    if (docs.length !== n) return stale('chunks');
    var sorted = docs.slice().sort(function (a, b) {
      return Number(a.chunkIndex) - Number(b.chunkIndex);
    });
    var i;
    var entries = [];
    for (i = 0; i < n; i++) {
      var doc = sorted[i];
      if (!doc) return stale('chunks');
      if (String(doc.revision || '') !== rev) return stale('revision');
      if (Number(doc.chunkIndex) !== i) return stale('index');
      if (Number(doc.chunkCount) !== n) return stale('count');
      entries = entries.concat(doc.entries || []);
    }
    var modifiers = (sorted[0] && sorted[0].modifiers) || [];
    return {
      revision: rev,
      stale: false,
      index: buildIndex(entries, modifiers, rev),
      reason: ''
    };
  }

  function takePosition(text) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    var m = s.match(/^(back\s+to\s+)?(\d{1,2})\s*([aA])?(?:\s+([\s\S]+))?$/i);
    if (!m) return { touched: false, seat: null, priority: false, body: s };
    var seat = Number(m[2]);
    if (!(seat >= 1 && seat <= 20)) return { touched: false, seat: null, priority: false, body: s };
    return {
      touched: true,
      seat: seat,
      priority: !!m[3],
      back: !!m[1],
      body: String(m[4] || '').trim()
    };
  }

  function serviceOf(body) {
    var n = normKeyword(body);
    if (n === 'PASS') return 'pass';
    if (n === 'NO DRINK') return 'noDrink';
    return '';
  }

  function spokenCode(body) {
    var s = String(body || '').trim().toLowerCase();
    var m = s.match(/^(vin|lin)\b[:#\-\s]*(.*)$/i);
    if (!m) return null;
    var rest = String(m[2] || '').replace(/\b(zero|oh|o|one|two|three|four|five|six|seven|eight|nine)\b/g, function (w) {
      return DIGITS[w] != null ? DIGITS[w] : w;
    });
    var code = rest.replace(/\D+/g, '');
    return { kind: m[1].toLowerCase(), code: code };
  }

  function editDistance(a, b) {
    if (a === b) return 0;
    if (!a || !b) return Math.max(a.length, b.length);
    if (Math.abs(a.length - b.length) > 2) return 3;
    var prev = [];
    var i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function finish(base, extra) {
    var out = {
      text: base.text,
      seat: base.seat,
      priority: !!base.priority,
      positionTouched: !!base.positionTouched,
      confidence: extra.confidence,
      kind: extra.kind || 'draft',
      code: extra.code || null,
      itemId: extra.itemId || '',
      name: extra.name || '',
      price: extra.price != null ? extra.price : null,
      need: extra.need || '',
      suggestion: extra.suggestion || '',
      candidates: extra.candidates || []
    };
    return out;
  }

  function candidate(it, entry) {
    return {
      id: it && it.id ? String(it.id) : (entry && entry.sourceId) || '',
      name: (it && it.name) || (entry && entry.voiceKeyword) || '',
      keyword: (entry && entry.voiceKeyword) || ''
    };
  }

  function judgeItem(base, item, extra) {
    extra = extra || {};
    if (!item) {
      return finish(base, { confidence: 'MISSING', kind: 'draft', need: 'not on the POS menu', code: extra.code || null });
    }
    var row = {
      code: extra.code || null,
      itemId: String(item.id || ''),
      name: String(item.name || ''),
      price: Number(item.price) || 0,
      candidates: [candidate(item)]
    };
    if (item.active === false) {
      row.confidence = 'MISSING';
      row.kind = 'draft';
      row.need = 'inactive';
      return finish(base, row);
    }
    if (item.eightySixed) {
      row.confidence = 'MISSING';
      row.kind = 'draft';
      row.need = '86 — not available';
      return finish(base, row);
    }
    var groups = modifierGroups(item);
    if (groups.length) {
      row.confidence = 'MISSING';
      row.kind = 'draft';
      row.need = groups.join(', ');
      return finish(base, row);
    }
    row.confidence = 'HIGH';
    row.kind = 'item';
    return finish(base, row);
  }

  function dedupe(items) {
    var seen = {};
    var out = [];
    (items || []).forEach(function (it) {
      if (!it) return;
      var id = String(it.id || '');
      if (!id || seen[id]) return;
      seen[id] = 1;
      out.push(it);
    });
    return out;
  }

  function itemsForEntry(entry, catalog) {
    var id = String(entry.sourceId || '');
    var hits = [];
    (catalog || []).forEach(function (it) {
      if (!it || !isBeverage(it)) return;
      if (String(it.id || '') === id) hits.push(it);
      else if (entry.sourceType === 'wine' && String(it.vin || it.code || '') === id) hits.push(it);
    });
    return dedupe(hits);
  }

  function fromEntries(base, entries, catalog) {
    if (!entries || !entries.length) return null;
    if (entries.length > 1) {
      return finish(base, {
        confidence: 'AMBIGUOUS',
        kind: 'draft',
        need: 'keyword',
        candidates: entries.map(function (e) { return candidate(null, e); })
      });
    }
    var hits = itemsForEntry(entries[0], catalog);
    if (!hits.length) {
      return finish(base, {
        confidence: 'MISSING',
        kind: 'draft',
        need: 'not on the POS menu',
        name: entries[0].voiceKeyword,
        candidates: [candidate(null, entries[0])]
      });
    }
    if (hits.length > 1) {
      return finish(base, {
        confidence: 'AMBIGUOUS',
        kind: 'draft',
        need: 'menu',
        candidates: hits.map(function (it) { return candidate(it, entries[0]); })
      });
    }
    return judgeItem(base, hits[0]);
  }

  function resolveCode(base, code, catalog) {
    if (!code.code) {
      return finish(base, { confidence: 'INVALID_CODE', kind: 'draft', code: code, need: String(code.kind || '').toUpperCase() });
    }
    var hits = [];
    (catalog || []).forEach(function (it) {
      if (!it || !isBeverage(it)) return;
      var vin = String(it.vin || '').trim();
      if (!vin && it.source === 'wine' && it.code) vin = String(it.code).trim();
      var lin = String(it.lin || '').trim();
      if (code.kind === 'vin' && vin && vin === code.code) hits.push(it);
      if (code.kind === 'lin' && lin && lin === code.code) hits.push(it);
    });
    hits = dedupe(hits);
    if (!hits.length) {
      return finish(base, { confidence: 'INVALID_CODE', kind: 'draft', code: code, need: code.kind.toUpperCase() + ' ' + code.code });
    }
    if (hits.length > 1) {
      return finish(base, {
        confidence: 'AMBIGUOUS',
        kind: 'draft',
        code: code,
        candidates: hits.map(function (it) { return candidate(it); })
      });
    }
    return judgeItem(base, hits[0], { code: code });
  }

  function exactNames(body, catalog) {
    var q = normKeyword(body);
    var hits = [];
    (catalog || []).forEach(function (it) {
      if (!it || !isBeverage(it)) return;
      if (normKeyword(it.name) === q) hits.push(it);
    });
    return dedupe(hits);
  }

  function fuzzySuggestion(query, index) {
    var q = normKeyword(query);
    if (q.length < 4) return '';
    var words = [];
    function add(map) {
      Object.keys(map || {}).forEach(function (key) {
        if (words.indexOf(key) < 0) words.push(key);
      });
    }
    add(index.byKeyword);
    add(index.byAlias);
    var best = [];
    var bestD = 3;
    words.forEach(function (word) {
      var d = editDistance(q, word);
      if (d < 1 || d > 2) return;
      if (d < bestD) {
        bestD = d;
        best = [word];
      } else if (d === bestD) best.push(word);
    });
    if (!best.length || best.length > 2) return '';
    return best.join(' OR ');
  }

  function resolveLanguage(base, body, opts) {
    var index = opts.index;
    var q = normKeyword(body);
    if (!q) return finish(base, { confidence: 'NO_MATCH', kind: 'draft' });
    var kw = index.byKeyword[q] || [];
    if (kw.length) return fromEntries(base, kw, opts.catalog);
    var inactive = index.inactiveKeyword[q] || [];
    if (inactive.length) {
      return finish(base, {
        confidence: 'MISSING',
        kind: 'draft',
        need: 'inactive',
        name: inactive[0].voiceKeyword,
        candidates: inactive.map(function (e) { return candidate(null, e); })
      });
    }
    var aliases = index.byAlias[q] || [];
    if (aliases.length) return fromEntries(base, aliases, opts.catalog);
    var names = exactNames(body, opts.catalog);
    if (names.length > 1) {
      return finish(base, {
        confidence: 'AMBIGUOUS',
        kind: 'draft',
        need: 'name',
        candidates: names.map(function (it) { return candidate(it); })
      });
    }
    if (names.length === 1) return judgeItem(base, names[0]);
    return finish(base, {
      confidence: 'NO_MATCH',
      kind: 'draft',
      suggestion: fuzzySuggestion(q, index)
    });
  }

  function parse(text, opts) {
    opts = opts || {};
    var raw = String(text || '').trim();
    var pos = takePosition(raw);
    var base = {
      text: raw,
      seat: pos.seat,
      priority: pos.priority,
      positionTouched: pos.touched
    };
    if (!raw) return finish(base, { confidence: 'NO_MATCH', kind: 'draft' });
    if (!pos.body) {
      if (pos.touched) return finish(base, { confidence: 'HIGH', kind: 'position' });
      return finish(base, { confidence: 'NO_MATCH', kind: 'draft' });
    }
    var service = serviceOf(pos.body);
    if (service) return finish(base, { confidence: 'HIGH', kind: service });
    var code = spokenCode(pos.body);
    if (code) return resolveCode(base, code, opts.catalog || []);
    if (opts.stale || !opts.index) {
      return finish(base, { confidence: 'STALE', kind: 'draft', need: 'vocabulary' });
    }
    return resolveLanguage(base, pos.body, opts);
  }

  var api = {
    CONFIDENCE: CONFIDENCE,
    normKeyword: normKeyword,
    isBeverage: isBeverage,
    modifierGroups: modifierGroups,
    buildIndex: buildIndex,
    assemble: assemble,
    spokenCode: spokenCode,
    parse: parse
  };

  root.EPICUREAN_VOICE_ENGINE = api;
  if (typeof globalThis !== 'undefined') globalThis.EPICUREAN_VOICE_ENGINE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
