/* Restaurant Voice endpoint.
   DEEPGRAM_API_KEY is injected from Secret Manager. It is never logged. */

import { http } from '@google-cloud/functions-framework';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createVoiceHandler } from './handler.js';

initializeApp();
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

http('voiceTranscribe', createVoiceHandler({
  apiKey: function () { return process.env.DEEPGRAM_API_KEY || ''; },
  fetchImpl: fetch,
  verifyToken: verifyProjectToken
}));
