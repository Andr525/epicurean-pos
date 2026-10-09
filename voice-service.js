/* Speech acts for a table.
   Conversation stays conversation. An order needs a service instruction.
   Position 2 and position 2A stay distinct. The system's own confirmation
   is not a new order. No audio is stored here. */
(function (root) {
  var GUEST = /\b(i'll have|ill have|i will have|i'd like|id like|i would like|i want|we want|we'll have|we will have|can i get|could i get|let me get|i'll take|ill take|i'm going to have|im going to have)\b/i;
  var QUESTION = /\b(what is|what's|whats|what are|how is|how does|tell me about|tell me|describe|recommend|suggestion|do you have|can you explain|why is|is it|is the|does it)\b/i;
  var COURSE = /\b(appetizer|starter|first course|main course|entr[eé]e|dessert|cocktail)\b/i;

  function norm(s) {
    return String(s == null ? '' : s)
      .toUpperCase()
      .replace(/&/g, ' AND ')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function label(pos) {
    if (!pos) return '';
    return String(pos.seat) + (pos.priority ? 'A' : '');
  }

  function readPositions(text) {
    var tokens = norm(text).split(' ').filter(Boolean);
    var out = [];
    var i;
    for (i = 0; i < tokens.length; i++) {
      var glue = tokens[i].match(/^(\d{1,2})A$/);
      if (glue) {
        var seat = Number(glue[1]);
        if (seat >= 1 && seat <= 20) out.push({ seat: seat, priority: true, at: i, explicit: true });
        continue;
      }
      if ((tokens[i] === 'POSITION' || tokens[i] === 'SEAT') && /^\d{1,2}$/.test(tokens[i + 1] || '')) {
        var n = Number(tokens[i + 1]);
        if (n >= 1 && n <= 20) {
          out.push({ seat: n, priority: tokens[i + 2] === 'A', at: i + 1, explicit: true });
        }
        continue;
      }
      if (/^\d{1,2}$/.test(tokens[i]) && tokens[i - 1] !== 'POSITION' && tokens[i - 1] !== 'SEAT' && tokens[i - 1] !== 'VIN' && tokens[i - 1] !== 'LIN') {
        var bare = Number(tokens[i]);
        if (bare >= 1 && bare <= 20 && tokens[i + 1] !== 'A') out.push({ seat: bare, priority: false, at: i, explicit: false });
      }
    }
    return out;
  }

  function negated(tokens, pos, previousAt) {
    var from = previousAt == null ? Math.max(0, pos.at - 3) : previousAt + 1;
    var i;
    for (i = from; i < pos.at; i++) {
      if (tokens[i] === 'NOT' || tokens[i] === 'NO') return true;
    }
    return false;
  }

  function serviceFrame(text, positions) {
    if (/\b(position|seat|vin|lin)\b/i.test(text)) return true;
    if (positions.some(function (pos) { return pos.explicit; })) return true;
    if (COURSE.test(text) && positions.length) return true;
    return false;
  }

  function splitClauses(text) {
    var stripped = String(text || '').replace(/\bconfirm\b/ig, ' ').replace(/\s+/g, ' ').trim();
    if (!stripped) return [];
    return stripped.split(/\s*,\s*|\s+(?=(?:appetizer|starter|first course|main course|entr[eé]e|dessert|cocktail)\b)/i)
      .map(function (part) { return part.trim(); })
      .filter(Boolean);
  }

  function looksLikeWine(text) {
    var n = norm(text);
    if (/\b(19|20)\d{2}\b/.test(n)) return true;
    return /\b(WINE|BOTTLE|VINTAGE)\b/.test(n);
  }

  function classify(text) {
    var raw = String(text || '').trim();
    var tokens = norm(raw).split(' ').filter(Boolean);
    var positions = readPositions(raw);
    positions.forEach(function (pos, index) {
      var previous = index ? positions[index - 1].at : null;
      pos.negated = negated(tokens, pos, previous);
    });
    var rejected = positions.filter(function (pos) { return pos.negated; });
    var kept = positions.filter(function (pos) { return !pos.negated; });
    if (rejected.length && kept.length === 1) {
      var from = rejected[rejected.length - 1];
      var to = kept[0];
      if (from.seat !== to.seat || !!from.priority !== !!to.priority) {
        return { act: 'correction', from: from, to: to };
      }
    }
    if (rejected.length && !kept.length) {
      return { act: 'clarify', need: 'which position', name: rejected.map(label).join(' ') };
    }
    if (positions.length > 1 && !rejected.length && /\bor\b/i.test(raw) && !COURSE.test(raw)) {
      return { act: 'clarify', need: 'which position', name: positions.map(label).join(' or ') };
    }
    if ((GUEST.test(raw) || QUESTION.test(raw) || /\?\s*$/.test(raw)) && !serviceFrame(raw, positions)) {
      return { act: 'conversation' };
    }
    var confirm = /\bconfirm\b/i.test(raw);
    var clauses = splitClauses(raw);
    var framed = /\b(position|seat)\b/i.test(raw) || COURSE.test(raw);
    if (confirm && !clauses.length) return { act: 'confirm', only: true };
    if (clauses.length > 1 && framed) return { act: 'order', clauses: clauses, confirm: confirm };
    return { act: 'order', confirm: confirm };
  }

  function ownSpeech(text, echo, at, now) {
    if (!echo) return false;
    if (now - at > 8000) return false;
    var heard = norm(text);
    var spoken = norm(echo);
    if (!heard || !spoken) return false;
    if (heard === spoken) return true;
    return spoken.indexOf(heard) >= 0 && heard.length > 18;
  }

  var api = {
    norm: norm,
    label: label,
    readPositions: readPositions,
    classify: classify,
    looksLikeWine: looksLikeWine,
    ownSpeech: ownSpeech
  };
  root.EPICUREAN_VOICE_SERVICE = api;
  if (typeof globalThis !== 'undefined') globalThis.EPICUREAN_VOICE_SERVICE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
