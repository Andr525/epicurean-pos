/* Restaurant Voice transcription.
   The phone records one short utterance. This module sends it to Deepgram
   Nova-3 and returns text for the existing Voice parser. It never sends or fires.
   The Deepgram key stays on the server. */

export const VOICE_COMMAND_TERMS = [
  '1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A',
  'VIN', 'LIN', 'no drink'
];

function cleanTerm(term) {
  return String(term == null ? '' : term).replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
}

function termTokens(term) {
  const parts = cleanTerm(term).split(' ').filter(Boolean);
  return Math.max(1, parts.length);
}

function rarity(term) {
  if (/[^\u0000-\u007f]/i.test(term)) return 0;
  if (term.split(' ').length >= 2) return 1;
  if (term.length >= 8) return 2;
  return 3;
}

export function selectVoiceKeyterms(keywords, limits) {
  const maxTerms = (limits && limits.maxTerms) || 100;
  const maxTokens = (limits && limits.maxTokens) || 480;
  const out = [];
  const seen = new Set();
  function tokens() {
    return out.reduce((sum, term) => sum + termTokens(term), 0);
  }
  function add(term) {
    const text = cleanTerm(term);
    if (!text || text.length > 48) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    if (out.length + 1 > maxTerms) return;
    if (tokens() + termTokens(text) > maxTokens) return;
    seen.add(key);
    out.push(text);
  }
  VOICE_COMMAND_TERMS.forEach(add);
  const ranked = (Array.isArray(keywords) ? keywords : []).map(cleanTerm).filter(Boolean);
  ranked.sort((a, b) => rarity(a) - rarity(b) || b.length - a.length);
  ranked.forEach(add);
  return out;
}

export function keywordsFromField(value) {
  if (Array.isArray(value)) return value.slice(0, 400);
  if (value == null || value === '') return [];
  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) return parsed.slice(0, 400);
  } catch (e) {}
  return [];
}

export function deepgramListenUrl(keyterms) {
  const params = new URLSearchParams();
  params.set('model', 'nova-3');
  params.set('language', 'multi');
  params.set('numerals', 'true');
  params.set('punctuate', 'false');
  params.set('smart_format', 'false');
  params.set('mip_opt_out', 'true');
  const extra = (keyterms || []).map((term) => 'keyterm=' + encodeURIComponent(term)).join('&');
  const base = 'https://api.deepgram.com/v1/listen?' + params.toString();
  return extra ? base + '&' + extra : base;
}

export function transcriptFromDeepgram(body) {
  const channel = body && body.results && body.results.channels && body.results.channels[0];
  const alt = channel && channel.alternatives && channel.alternatives[0];
  return alt && alt.transcript ? String(alt.transcript).trim() : '';
}

export async function transcribeRestaurantClip(options) {
  options = options || {};
  if (!options.apiKey) throw new Error('missing key');
  const keyterms = selectVoiceKeyterms(options.keywords || []);
  const fetchImpl = options.fetchImpl;
  if (!fetchImpl) throw new Error('missing fetch');
  const response = await fetchImpl(deepgramListenUrl(keyterms), {
    method: 'POST',
    headers: {
      Authorization: 'Token ' + options.apiKey,
      'Content-Type': options.mime || 'audio/mp4'
    },
    body: options.audio
  });
  if (!response.ok) throw new Error('transcribe');
  return transcriptFromDeepgram(await response.json());
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleVoiceTranscribe(request, env) {
  env = env || {};
  const auth = (request.headers.get('authorization') || '');
  if (!/^Bearer\s+\S+/.test(auth)) return jsonResponse(401, { error: 'auth' });
  if (env.verifyToken) {
    const ok = await env.verifyToken(auth);
    if (!ok) return jsonResponse(401, { error: 'auth' });
  }
  const form = await request.formData();
  const audio = form.get('audio');
  if (!audio) return jsonResponse(400, { error: 'audio' });
  try {
    const transcript = await transcribeRestaurantClip({
      apiKey: env.apiKey,
      audio: audio,
      mime: audio.type || 'audio/mp4',
      keywords: keywordsFromField(form.get('keyterms')),
      fetchImpl: env.fetchImpl
    });
    return jsonResponse(200, { transcript: transcript });
  } catch (e) {
    return jsonResponse(502, { error: 'transcribe' });
  }
}
