/* HTTP edge for restaurant Voice.
   The phone posts one short clip. This checks size and origin, then the
   adapter calls Deepgram. The response is only the transcript. */

import { handleVoiceTranscribe } from './voice-transcribe.mjs';

export const VOICE_MAX_BYTES = 1500000;
export const VOICE_ORIGINS = [
  'https://andr525.github.io',
  'http://127.0.0.1:8765',
  'http://localhost:8765'
];

export function voiceCors(origin) {
  const allow = VOICE_ORIGINS.includes(origin) ? origin : 'https://andr525.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

function json(status, body, headers) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers)
  });
}

export function voiceRequestFromParts(parts) {
  parts = parts || {};
  const method = parts.method || 'POST';
  const headers = {
    origin: parts.origin || '',
    authorization: parts.authorization || ''
  };
  if (parts.contentType) headers['content-type'] = parts.contentType;
  const init = { method: method, headers: headers };
  if (method !== 'GET' && method !== 'HEAD' && parts.body != null) init.body = parts.body;
  return new Request('https://voice.internal/transcribe', init);
}

export async function voiceHttp(request, env) {
  const headers = voiceCors(request.headers.get('origin') || '');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers });
  if (request.method !== 'POST') return json(405, { error: 'method' }, headers);
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > VOICE_MAX_BYTES) return json(413, { error: 'audio' }, headers);
  const bytes = await request.clone().arrayBuffer();
  if (bytes.byteLength > VOICE_MAX_BYTES) return json(413, { error: 'audio' }, headers);
  const response = await handleVoiceTranscribe(request, env);
  const out = new Headers(response.headers);
  Object.keys(headers).forEach((key) => out.set(key, headers[key]));
  return new Response(response.body, { status: response.status, headers: out });
}
