import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { voiceHttp, voiceRequestFromParts, VOICE_MAX_BYTES } from '../functions/http.js';
import { createVoiceHandler } from '../functions/handler.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = fs.readFileSync(path.join(root, 'server/voice-transcribe.mjs'), 'utf8');
const deployed = fs.readFileSync(path.join(root, 'functions/voice-transcribe.mjs'), 'utf8');
assert.equal(server, deployed);
const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(index, /process\.env\.DEEPGRAM_API_KEY/);
assert.equal(index.includes('console.'), false);
assert.equal(index.includes('api.deepgram.com'), false);
assert.equal(html.includes('DEEPGRAM_API_KEY'), false);
assert.equal(html.includes('api.deepgram.com'), false);

const preflight = await voiceHttp(new Request('https://voice.internal/transcribe', {
  method: 'OPTIONS',
  headers: { Origin: 'https://andr525.github.io' }
}), { apiKey: 'secret-key', fetchImpl: async () => { throw new Error('should not call'); } });
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://andr525.github.io');

const denied = await voiceHttp(new Request('https://voice.internal/transcribe', {
  method: 'POST',
  headers: { Origin: 'https://andr525.github.io' }
}), { apiKey: 'secret-key', fetchImpl: async () => { throw new Error('should not call'); } });
assert.equal(denied.status, 401);
assert.equal((await denied.text()).includes('secret-key'), false);

let called = 0;
const badToken = await voiceHttp(new Request('https://voice.internal/transcribe', {
  method: 'POST',
  headers: { Authorization: 'Bearer nope', Origin: 'https://andr525.github.io' }
}), {
  apiKey: 'secret-key',
  verifyToken: async () => false,
  fetchImpl: async () => { called += 1; throw new Error('should not call'); }
});
assert.equal(badToken.status, 401);
assert.equal(called, 0);

const tooBig = await voiceHttp(new Request('https://voice.internal/transcribe', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer firebase-token',
    Origin: 'https://andr525.github.io',
    'Content-Type': 'audio/mp4'
  },
  body: new Uint8Array(VOICE_MAX_BYTES + 1)
}), {
  apiKey: 'secret-key',
  verifyToken: async () => true,
  fetchImpl: async () => { throw new Error('should not call'); }
});
assert.equal(tooBig.status, 413);

const form = new FormData();
form.append('audio', new Blob([new Uint8Array([9, 8, 7])], { type: 'audio/mp4' }), 'utterance.m4a');
form.append('keyterms', JSON.stringify(['Krug']));
const ok = await voiceHttp(new Request('https://voice.internal/transcribe', {
  method: 'POST',
  headers: { Authorization: 'Bearer firebase-token', Origin: 'http://127.0.0.1:8765' },
  body: form
}), {
  apiKey: 'secret-key',
  verifyToken: async (header) => header === 'Bearer firebase-token',
  fetchImpl: async (url, init) => {
    assert.equal(init.headers.Authorization, 'Token secret-key');
    assert.equal(String(url).includes('secret-key'), false);
    return new Response(JSON.stringify({
      results: { channels: [{ alternatives: [{ transcript: '3A VIN 2148' }] }] }
    }), { status: 200 });
  }
});
assert.equal(ok.status, 200);
assert.equal(ok.headers.get('access-control-allow-origin'), 'http://127.0.0.1:8765');
const payload = await ok.json();
assert.deepEqual(payload, { transcript: '3A VIN 2148' });
assert.equal(JSON.stringify(payload).includes('secret-key'), false);

const rawForm = new FormData();
rawForm.append('audio', new Blob([new Uint8Array([4, 5, 6])], { type: 'audio/mp4' }), 'utterance.m4a');
rawForm.append('keyterms', JSON.stringify(['3A', 'VIN']));
const rawRequest = new Request('https://voice.internal/transcribe', { method: 'POST', body: rawForm });
const rawBytes = Buffer.from(await rawRequest.arrayBuffer());
const rebuilt = voiceRequestFromParts({
  method: 'POST',
  origin: 'https://andr525.github.io',
  contentType: rawRequest.headers.get('content-type'),
  authorization: 'Bearer firebase-token',
  body: rawBytes
});
const rebuiltOk = await voiceHttp(rebuilt, {
  apiKey: 'secret-key',
  verifyToken: async () => true,
  fetchImpl: async () => new Response(JSON.stringify({
    results: { channels: [{ alternatives: [{ transcript: '3A VIN 2148' }] }] }
  }), { status: 200 })
});
assert.equal(rebuiltOk.status, 200);
assert.deepEqual(await rebuiltOk.json(), { transcript: '3A VIN 2148' });

const handler = createVoiceHandler({
  apiKey: function () { return 'secret-key'; },
  verifyToken: async () => true,
  fetchImpl: async (url) => {
    assert.equal(String(url).includes('secret-key'), false);
    return new Response(JSON.stringify({
      results: { channels: [{ alternatives: [{ transcript: '3A VIN 2148' }] }] }
    }), { status: 200 });
  }
});
const posted = new FormData();
posted.append('audio', new Blob([new Uint8Array([1, 2])], { type: 'audio/mp4' }), 'utterance.m4a');
posted.append('keyterms', JSON.stringify(['VIN']));
const postedReq = new Request('https://voice.internal/transcribe', { method: 'POST', body: posted });
const postedType = postedReq.headers.get('content-type');
const postedBody = Buffer.from(await postedReq.arrayBuffer());
const sent = {};
await handler({
  method: 'POST',
  rawBody: postedBody,
  get: function (name) {
    const headers = {
      origin: 'https://andr525.github.io',
      'content-type': postedType,
      authorization: 'Bearer firebase-token'
    };
    return headers[String(name).toLowerCase()] || '';
  }
}, {
  set: function (key, value) { sent[key] = value; },
  status: function (code) { sent.status = code; return this; },
  send: function (body) { sent.body = body; }
});
assert.equal(sent.status, 200);
assert.equal(sent.body.includes('secret-key'), false);
assert.equal(JSON.parse(sent.body).transcript, '3A VIN 2148');

console.log('voice-http tests passed');
