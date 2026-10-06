import assert from 'node:assert/strict';
import {
  selectVoiceKeyterms,
  deepgramListenUrl,
  transcriptFromDeepgram,
  transcribeRestaurantClip,
  handleVoiceTranscribe
} from '../server/voice-transcribe.mjs';

const terms = selectVoiceKeyterms([
  'PROSECCO',
  'red',
  'Clau de Nell',
  'Château Lafite',
  'PINOT',
  ...Array.from({ length: 200 }, (_, i) => 'WORD' + i)
]);
assert.ok(terms.length <= 100);
assert.ok(terms.includes('3A'));
assert.ok(terms.includes('VIN'));
assert.ok(terms.includes('no drink'));
assert.ok(terms.includes('Clau de Nell'));
assert.ok(terms.includes('Château Lafite'));
assert.equal(terms.includes('red'), false);
const tokens = terms.reduce((sum, term) => sum + term.split(' ').length, 0);
assert.ok(tokens <= 480);

const url = deepgramListenUrl(terms);
assert.match(url, /^https:\/\/api\.deepgram\.com\/v1\/listen\?/);
assert.match(url, /model=nova-3/);
assert.match(url, /language=multi/);
assert.match(url, /numerals=true/);
assert.match(url, /mip_opt_out=true/);
assert.match(url, /keyterm=3A/);
assert.match(url, /keyterm=Clau%20de%20Nell/);
assert.equal(url.includes('Token'), false);

assert.equal(transcriptFromDeepgram({
  results: { channels: [{ alternatives: [{ transcript: '3A VIN 2148' }] }] }
}), '3A VIN 2148');
assert.equal(transcriptFromDeepgram({}), '');

let seen = null;
const transcript = await transcribeRestaurantClip({
  apiKey: 'secret-key',
  audio: new Uint8Array([1, 2, 3]),
  mime: 'audio/mp4',
  keywords: ['Prosecco'],
  fetchImpl: async (listenUrl, init) => {
    seen = { listenUrl, init };
    return new Response(JSON.stringify({
      results: { channels: [{ alternatives: [{ transcript: '3A Prosecco' }] }] }
    }), { status: 200 });
  }
});
assert.equal(transcript, '3A Prosecco');
assert.equal(seen.init.headers.Authorization, 'Token secret-key');
assert.equal(seen.init.headers['Content-Type'], 'audio/mp4');
assert.match(seen.listenUrl, /keyterm=Prosecco/);
assert.equal(JSON.stringify(seen).includes('secret-key') && seen.listenUrl.includes('secret-key'), false);

const denied = await handleVoiceTranscribe(new Request('https://pos.example/voice', { method: 'POST' }), {
  apiKey: 'secret-key',
  fetchImpl: async () => { throw new Error('should not call'); }
});
assert.equal(denied.status, 401);

const form = new FormData();
form.append('audio', new Blob([new Uint8Array([9])], { type: 'audio/mp4' }), 'utterance.m4a');
form.append('keyterms', JSON.stringify(['Krug', 'Prosecco']));
const ok = await handleVoiceTranscribe(new Request('https://pos.example/voice', {
  method: 'POST',
  headers: { Authorization: 'Bearer firebase-token' },
  body: form
}), {
  apiKey: 'secret-key',
  verifyToken: async (header) => header === 'Bearer firebase-token',
  fetchImpl: async () => new Response(JSON.stringify({
    results: { channels: [{ alternatives: [{ transcript: '7A no drink' }] }] }
  }), { status: 200 })
});
assert.equal(ok.status, 200);
const payload = await ok.json();
assert.deepEqual(payload, { transcript: '7A no drink' });
assert.equal(JSON.stringify(payload).includes('secret-key'), false);

console.log('voice-transcribe tests passed');
