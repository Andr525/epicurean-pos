import { randomUUID } from 'node:crypto';
import { copy,digest,validateOperation,kitchenEnvelope } from './pilot-authority.mjs';
const publicState=s=>({sessionId:s.id,revision:s.revision,phase:s.phase,proposal:s.proposal,question:s.question,pricing:s.pricing,catalogRevision:s.catalogRevision,positions:s.positions});
const guest= /\b(i(?:'ll| will| want| would like|d like)|we(?:'ll| will| want)|can i get|what do you recommend|tell me about|is the|what is)\b/i;
export function createPilotService({mode='disabled',authorize,loadAuthority,store,interpret,now=Date.now}) {
 return async (body,authHeader)=>{
  if(mode==='disabled')throw new Error('Conversational pilot disabled');
  if(!body||typeof body!=='object'||JSON.stringify(body).length>16000)throw new Error('Invalid or oversized request');
  if(Object.keys(body).some(k=>!['action','sessionId','requestId','revision','text','checkId','table','pricing'].includes(k)))throw new Error('Unexpected request field');
  const staff=await authorize(authHeader);
  if(!staff?.uid||!staff.foodmaster||!Array.isArray(staff.tables))throw new Error('Authorized Foodmaster account required');
  if(body.action==='open'){
   if(!staff.tables.includes(String(body.table)))throw new Error('Table not authorized');
   const authority=await loadAuthority({checkId:body.checkId,table:String(body.table)});
   if(body.pricing!=='a-la-carte'&&body.pricing!=='pf_scalini_89')throw new Error('Pilot supports only the audited Scalini menu');
   if(body.pricing!=='a-la-carte'&&!authority.menus.some(m=>m.id===body.pricing&&m.price>0))throw new Error('BOH pricing basis unavailable');
   const session={id:randomUUID(),uid:staff.uid,table:authority.table,checkId:authority.checkId,pricing:body.pricing,positions:authority.seats,catalogRevision:authority.revision,checkRevision:digest({revision:authority.checkRevision,allergies:authority.allergies}),
    revision:0,phase:'idle',proposal:[],question:null,history:[],requests:{},busy:null,turnCount:0,expiresAt:now()+30*60*1000};
   await store.create(session);return publicState(session);
  }
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(body.sessionId||''))throw new Error('Invalid session');
  let session=await store.read(body.sessionId);
  if(session.uid!==staff.uid||!staff.tables.includes(session.table)||session.expiresAt<now())throw new Error('Session unauthorized or expired');
  if(body.action==='interrupt')return publicState(await store.interrupt(session.id,staff.uid));
  if(!['turn','confirm','cancel'].includes(body.action)||!Number.isInteger(body.revision)||!/^[a-zA-Z0-9_-]{1,100}$/.test(body.requestId||''))throw new Error('Invalid command identity');
  const fingerprint=digest(body),claim=await store.claim(session.id,body.requestId,fingerprint,body.revision);
  if(claim.cached)return claim.cached;
  session=claim.session;
  const finish=async extra=>{
   session.revision++;return store.finish(session.id,claim.nonce,session,body.requestId,fingerprint,{...publicState(session),...extra});
  };
  try {
   if(body.action==='cancel'){session.proposal=[];session.confirmedEnvelope=null;session.question=null;session.phase='idle';return await finish({});}
   const authority=await loadAuthority({checkId:session.checkId,table:session.table});
   if(digest({revision:authority.checkRevision,allergies:authority.allergies})!==session.checkRevision||authority.revision!==session.catalogRevision||JSON.stringify(authority.seats)!==JSON.stringify(session.positions))throw new Error('BOH or positions changed; open a fresh session');
   if(body.action==='confirm'){
    if(session.confirmedEnvelope)return await finish({envelope:session.confirmedEnvelope});
    if(!session.proposal.length||session.question)throw new Error('Resolve the entire session before confirming');
    session.proposal.forEach(op=>validateOperation({...op,action:'add',target:null},authority,session.pricing,session.proposal));
    const envelope=kitchenEnvelope(session,authority,randomUUID());session.phase='confirmed';session.confirmedEnvelope=envelope;return await finish({envelope});
   }
   if(typeof body.text!=='string'||!body.text.trim()||body.text.length>2000)throw new Error('Invalid transcript');
   const raw=body.text.trim(),explicit=/^food\s*master\b[,:]?/i.test(raw),correction=/^(?:no[, ]|actually\b|change\b|replace\b|make\b|remove\b)/i.test(raw);
   if((!explicit&&guest.test(raw))||(!explicit&&!session.question&&!(correction&&session.proposal.length)))return await finish({conversation:true});
   if(++session.turnCount>20)throw new Error('Session turn limit reached');
   const text=raw.replace(/^food\s*master\b[,:]?\s*/i,'');
   const proposal=copy(session.proposal),history=[...session.history,{role:'user',text}].slice(-8);
   const candidates=authority.items.filter(i=>session.pricing==='a-la-carte'?i.price>0:i.menuIds.includes(session.pricing));
   if(candidates.length>300)throw new Error('BOH candidate set exceeds bounded context; narrow the menu');
   const result=await interpret({text,context:{table:session.table,catalog:authority.revision,pricing:session.pricing,seats:authority.seats,question:session.question},catalog:candidates,proposal,history,
    requestId:session.id+'-'+body.requestId});
   if(!result||typeof result!=='object'||Object.keys(result).some(k=>!['operations','clarification'].includes(k))||!Array.isArray(result.operations)||result.operations.length>12||!(result.clarification===null||typeof result.clarification==='string'))throw new Error('Invalid interpreter response');
   session.history=history;
   if(result.clarification){
    if(result.operations.length)throw new Error('Partial interpretation rejected: question and operations cannot coexist');
    if(result.clarification.length>300)throw new Error('Question too long');
    session.question=result.clarification;session.phase='clarify';return await finish({});
   }
   if(!result.operations.length)throw new Error('Interpreter returned no complete instructions');
   const validated=result.operations.map(op=>validateOperation(op,authority,session.pricing,proposal));
   const next=copy(proposal),targets=new Set();
   for(const [i,op] of validated.entries()){
    if(op.action!=='add'){
     if(targets.has(op.target))throw new Error('Conflicting correction targets');targets.add(op.target);
     const at=next.findIndex(p=>p.proposalId===op.target);
     if(at<0)throw new Error('Correction target changed');
     if(op.action==='remove')next.splice(at,1);
     else next[at]={...op,action:'add',target:null,proposalId:next[at].proposalId};
    }else next.push({...op,proposalId:session.id+'-'+session.revision+'-'+i});
   }
   if(next.length>40)throw new Error('Session order limit reached');
   // A prix-fixe guest cannot acquire a second included dish through a mistaken "add" correction.
   if(session.pricing!=='a-la-carte'&&new Set(next.map(p=>p.seat+'-'+p.course)).size!==next.length)throw new Error('Duplicate included course; use an explicit correction');
   session.proposal=next;session.confirmedEnvelope=null;session.question=null;session.phase='review';return await finish({});
  } catch(error){
   session.phase='clarify';session.question=error.message;
   // Never replace a proposal with a partially validated response. Late work cannot overwrite interruption.
   return await finish({error:error.message});
  }
 };
}
export function createPilotHandler(service){
 return async(request)=>{
  const origin=request.headers.get('origin')||'';
  const local=/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
  const cors=local?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'}:{};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return Response.json({error:'POST required'},{status:405,headers:cors});
  try{
   if(Number(request.headers.get('content-length'))>16000)throw new Error('Request too large');
   const text=await request.text();if(Buffer.byteLength(text)>16000)throw new Error('Request too large');
   const result=await service(JSON.parse(text),request.headers.get('authorization')||'');
   return Response.json(result,{headers:cors});
  }catch(e){return Response.json({error:e.message},{status:/authorized|Foodmaster/.test(e.message)?403:/disabled/.test(e.message)?503:409,headers:cors});}
 };
}
