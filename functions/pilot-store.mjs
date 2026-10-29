import { randomUUID } from 'node:crypto';
import { copy } from './pilot-authority.mjs';
export class MemorySessions {
 constructor(){this.sessions=new Map();}
 async create(s){this.sessions.set(s.id,copy(s));}
 async read(id){const s=this.sessions.get(id);if(!s)throw new Error('Session unavailable');return copy(s);}
 async claim(id,requestId,fingerprint,revision){
  const s=this.sessions.get(id);if(!s)throw new Error('Session unavailable');
  const cached=Object.hasOwn(s.requests,requestId)?s.requests[requestId]:null;if(cached){if(cached.fingerprint!==fingerprint)throw new Error('Request identity reused');return {cached:copy(cached.result)};}
  if(s.revision!==revision||s.busy)throw new Error('Session changed or previous command is pending');
  const nonce=randomUUID();s.busy={nonce,requestId};return {session:copy(s),nonce};
 }
 async finish(id,nonce,next,requestId,fingerprint,result){
  const s=this.sessions.get(id);if(!s||s.busy?.nonce!==nonce)throw new Error('Interrupted command result discarded');
  next.busy=null;next.requests={...s.requests,[requestId]:{fingerprint,result:copy(result)}};
  for(const key of Object.keys(next.requests).slice(0,-64))delete next.requests[key];
  this.sessions.set(id,copy(next));return result;
 }
 async interrupt(id,uid){const s=this.sessions.get(id);if(!s||s.uid!==uid)throw new Error('Session unavailable');s.busy=null;s.revision++;s.phase='interrupted';s.question=null;return copy(s);}
}
export class FirestoreSessions {
 constructor(db){this.db=db;this.ref=id=>db.collection('voice_pilot_sessions').doc(id);}
 async create(s){await this.ref(s.id).create(s);}
 async read(id){const s=await this.ref(id).get();if(!s.exists)throw new Error('Session unavailable');return s.data();}
 async claim(id,requestId,fingerprint,revision){return this.db.runTransaction(async tx=>{
  const ref=this.ref(id),snap=await tx.get(ref);if(!snap.exists)throw new Error('Session unavailable');const s=snap.data(),cached=Object.hasOwn(s.requests,requestId)?s.requests[requestId]:null;
  if(cached){if(cached.fingerprint!==fingerprint)throw new Error('Request identity reused');return {cached:cached.result};}
  if(s.revision!==revision||s.busy)throw new Error('Session changed or previous command is pending');
  const nonce=randomUUID();tx.update(ref,{busy:{nonce,requestId}});return {session:s,nonce};
 });}
 async finish(id,nonce,next,requestId,fingerprint,result){return this.db.runTransaction(async tx=>{
  const ref=this.ref(id),snap=await tx.get(ref),s=snap.data();if(s?.busy?.nonce!==nonce)throw new Error('Interrupted command result discarded');
  next.busy=null;next.requests={...s.requests,[requestId]:{fingerprint,result}};
  for(const key of Object.keys(next.requests).slice(0,-64))delete next.requests[key];tx.set(ref,next);return result;
 });}
 async interrupt(id,uid){return this.db.runTransaction(async tx=>{const ref=this.ref(id),snap=await tx.get(ref),s=snap.data();if(!s||s.uid!==uid)throw new Error('Session unavailable');s.busy=null;s.revision++;s.phase='interrupted';s.question=null;tx.set(ref,s);return s;});}
}
