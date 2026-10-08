/* Resolves a spoken phrase against the published BOH Voice vocabulary.
   Keywords and aliases win over words that merely appear in a dish name.
   A phrase that fits two different items is a draft, not a guess.
   This file does not send, fire, or invent a price. */
(function (root) {
  var FILLER = {
    A: 1, AN: 1, THE: 1, PLEASE: 1, THANKS: 1, THANK: 1, YOU: 1,
    OF: 1, AND: 1, FOR: 1, TO: 1, WITH: 1, ME: 1, US: 1, SOME: 1
  };
  var TEMPS = [
    ['MEDIUM RARE', ['MEDIUM RARE', 'MED RARE', 'MEDIUM-RARE', 'MR']],
    ['MEDIUM WELL', ['MEDIUM WELL', 'MED WELL', 'MEDIUM-WELL', 'MW']],
    ['WELL DONE', ['WELL DONE', 'WD']],
    ['MEDIUM', ['MEDIUM', 'M']],
    ['RARE', ['RARE', 'R']]
  ];
  var POUR = { GLASS: 'GLASS', TASTE: 'TASTE', BOTTLE: 'BOTTLE' };

  function norm(s) {
    return String(s == null ? '' : s)
      .toUpperCase()
      .replace(/[^\w\s0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(s) {
    var n = norm(s);
    return n ? n.split(' ').filter(function (word) { return !FILLER[word]; }) : [];
  }

  function covers(keyword, phrase) {
    var bag = phrase.slice();
    var i;
    for (i = 0; i < keyword.length; i++) {
      var at = bag.indexOf(keyword[i]);
      if (at < 0) return null;
      bag.splice(at, 1);
    }
    return bag;
  }

  function wordsOf(entry) {
    var out = [];
    function add(value) {
      var n = norm(value);
      if (n && out.indexOf(n) < 0) out.push(n);
    }
    if (!entry) return out;
    add(entry.voiceKeyword);
    (entry.voiceAliases || []).forEach(add);
    return out;
  }

  function resolveEntries(phrase, entries) {
    var phraseTokens = tokens(phrase);
    var best = [];
    var bestCover = 0;
    (entries || []).forEach(function (entry) {
      if (!entry || entry.active === false || !entry.sourceId) return;
      wordsOf(entry).forEach(function (word) {
        var keyword = word.split(' ').filter(Boolean);
        if (!keyword.length) return;
        var left = covers(keyword, phraseTokens);
        if (!left) return;
        if (keyword.length > bestCover) {
          bestCover = keyword.length;
          best = [];
        }
        if (keyword.length === bestCover) best.push({ entry: entry, left: left, word: word });
      });
    });
    var byId = {};
    best.forEach(function (hit) { byId[String(hit.entry.sourceId)] = hit; });
    var ids = Object.keys(byId);
    if (!ids.length) return { action: 'none' };
    if (ids.length > 1) {
      return {
        action: 'draft',
        reason: 'ambiguous',
        sourceIds: ids,
        names: ids.map(function (id) { return byId[id].entry.voiceKeyword; }),
        entries: ids.map(function (id) { return byId[id].entry; })
      };
    }
    var hit = byId[ids[0]];
    return {
      action: 'match',
      entry: hit.entry,
      sourceId: String(hit.entry.sourceId),
      keyword: hit.word,
      leftover: hit.left
    };
  }

  function stemAmbiguity(phraseTokens, entries) {
    var hits = {};
    (phraseTokens || []).forEach(function (token) {
      if (!token || token.length < 4) return;
      (entries || []).forEach(function (entry) {
        if (!entry || entry.active === false || !entry.sourceId) return;
        wordsOf(entry).forEach(function (word) {
          var parts = word.split(' ').filter(Boolean);
          if (parts.length < 2 || parts.indexOf(token) < 0) return;
          hits[String(entry.sourceId)] = entry;
        });
      });
    });
    var ids = Object.keys(hits);
    if (ids.length < 2) return { action: 'none' };
    return {
      action: 'draft',
      reason: 'ambiguous',
      sourceIds: ids,
      names: ids.map(function (id) { return hits[id].voiceKeyword; }),
      entries: ids.map(function (id) { return hits[id]; })
    };
  }

  function resolvePhrase(phrase, entries) {
    var hit = resolveEntries(phrase, entries);
    if (hit.action !== 'none') return hit;
    return stemAmbiguity(tokens(phrase), entries);
  }

  function narrowByName(result, phraseTokens, nameOf) {
    if (!result || result.action !== 'draft' || result.reason !== 'ambiguous' || typeof nameOf !== 'function') return result;
    var spoken = phraseTokens || [];
    var identity = [];
    var i;
    for (i = 0; i < spoken.length; i++) {
      if (/^(WITHOUT|NO|HOLD|ALLERGY|ALLERGIC|EXTRA)$/.test(spoken[i])) break;
      if (!instructionWord(spoken[i])) identity.push(spoken[i]);
    }
    if (!identity.length) return result;
    var winners = [];
    (result.entries || []).forEach(function (entry) {
      var nameTokens = tokens(nameOf(entry.sourceId, entry) || '');
      var bag = nameTokens.concat(tokens(entry.voiceKeyword));
      (entry.voiceAliases || []).forEach(function (alias) { bag = bag.concat(tokens(alias)); });
      var ok = identity.every(function (word) { return bag.indexOf(word) >= 0; });
      if (ok) winners.push({ entry: entry, nameTokens: nameTokens });
    });
    if (winners.length !== 1) return result;
    var win = winners[0];
    var keyword = tokens(win.entry.voiceKeyword);
    (win.entry.voiceAliases || []).forEach(function (alias) {
      tokens(alias).forEach(function (word) { if (keyword.indexOf(word) < 0) keyword.push(word); });
    });
    var left = [];
    spoken.forEach(function (word) {
      if (keyword.indexOf(word) >= 0) return;
      if (win.nameTokens.indexOf(word) >= 0) return;
      left.push(word);
    });
    return {
      action: 'match',
      entry: win.entry,
      sourceId: String(win.entry.sourceId),
      keyword: norm(win.entry.voiceKeyword),
      leftover: left
    };
  }

  function canonicalTemp(phrase) {
    var n = norm(phrase);
    var i, j;
    for (i = 0; i < TEMPS.length; i++) {
      if (n === TEMPS[i][0]) return TEMPS[i][0];
      for (j = 0; j < TEMPS[i][1].length; j++) {
        if (n === TEMPS[i][1][j]) return TEMPS[i][0];
      }
    }
    return '';
  }

  function tempChoice(phrase, options) {
    var canon = canonicalTemp(phrase);
    if (!canon) return '';
    var list = options || [];
    var aliases = [];
    var i, j;
    for (i = 0; i < TEMPS.length; i++) if (TEMPS[i][0] === canon) aliases = TEMPS[i][1];
    for (j = 0; j < aliases.length; j++) {
      var want = aliases[j];
      var hit = list.filter(function (opt) { return norm(opt) === want || norm(opt.name) === want; })[0];
      if (hit) return typeof hit === 'string' ? hit : hit.name;
    }
    return '';
  }

  function instructionWord(word) {
    if (POUR[word]) return true;
    if (/^(WITHOUT|NO|HOLD|ALLERGY|ALLERGIC|EXTRA|BY)$/.test(word)) return true;
    return !!canonicalTemp(word);
  }

  function classifyLeftover(words, options) {
    options = options || {};
    var notes = [];
    var temp = '';
    var pour = '';
    var unknown = [];
    var i = 0;
    while (i < (words || []).length) {
      var pair = words.slice(i, i + 2).join(' ');
      var triple = words.slice(i, i + 3).join(' ');
      var spokenTemp = tempChoice(triple, options.temps || []) || tempChoice(pair, options.temps || []) || tempChoice(words[i], options.temps || []);
      if (spokenTemp) {
        temp = spokenTemp;
        i += triple && tempChoice(triple, options.temps || []) ? 3 : (tempChoice(pair, options.temps || []) ? 2 : 1);
        continue;
      }
      if (words[i] === 'BY' && POUR[words[i + 1]]) {
        pour = POUR[words[i + 1]];
        i += 2;
        continue;
      }
      if (POUR[words[i]]) {
        pour = POUR[words[i]];
        i += 1;
        continue;
      }
      if (/^(WITHOUT|NO|HOLD|ALLERGY|ALLERGIC|EXTRA)$/.test(words[i])) {
        notes.push(words.slice(i).join(' ').toLowerCase());
        break;
      }
      unknown.push(words[i]);
      i += 1;
    }
    return { notes: notes.join(' · '), temp: temp, pour: pour, unknown: unknown };
  }

  function matchGroupOption(phrase, groups) {
    var spoken = norm(phrase);
    var hits = [];
    (groups || []).forEach(function (group) {
      var options = group.options || [];
      options.forEach(function (opt) {
        var name = norm(opt && opt.name != null ? opt.name : opt);
        var aliased = tempChoice(spoken, [name]) || (name === spoken ? (opt.name || opt) : '');
        if (!aliased && name !== spoken) return;
        hits.push({ group: group.name || group.group, option: opt.name || opt });
      });
      var viaTemp = tempChoice(spoken, options.map(function (opt) { return opt.name || opt; }));
      if (viaTemp) hits.push({ group: group.name || group.group, option: viaTemp });
    });
    var seen = {};
    var unique = [];
    hits.forEach(function (hit) {
      var key = hit.group + '=' + hit.option;
      if (seen[key]) return;
      seen[key] = 1;
      unique.push(hit);
    });
    if (unique.length === 1) return unique[0];
    if (unique.length > 1) return { ambiguous: true, hits: unique };
    return null;
  }

  var api = {
    norm: norm,
    tokens: tokens,
    resolveEntries: resolveEntries,
    resolvePhrase: resolvePhrase,
    narrowByName: narrowByName,
    classifyLeftover: classifyLeftover,
    tempChoice: tempChoice,
    canonicalTemp: canonicalTemp,
    matchGroupOption: matchGroupOption
  };
  root.EPICUREAN_VOICE_CATALOG = api;
  if (typeof globalThis !== 'undefined') globalThis.EPICUREAN_VOICE_CATALOG = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
