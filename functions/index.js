/* Restaurant Voice endpoint.
   DEEPGRAM_API_KEY is read from Secret Manager at runtime.
   The value is never logged and never returned to the phone. */

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { voiceHttp, voiceRequestFromParts } from './http.js';

initializeApp();
const deepgramKey = defineSecret('DEEPGRAM_API_KEY');
const PROJECT = 'epicurean-house-at-the-choc-st';

async function verifyProjectToken(header) {
  const match = /^Bearer\s+(\S+)/.exec(header || '');
  if (!match) return false;
  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    return !!(decoded && decoded.aud === PROJECT);
  } catch (err) {
    return false;
  }
}

export const voiceTranscribe = onRequest({
  region: 'us-central1',
  timeoutSeconds: 30,
  memory: '256MiB',
  maxInstances: 5,
  secrets: [deepgramKey],
  invoker: 'public',
  cors: false
}, async (req, res) => {
  const raw = req.rawBody || Buffer.alloc(0);
  const request = voiceRequestFromParts({
    method: req.method,
    origin: req.get('origin') || '',
    contentType: req.get('content-type') || '',
    authorization: req.get('authorization') || '',
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : raw
  });
  const response = await voiceHttp(request, {
    apiKey: deepgramKey.value(),
    fetchImpl: fetch,
    verifyToken: verifyProjectToken
  });
  response.headers.forEach((value, key) => res.set(key, value));
  res.status(response.status).send(await response.text());
});
