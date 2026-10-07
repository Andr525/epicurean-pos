/* Request adapter for the restaurant Voice endpoint.
   The Deepgram key arrives from the environment, which Secret Manager fills.
   This file never logs that value and never puts it in the response. */

import { voiceHttp, voiceRequestFromParts } from './http.js';

export function createVoiceHandler(env) {
  return async function voiceTranscribe(req, res) {
    const raw = req.rawBody || Buffer.alloc(0);
    const method = req.method || 'POST';
    const request = voiceRequestFromParts({
      method: method,
      origin: req.get ? (req.get('origin') || '') : '',
      contentType: req.get ? (req.get('content-type') || '') : '',
      authorization: req.get ? (req.get('authorization') || '') : '',
      body: method === 'GET' || method === 'HEAD' ? undefined : raw
    });
    const apiKey = typeof env.apiKey === 'function' ? env.apiKey() : env.apiKey;
    const response = await voiceHttp(request, {
      apiKey: apiKey,
      fetchImpl: env.fetchImpl,
      verifyToken: env.verifyToken
    });
    response.headers.forEach((value, key) => res.set(key, value));
    res.status(response.status).send(await response.text());
  };
}
