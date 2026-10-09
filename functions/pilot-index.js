/* Separate pilot entry point; not the existing production functions/index.js.
   Defaults disabled. No real provider is enabled by registering this file. */
import { http } from '@google-cloud/functions-framework';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { createPilotHandler,createPilotService } from './pilot-service.mjs';
import { firestoreAuthority } from './pilot-authority.mjs';
import { FirestoreSessions } from './pilot-store.mjs';
import { FirestoreBudget,requirePaidApproval } from './pilot-budget.mjs';
import { paidInterpreter } from './pilot-provider.mjs';
const policy=JSON.parse(readFileSync(new URL('../pilot/provider-policy.json',import.meta.url),'utf8'));
const live=process.env.VOICE_PILOT_MODE==='approved-live';
if(live){requirePaidApproval(policy);throw new Error("Live pilot locked: STT ledger, session quota and POS delivery acceptance outstanding");}
// Never infer a production project from ambient credentials.
if(live && process.env.GOOGLE_CLOUD_PROJECT!==policy.projectId)throw new Error("Isolated project mismatch");
initializeApp({projectId:live?policy.projectId:"voice-pilot-disabled"});
const db=getFirestore();
const authorize=async header=>{
 const token=/^Bearer (\S+)$/.exec(header||'');if(!token)return null;
 const user=await getAuth().verifyIdToken(token[1],true);
 const binding=await db.collection('voice_pilot_staff').doc(user.uid).get();
 const staff=binding.data();
 return staff?.enabled&&staff.roles?.includes('foodmaster')?{uid:user.uid,foodmaster:true,tables:staff.tables||[]}:null;
};
const handler=createPilotHandler(createPilotService({mode:live?'approved-live':'disabled',authorize,loadAuthority:firestoreAuthority(db),store:new FirestoreSessions(db),
 interpret:paidInterpreter({policy,budget:new FirestoreBudget(db,'initial-25-usd'),apiKey:process.env.VOICE_LLM_API_KEY})}));
http('voicePilot',async(req,res)=>{
 const response=await handler(new Request('http://pilot.internal/session',{method:req.method,headers:{authorization:req.get('authorization')||'',origin:req.get('origin')||'','content-type':'application/json'},
  ...(req.method==='GET'||req.method==='HEAD'?{}:{body:req.rawBody||Buffer.alloc(0)})}));
 response.headers.forEach((v,k)=>res.set(k,v));res.status(response.status).send(await response.text());
});
